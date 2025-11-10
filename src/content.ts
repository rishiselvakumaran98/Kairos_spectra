/**
 * KAIROS-SPECTRA Content Script
 * 
 * This script runs in the context of web pages and coordinates
 * the PerceptionAgent and DataAgent.
 * 
 * Flow:
 * 1. PerceptionAgent monitors user interactions
 * 2. When struggle detected → DataAgent extracts data
 * 3. If DOM extraction fails → VisionAgent uses GPT-4V screenshot analysis
 * 4. Results sent to background script for processing
 */

import { perceptionAgent } from './agents/PerceptionAgent';
import { dataAgent } from './agents/DataAgent';
import { visionAgent } from './agents/VisionAgent';
import type { StruggleEvent, ChromeMessage } from './types';
import { logger, createMessage, sendMessageToBackground } from './utils';

class KairosSpectraContentScript {
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.info('ContentScript', 'Initializing KAIROS-SPECTRA');

    // Start perception monitoring
    perceptionAgent.start(this.handleStruggleDetected.bind(this));

    // Set up message listener for commands from background/popup
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    this.isInitialized = true;
    
    logger.info('ContentScript', 'Initialization complete');
    
    // Notify background script that content script is ready
    await this.notifyReady();
  }

  private async handleStruggleDetected(event: StruggleEvent): Promise<void> {
    logger.info('ContentScript', 'Struggle event received', {
      type: event.pattern.type,
      confidence: event.pattern.confidence,
    });

    try {
      // Extract data from involved elements using DOM scraping
      const extractionResult = await dataAgent.extractFromStruggleEvent(event);

      // If DOM extraction failed (no data extracted), fall back to vision analysis
      if (extractionResult.extractedData.length === 0 && event.interactionHistory.length > 0) {
        logger.info('ContentScript', 'DOM extraction failed, trying vision analysis');
        
        // Get last interaction position for cursor location
        const lastInteraction = event.interactionHistory[event.interactionHistory.length - 1];
        
        if (lastInteraction.position) {
          const mousePosition = lastInteraction.position;
          const elementSelector = lastInteraction.target.element;

          // Use vision agent to analyze screenshot
          const visionData = await visionAgent.analyzeStrugglePoint(mousePosition, elementSelector);
          
          if (visionData) {
            logger.info('ContentScript', 'Vision analysis succeeded', {
              type: visionData.type,
              confidence: visionData.confidence,
            });
            extractionResult.extractedData.push(visionData);
          } else {
            logger.warn('ContentScript', 'Vision analysis also failed');
          }
        }
      }

      // Log detailed extraction results to page console (for Phase 1 debugging)
      this.logExtractionResults(event, extractionResult);

      // Send combined event to background script
      const message = createMessage(
        'STRUGGLE_DETECTED',
        {
          struggleEvent: event,
          extractionResult,
        },
        'content'
      );

      await sendMessageToBackground(message);

      logger.info('ContentScript', 'Struggle event and data sent to background');
    } catch (error) {
      logger.error('ContentScript', 'Failed to handle struggle event', error);
    }
  }

  private logExtractionResults(
    event: StruggleEvent,
    extraction: { extractedData: any[] }
  ): void {
    console.log('='.repeat(80));
    console.log('🎯 KAIROS-SPECTRA: Struggle Detected');
    console.log('='.repeat(80));
    console.log('Pattern:', event.pattern.type);
    console.log('Confidence:', (event.pattern.confidence * 100).toFixed(1) + '%');
    console.log('Elements involved:', event.involvedElements.length);
    console.log('Data extracted:', extraction.extractedData.length);
    console.log('\n📊 Extracted Data:');
    extraction.extractedData.forEach((data, idx) => {
      console.log(`\n  ${idx + 1}. Type: ${data.type}, Confidence: ${(data.confidence * 100).toFixed(1)}%`);
      console.log('     Data:', data.data);
    });
    console.log('='.repeat(80));
  }

  private handleMessage(
    message: ChromeMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    logger.debug('ContentScript', 'Message received', message);

    switch (message.type) {
      case 'PERCEPTION_STATUS':
        sendResponse({
          isActive: perceptionAgent.getState().isActive,
          state: perceptionAgent.getState(),
        });
        break;

      case 'AGENT_STATE_UPDATE':
        // Handle configuration updates from popup
        if (message.payload.perceptionConfig) {
          perceptionAgent.updateConfig(message.payload.perceptionConfig);
        }
        sendResponse({ success: true });
        break;

      default:
        logger.warn('ContentScript', 'Unknown message type', message.type);
        sendResponse({ error: 'Unknown message type' });
    }

    return true; // Keep channel open for async response
  }

  private async notifyReady(): Promise<void> {
    const message = createMessage(
      'AGENT_STATE_UPDATE',
      {
        contentScriptReady: true,
        url: window.location.href,
      },
      'content'
    );

    try {
      await sendMessageToBackground(message);
    } catch (error) {
      logger.warn('ContentScript', 'Failed to notify background (extension may not be loaded)');
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new KairosSpectraContentScript();
  });
} else {
  new KairosSpectraContentScript();
}

// Also export for testing
export { KairosSpectraContentScript };
