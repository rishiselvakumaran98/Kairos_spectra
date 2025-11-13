/**
 * KAIROS-SPECTRA Content Script
 * 
 * This script runs in the context of web pages and coordinates all agents.
 * 
 * Phase 1 Flow (Sensing):
 * 1. PerceptionAgent monitors user interactions
 * 2. When struggle detected → DataAgent extracts data
 * 3. If DOM extraction fails → VisionAgent uses GPT-4V screenshot analysis
 * 
 * Phase 2 Flow (Guiding):
 * 4. OrchestratorAgent shows hierarchical guidance UI
 * 5. User selects analytical goal and viz type
 * 6. VisualizationAgent generates and renders chart
 * 7. User refines visualization iteratively
 */

import { perceptionAgent } from './agents/PerceptionAgent';
import { dataAgent } from './agents/DataAgent';
import { visionAgent } from './agents/VisionAgent';
import { orchestratorAgent } from './agents/OrchestratorAgent';
import type { StruggleEvent, ChromeMessage } from './types';
import { logger, createMessage, sendMessageToBackground } from './utils';

class KairosSpectraContentScript {
  private isInitialized: boolean = false;
  private interactionFeedInterval: number | null = null;

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

    // Periodically feed interactions to GUM for continuous learning (every 15 seconds)
    this.startPeriodicInteractionFeed();

    this.isInitialized = true;
    
    logger.info('ContentScript', 'Initialization complete');
    
    // Notify background script that content script is ready
    await this.notifyReady();
  }

  /**
   * Periodically send interaction history to GUM for continuous learning
   */
  private startPeriodicInteractionFeed(): void {
    this.interactionFeedInterval = window.setInterval(() => {
      const interactions = perceptionAgent.getRecentInteractions(50); // Last 50 interactions
      
      if (interactions.length > 0) {
        const message = createMessage(
          'AGENT_STATE_UPDATE',
          {
            interactionHistory: interactions,
            url: window.location.href,
          },
          'content'
        );

        sendMessageToBackground(message).catch((error) => {
          logger.debug('ContentScript', 'Failed to send periodic interactions (extension may be reloading)');
        });
      }
    }, 15000); // Every 15 seconds
  }

  private async handleStruggleDetected(event: StruggleEvent): Promise<void> {
    logger.info('ContentScript', 'Struggle event received', {
      type: event.pattern.type,
      confidence: event.pattern.confidence,
    });

    // CRITICAL: Check if guidance UI is already active
    // Prevents context switching while user is interacting with KAIROS
    if (orchestratorAgent.isGuidanceActive()) {
      logger.info('ContentScript', 'Ignoring struggle - guidance already active');
      return;
    }

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

      // Phase 2: Start hierarchical guidance if we have data
      if (extractionResult.extractedData.length > 0) {
        logger.info('ContentScript', 'Struggle detected, triggering Orchestrator guidance...');
        
        // Pause perception to prevent context switching
        perceptionAgent.pause();
        
        // Pass struggle event to orchestrator for GUM hesitation detection
        await orchestratorAgent.startHierarchicalGuidance(extractionResult, event);
      } else {
        logger.warn('ContentScript', 'Struggle detected, but no data extracted. Aborting guidance.');
      }

      // Send combined event AND interaction history to background script for GUM
      const message = createMessage(
        'STRUGGLE_DETECTED',
        {
          struggleEvent: event,
          extractionResult,
          interactionHistory: event.interactionHistory, // Send interactions to GUM
        },
        'content'
      );

      await sendMessageToBackground(message);

      logger.info('ContentScript', 'Struggle event and data sent to background');
    } catch (error) {
      // Handle extension context invalidation gracefully
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        logger.warn('ContentScript', 'Extension was reloaded. KAIROS-SPECTRA stopped until page refresh.');
        
        // Stop perception agent to prevent further errors
        perceptionAgent.stop();
        
        // Optionally show a notification to the user
        console.warn(
          '⚠️ KAIROS-SPECTRA: Extension was reloaded. Please refresh this page to re-enable assistance.'
        );
      } else {
        logger.error('ContentScript', 'Failed to handle struggle event', error);
      }
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
      if (error instanceof Error && error.message.includes('Extension context invalidated')) {
        logger.warn('ContentScript', 'Extension context invalidated - page refresh needed');
      } else {
        logger.warn('ContentScript', 'Failed to notify background (extension may not be loaded)');
      }
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
