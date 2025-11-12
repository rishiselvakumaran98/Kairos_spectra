/**
 * KAIROS-SPECTRA Hierarchical Guidance UI
 * Phase 2: Floating UI Manager
 * 
 * Implements COWPILOT-style non-intrusive floating UI injection
 * with FlowForge's 3-level hierarchical abstraction:
 * 
 * Level 1: Task Planning - Analytical goal selection
 * Level 2: Viz Selection - Chart type selection  
 * Level 3: Refinement - Interactive chart refinement
 * 
 * References:
 * - COWPILOT (Zora et al.): Visual indicator highlighting, floating UI
 * - FlowForge (Hao et al.): Hierarchical abstraction levels
 */

import type {
  DataExtractionResult,
  AnalyticalGoal,
  VizType,
  InferredContext,
} from '../types';
import { logger } from '../utils';
import { visualizationAgent } from '../agents/VisualizationAgent';

interface TaskPlanningCallbacks {
  onGoalSelected: (goal: AnalyticalGoal) => void;
  onDismiss: () => void;
}

interface VizSelectionCallbacks {
  onVizTypeSelected: (vizType: VizType) => void;
  onBack: () => void;
  onDismiss: () => void;
}

interface RefinementCallbacks {
  onRefine: (userPrompt: string) => void;
  onBack: () => void;
  onDismiss: () => void;
}

export class HierarchicalGuidanceUI {
  private container: HTMLElement | null = null;
  private currentLevel: 'TASK_PLANNING' | 'VIZ_SELECTION' | 'REFINEMENT' = 'TASK_PLANNING';

  constructor() {
    logger.info('HierarchicalGuidanceUI', 'Initialized');
  }

  /**
   * Level 1: Show Task Planning UI
   * Displays analytical goal options with inferred context
   */
  public async showTaskPlanningUI(
    extractionResult: DataExtractionResult,
    context: InferredContext,
    callbacks: TaskPlanningCallbacks
  ): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Showing Task Planning UI', { context });

    this.currentLevel = 'TASK_PLANNING';
    this.createOrGetContainer();

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">🧭</div>
        <div class="kairos-title">KAIROS-SPECTRA</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-context">
        <div class="kairos-context-icon">💡</div>
        <div class="kairos-context-message">${context.message}</div>
        <div class="kairos-confidence">Confidence: ${Math.round(context.confidence * 100)}%</div>
      </div>

      <div class="kairos-level-indicator">Level 1: Choose Your Goal</div>

      <div class="kairos-goals">
        <button class="kairos-goal-btn" data-goal="compare_trends">
          <span class="goal-icon">📈</span>
          <span class="goal-title">Compare Trends</span>
          <span class="goal-desc">See patterns over time or categories</span>
        </button>

        <button class="kairos-goal-btn" data-goal="analyze_distribution">
          <span class="goal-icon">📊</span>
          <span class="goal-title">Analyze Distribution</span>
          <span class="goal-desc">Understand data spread and frequency</span>
        </button>

        <button class="kairos-goal-btn" data-goal="find_outliers">
          <span class="goal-icon">🔍</span>
          <span class="goal-title">Find Outliers</span>
          <span class="goal-desc">Identify unusual data points</span>
        </button>
      </div>

      <div class="kairos-footer">
        <span class="kairos-help">Need help? Hover over options for details</span>
      </div>
    `;

    this.container!.innerHTML = html;
    this.attachTaskPlanningListeners(callbacks);
    this.show();
  }

  /**
   * Level 2: Show Viz Selection UI
   * Displays visualization type options based on selected goal
   */
  public async showVizSelectionUI(
    goal: AnalyticalGoal,
    callbacks: VizSelectionCallbacks
  ): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Showing Viz Selection UI', { goal });

    this.currentLevel = 'VIZ_SELECTION';
    this.createOrGetContainer();

    const vizOptions = this.getVizOptionsForGoal(goal);
    const goalTitle = this.getGoalTitle(goal);

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">📊</div>
        <div class="kairos-title">KAIROS-SPECTRA</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-breadcrumb">
        <button class="kairos-back-btn" id="kairos-back">← Back</button>
        <span>${goalTitle}</span>
      </div>

      <div class="kairos-level-indicator">Level 2: Choose Visualization Type</div>

      <div class="kairos-viz-types">
        ${vizOptions.map(opt => `
          <button class="kairos-viz-btn" data-viz-type="${opt.type}">
            <span class="viz-icon">${opt.icon}</span>
            <span class="viz-title">${opt.title}</span>
            <span class="viz-desc">${opt.description}</span>
          </button>
        `).join('')}
      </div>

      <div class="kairos-footer">
        <span class="kairos-help">Click a chart type to generate visualization</span>
      </div>
    `;

    this.container!.innerHTML = html;
    this.attachVizSelectionListeners(callbacks);
    this.show();
  }

  /**
   * Level 3: Show Refinement UI
   * Displays rendered chart with refinement input
   */
  public async showRefinementUI(
    spec: any,
    callbacks: RefinementCallbacks
  ): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Showing Refinement UI');

    this.currentLevel = 'REFINEMENT';
    this.createOrGetContainer();

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">🎨</div>
        <div class="kairos-title">KAIROS-SPECTRA</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-breadcrumb">
        <button class="kairos-back-btn" id="kairos-back">← Change Chart</button>
      </div>

      <div class="kairos-level-indicator">Level 3: Refine Your Visualization</div>

      <div class="kairos-chart-container" id="kairos-chart"></div>

      <div class="kairos-refinement">
        <label class="kairos-refine-label">
          💬 Tell me how to improve this chart:
        </label>
        <div class="kairos-refine-input-group">
          <input 
            type="text" 
            id="kairos-refine-input" 
            class="kairos-refine-input" 
            placeholder='e.g., "make this a stacked bar chart" or "add color by category"'
          />
          <button class="kairos-refine-btn" id="kairos-refine-btn">Refine</button>
        </div>
        <div class="kairos-refine-suggestions">
          <span class="suggestion-label">Try:</span>
          <button class="suggestion-chip" data-suggestion="make this a line chart">📈 Line chart</button>
          <button class="suggestion-chip" data-suggestion="add color">🎨 Add color</button>
          <button class="suggestion-chip" data-suggestion="show as stacked bars">📊 Stack bars</button>
        </div>
      </div>

      <div class="kairos-footer">
        <span class="kairos-help">Powered by Amershi et al. G9: Support efficient correction</span>
      </div>
    `;

    this.container!.innerHTML = html;

    // Render the chart
    const chartContainer = document.getElementById('kairos-chart');
    if (chartContainer) {
      try {
        await visualizationAgent.renderVegaLite(spec, chartContainer);
      } catch (error) {
        logger.error('HierarchicalGuidanceUI', 'Failed to render chart', error);
        this.showError('Failed to render visualization');
      }
    }

    this.attachRefinementListeners(callbacks);
    this.show();
  }

  /**
   * Update chart in the current refinement UI
   */
  public async updateChart(spec: any): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Updating chart');

    const chartContainer = document.getElementById('kairos-chart');
    if (chartContainer) {
      // Clear previous chart
      chartContainer.innerHTML = '';

      try {
        await visualizationAgent.renderVegaLite(spec, chartContainer);
        
        // Show success feedback
        const input = document.getElementById('kairos-refine-input') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.placeholder = '✓ Chart updated! Try another refinement...';
          setTimeout(() => {
            input.placeholder = 'e.g., "make this a stacked bar chart"';
          }, 2000);
        }
      } catch (error) {
        logger.error('HierarchicalGuidanceUI', 'Failed to update chart', error);
        this.showError('Failed to update visualization');
      }
    }
  }

  /**
   * Show error message in the UI
   */
  public showError(message: string): void {
    if (!this.container) return;

    const errorDiv = document.createElement('div');
    errorDiv.className = 'kairos-error';
    errorDiv.textContent = `⚠️ ${message}`;
    
    this.container.insertBefore(errorDiv, this.container.firstChild);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  /**
   * Hide the UI
   */
  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      logger.info('HierarchicalGuidanceUI', 'UI hidden');
    }
  }

  /**
   * Show the UI
   */
  private show(): void {
    if (this.container) {
      this.container.style.display = 'block';
      logger.info('HierarchicalGuidanceUI', 'UI shown');
    }
  }

  /**
   * Create or get the main container div
   */
  private createOrGetContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'kairos-spectra-ui';
      this.container.className = 'kairos-container';
      document.body.appendChild(this.container);
      logger.info('HierarchicalGuidanceUI', 'Container created and injected');
    }
    return this.container;
  }

  // ============================================================================
  // Event Listener Attachments
  // ============================================================================

  private attachTaskPlanningListeners(callbacks: TaskPlanningCallbacks): void {
    // Goal selection buttons
    const goalBtns = this.container!.querySelectorAll('.kairos-goal-btn');
    goalBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const goal = (btn as HTMLElement).dataset.goal as AnalyticalGoal;
        callbacks.onGoalSelected(goal);
      });
    });

    // Dismiss button
    const dismissBtn = document.getElementById('kairos-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => callbacks.onDismiss());
    }
  }

  private attachVizSelectionListeners(callbacks: VizSelectionCallbacks): void {
    // Viz type buttons
    const vizBtns = this.container!.querySelectorAll('.kairos-viz-btn');
    vizBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const vizType = (btn as HTMLElement).dataset.vizType as VizType;
        callbacks.onVizTypeSelected(vizType);
      });
    });

    // Back button
    const backBtn = document.getElementById('kairos-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => callbacks.onBack());
    }

    // Dismiss button
    const dismissBtn = document.getElementById('kairos-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => callbacks.onDismiss());
    }
  }

  private attachRefinementListeners(callbacks: RefinementCallbacks): void {
    // Refine button
    const refineBtn = document.getElementById('kairos-refine-btn');
    const refineInput = document.getElementById('kairos-refine-input') as HTMLInputElement;

    if (refineBtn && refineInput) {
      const handleRefine = () => {
        const prompt = refineInput.value.trim();
        if (prompt) {
          callbacks.onRefine(prompt);
        }
      };

      refineBtn.addEventListener('click', handleRefine);
      refineInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleRefine();
        }
      });
    }

    // Suggestion chips
    const suggestionChips = this.container!.querySelectorAll('.suggestion-chip');
    suggestionChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const suggestion = (chip as HTMLElement).dataset.suggestion;
        if (suggestion && refineInput) {
          refineInput.value = suggestion;
          callbacks.onRefine(suggestion);
        }
      });
    });

    // Back button
    const backBtn = document.getElementById('kairos-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => callbacks.onBack());
    }

    // Dismiss button
    const dismissBtn = document.getElementById('kairos-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => callbacks.onDismiss());
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getVizOptionsForGoal(goal: AnalyticalGoal) {
    const vizOptionsMap: Record<AnalyticalGoal, Array<{ type: VizType; icon: string; title: string; description: string }>> = {
      compare_trends: [
        { type: 'line_chart', icon: '📈', title: 'Line Chart', description: 'See trends over time' },
        { type: 'bar_chart', icon: '📊', title: 'Bar Chart', description: 'Compare categories' },
        { type: 'scatter_plot', icon: '⚫', title: 'Scatter Plot', description: 'Find relationships' },
      ],
      analyze_distribution: [
        { type: 'histogram', icon: '📶', title: 'Histogram', description: 'Show frequency distribution' },
        { type: 'box_plot', icon: '📦', title: 'Box Plot', description: 'See quartiles and outliers' },
        { type: 'bar_chart', icon: '📊', title: 'Bar Chart', description: 'Count by category' },
      ],
      find_outliers: [
        { type: 'scatter_plot', icon: '⚫', title: 'Scatter Plot', description: 'Spot unusual points' },
        { type: 'box_plot', icon: '📦', title: 'Box Plot', description: 'Identify extremes' },
      ],
      correlation_analysis: [
        { type: 'scatter_plot', icon: '⚫', title: 'Scatter Plot', description: 'See correlations' },
        { type: 'heatmap', icon: '🔥', title: 'Heatmap', description: 'Show correlation matrix' },
      ],
      custom: [
        { type: 'bar_chart', icon: '📊', title: 'Bar Chart', description: 'General purpose' },
        { type: 'line_chart', icon: '📈', title: 'Line Chart', description: 'General purpose' },
        { type: 'scatter_plot', icon: '⚫', title: 'Scatter Plot', description: 'General purpose' },
      ],
    };

    return vizOptionsMap[goal] || vizOptionsMap.custom;
  }

  private getGoalTitle(goal: AnalyticalGoal): string {
    const titleMap: Record<AnalyticalGoal, string> = {
      compare_trends: 'Compare Trends',
      analyze_distribution: 'Analyze Distribution',
      find_outliers: 'Find Outliers',
      correlation_analysis: 'Correlation Analysis',
      custom: 'Custom Analysis',
    };

    return titleMap[goal] || 'Analysis';
  }

  // ============================================================================
  // NEW: Chart Analysis Mode Methods
  // ============================================================================

  /**
   * Show Chart Analysis UI (for EXISTING charts)
   * User wants help understanding a chart, not creating new one
   */
  public async showChartAnalysisUI(options: {
    chartType: string;
    dataDescription: string;
    possibleActions: string[];
    visionData: any;
    onSnipChart: () => void;
    onAskQuestion: (question: string) => void;
    onDismiss: () => void;
  }): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Showing Chart Analysis UI');

    this.createOrGetContainer();

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">📊</div>
        <div class="kairos-title">Chart Analysis Assistant</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-context">
        <div class="kairos-context-icon">👁️</div>
        <div class="kairos-context-message">
          I see you're looking at a <strong>${options.chartType}</strong>
          ${options.dataDescription ? `showing ${options.dataDescription}` : ''}.
        </div>
      </div>

      <div class="kairos-chart-analysis">
        <h3>How can I help you understand this chart?</h3>
        
        <button class="kairos-action-btn kairos-snip-btn" id="kairos-snip-chart">
          <span class="action-icon">✂️</span>
          <span class="action-title">Snip & Analyze Chart</span>
          <span class="action-desc">Take a screenshot of the specific area you want analyzed</span>
        </button>

        <div class="kairos-divider">or ask me directly:</div>

        <div class="kairos-chat-input-container">
          <textarea 
            id="kairos-chart-question" 
            class="kairos-chat-input" 
            placeholder="E.g., 'What trends do you see?' or 'Which category has the highest value?'"
            rows="3"
          ></textarea>
          <button class="kairos-send-btn" id="kairos-send-question">
            <span>Ask</span>
            <span class="send-icon">→</span>
          </button>
        </div>

        ${options.possibleActions.length > 0 ? `
          <div class="kairos-suggestions">
            <div class="suggestion-label">💡 Suggested questions:</div>
            ${options.possibleActions.slice(0, 3).map(action => `
              <button class="kairos-suggestion-chip" data-question="${action}">
                ${action}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="kairos-footer">
        <span class="kairos-help">I'll use AI vision to analyze the chart and answer your questions</span>
      </div>
    `;

    this.container!.innerHTML = html;

    // Attach listeners
    document.getElementById('kairos-snip-chart')?.addEventListener('click', options.onSnipChart);
    document.getElementById('kairos-dismiss')?.addEventListener('click', options.onDismiss);
    
    const questionInput = document.getElementById('kairos-chart-question') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('kairos-send-question');
    
    sendBtn?.addEventListener('click', () => {
      const question = questionInput?.value.trim();
      if (question) {
        options.onAskQuestion(question);
      }
    });

    // Enter key to send
    questionInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const question = questionInput.value.trim();
        if (question) {
          options.onAskQuestion(question);
        }
      }
    });

    // Suggestion chips
    this.container!.querySelectorAll('.kairos-suggestion-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const question = chip.getAttribute('data-question');
        if (question) {
          options.onAskQuestion(question);
        }
      });
    });

    this.show();
  }

  /**
   * Show snipping mode overlay
   */
  public showSnipMode(options: {
    onSnipComplete: (screenshotData: string, boundingBox: any) => void;
    onCancel: () => void;
  }): void {
    logger.info('HierarchicalGuidanceUI', 'Showing Snip Mode');

    // Create full-screen overlay for snipping
    const overlay = document.createElement('div');
    overlay.id = 'kairos-snip-overlay';
    overlay.className = 'kairos-snip-overlay';
    overlay.innerHTML = `
      <div class="kairos-snip-instructions">
        <div class="snip-icon">✂️</div>
        <div class="snip-text">Click and drag to select the chart area</div>
        <button class="kairos-cancel-snip" id="kairos-cancel-snip">Cancel (ESC)</button>
      </div>
      <canvas id="kairos-snip-canvas"></canvas>
    `;

    document.body.appendChild(overlay);

    const canvas = document.getElementById('kairos-snip-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    // Mouse down - start selection
    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    // Mouse move - draw selection rectangle
    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      const width = e.clientX - startX;
      const height = e.clientY - startY;
      
      ctx.strokeRect(startX, startY, width, height);
      ctx.fillStyle = 'rgba(79, 70, 229, 0.1)';
      ctx.fillRect(startX, startY, width, height);
    });

    // Mouse up - capture selection
    canvas.addEventListener('mouseup', async (e) => {
      if (!isDrawing) return;
      
      isDrawing = false;
      
      const endX = e.clientX;
      const endY = e.clientY;
      
      const boundingBox = {
        x: Math.min(startX, endX),
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
      };

      // Validate selection size
      if (boundingBox.width < 50 || boundingBox.height < 50) {
        logger.warn('HierarchicalGuidanceUI', 'Selection too small, ignoring');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isDrawing = false;
        return;
      }

      // Show preview with confirm/cancel buttons
      const previewDiv = document.createElement('div');
      previewDiv.className = 'kairos-snip-preview';
      previewDiv.innerHTML = `
        <div class="snip-preview-header">
          <div class="snip-icon">✂️</div>
          <div class="snip-text">Review your selection</div>
        </div>
        <div class="snip-preview-box" style="
          position: absolute;
          left: ${boundingBox.x}px;
          top: ${boundingBox.y}px;
          width: ${boundingBox.width}px;
          height: ${boundingBox.height}px;
          border: 3px solid #4F46E5;
          background: rgba(79, 70, 229, 0.1);
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        "></div>
        <div class="snip-preview-actions">
          <button class="kairos-cancel-snip" id="kairos-redo-snip">↻ Re-select</button>
          <button class="kairos-confirm-snip" id="kairos-confirm-snip">✓ Analyze This Area</button>
        </div>
      `;
      
      overlay.appendChild(previewDiv);
      
      // Clear canvas to show preview box
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Redo button
      document.getElementById('kairos-redo-snip')?.addEventListener('click', () => {
        previewDiv.remove();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });

      // Confirm button - capture and analyze
      document.getElementById('kairos-confirm-snip')?.addEventListener('click', async () => {
        overlay.remove();
        
        // Use Chrome API to capture full screenshot
        chrome.runtime.sendMessage(
          { 
            type: 'CAPTURE_SCREENSHOT',
            timestamp: Date.now(),
            source: 'content'
          },
          (response: { screenshot?: string; dataUrl?: string }) => {
            const screenshot = response?.screenshot || response?.dataUrl;
            if (screenshot) {
              options.onSnipComplete(screenshot, boundingBox);
            } else {
              logger.error('HierarchicalGuidanceUI', 'No screenshot in response');
              options.onCancel();
            }
          }
        );
      });
    });

    // Cancel button and ESC key
    const cancelBtn = document.getElementById('kairos-cancel-snip');
    const handleCancel = () => {
      overlay.remove();
      options.onCancel();
    };
    
    cancelBtn?.addEventListener('click', handleCancel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    }, { once: true });
  }

  /**
   * Show chart insights after analysis
   */
  public async showChartInsights(options: {
    chartType: string;
    insights: string[];
    trends: string[];
    suggestions: string[];
    onAskFollowUp: (question: string) => void;
    onDismiss: () => void;
  }): Promise<void> {
    logger.info('HierarchicalGuidanceUI', 'Showing Chart Insights');

    this.createOrGetContainer();

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">🔍</div>
        <div class="kairos-title">Chart Analysis Results</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-insights-container">
        <h3>${options.chartType} Analysis</h3>

        ${options.insights.length > 0 ? `
          <div class="insight-section">
            <h4>📊 Key Insights</h4>
            <ul class="insight-list">
              ${options.insights.map(insight => `<li>${insight}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${options.trends.length > 0 ? `
          <div class="insight-section">
            <h4>📈 Trends Detected</h4>
            <ul class="insight-list">
              ${options.trends.map(trend => `<li>${trend}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${options.suggestions.length > 0 ? `
          <div class="insight-section">
            <h4>💡 Suggestions</h4>
            <ul class="insight-list">
              ${options.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="kairos-chat-input-container">
          <textarea 
            id="kairos-followup-question" 
            class="kairos-chat-input" 
            placeholder="Ask a follow-up question..."
            rows="2"
          ></textarea>
          <button class="kairos-send-btn" id="kairos-send-followup">
            <span>Ask</span>
            <span class="send-icon">→</span>
          </button>
        </div>
      </div>
    `;

    this.container!.innerHTML = html;

    // Attach listeners
    document.getElementById('kairos-dismiss')?.addEventListener('click', options.onDismiss);
    
    const followupInput = document.getElementById('kairos-followup-question') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('kairos-send-followup');
    
    sendBtn?.addEventListener('click', () => {
      const question = followupInput?.value.trim();
      if (question) {
        options.onAskFollowUp(question);
      }
    });

    this.show();
  }

  /**
   * Show thinking/loading state
   */
  public showThinking(): void {
    if (!this.container) return;

    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'kairos-thinking';
    thinkingDiv.innerHTML = `
      <div class="thinking-spinner"></div>
      <div class="thinking-text">Analyzing chart...</div>
    `;

    // Insert at top
    this.container.insertBefore(thinkingDiv, this.container.firstChild);
  }

  /**
   * Show chat response
   */
  public showChatResponse(options: {
    question: string;
    answer: string;
    suggestions: string[];
    onAskFollowUp: (question: string) => void;
    onSnipChart: () => void;
    onDismiss: () => void;
  }): void {
    logger.info('HierarchicalGuidanceUI', 'Showing Chat Response');

    this.createOrGetContainer();

    const html = `
      <div class="kairos-header">
        <div class="kairos-icon">💬</div>
        <div class="kairos-title">Chart Assistant</div>
        <button class="kairos-dismiss" id="kairos-dismiss">×</button>
      </div>

      <div class="kairos-chat-history">
        <div class="chat-message user-message">
          <div class="message-label">You asked:</div>
          <div class="message-content">${options.question}</div>
        </div>

        <div class="chat-message assistant-message">
          <div class="message-label">Assistant:</div>
          <div class="message-content">${options.answer}</div>
        </div>

        ${options.suggestions.length > 0 ? `
          <div class="kairos-suggestions">
            <div class="suggestion-label">💡 You might also want to know:</div>
            ${options.suggestions.map(suggestion => `
              <button class="kairos-suggestion-chip" data-question="${suggestion}">
                ${suggestion}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="kairos-chat-actions">
        <button class="kairos-action-btn-small" id="kairos-snip-chart-again">
          ✂️ Snip Another Area
        </button>
      </div>

      <div class="kairos-chat-input-container">
        <textarea 
          id="kairos-followup-question" 
          class="kairos-chat-input" 
          placeholder="Ask another question..."
          rows="2"
        ></textarea>
        <button class="kairos-send-btn" id="kairos-send-followup">
          <span>Ask</span>
          <span class="send-icon">→</span>
        </button>
      </div>
    `;

    this.container!.innerHTML = html;

    // Attach listeners
    document.getElementById('kairos-dismiss')?.addEventListener('click', options.onDismiss);
    document.getElementById('kairos-snip-chart-again')?.addEventListener('click', options.onSnipChart);
    
    const followupInput = document.getElementById('kairos-followup-question') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('kairos-send-followup');
    
    sendBtn?.addEventListener('click', () => {
      const question = followupInput?.value.trim();
      if (question) {
        options.onAskFollowUp(question);
      }
    });

    // Suggestion chips
    this.container!.querySelectorAll('.kairos-suggestion-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const question = chip.getAttribute('data-question');
        if (question) {
          options.onAskFollowUp(question);
        }
      });
    });

    this.show();
  }
}

// Singleton instance
export const hierarchicalGuidanceUI = new HierarchicalGuidanceUI();
