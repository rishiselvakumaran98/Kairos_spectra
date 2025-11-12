/**
 * TrustIndicatorUI - Visual trust & confidence indicators
 * 
 * Implements:
 * - G2 (Clarity): Show confidence scores clearly
 * - G11 (Transparency): Visual grounding of data sources and agent reasoning
 * 
 * Displays:
 * - Confidence badges (color-coded: high=green, medium=yellow, low=red)
 * - Data source indicators (where the data came from)
 * - Agent decision trail ("breadcrumbs" of reasoning)
 */

import { StruggleExplanation, VizRecommendationExplanation, ChartInterpretation } from '../agents/ExplanationEngine';

/**
 * Confidence level categorization
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Configuration for trust indicators
 */
export interface TrustIndicatorConfig {
  showConfidenceBadges: boolean;
  showDataSources: boolean;
  showReasoningTrail: boolean;
  expandByDefault: boolean;
}

export class TrustIndicatorUI {
  private config: TrustIndicatorConfig = {
    showConfidenceBadges: true,
    showDataSources: true,
    showReasoningTrail: true,
    expandByDefault: false,
  };

  constructor(config?: Partial<TrustIndicatorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.info('[KAIROS-SPECTRA:TrustIndicatorUI] Initialized');
  }

  /**
   * Create a confidence badge element
   * 
   * @param confidence - Confidence score (0-1)
   * @param label - What this confidence represents
   * @returns HTML element with styled confidence badge
   */
  public createConfidenceBadge(confidence: number, label: string): HTMLElement {
    if (!this.config.showConfidenceBadges) {
      const empty = document.createElement('span');
      empty.style.display = 'none';
      return empty;
    }

    const level = this.getConfidenceLevel(confidence);
    const percentage = Math.round(confidence * 100);

    const badge = document.createElement('div');
    badge.className = `kairos-trust-badge kairos-trust-badge-${level}`;
    badge.innerHTML = `
      <div class="kairos-trust-badge-content">
        <div class="kairos-trust-badge-label">${label}</div>
        <div class="kairos-trust-badge-score">
          <div class="kairos-trust-badge-bar">
            <div class="kairos-trust-badge-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="kairos-trust-badge-percentage">${percentage}%</span>
        </div>
      </div>
    `;

    // Tooltip with explanation
    badge.title = this.getConfidenceExplanation(level, percentage);

    return badge;
  }

  /**
   * Create a data source indicator
   * 
   * @param sourceType - Type of data source (table, chart, etc.)
   * @param sourceDescription - Description of where data came from
   * @param elementSelector - CSS selector for highlighting source
   * @returns HTML element showing data provenance
   */
  public createDataSourceIndicator(
    sourceType: string,
    sourceDescription: string,
    elementSelector?: string
  ): HTMLElement {
    if (!this.config.showDataSources) {
      const empty = document.createElement('span');
      empty.style.display = 'none';
      return empty;
    }

    const indicator = document.createElement('div');
    indicator.className = 'kairos-trust-source';
    
    const icon = this.getSourceIcon(sourceType);
    
    indicator.innerHTML = `
      <div class="kairos-trust-source-content">
        <span class="kairos-trust-source-icon">${icon}</span>
        <div class="kairos-trust-source-text">
          <div class="kairos-trust-source-label">Data Source</div>
          <div class="kairos-trust-source-desc">${sourceDescription}</div>
        </div>
        ${elementSelector ? '<button class="kairos-trust-source-highlight-btn" title="Highlight source">🔍</button>' : ''}
      </div>
    `;

    // Add highlight functionality
    if (elementSelector) {
      const highlightBtn = indicator.querySelector('.kairos-trust-source-highlight-btn');
      if (highlightBtn) {
        highlightBtn.addEventListener('click', () => {
          this.highlightSourceElement(elementSelector);
        });
      }
    }

    return indicator;
  }

  /**
   * Create an explanation card for struggle detection
   * 
   * @param explanation - Struggle explanation from ExplanationEngine
   * @returns HTML element with expandable explanation
   */
  public createStruggleExplanationCard(explanation: StruggleExplanation): HTMLElement {
    const card = document.createElement('div');
    card.className = 'kairos-trust-explanation-card';
    
    const level = this.getConfidenceLevel(explanation.confidence);
    
    card.innerHTML = `
      <div class="kairos-trust-explanation-header">
        <div class="kairos-trust-explanation-title">
          <span class="kairos-trust-explanation-icon">🧠</span>
          <span>Why I Detected This</span>
        </div>
        <span class="kairos-trust-badge-mini kairos-trust-badge-${level}">
          ${Math.round(explanation.confidence * 100)}%
        </span>
      </div>
      <div class="kairos-trust-explanation-summary">${explanation.summary}</div>
      <div class="kairos-trust-explanation-details ${this.config.expandByDefault ? 'expanded' : ''}">
        <div class="kairos-trust-explanation-details-content">
          <p>${explanation.details}</p>
          ${explanation.evidencePoints.length > 0 ? `
            <div class="kairos-trust-evidence">
              <div class="kairos-trust-evidence-label">Evidence:</div>
              <ul class="kairos-trust-evidence-list">
                ${explanation.evidencePoints.map(point => `<li>${point}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      <button class="kairos-trust-toggle-details">
        ${this.config.expandByDefault ? '▲ Show Less' : '▼ Show More'}
      </button>
    `;

    // Toggle details functionality
    const toggleBtn = card.querySelector('.kairos-trust-toggle-details') as HTMLButtonElement;
    const details = card.querySelector('.kairos-trust-explanation-details') as HTMLElement;
    
    if (toggleBtn && details) {
      toggleBtn.addEventListener('click', () => {
        const isExpanded = details.classList.toggle('expanded');
        toggleBtn.textContent = isExpanded ? '▲ Show Less' : '▼ Show More';
      });
    }

    return card;
  }

  /**
   * Create an explanation card for visualization recommendation
   * 
   * @param explanation - Viz recommendation explanation
   * @returns HTML element with recommendation reasoning
   */
  public createVizExplanationCard(explanation: VizRecommendationExplanation): HTMLElement {
    const card = document.createElement('div');
    card.className = 'kairos-trust-explanation-card';
    
    card.innerHTML = `
      <div class="kairos-trust-explanation-header">
        <div class="kairos-trust-explanation-title">
          <span class="kairos-trust-explanation-icon">📊</span>
          <span>Why This Visualization?</span>
        </div>
      </div>
      <div class="kairos-trust-explanation-summary">${explanation.summary}</div>
      <div class="kairos-trust-explanation-details ${this.config.expandByDefault ? 'expanded' : ''}">
        <div class="kairos-trust-explanation-details-content">
          <p>${explanation.details}</p>
          
          <div class="kairos-trust-reasoning-section">
            <div class="kairos-trust-reasoning-label">📈 Your Data:</div>
            <ul class="kairos-trust-reasoning-list">
              ${explanation.reasoning.dataCharacteristics.map(char => `<li>${char}</li>`).join('')}
            </ul>
          </div>

          <div class="kairos-trust-reasoning-section">
            <div class="kairos-trust-reasoning-label">🎯 Analytical Goal:</div>
            <p>${explanation.reasoning.analyticalGoal}</p>
          </div>

          ${explanation.reasoning.alternatives.length > 0 ? `
            <div class="kairos-trust-reasoning-section">
              <div class="kairos-trust-reasoning-label">🔄 Other Options:</div>
              <ul class="kairos-trust-reasoning-list kairos-trust-alternatives">
                ${explanation.reasoning.alternatives.map(alt => `<li>${alt}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      <button class="kairos-trust-toggle-details">
        ${this.config.expandByDefault ? '▲ Show Less' : '▼ Show More'}
      </button>
    `;

    // Toggle details functionality
    const toggleBtn = card.querySelector('.kairos-trust-toggle-details') as HTMLButtonElement;
    const details = card.querySelector('.kairos-trust-explanation-details') as HTMLElement;
    
    if (toggleBtn && details) {
      toggleBtn.addEventListener('click', () => {
        const isExpanded = details.classList.toggle('expanded');
        toggleBtn.textContent = isExpanded ? '▲ Show Less' : '▼ Show More';
      });
    }

    return card;
  }

  /**
   * Create chart interpretation panel
   * 
   * @param interpretation - Chart interpretation from ExplanationEngine
   * @returns HTML element with chart insights
   */
  public createChartInterpretationPanel(interpretation: ChartInterpretation): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'kairos-trust-interpretation-panel';
    
    panel.innerHTML = `
      <div class="kairos-trust-interpretation-header">
        <span class="kairos-trust-interpretation-icon">💡</span>
        <span>What This Chart Shows</span>
      </div>
      <div class="kairos-trust-interpretation-summary">${interpretation.summary}</div>
      ${interpretation.insights.length > 0 ? `
        <div class="kairos-trust-insights">
          <div class="kairos-trust-insights-label">Key Insights:</div>
          <ul class="kairos-trust-insights-list">
            ${interpretation.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="kairos-trust-interpretation-context">
        <span class="kairos-trust-context-icon">💬</span>
        ${interpretation.context}
      </div>
    `;

    return panel;
  }

  /**
   * Create reasoning trail (breadcrumb of agent decisions)
   * 
   * @param steps - Array of decision steps
   * @returns HTML element showing decision trail
   */
  public createReasoningTrail(steps: Array<{label: string; confidence?: number}>): HTMLElement {
    if (!this.config.showReasoningTrail) {
      const empty = document.createElement('span');
      empty.style.display = 'none';
      return empty;
    }

    const trail = document.createElement('div');
    trail.className = 'kairos-trust-reasoning-trail';
    
    trail.innerHTML = `
      <div class="kairos-trust-trail-label">Agent Decision Path:</div>
      <div class="kairos-trust-trail-steps">
        ${steps.map((step, index) => `
          <div class="kairos-trust-trail-step">
            <span class="kairos-trust-trail-number">${index + 1}</span>
            <span class="kairos-trust-trail-text">${step.label}</span>
            ${step.confidence !== undefined ? `
              <span class="kairos-trust-trail-confidence">
                (${Math.round(step.confidence * 100)}%)
              </span>
            ` : ''}
          </div>
          ${index < steps.length - 1 ? '<div class="kairos-trust-trail-arrow">→</div>' : ''}
        `).join('')}
      </div>
    `;

    return trail;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.75) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  private getConfidenceExplanation(level: ConfidenceLevel, percentage: number): string {
    switch (level) {
      case 'high':
        return `High confidence (${percentage}%): I'm quite certain about this detection/recommendation.`;
      case 'medium':
        return `Medium confidence (${percentage}%): I think this is right, but there's some uncertainty.`;
      case 'low':
        return `Low confidence (${percentage}%): This is my best guess, but I could be wrong.`;
    }
  }

  private getSourceIcon(sourceType: string): string {
    switch (sourceType.toLowerCase()) {
      case 'table':
        return '📋';
      case 'chart':
        return '📊';
      case 'list':
        return '📝';
      case 'text':
        return '📄';
      default:
        return '📌';
    }
  }

  private highlightSourceElement(selector: string): void {
    // Remove existing highlights
    document.querySelectorAll('.kairos-trust-source-highlight').forEach(el => {
      el.classList.remove('kairos-trust-source-highlight');
    });

    // Add highlight to target
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('kairos-trust-source-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove('kairos-trust-source-highlight');
      }, 3000);
    }
  }

  public updateConfig(config: Partial<TrustIndicatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
