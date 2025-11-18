/**
 * GeneralUserAgent (GUM Implementation)
 * 
 * Purpose: Strategic, long-term user modeling that answers "Who is this user, and what are their holistic goals?"
 * 
 * Inspired by: "Creating General User Models from Computer Use" (Shaikh et al., UIST 2025)
 * 
 * Key Features:
 * - Maintains confidence-weighted propositions about user context, goals, preferences
 * - Runs periodically (every 60s) to update beliefs based on full interaction history
 * - Complements PerceptionAgent (tactical struggle) with strategic intent understanding
 * - Stores propositions persistently in chrome.storage.local
 * 
 * Architecture:
 * 1. Observe: Collect interaction history + page content
 * 2. Infer: Use LLM to generate/revise propositions with confidence scores
 * 3. Store: Persist propositions with decay rates and grounding observations
 * 4. Query: Allow other agents to search for relevant user context
 * 
 * Integration Points:
 * - PerceptionAgent: Provides full interaction buffer (not just struggles)
 * - OrchestratorAgent: Queries GUM for strategic context before showing guidance
 * - HierarchicalGuidanceUI: Shows GUM propositions for transparency (G11)
 */

import type {
  UserInteractionEvent,
  ExtractedData,
} from '../types';
import {
  logger,
  generateId,
} from '../utils';

// ============================================================================
// GUM Type Definitions
// ============================================================================

/**
 * A confidence-weighted natural language proposition about the user
 * Core abstraction of the GUM framework
 */
export interface Proposition {
  id: string;
  text: string; // Natural language statement (e.g., "User is a Ph.D. student")
  confidence: number; // 0-1
  createdAt: number;
  updatedAt: number;
  decayScore: number; // 0-1, how quickly this becomes stale (1.0 = stable, 0.1 = ephemeral)
  grounding: {
    observations: string[]; // IDs of observations that support this proposition
    reasoning: string; // Generated explanation of why this proposition was inferred
  };
  category?: 'identity' | 'goal' | 'preference' | 'context' | 'activity'; // Optional semantic tag
}

/**
 * Raw observation that feeds into GUM
 * Can be any unstructured data: screenshots, interactions, text, etc.
 */
export interface Observation {
  id: string;
  source: 'interaction' | 'page_content' | 'screenshot' | 'custom';
  timestamp: number;
  data: any; // Flexible: could be UserInteractionEvent[], string (page text), base64 (image), etc.
  metadata?: {
    pageURL?: string;
    elementType?: string;
    userAction?: string;
  };
}

/**
 * Query parameters for searching propositions
 */
export interface QueryParams {
  searchTerms?: string; // Natural language query
  relevanceDiversityBalance?: number; // 0 = max relevance, 1 = max diversity
  timestampCutoff?: number; // Only return propositions after this timestamp
  applyDecay?: boolean; // Apply decay based on timestamp
  category?: Proposition['category']; // Filter by category
  minConfidence?: number; // Minimum confidence threshold
}

/**
 * GUM Agent state
 */
export interface GUMState {
  isActive: boolean;
  propositions: Proposition[];
  observations: Observation[];
  lastUpdateTime: number | null;
  config: {
    updateIntervalMs: number; // How often to run inference (default: 60000ms = 1 min)
    maxPropositions: number; // Max propositions to keep (default: 100)
    maxObservations: number; // Max observations to keep (default: 500)
    minConfidenceThreshold: number; // Don't store propositions below this (default: 0.3)
    decayHalfLife: number; // Time (ms) for confidence to decay by 50% (default: 7 days)
  };
}

// ============================================================================
// GeneralUserAgent Class
// ============================================================================

export class GeneralUserAgent {
  private state: GUMState;
  private updateTimer: number | null = null;
  private apiKey: string | null = null;
  private isServiceWorker: boolean;

  constructor() {
    // Detect if we're in a service worker (no DOM access) or content script (has DOM)
    this.isServiceWorker = typeof window === 'undefined';
    
    this.state = {
      isActive: false,
      propositions: [],
      observations: [],
      lastUpdateTime: null,
      config: {
        updateIntervalMs: 60000, // 1 minute
        maxPropositions: 100,
        maxObservations: 500,
        minConfidenceThreshold: 0.3,
        decayHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    };

    logger.info('GeneralUserAgent', 'GUM initialized', {
      environment: this.isServiceWorker ? 'service-worker' : 'content-script'
    });
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Start the GUM - loads from storage and begins periodic updates
   */
  public async start(apiKey?: string): Promise<void> {
    if (this.state.isActive) {
      logger.warn('GeneralUserAgent', 'Already active');
      return;
    }

    this.apiKey = apiKey || null;
    this.state.isActive = true;

    // Load existing propositions from storage
    await this.loadFromStorage();

    // Start periodic update loop
    this.startUpdateLoop();

    logger.info('GeneralUserAgent', 'GUM started', {
      propositions: this.state.propositions.length,
      observations: this.state.observations.length,
    });
  }

  /**
   * Stop the GUM - saves to storage and clears timers
   */
  public async stop(): Promise<void> {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    this.stopUpdateLoop();

    // Save current state
    await this.saveToStorage();

    logger.info('GeneralUserAgent', 'GUM stopped');
  }

  /**
   * Add an observation to the GUM
   * Observations are the raw input data that propositions are inferred from
   */
  public async addObservation(observation: Omit<Observation, 'id' | 'timestamp'>): Promise<void> {
    const fullObservation: Observation = {
      id: generateId(),
      timestamp: Date.now(),
      ...observation,
    };

    this.state.observations.push(fullObservation);

    // Maintain max size
    if (this.state.observations.length > this.state.config.maxObservations) {
      this.state.observations = this.state.observations.slice(-this.state.config.maxObservations);
    }

    logger.debug('GeneralUserAgent', 'Observation added', {
      id: fullObservation.id,
      source: fullObservation.source,
    });
  }

  /**
   * Get recent interactions from observations
   * Used for immediate inference when struggle detected
   */
  private getRecentInteractions(): UserInteractionEvent[] {
    const interactions: UserInteractionEvent[] = [];
    
    // Extract interactions from observations
    for (const obs of this.state.observations) {
      if (obs.source === 'interaction' && Array.isArray(obs.data)) {
        interactions.push(...obs.data);
      }
    }

    // Return last 50 interactions (most recent)
    return interactions.slice(-50);
  }

  /**
   * Query propositions using natural language
   * Returns propositions ranked by relevance to the query
   */
  public async query(params: QueryParams): Promise<Proposition[]> {
    let results = [...this.state.propositions];

    // Apply filters
    if (params.category) {
      results = results.filter(p => p.category === params.category);
    }

    if (params.minConfidence !== undefined) {
      const minConf = params.minConfidence;
      results = results.filter(p => p.confidence >= minConf);
    }

    if (params.timestampCutoff !== undefined) {
      const cutoff = params.timestampCutoff;
      results = results.filter(p => p.updatedAt >= cutoff);
    }

    // Apply decay if requested
    if (params.applyDecay) {
      results = results.map(p => ({
        ...p,
        confidence: this.applyDecay(p),
      }));
    }

    // Sort by confidence (could enhance with semantic search later)
    results.sort((a, b) => b.confidence - a.confidence);

    // If search terms provided, filter by text matching (simple implementation)
    if (params.searchTerms) {
      const searchLower = params.searchTerms.toLowerCase();
      results = results.filter(p => 
        p.text.toLowerCase().includes(searchLower) ||
        p.grounding.reasoning.toLowerCase().includes(searchLower)
      );
    }

    logger.debug('GeneralUserAgent', 'Query executed', {
      totalResults: results.length,
      searchTerms: params.searchTerms,
    });

    return results;
  }

  /**
   * Get all propositions (for debugging/UI display)
   */
  public getPropositions(): Proposition[] {
    return [...this.state.propositions];
  }

  /**
   * Manually trigger a GUM update (outside the periodic loop)
   */
  public async forceUpdate(
    interactionHistory: UserInteractionEvent[],
    pageContent?: string
  ): Promise<void> {
    await this.runInference(interactionHistory, pageContent);
  }

  /**
   * Delete a proposition by ID (user control)
   */
  public async deleteProposition(id: string): Promise<void> {
    this.state.propositions = this.state.propositions.filter(p => p.id !== id);
    await this.saveToStorage();
    
    logger.info('GeneralUserAgent', 'Proposition deleted', { id });
  }

  /**
   * Clear all propositions (user control - reset user model)
   * Implements G8 (efficient dismissal) and G17 (user control)
   */
  public async clearAllPropositions(): Promise<void> {
    const count = this.state.propositions.length;
    this.state.propositions = [];
    await this.saveToStorage();
    
    logger.info('GeneralUserAgent', 'All propositions cleared - user model reset', { count });
  }

  /**
   * Edit a proposition (user control)
   */
  public async editProposition(id: string, updates: Partial<Pick<Proposition, 'text' | 'confidence' | 'category'>>): Promise<void> {
    const proposition = this.state.propositions.find(p => p.id === id);
    if (!proposition) {
      logger.warn('GeneralUserAgent', 'Proposition not found', { id });
      return;
    }

    Object.assign(proposition, updates, { updatedAt: Date.now() });
    await this.saveToStorage();

    logger.info('GeneralUserAgent', 'Proposition edited', { id, updates });
  }

  /**
   * Add a custom proposition (user input)
   */
  public async addProposition(text: string, confidence: number = 0.9, category?: Proposition['category']): Promise<void> {
    const proposition: Proposition = {
      id: generateId(),
      text,
      confidence,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      decayScore: 1.0, // User-added propositions are stable
      grounding: {
        observations: [],
        reasoning: 'Manually added by user',
      },
      category,
    };

    this.state.propositions.push(proposition);
    await this.saveToStorage();

    logger.info('GeneralUserAgent', 'Proposition manually added', { text, confidence });
  }

  /**
   * PHASE 5: Get the single highest confidence proposition
   * Used by JIT Objective Agent to determine user's current need
   * 
   * @returns The proposition with highest effective confidence (confidence × decayScore), or null if none exist
   */
  public async getHighestConfidenceProposition(): Promise<Proposition | null> {
    if (this.state.propositions.length === 0) {
      logger.debug('GeneralUserAgent', 'No propositions available');
      return null;
    }

    // Calculate effective confidence (confidence × decayScore) for each proposition
    const propositionsWithEffectiveConfidence = this.state.propositions.map(p => ({
      proposition: p,
      effectiveConfidence: p.confidence * p.decayScore,
    }));

    // Sort by effective confidence (descending)
    propositionsWithEffectiveConfidence.sort((a, b) => 
      b.effectiveConfidence - a.effectiveConfidence
    );

    const top = propositionsWithEffectiveConfidence[0];

    logger.info('GeneralUserAgent', 'Retrieved highest confidence proposition', {
      text: top.proposition.text,
      confidence: top.proposition.confidence,
      decayScore: top.proposition.decayScore,
      effectiveConfidence: top.effectiveConfidence,
      category: top.proposition.category,
    });

    return top.proposition;
  }

  /**
   * PHASE 5: Call GUM model with interaction history
   * Direct interface for background script to trigger inference
   * 
   * @param history - Array of user interaction events
   * @returns Array of generated propositions
   */
  public async callGUMModel(history: UserInteractionEvent[]): Promise<Proposition[]> {
    logger.info('GeneralUserAgent', 'callGUMModel invoked', {
      historyLength: history.length,
    });

    if (!this.apiKey) {
      logger.warn('GeneralUserAgent', 'No API key configured for GUM model');
      return [];
    }

    try {
      // Extract page content if available
      const pageContent = this.extractPageContent();

      // Run inference with provided history
      await this.runInference(history, pageContent);

      // Return all current propositions (freshly updated)
      return this.getPropositions();

    } catch (error) {
      logger.error('GeneralUserAgent', 'callGUMModel failed', error);
      return [];
    }
  }

  // ========================================================================
  // Core GUM Inference Loop
  // ========================================================================

  private startUpdateLoop(): void {
    this.stopUpdateLoop();

    // Use global setInterval (works in both service worker and content script)
    this.updateTimer = setInterval(async () => {
      await this.runPeriodicUpdate();
    }, this.state.config.updateIntervalMs) as unknown as number;

    logger.debug('GeneralUserAgent', 'Update loop started', {
      intervalMs: this.state.config.updateIntervalMs,
    });
  }

  private stopUpdateLoop(): void {
    if (this.updateTimer !== null) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Periodic update triggered by timer
   * Gets interaction history from PerceptionAgent and page content
   */
  private async runPeriodicUpdate(): Promise<void> {
    try {
      // Get interaction history from PerceptionAgent (if available)
      // In a real implementation, we'd import perceptionAgent.getState()
      // For now, we'll use the observations we've collected
      
      const recentObservations = this.state.observations.slice(-50); // Last 50 observations
      
      if (recentObservations.length === 0) {
        logger.debug('GeneralUserAgent', 'No new observations, skipping update');
        return;
      }

      // Extract interaction events from observations
      const interactions: UserInteractionEvent[] = recentObservations
        .filter(obs => obs.source === 'interaction' && Array.isArray(obs.data))
        .flatMap(obs => obs.data);

      // Get page content
      const pageContent = this.extractPageContent();

      await this.runInference(interactions, pageContent);

      this.state.lastUpdateTime = Date.now();
      await this.saveToStorage();

    } catch (error) {
      logger.error('GeneralUserAgent', 'Periodic update failed', error);
    }
  }

  /**
   * Trigger immediate inference (useful when struggle detected)
   * This bypasses the 60s timer and runs inference NOW
   */
  public async triggerImmediateInference(): Promise<void> {
    if (!this.apiKey) {
      logger.warn('GeneralUserAgent', 'No API key configured, cannot trigger inference');
      return;
    }

    logger.info('GeneralUserAgent', 'Immediate inference triggered (struggle detected)');

    try {
      // Get current page content
      const pageContent = this.extractPageContent();
      
      // Get recent interactions from observations
      const recentInteractions = this.getRecentInteractions();

      logger.info('GeneralUserAgent', 'Data available for inference', {
        interactionCount: recentInteractions.length,
        pageContentLength: pageContent.length,
        observationCount: this.state.observations.length,
      });

      if (recentInteractions.length === 0 && !pageContent) {
        logger.warn('GeneralUserAgent', '⚠️ No data to infer from yet - no interactions or page content');
        return;
      }

      // Run inference immediately
      logger.info('GeneralUserAgent', 'Starting LLM inference NOW...');
      await this.runInference(recentInteractions, pageContent);
      
      logger.info('GeneralUserAgent', 'Immediate inference complete', {
        propositionCount: this.state.propositions.length,
      });

    } catch (error) {
      logger.error('GeneralUserAgent', 'Immediate inference failed', error);
    }
  }

  /**
   * Core inference: Generate/revise propositions from observations
   * This is where the LLM magic happens!
   */
  private async runInference(
    interactions: UserInteractionEvent[],
    pageContent?: string
  ): Promise<void> {
    if (!this.apiKey) {
      logger.warn('GeneralUserAgent', 'No API key configured, skipping inference');
      return;
    }

    logger.info('GeneralUserAgent', 'Running GUM inference', {
      interactions: interactions.length,
      currentPropositions: this.state.propositions.length,
      hasPageContent: !!pageContent,
      apiKeyConfigured: !!this.apiKey,
    });

    try {
      // Build the prompt (inspired by GUM paper's prompting strategy)
      logger.debug('GeneralUserAgent', 'Building GUM prompt...');
      const prompt = this.buildGUMPrompt(interactions, pageContent);
      
      logger.debug('GeneralUserAgent', 'Prompt built', {
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 200) + '...',
      });

      // Call LLM (OpenAI GPT-4)
      logger.info('GeneralUserAgent', 'Calling OpenAI GPT-4 for inference...');
      const response = await this.callLLM(prompt);
      
      logger.info('GeneralUserAgent', 'OpenAI response received', {
        responseLength: response.length,
        responsePreview: response.substring(0, 100) + '...',
      });

      // Parse response into propositions
      logger.debug('GeneralUserAgent', 'Parsing propositions from response...');
      const newPropositions = this.parsePropositionsFromResponse(response);
      
      logger.info('GeneralUserAgent', 'Propositions parsed', {
        count: newPropositions.length,
        propositions: newPropositions.map(p => `${p.text} (${p.confidence})`),
      });

      // Merge with existing propositions (update or add)
      this.mergePropositions(newPropositions);
      
      // Save to storage
      await this.saveToStorage();

      logger.info('GeneralUserAgent', '✅ Inference complete', {
        newPropositions: newPropositions.length,
        totalPropositions: this.state.propositions.length,
      });

    } catch (error) {
      logger.error('GeneralUserAgent', '❌ Inference failed', error);
      // Log more details about the error
      if (error instanceof Error) {
        logger.error('GeneralUserAgent', 'Error details', {
          message: error.message,
          stack: error.stack,
        });
      }
    }
  }

  /**
   * Build the GUM prompt following Shaikh et al. (UIST 2025) format
   * Reference: "Creating General User Models from Computer Use"
   */
  private buildGUMPrompt(
    interactions: UserInteractionEvent[],
    pageContent?: string
  ): string {
    // Format existing propositions with all metadata
    const existingPropositions = this.state.propositions
      .map(p => `Proposition: ${p.text}\nConfidence: ${p.confidence.toFixed(1)}\nDecay: ${p.decayScore.toFixed(1)}\n`)
      .join('\n');

    const interactionSummary = this.summarizeInteractions(interactions);

    // Get page context safely (only available in content script)
    let observationContext = '';
    if (!this.isServiceWorker) {
      try {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        const title = typeof document !== 'undefined' ? document.title : '';
        observationContext = `URL: ${url}\nPage Title: ${title}`;
        if (pageContent) {
          observationContext += `\n\nPage Content:\n${pageContent.substring(0, 800)}`;
        }
      } catch (error) {
        logger.warn('GeneralUserAgent', 'Failed to get page context', error);
      }
    }

    // GUM prompt format from the research paper (Section 5.3)
    return `You are constructing a General User Model (GUM) by observing user interactions. GUMs take unstructured observations and construct confidence-weighted natural language propositions about a user's behavior, knowledge, beliefs, and preferences.

## Existing Propositions:
${existingPropositions || 'No existing propositions yet.\n'}

## New Observation:
${observationContext}

User Interactions (last ${interactions.length} events):
${interactionSummary}

## Task:
Based on these observations, generate propositions about this user. Each proposition should capture insights about the user's:
- Current activity or goal
- Identity or role
- Preferences or interests
- Knowledge or expertise
- Behavioral patterns

For each proposition, provide:
1. proposition: A clear natural language statement about the user
2. confidence: Score from 0-10 (10 = certain, 5 = moderate, 1 = low confidence)
3. decay: Rate of staleness from 1-10 (10 = stable like "User is a researcher", 2 = transient like "User is reading an email")
4. reasoning: Explanation grounding the proposition in observations
5. category: One of [activity, goal, identity, preference, knowledge]

## Output Format (JSON array):
[
  {
    "text": "User is exploring GDP data across different countries",
    "confidence": 8,
    "decayScore": 3,
    "reasoning": "Screenshots show the user repeatedly interacting with tables comparing country GDP values, hovering over multiple rows",
    "category": "activity"
  }
]

Generate 3-5 propositions. Prioritize actionable insights that reveal what the user is trying to accomplish right now.`;
  }

  /**
   * Summarize interactions for the prompt
   */
  private summarizeInteractions(interactions: UserInteractionEvent[]): string {
    if (interactions.length === 0) {
      return 'No interactions recorded.';
    }

    const summary: string[] = [];
    
    // Count by type
    const typeCounts = interactions.reduce((acc, int) => {
      acc[int.type] = (acc[int.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    summary.push(`Interaction counts: ${Object.entries(typeCounts).map(([type, count]) => `${type}:${count}`).join(', ')}`);

    // List unique elements interacted with
    const elements = new Set(interactions.map(int => int.target.tagName));
    summary.push(`Element types: ${Array.from(elements).join(', ')}`);

    // Sample recent text content
    const recentTexts = interactions
      .filter(int => int.target.textContent)
      .slice(-5)
      .map(int => int.target.textContent?.substring(0, 50));
    
    if (recentTexts.length > 0) {
      summary.push(`Recent element text: ${recentTexts.join(' | ')}`);
    }

    return summary.join('\n');
  }

  /**
   * Extract relevant page content for context
   * Only works in content script context (has DOM access)
   */
  private extractPageContent(): string {
    // If in service worker (no DOM), return empty string
    if (this.isServiceWorker) {
      logger.debug('GeneralUserAgent', 'Cannot extract page content in service worker context');
      return '';
    }

    try {
      // Get main content areas (skip nav, footer, etc.)
      const mainSelectors = ['main', 'article', '[role="main"]', '#content', '.content'];
      let content = '';

      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = element.textContent?.substring(0, 2000) || '';
          break;
        }
      }

      // Fallback: use body text
      if (!content && typeof document !== 'undefined') {
        content = document.body.textContent?.substring(0, 2000) || '';
      }

      return content.trim();
    } catch (error) {
      logger.warn('GeneralUserAgent', 'Failed to extract page content', error);
      return '';
    }
  }

  /**
   * Call LLM API (OpenAI GPT-4)
   * Using same API as rest of KAIROS-SPECTRA system
   */
  private async callLLM(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Same model as VisualizationAgent
        messages: [
          {
            role: 'system',
            content: 'You are a user modeling assistant that infers propositions about the user based on their browsing behavior. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent propositions
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API call failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (!text) {
      throw new Error('No content in OpenAI API response');
    }

    logger.info('GeneralUserAgent', 'OpenAI inference successful', {
      tokenUsage: data.usage,
      model: data.model,
    });

    return text;
  }

  /**
   * Parse LLM response into propositions
   */
  private parsePropositionsFromResponse(response: string): Proposition[] {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = response;
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);
      const propositions: Proposition[] = [];

      if (!Array.isArray(parsed)) {
        logger.warn('GeneralUserAgent', 'Response is not an array');
        return [];
      }

      for (const item of parsed) {
        if (
          typeof item.text === 'string' &&
          typeof item.confidence === 'number'
        ) {
          // Normalize confidence from 0-10 scale to 0-1 scale (paper uses 0-10)
          const normalizedConfidence = Math.max(0, Math.min(1, item.confidence / 10));
          
          // Only keep propositions above minimum threshold
          if (normalizedConfidence >= this.state.config.minConfidenceThreshold) {
            propositions.push({
              id: generateId(),
              text: item.text,
              confidence: normalizedConfidence,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              decayScore: item.decayScore ? Math.max(0, Math.min(1, item.decayScore / 10)) : 0.5,
              grounding: {
                observations: [], // Could link to specific observation IDs
                reasoning: item.reasoning || 'Inferred from recent interactions',
              },
              category: item.category || 'context',
            });
          }
        }
      }

      return propositions;

    } catch (error) {
      logger.error('GeneralUserAgent', 'Failed to parse LLM response', error);
      logger.debug('GeneralUserAgent', 'Raw response', response);
      return [];
    }
  }

  /**
   * Merge new propositions with existing ones
   * If a similar proposition exists, update it; otherwise add new
   */
  private mergePropositions(newPropositions: Proposition[]): void {
    for (const newProp of newPropositions) {
      // Simple similarity check: exact text match (could enhance with semantic similarity)
      const existing = this.state.propositions.find(p => 
        p.text.toLowerCase() === newProp.text.toLowerCase()
      );

      if (existing) {
        // Update existing proposition
        existing.confidence = (existing.confidence + newProp.confidence) / 2; // Average
        existing.updatedAt = Date.now();
        existing.grounding.reasoning = newProp.grounding.reasoning;
        
        logger.debug('GeneralUserAgent', 'Updated proposition', { text: existing.text });
      } else {
        // Add new proposition
        this.state.propositions.push(newProp);
        
        logger.debug('GeneralUserAgent', 'Added proposition', { text: newProp.text });
      }
    }

    // Maintain max size (keep highest confidence)
    if (this.state.propositions.length > this.state.config.maxPropositions) {
      this.state.propositions.sort((a, b) => b.confidence - a.confidence);
      this.state.propositions = this.state.propositions.slice(0, this.state.config.maxPropositions);
    }
  }

  /**
   * Apply decay to a proposition based on time elapsed
   */
  private applyDecay(proposition: Proposition): number {
    const age = Date.now() - proposition.updatedAt;
    const halfLife = this.state.config.decayHalfLife * proposition.decayScore;
    
    // Exponential decay: confidence * (0.5 ^ (age / halfLife))
    const decayFactor = Math.pow(0.5, age / halfLife);
    
    return proposition.confidence * decayFactor;
  }

  // ========================================================================
  // Storage (Chrome Storage API)
  // ========================================================================

  private async loadFromStorage(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['gum_propositions', 'gum_observations']);
      
      if (result.gum_propositions) {
        this.state.propositions = result.gum_propositions;
        logger.info('GeneralUserAgent', 'Loaded propositions from storage', {
          count: this.state.propositions.length,
        });
      }

      if (result.gum_observations) {
        this.state.observations = result.gum_observations;
        logger.info('GeneralUserAgent', 'Loaded observations from storage', {
          count: this.state.observations.length,
        });
      }

    } catch (error) {
      logger.error('GeneralUserAgent', 'Failed to load from storage', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await chrome.storage.local.set({
        gum_propositions: this.state.propositions,
        gum_observations: this.state.observations,
      });

      logger.debug('GeneralUserAgent', 'Saved to storage', {
        propositions: this.state.propositions.length,
        observations: this.state.observations.length,
      });

    } catch (error) {
      logger.error('GeneralUserAgent', 'Failed to save to storage', error);
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  public getState(): GUMState {
    return { ...this.state };
  }

  public updateConfig(config: Partial<GUMState['config']>): void {
    this.state.config = { ...this.state.config, ...config };
    logger.info('GeneralUserAgent', 'Config updated', this.state.config);
  }
}

// Export singleton instance
export const generalUserAgent = new GeneralUserAgent();
