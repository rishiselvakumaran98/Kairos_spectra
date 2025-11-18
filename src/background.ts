/**
 * KAIROS-SPECTRA Background Script
 * 
 * Service worker that manages extension lifecycle and coordinates
 * between content scripts and UI components.
 */

import type { ChromeMessage, StruggleEvent, DataExtractionResult, UserInteractionEvent, Proposition, ActionableObjective, GeneratedWidget, StoredWidget } from './types';
import { logger, createMessage, generateId } from './utils';
import { generalUserAgent } from './agents/GeneralUserAgent';
import { jitObjectiveAgent } from './agents/JIT_ObjectiveAgent';
import { generativeUIAgent } from './agents/Generative_UIAgent';

class KairosSpectraBackground {
  private activeTabId: number | null = null;
  private struggleHistory: Map<string, { event: StruggleEvent; data: DataExtractionResult }> = new Map();
  private gumInitialized: boolean = false;
  
  // Phase 5: Proactive Tool Generation
  private proactiveLoopTimer: number | null = null;
  private isProactiveGenerationEnabled: boolean = true;
  private generatedWidgets: Map<string, StoredWidget> = new Map();
  private lastPropositionId: string | null = null;
  private lastGenerationTime: number = 0;
  private MIN_GENERATION_INTERVAL_MS: number = 5 * 60 * 1000; // 5 minutes minimum between generations

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    logger.info('Background', 'Initializing KAIROS-SPECTRA background script');

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Track active tab
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));

    // Handle extension icon click
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));

    // Initialize GUM (load API key from storage)
    await this.initializeGUM();

    logger.info('Background', 'Background script initialized');
  }

  /**
   * Initialize GUM with API key from storage
   */
  private async initializeGUM(): Promise<void> {
    try {
      // Use same API key as rest of system (OpenAI)
      const result = await chrome.storage.sync.get(['openai_api_key', 'proactive_generation_enabled']);
      const apiKey = result.openai_api_key;
      
      if (apiKey) {
        await generalUserAgent.start(apiKey);
        
        // Phase 5: Initialize JIT and GenUI agents
        await jitObjectiveAgent.initialize(apiKey);
        await generativeUIAgent.initialize(apiKey);
        
        this.gumInitialized = true;
        logger.info('BackgroundScript', 'GUM, JIT, and GenUI agents initialized with OpenAI API');
        
        // Phase 5: Load proactive generation setting (default: enabled)
        this.isProactiveGenerationEnabled = result.proactive_generation_enabled !== false;
        
        // Phase 5: Load stored widgets from storage
        await this.loadStoredWidgets();
        
        // Phase 5: Start proactive tool generation loop
        if (this.isProactiveGenerationEnabled) {
          this.startProactiveToolGenerationLoop();
        }
        
      } else {
        logger.warn('BackgroundScript', 'No OpenAI API key found - GUM disabled');
      }
    } catch (error) {
      logger.error('BackgroundScript', 'Failed to initialize GUM', error);
    }
  }  private handleMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    logger.debug('Background', 'Message received', {
      type: message.type,
      from: sender.tab?.id,
    });

    switch (message.type) {
      case 'STRUGGLE_DETECTED':
        this.handleStruggleDetected(message.payload, sender.tab?.id);
        sendResponse({ received: true });
        break;

      case 'CAPTURE_SCREENSHOT':
        this.handleCaptureScreenshot(sender.tab?.id, sendResponse);
        return true; // Keep channel open for async response

      case 'AGENT_STATE_UPDATE':
        if (message.payload.contentScriptReady) {
          logger.info('Background', 'Content script ready', {
            url: message.payload.url,
            tabId: sender.tab?.id,
          });
        }
        // Feed interaction history to GUM
        if (message.payload.interactionHistory) {
          this.feedInteractionsToGUM(message.payload.interactionHistory, message.payload.url);
        }
        sendResponse({ acknowledged: true });
        break;

      case 'DATA_EXTRACTION_REQUEST':
        // Future: handle manual data extraction requests
        sendResponse({ error: 'Not implemented yet' });
        break;

      case 'GUM_QUERY':
        this.handleGUMQuery(message.payload, sendResponse);
        return true; // Keep channel open for async response

      case 'GUM_GET_PROPOSITIONS':
        sendResponse({ propositions: generalUserAgent.getPropositions() });
        break;

      case 'GUM_DELETE_PROPOSITION':
        this.handleGUMDeleteProposition(message.payload.id, sendResponse);
        return true;

      case 'GUM_EDIT_PROPOSITION':
        this.handleGUMEditProposition(message.payload, sendResponse);
        return true;

      case 'GUM_ADD_PROPOSITION':
        this.handleGUMAddProposition(message.payload, sendResponse);
        return true;

      case 'GUM_RESET_ALL_PROPOSITIONS':
        this.handleGUMResetAll(sendResponse);
        return true;

      case 'GUM_TRIGGER_INFERENCE':
        this.handleGUMTriggerInference(sendResponse);
        return true;

      // Phase 5: Proactive Tool Generation Messages
      case 'GET_STORED_WIDGETS':
        sendResponse({ widgets: this.getStoredWidgets() });
        break;

      case 'TOGGLE_PROACTIVE_GENERATION':
        this.toggleProactiveGeneration(message.payload.enabled);
        sendResponse({ success: true });
        break;

      case 'DELETE_WIDGET':
        this.handleDeleteWidget(message.payload.id, sendResponse);
        return true;

      case 'RATE_WIDGET':
        this.handleRateWidget(message.payload.id, message.payload.rating, sendResponse);
        return true;

      case 'OPEN_WIDGET':
        this.handleOpenWidget(message.payload.id, sendResponse);
        return true;

      default:
        logger.warn('Background', 'Unknown message type', message.type);
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  }

  private handleCaptureScreenshot(
    tabId: number | undefined,
    sendResponse: (response: any) => void
  ): void {
    if (!tabId) {
      sendResponse({ error: 'No tab ID' });
      return;
    }

    chrome.tabs.captureVisibleTab(
      { format: 'png', quality: 100 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          logger.error('Background', 'Screenshot capture failed', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          logger.debug('Background', 'Screenshot captured', {
            size: dataUrl.length,
            tabId,
          });
          sendResponse({ screenshot: dataUrl });
        }
      }
    );
  }

  private handleStruggleDetected(
    payload: { struggleEvent: StruggleEvent; extractionResult: DataExtractionResult; interactionHistory?: UserInteractionEvent[] },
    tabId?: number
  ): void {
    const { struggleEvent, extractionResult, interactionHistory } = payload;

    logger.info('Background', 'Struggle detected in tab', {
      tabId,
      type: struggleEvent.pattern.type,
      confidence: struggleEvent.pattern.confidence,
      dataExtracted: extractionResult.extractedData.length,
      interactionCount: interactionHistory?.length || 0,
    });

    // Feed interactions to GUM FIRST (before inference)
    if (interactionHistory && interactionHistory.length > 0) {
      this.feedInteractionsToGUM(interactionHistory, struggleEvent.context.pageURL);
    }

    // Store in history
    this.struggleHistory.set(struggleEvent.id, {
      event: struggleEvent,
      data: extractionResult,
    });

    // Log extraction results for Phase 1 debugging
    logger.data('Extracted data summary', {
      eventId: struggleEvent.id,
      dataTypes: extractionResult.extractedData.map(d => d.type),
      confidences: extractionResult.extractedData.map(d => d.confidence),
    });

    // Future (Phase 2): This is where we'll trigger the OrchestratorAgent
    // For now, just log the event
    this.logStruggleEventToConsole(struggleEvent, extractionResult);
  }

  private handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
    this.activeTabId = activeInfo.tabId;
    logger.debug('Background', 'Active tab changed', { tabId: this.activeTabId });
  }

  private handleActionClick(tab: chrome.tabs.Tab): void {
    logger.info('Background', 'Extension icon clicked', { tabId: tab.id });
    
    // Future: Open popup or show UI
    // For Phase 1, just log
    if (tab.id) {
      this.sendMessageToTab(tab.id, createMessage(
        'PERCEPTION_STATUS',
        {},
        'background'
      ));
    }
  }

  private sendMessageToTab(tabId: number, message: ChromeMessage): void {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        logger.warn('Background', 'Failed to send message to tab', {
          tabId,
          error: chrome.runtime.lastError,
        });
      } else {
        logger.debug('Background', 'Message sent to tab', { tabId, response });
      }
    });
  }

  private logStruggleEventToConsole(
    event: StruggleEvent,
    extraction: DataExtractionResult
  ): void {
    console.log('='.repeat(80));
    console.log('🎯 KAIROS-SPECTRA: Struggle Detected');
    console.log('='.repeat(80));
    console.log('Pattern:', event.pattern.type);
    console.log('Confidence:', (event.pattern.confidence * 100).toFixed(1) + '%');
    console.log('Elements involved:', event.involvedElements.length);
    console.log('Data extracted:', extraction.extractedData.length);
    console.log('\nExtracted Data:');
    extraction.extractedData.forEach((data, idx) => {
      console.log(`  ${idx + 1}. Type: ${data.type}, Confidence: ${(data.confidence * 100).toFixed(1)}%`);
      console.log('     Data:', data.data);
    });
    console.log('='.repeat(80));
  }

  public getStruggleHistory(): Map<string, { event: StruggleEvent; data: DataExtractionResult }> {
    return this.struggleHistory;
  }

  // ========================================================================
  // GUM Integration Methods
  // ========================================================================

  /**
   * Feed interaction history to GUM for observation
   */
  private async feedInteractionsToGUM(interactions: UserInteractionEvent[], pageURL?: string): Promise<void> {
    if (!this.gumInitialized || interactions.length === 0) {
      return;
    }

    try {
      await generalUserAgent.addObservation({
        source: 'interaction',
        data: interactions,
        metadata: {
          pageURL: pageURL,
        },
      });

      logger.info('Background', 'Fed interactions to GUM', {
        count: interactions.length,
        pageURL: pageURL,
      });
    } catch (error) {
      logger.error('Background', 'Failed to feed interactions to GUM', error);
    }
  }

  /**
   * Handle GUM query from content script
   */
  private async handleGUMQuery(
    payload: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      const results = await generalUserAgent.query(payload);
      sendResponse({ propositions: results });
    } catch (error) {
      logger.error('Background', 'GUM query failed', error);
      sendResponse({ error: 'Query failed' });
    }
  }

  /**
   * Handle delete proposition request
   */
  private async handleGUMDeleteProposition(
    id: string,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      await generalUserAgent.deleteProposition(id);
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Background', 'Failed to delete proposition', error);
      sendResponse({ error: 'Delete failed' });
    }
  }

  /**
   * Handle reset all propositions request
   * Completely clears the user model (G8: efficient dismissal, G17: user control)
   */
  private async handleGUMResetAll(
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      logger.info('Background', 'Resetting all GUM propositions');
      await generalUserAgent.clearAllPropositions();
      sendResponse({ success: true, message: 'All propositions cleared' });
    } catch (error) {
      logger.error('Background', 'Failed to reset all propositions', error);
      sendResponse({ error: 'Reset failed' });
    }
  }

  /**
   * Handle edit proposition request
   */
  private async handleGUMEditProposition(
    payload: { id: string; updates: any },
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      await generalUserAgent.editProposition(payload.id, payload.updates);
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Background', 'Failed to edit proposition', error);
      sendResponse({ error: 'Edit failed' });
    }
  }

  /**
   * Handle add proposition request
   */
  private async handleGUMAddProposition(
    payload: { text: string; confidence?: number; category?: any },
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      await generalUserAgent.addProposition(
        payload.text,
        payload.confidence,
        payload.category
      );
      sendResponse({ success: true });
    } catch (error) {
      logger.error('Background', 'Failed to add proposition', error);
      sendResponse({ error: 'Add failed' });
    }
  }

  /**
   * Trigger immediate GUM inference (when struggle detected)
   * This bypasses the 60s timer to get propositions NOW
   */
  private async handleGUMTriggerInference(
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      logger.info('Background', 'Triggering immediate GUM inference');
      await generalUserAgent.triggerImmediateInference();
      
      // Return the newly generated propositions
      const propositions = generalUserAgent.getPropositions();
      sendResponse({ 
        success: true, 
        propositions,
        count: propositions.length 
      });
    } catch (error) {
      logger.error('Background', 'Failed to trigger GUM inference', error);
      sendResponse({ error: 'Inference trigger failed' });
    }
  }

  // ========================================================================
  // Phase 5: Proactive Tool Generation Loop
  // Implements GUM → JIT → GenUI pipeline
  // ========================================================================

  /**
   * Start the proactive tool generation loop
   * Runs every 5 minutes to check for new high-confidence propositions
   */
  private startProactiveToolGenerationLoop(): void {
    logger.info('Background', 'Starting proactive tool generation loop');
    
    // Run immediately on startup
    this.runProactiveGenerationCycle();
    
    // Then run every 5 minutes
    this.proactiveLoopTimer = setInterval(() => {
      this.runProactiveGenerationCycle();
    }, this.MIN_GENERATION_INTERVAL_MS) as unknown as number;
  }

  /**
   * Stop the proactive loop
   */
  private stopProactiveToolGenerationLoop(): void {
    if (this.proactiveLoopTimer !== null) {
      clearInterval(this.proactiveLoopTimer);
      this.proactiveLoopTimer = null;
      logger.info('Background', 'Stopped proactive tool generation loop');
    }
  }

  /**
   * Single cycle of the proactive generation pipeline
   * 1. Get highest confidence GUM proposition
   * 2. Generate actionable objective (JIT)
   * 3. Generate UI widget (GenUI)
   * 4. Notify user (G18)
   */
  private async runProactiveGenerationCycle(): Promise<void> {
    if (!this.isProactiveGenerationEnabled || !this.gumInitialized) {
      logger.debug('Background', 'Proactive generation skipped', {
        enabled: this.isProactiveGenerationEnabled,
        gumInitialized: this.gumInitialized,
      });
      return;
    }

    try {
      logger.info('Background', '🔄 Starting proactive generation cycle');

      // Step 1: Get highest confidence proposition from GUM
      const proposition = await generalUserAgent.getHighestConfidenceProposition();

      if (!proposition) {
        logger.info('Background', 'No propositions available yet');
        return;
      }

      // Check if this is a new proposition (different from last one)
      if (proposition.id === this.lastPropositionId) {
        logger.debug('Background', 'Same proposition as last cycle, skipping');
        return;
      }

      // Check confidence threshold (must be >= 0.8 per requirements)
      const effectiveConfidence = proposition.confidence * proposition.decayScore;
      if (effectiveConfidence < 0.8) {
        logger.info('Background', 'Proposition confidence too low for tool generation', {
          text: proposition.text,
          effectiveConfidence: effectiveConfidence.toFixed(2),
        });
        return;
      }

      logger.info('Background', '✅ High-confidence proposition found', {
        text: proposition.text,
        confidence: proposition.confidence.toFixed(2),
        decayScore: proposition.decayScore.toFixed(2),
        effectiveConfidence: effectiveConfidence.toFixed(2),
      });

      // Step 2: Generate actionable objective (JIT)
      const objective = await jitObjectiveAgent.generateActionableObjective(proposition);

      if (!objective) {
        logger.warn('Background', 'Failed to generate objective from proposition');
        return;
      }

      logger.info('Background', '✅ Actionable objective generated', {
        objective: objective.objective,
        toolType: objective.toolType,
        complexity: objective.complexity,
      });

      // Step 3: Generate UI widget (GenUI)
      const widgetResult = await generativeUIAgent.generateUIWidget(objective);

      if (!widgetResult.success || !widgetResult.widget) {
        logger.error('Background', 'Failed to generate widget', {
          error: widgetResult.error,
        });
        return;
      }

      logger.info('Background', '✅ UI widget generated successfully', {
        objective: objective.objective,
        htmlLength: widgetResult.widget.html.length,
        warnings: widgetResult.warnings?.length || 0,
      });

      // Step 4: Store the widget
      const storedWidget: StoredWidget = {
        id: generateId(),
        widget: widgetResult.widget,
        createdAt: Date.now(),
        usageCount: 0,
        lastUsedAt: Date.now(),
        isVisible: true,
        isPinned: false,
      };

      this.generatedWidgets.set(storedWidget.id, storedWidget);
      await this.saveStoredWidgets();

      // Update tracking
      this.lastPropositionId = proposition.id;
      this.lastGenerationTime = Date.now();

      // Step 5: Notify user (G18: Notify about changes)
      await this.notifyUserAboutNewTool(storedWidget, objective);

      logger.info('Background', '🎉 Proactive generation cycle complete', {
        widgetId: storedWidget.id,
        objective: objective.objective,
      });

    } catch (error) {
      logger.error('Background', 'Proactive generation cycle failed', error);
    }
  }

  /**
   * Notify user about new tool (G18: Notify about changes)
   */
  private async notifyUserAboutNewTool(
    widget: StoredWidget,
    objective: ActionableObjective
  ): Promise<void> {
    try {
      // Send notification to all tabs
      const tabs = await chrome.tabs.query({ active: true });
      
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, createMessage(
            'NEW_TOOL_GENERATED',
            {
              widgetId: widget.id,
              objective: objective.objective,
              toolType: objective.toolType,
              message: `Hi, I've analyzed your workflow and built a new '${objective.objective}' tool for you. You can find it in your KAIROS-SPECTRA panel.`,
            },
            'background'
          ));
        }
      }

      // Also show Chrome notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'KAIROS-SPECTRA: New Tool Generated',
        message: `${objective.objective}`,
        priority: 1,
      });

      logger.info('Background', 'User notified about new tool', {
        objective: objective.objective,
      });

    } catch (error) {
      logger.error('Background', 'Failed to notify user', error);
    }
  }

  /**
   * Load stored widgets from chrome.storage
   */
  private async loadStoredWidgets(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['generated_widgets']);
      
      if (result.generated_widgets && Array.isArray(result.generated_widgets)) {
        this.generatedWidgets = new Map(
          result.generated_widgets.map((w: StoredWidget) => [w.id, w])
        );
        logger.info('Background', 'Loaded stored widgets', {
          count: this.generatedWidgets.size,
        });
      }
    } catch (error) {
      logger.error('Background', 'Failed to load stored widgets', error);
    }
  }

  /**
   * Save stored widgets to chrome.storage
   */
  private async saveStoredWidgets(): Promise<void> {
    try {
      await chrome.storage.local.set({
        generated_widgets: Array.from(this.generatedWidgets.values()),
      });
      logger.debug('Background', 'Saved stored widgets', {
        count: this.generatedWidgets.size,
      });
    } catch (error) {
      logger.error('Background', 'Failed to save stored widgets', error);
    }
  }

  /**
   * Get all stored widgets
   */
  public getStoredWidgets(): StoredWidget[] {
    return Array.from(this.generatedWidgets.values());
  }

  /**
   * Toggle proactive generation on/off (G17: Provide global controls)
   */
  public async toggleProactiveGeneration(enabled: boolean): Promise<void> {
    this.isProactiveGenerationEnabled = enabled;
    
    await chrome.storage.sync.set({
      proactive_generation_enabled: enabled,
    });

    if (enabled) {
      this.startProactiveToolGenerationLoop();
    } else {
      this.stopProactiveToolGenerationLoop();
    }

    logger.info('Background', 'Proactive generation toggled', { enabled });
  }

  /**
   * Handle delete widget request (G8: Support efficient dismissal)
   */
  private async handleDeleteWidget(
    id: string,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      this.generatedWidgets.delete(id);
      await this.saveStoredWidgets();
      sendResponse({ success: true });
      logger.info('Background', 'Widget deleted', { id });
    } catch (error) {
      logger.error('Background', 'Failed to delete widget', error);
      sendResponse({ error: 'Delete failed' });
    }
  }

  /**
   * Handle rate widget request (user feedback)
   */
  private async handleRateWidget(
    id: string,
    rating: number,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      const widget = this.generatedWidgets.get(id);
      if (widget) {
        widget.userRating = rating;
        await this.saveStoredWidgets();
        sendResponse({ success: true });
        logger.info('Background', 'Widget rated', { id, rating });
      } else {
        sendResponse({ error: 'Widget not found' });
      }
    } catch (error) {
      logger.error('Background', 'Failed to rate widget', error);
      sendResponse({ error: 'Rating failed' });
    }
  }

  /**
   * Handle open widget request (track usage)
   */
  private async handleOpenWidget(
    id: string,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      const widget = this.generatedWidgets.get(id);
      if (widget) {
        widget.usageCount++;
        widget.lastUsedAt = Date.now();
        await this.saveStoredWidgets();
        sendResponse({ success: true, widget: widget.widget });
        logger.info('Background', 'Widget opened', { id, usageCount: widget.usageCount });
      } else {
        sendResponse({ error: 'Widget not found' });
      }
    } catch (error) {
      logger.error('Background', 'Failed to open widget', error);
      sendResponse({ error: 'Open failed' });
    }
  }
}

// Initialize background script
new KairosSpectraBackground();
