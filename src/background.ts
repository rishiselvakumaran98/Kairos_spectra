/**
 * KAIROS-SPECTRA Background Script
 * 
 * Service worker that manages extension lifecycle and coordinates
 * between content scripts and UI components.
 */

import type { ChromeMessage, StruggleEvent, DataExtractionResult } from './types';
import { logger, createMessage } from './utils';

class KairosSpectraBackground {
  private activeTabId: number | null = null;
  private struggleHistory: Map<string, { event: StruggleEvent; data: DataExtractionResult }> = new Map();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    logger.info('Background', 'Initializing KAIROS-SPECTRA background script');

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Track active tab
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));

    // Handle extension icon click
    chrome.action.onClicked.addListener(this.handleActionClick.bind(this));

    logger.info('Background', 'Background script initialized');
  }

  private handleMessage(
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

      case 'AGENT_STATE_UPDATE':
        if (message.payload.contentScriptReady) {
          logger.info('Background', 'Content script ready', {
            url: message.payload.url,
            tabId: sender.tab?.id,
          });
        }
        sendResponse({ acknowledged: true });
        break;

      case 'DATA_EXTRACTION_REQUEST':
        // Future: handle manual data extraction requests
        sendResponse({ error: 'Not implemented yet' });
        break;

      default:
        logger.warn('Background', 'Unknown message type', message.type);
        sendResponse({ error: 'Unknown message type' });
    }

    return true;
  }

  private handleStruggleDetected(
    payload: { struggleEvent: StruggleEvent; extractionResult: DataExtractionResult },
    tabId?: number
  ): void {
    const { struggleEvent, extractionResult } = payload;

    logger.info('Background', 'Struggle detected in tab', {
      tabId,
      type: struggleEvent.pattern.type,
      confidence: struggleEvent.pattern.confidence,
      dataExtracted: extractionResult.extractedData.length,
    });

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
}

// Initialize background script
new KairosSpectraBackground();
