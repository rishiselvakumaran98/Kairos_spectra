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
import { widgetPanel } from './ui/WidgetPanel';
import type { StruggleEvent, ChromeMessage, StoredWidget } from './types';
import { logger, createMessage, sendMessageToBackground } from './utils';

class KairosSpectraContentScript {
  private isInitialized: boolean = false;
  private interactionFeedInterval: number | null = null;
  private injectedWidgets: Map<string, HTMLElement> = new Map();
  private keyboardShortcutHandler: ((e: KeyboardEvent) => void) | null = null;

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

    // Set up keyboard shortcut for widget panel (Cmd/Ctrl + Shift + W)
    this.setupKeyboardShortcut();

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

  /**
   * Set up keyboard shortcut to toggle widget panel (Cmd/Ctrl + Shift + W)
   */
  private setupKeyboardShortcut(): void {
    this.keyboardShortcutHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        this.showWidgetPanel();
      }
    };
    
    document.addEventListener('keydown', this.keyboardShortcutHandler);
    logger.info('ContentScript', 'Widget panel shortcut registered: Cmd/Ctrl + Shift + W');
  }

  /**
   * Show the widget panel with all generated widgets
   */
  private async showWidgetPanel(): Promise<void> {
    try {
      // Get stored widgets from background
      const response = await chrome.runtime.sendMessage(
        createMessage('GET_STORED_WIDGETS', {}, 'content')
      );

      const widgets: StoredWidget[] = response.widgets || [];
      
      logger.info('ContentScript', 'Showing widget panel', { count: widgets.length });

      widgetPanel.show(widgets, {
        onInject: this.injectWidget.bind(this),
        onPreview: this.previewWidget.bind(this),
        onDelete: this.deleteWidget.bind(this),
        onRate: this.rateWidget.bind(this),
        onDismiss: () => widgetPanel.hide(),
      });
    } catch (error) {
      logger.error('ContentScript', 'Failed to load widgets', error);
    }
  }

  /**
   * Inject a widget into the page
   */
  private async injectWidget(widgetId: string): Promise<void> {
    try {
      logger.info('ContentScript', 'Injecting widget', { widgetId });

      // Get widget from background
      const response = await chrome.runtime.sendMessage(
        createMessage('GET_STORED_WIDGETS', {}, 'content')
      );

      const widget = response.widgets?.find((w: StoredWidget) => w.id === widgetId);
      
      if (!widget) {
        logger.error('ContentScript', 'Widget not found', { widgetId });
        return;
      }

      // Create isolated container for widget
      const container = document.createElement('div');
      container.id = `kairos-widget-${widgetId}`;
      container.className = 'kairos-injected-widget';
      container.setAttribute('data-widget-id', widgetId);

      // Add widget HTML
      container.innerHTML = `
        <div class="widget-container">
          <div class="widget-header">
            <div class="widget-title">${widget.widget.metadata.objective}</div>
            <button class="widget-close" data-widget-id="${widgetId}">×</button>
          </div>
          <div class="widget-body">
            ${widget.widget.html}
          </div>
        </div>
      `;

      // Add widget CSS
      if (widget.widget.css) {
        const style = document.createElement('style');
        style.textContent = widget.widget.css;
        container.appendChild(style);
      }

      // Append to body
      document.body.appendChild(container);

      // Execute widget JavaScript (in isolated scope)
      if (widget.widget.js) {
        try {
          const widgetScope = {
            container,
            widgetId,
            logger,
          };
          
          const widgetFunction = new Function('scope', widget.widget.js);
          widgetFunction(widgetScope);
        } catch (error) {
          logger.error('ContentScript', 'Widget JS execution failed', error);
        }
      }

      // Track injected widget
      this.injectedWidgets.set(widgetId, container);

      // Set up close button
      const closeBtn = container.querySelector('.widget-close');
      closeBtn?.addEventListener('click', () => {
        this.removeInjectedWidget(widgetId);
      });

      // Notify background to update usage count
      await chrome.runtime.sendMessage(
        createMessage('OPEN_WIDGET', { widgetId }, 'content')
      );

      // Hide widget panel
      widgetPanel.hide();

      logger.info('ContentScript', 'Widget injected successfully', { widgetId });
    } catch (error) {
      logger.error('ContentScript', 'Widget injection failed', error);
    }
  }

  /**
   * Remove an injected widget from the page
   */
  private removeInjectedWidget(widgetId: string): void {
    const container = this.injectedWidgets.get(widgetId);
    if (container) {
      container.remove();
      this.injectedWidgets.delete(widgetId);
      logger.info('ContentScript', 'Widget removed', { widgetId });
    }
  }

  /**
   * Preview a widget before injection
   */
  private async previewWidget(widgetId: string): Promise<void> {
    try {
      logger.info('ContentScript', 'Previewing widget', { widgetId });

      // Get widget from background
      const response = await chrome.runtime.sendMessage(
        createMessage('GET_STORED_WIDGETS', {}, 'content')
      );

      const widget = response.widgets?.find((w: StoredWidget) => w.id === widgetId);
      
      if (!widget) {
        logger.error('ContentScript', 'Widget not found', { widgetId });
        return;
      }

      // Create preview modal
      const modal = document.createElement('div');
      modal.id = 'kairos-widget-preview';
      modal.className = 'kairos-widget-preview';
      
      modal.innerHTML = `
        <div class="preview-overlay"></div>
        <div class="preview-content">
          <div class="preview-header">
            <div class="preview-title">Widget Preview</div>
            <button class="preview-close">×</button>
          </div>
          <div class="preview-body">
            <iframe class="preview-iframe" sandbox="allow-scripts"></iframe>
          </div>
          <div class="preview-footer">
            <button class="preview-cancel">Cancel</button>
            <button class="preview-inject">Use This Tool</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Inject widget into iframe after it loads
      const iframe = modal.querySelector('.preview-iframe') as HTMLIFrameElement;
      
      iframe.onload = () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body { margin: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    ${widget.widget.css || ''}
                  </style>
                </head>
                <body>
                  ${widget.widget.html || '<p>No content</p>'}
                  <script>
                    try {
                      ${widget.widget.js || ''}
                    } catch (e) {
                      console.error('Widget error:', e);
                      document.body.innerHTML += '<p style="color: red;">Error loading widget</p>';
                    }
                  </script>
                </body>
              </html>
            `);
            iframeDoc.close();
            logger.info('ContentScript', 'Widget injected into preview iframe', { widgetId });
          }
        } catch (error) {
          logger.error('ContentScript', 'Failed to inject widget into iframe', error);
        }
      };
      
      // Trigger iframe load
      iframe.src = 'about:blank';

      // Set up event listeners
      modal.querySelector('.preview-close')?.addEventListener('click', () => modal.remove());
      modal.querySelector('.preview-cancel')?.addEventListener('click', () => modal.remove());
      modal.querySelector('.preview-inject')?.addEventListener('click', async () => {
        modal.remove();
        await this.injectWidget(widgetId);
      });

      logger.info('ContentScript', 'Widget preview shown', { widgetId });
    } catch (error) {
      logger.error('ContentScript', 'Widget preview failed', error);
    }
  }

  /**
   * Delete a widget
   */
  private async deleteWidget(widgetId: string): Promise<void> {
    try {
      logger.info('ContentScript', 'Deleting widget', { widgetId });

      await chrome.runtime.sendMessage(
        createMessage('DELETE_WIDGET', { widgetId }, 'content')
      );

      // Remove from page if injected
      this.removeInjectedWidget(widgetId);

      logger.info('ContentScript', 'Widget deleted', { widgetId });
    } catch (error) {
      logger.error('ContentScript', 'Widget deletion failed', error);
    }
  }

  /**
   * Rate a widget
   */
  private async rateWidget(widgetId: string, rating: number): Promise<void> {
    try {
      logger.info('ContentScript', 'Rating widget', { widgetId, rating });

      await chrome.runtime.sendMessage(
        createMessage('RATE_WIDGET', { widgetId, rating }, 'content')
      );

      logger.info('ContentScript', 'Widget rated', { widgetId, rating });
    } catch (error) {
      logger.error('ContentScript', 'Widget rating failed', error);
    }
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

      case 'NEW_TOOL_GENERATED':
        // Show notification that a new widget was generated
        logger.info('ContentScript', 'New tool generated', message.payload);
        this.showNewWidgetNotification(message.payload.widgetId);
        sendResponse({ success: true });
        break;

      case 'OPEN_WIDGET_PANEL':
        // Open widget panel from popup
        this.showWidgetPanel();
        sendResponse({ success: true });
        break;

      default:
        logger.warn('ContentScript', 'Unknown message type', message.type);
        sendResponse({ error: 'Unknown message type' });
    }

    return true; // Keep channel open for async response
  }

  /**
   * Show a notification when a new widget is generated
   */
  private async showNewWidgetNotification(widgetId: string): Promise<void> {
    // Get widget details
    const response = await chrome.runtime.sendMessage(
      createMessage('GET_STORED_WIDGETS', {}, 'content')
    );
    const widget = response.widgets?.find((w: StoredWidget) => w.id === widgetId);
    
    if (!widget) {
      logger.error('ContentScript', 'Widget not found for notification', { widgetId });
      return;
    }

    // Show proactive glyph cursor notification
    this.showProactiveGlyph(widget);
  }

  /**
   * Show proactive glyph cursor with widget suggestion
   */
  private showProactiveGlyph(widget: StoredWidget): void {
    const glyph = document.createElement('div');
    glyph.className = 'kairos-proactive-glyph';
    glyph.innerHTML = `
      <div class="glyph-container">
        <div class="glyph-pulse"></div>
        <div class="glyph-icon">✨</div>
        <div class="glyph-content">
          <div class="glyph-header">
            <div class="glyph-title">I noticed you're exploring data</div>
            <button class="glyph-dismiss">×</button>
          </div>
          <div class="glyph-message">
            ${widget.widget.metadata.objective}
          </div>
          <div class="glyph-actions">
            <button class="glyph-btn preview" data-action="preview">
              <span class="btn-icon">👁️</span>
              <span class="btn-text">Preview</span>
            </button>
            <button class="glyph-btn primary" data-action="generate">
              <span class="btn-icon">⚡</span>
              <span class="btn-text">Generate Tool</span>
            </button>
            <button class="glyph-btn" data-action="later">
              <span class="btn-text">Maybe Later</span>
            </button>
          </div>
          <div class="glyph-footer">
            Powered by your browsing patterns
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(glyph);

    // Position near cursor (bottom-right)
    setTimeout(() => {
      glyph.style.opacity = '1';
      glyph.style.transform = 'translateY(0)';
    }, 100);

    // Handle actions
    const handleAction = async (action: string) => {
      if (action === 'preview') {
        glyph.remove();
        await this.previewWidget(widget.id);
      } else if (action === 'generate') {
        glyph.remove();
        await this.injectWidget(widget.id);
      } else if (action === 'later') {
        glyph.classList.add('fade-out');
        setTimeout(() => glyph.remove(), 300);
      }
    };

    // Action buttons
    glyph.querySelectorAll('.glyph-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action) handleAction(action);
      });
    });

    // Dismiss button
    glyph.querySelector('.glyph-dismiss')?.addEventListener('click', () => {
      glyph.classList.add('fade-out');
      setTimeout(() => glyph.remove(), 300);
    });

    // Auto-dismiss after 15 seconds
    setTimeout(() => {
      if (glyph.parentElement) {
        glyph.classList.add('fade-out');
        setTimeout(() => glyph.remove(), 300);
      }
    }, 15000);

    logger.info('ContentScript', 'Proactive glyph shown', { widgetId: widget.id });
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
