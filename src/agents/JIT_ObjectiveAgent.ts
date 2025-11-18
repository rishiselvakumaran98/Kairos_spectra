/**
 * JIT_ObjectiveAgent (Just-In-Time Objectives)
 * Phase 5: Proactive Tool Generation
 * 
 * Purpose: Translate high-level GUM propositions into specific, actionable user needs
 * 
 * Inspired by: "Just-In-Time Objectives for Intelligent Agents" research
 * 
 * Key Responsibility:
 * - Takes a strategic GUM proposition (e.g., "User is a Ph.D. student writing a research paper")
 * - Generates a specific, actionable objective (e.g., "A tool to track and format citations")
 * - Output is used by Generative_UIAgent to build the actual widget
 * 
 * Architecture Flow:
 * 1. GUM → High-confidence proposition about user
 * 2. JIT → Actionable objective/need
 * 3. GenUI → Concrete UI widget implementation
 * 
 * Model Selection:
 * - Uses GPT-4o (strategic reasoning specialist) per Cursor 2.0 architecture
 * - Requires strong reasoning about user needs from abstract contexts
 */

import type { Proposition } from '../types';
import { logger } from '../utils';

// ============================================================================
// JIT Objective Type Definitions
// ============================================================================

/**
 * An actionable objective derived from a GUM proposition
 */
export interface ActionableObjective {
  objective: string; // Clear, specific description of user need
  reasoning: string; // Why this objective was inferred from the proposition
  toolType?: 'calculator' | 'tracker' | 'checker' | 'analyzer' | 'formatter' | 'monitor' | 'custom';
  complexity?: 'simple' | 'moderate' | 'complex'; // Estimated implementation complexity
  confidence: number; // 0-1, how confident we are this is the right objective
  sourceProposition: {
    id: string;
    text: string;
  };
}

// ============================================================================
// JIT_ObjectiveAgent Class
// ============================================================================

export class JIT_ObjectiveAgent {
  private apiKey: string | null = null;
  private modelName: string = 'gpt-4o'; // Strategic reasoning model

  constructor() {
    logger.info('JIT_ObjectiveAgent', 'Initialized with GPT-4o for objective generation');
  }

  /**
   * Initialize with API key
   */
  public async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    logger.info('JIT_ObjectiveAgent', 'API key configured');
  }

  /**
   * CORE METHOD: Generate actionable objective from GUM proposition
   * 
   * @param proposition - High-confidence proposition from GUM
   * @returns Specific, actionable objective that can be fulfilled with a UI widget
   */
  public async generateActionableObjective(proposition: Proposition): Promise<ActionableObjective | null> {
    if (!this.apiKey) {
      logger.error('JIT_ObjectiveAgent', 'No API key configured');
      return null;
    }

    logger.info('JIT_ObjectiveAgent', 'Generating objective from proposition', {
      propositionText: proposition.text,
      propositionConfidence: proposition.confidence,
      category: proposition.category,
    });

    try {
      // Build the JIT objective prompt
      const prompt = this.buildObjectivePrompt(proposition);

      // Call LLM (GPT-4o)
      const response = await this.callLLM(prompt);

      // Parse response
      const objective = this.parseObjectiveFromResponse(response, proposition);

      if (objective) {
        logger.info('JIT_ObjectiveAgent', 'Objective generated successfully', {
          objective: objective.objective,
          toolType: objective.toolType,
          complexity: objective.complexity,
          confidence: objective.confidence,
        });
      } else {
        logger.warn('JIT_ObjectiveAgent', 'Failed to generate objective from response');
      }

      return objective;

    } catch (error) {
      logger.error('JIT_ObjectiveAgent', 'Failed to generate objective', error);
      return null;
    }
  }

  /**
   * Build the prompt for generating actionable objectives
   * Implements the gen_objective concept from "Just-In-Time Objectives" paper
   */
  private buildObjectivePrompt(proposition: Proposition): string {
    return `You are an expert Human-Computer Interaction assistant specializing in identifying user needs.

My General User Model has generated the following belief about my user:

PROPOSITION: "${proposition.text}"
CONFIDENCE: ${(proposition.confidence * 10).toFixed(1)}/10
CATEGORY: ${proposition.category || 'general'}
REASONING: ${proposition.grounding.reasoning}

## Task:
Based on this *single* belief, identify a specific, actionable *objective* or *need* this user might have that could be solved with a small, generative software tool.

## Examples:
- PROPOSITION: "User is a Ph.D. student writing a research paper."
  OBJECTIVE: "A tool to track and format citations in APA/MLA style."
  TOOL_TYPE: tracker
  COMPLEXITY: moderate

- PROPOSITION: "User is a marketing manager analyzing sales data."
  OBJECTIVE: "A tool to quickly calculate ROI from 'ad spend' and 'revenue' columns."
  TOOL_TYPE: calculator
  COMPLEXITY: simple

- PROPOSITION: "User is shopping for a friend's wedding in Chicago."
  OBJECTIVE: "A tool to check the weather forecast in Chicago for the next 10 days."
  TOOL_TYPE: checker
  COMPLEXITY: simple

- PROPOSITION: "User is comparing GDP data across multiple countries."
  OBJECTIVE: "A tool to visualize and sort country GDP values in a table."
  TOOL_TYPE: analyzer
  COMPLEXITY: moderate

- PROPOSITION: "User is reading research papers on machine learning."
  OBJECTIVE: "A tool to extract and summarize key findings from academic papers."
  TOOL_TYPE: analyzer
  COMPLEXITY: complex

## Guidelines:
1. **Be Specific**: Don't just say "help with research" - say "track citations" or "summarize findings"
2. **Be Actionable**: The objective must be achievable with a small HTML/CSS/JS widget
3. **Be Focused**: One clear purpose, not multiple features
4. **Be Realistic**: Simple tools (calculators, trackers, checkers) are better than complex AI systems
5. **Consider Context**: Use the proposition's category and reasoning to inform the objective

## Output Format (JSON):
{
  "objective": "A specific, actionable description of the tool needed",
  "reasoning": "Why this objective addresses the user's inferred need",
  "toolType": "calculator|tracker|checker|analyzer|formatter|monitor|custom",
  "complexity": "simple|moderate|complex",
  "confidence": 0.85
}

Respond with valid JSON only, no additional text.`;
  }

  /**
   * Call LLM API (GPT-4o for strategic reasoning)
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
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at translating abstract user contexts into specific, actionable objectives. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4, // Balance creativity with consistency
        max_tokens: 500,
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

    logger.debug('JIT_ObjectiveAgent', 'OpenAI response received', {
      model: data.model,
      tokenUsage: data.usage,
    });

    return text;
  }

  /**
   * Parse LLM response into ActionableObjective
   */
  private parseObjectiveFromResponse(response: string, proposition: Proposition): ActionableObjective | null {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = response.trim();
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      if (
        typeof parsed.objective !== 'string' ||
        !parsed.objective.trim()
      ) {
        logger.warn('JIT_ObjectiveAgent', 'Invalid objective in response', { parsed });
        return null;
      }

      const objective: ActionableObjective = {
        objective: parsed.objective.trim(),
        reasoning: parsed.reasoning || 'Inferred from user model proposition',
        toolType: parsed.toolType || 'custom',
        complexity: parsed.complexity || 'moderate',
        confidence: typeof parsed.confidence === 'number' 
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
        sourceProposition: {
          id: proposition.id,
          text: proposition.text,
        },
      };

      return objective;

    } catch (error) {
      logger.error('JIT_ObjectiveAgent', 'Failed to parse objective from response', error);
      logger.debug('JIT_ObjectiveAgent', 'Raw response', response);
      return null;
    }
  }

  /**
   * Batch generate objectives from multiple propositions
   * Useful for generating multiple tool suggestions
   */
  public async generateMultipleObjectives(
    propositions: Proposition[],
    maxCount: number = 3
  ): Promise<ActionableObjective[]> {
    logger.info('JIT_ObjectiveAgent', 'Generating multiple objectives', {
      propositionCount: propositions.length,
      maxCount,
    });

    const objectives: ActionableObjective[] = [];

    // Process propositions in order of confidence
    const sortedProps = [...propositions].sort((a, b) => 
      (b.confidence * b.decayScore) - (a.confidence * a.decayScore)
    );

    for (const prop of sortedProps.slice(0, maxCount)) {
      const objective = await this.generateActionableObjective(prop);
      if (objective) {
        objectives.push(objective);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info('JIT_ObjectiveAgent', 'Batch objective generation complete', {
      generatedCount: objectives.length,
    });

    return objectives;
  }
}

// Export singleton instance
export const jitObjectiveAgent = new JIT_ObjectiveAgent();
