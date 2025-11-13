/**
 * KAIROS-SPECTRA Background Script
 * 
 * Service worker that manages extension lifecycle and coordinates
 * between content scripts and UI components.
 */

import type { ChromeMessage, StruggleEvent, DataExtractionResult, UserInteractionEvent } from './types';
import { logger, createMessage } from './utils';
import { generalUserAgent } from './agents/GeneralUserAgent';

class KairosSpectraBackground {
  private activeTabId: number | null = null;
  private struggleHistory: Map<string, { event: StruggleEvent; data: DataExtractionResult }> = new Map();
  private gumInitialized: boolean = false;

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
      const result = await chrome.storage.sync.get(['openai_api_key']);
      const apiKey = result.openai_api_key;
      
      if (apiKey) {
        await generalUserAgent.start(apiKey);
        this.gumInitialized = true;
        logger.info('BackgroundScript', 'GUM initialized successfully with OpenAI API');
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

      case 'GUM_TRIGGER_INFERENCE':
        this.handleGUMTriggerInference(sendResponse);
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
}

// Initialize background script
new KairosSpectraBackground();
