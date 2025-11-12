/**
 * ExplanationEngine - Generates natural language explanations for agent decisions
 * 
 * Implements:
 * - G11 (Transparency): Explain why struggle detected, why viz recommended
 * - G2 (Clarity): Clear confidence indicators and reasoning
 * 
 * Inspired by:
 * - FlowForge's in-situ design cards
 * - BrowserGym's AgentXRay trace visualization
 */

import { StruggleEvent, ExtractedData, UserInteractionEvent } from '../types';

/**
 * Explanation for why a struggle was detected
 */
export interface StruggleExplanation {
  summary: string; // One-line explanation
  details: string; // Full reasoning
  confidence: number;
  evidencePoints: string[]; // Specific behaviors observed
}

/**
 * Explanation for why a visualization was recommended
 */
export interface VizRecommendationExplanation {
  summary: string;
  details: string;
  reasoning: {
    dataCharacteristics: string[]; // Why this data suits this viz
    analyticalGoal: string; // What question does this answer
    alternatives: string[]; // Other options and why not chosen
  };
}

/**
 * Explanation of what a chart shows
 */
export interface ChartInterpretation {
  summary: string; // "This bar chart compares GDP across 14 countries"
  insights: string[]; // Key takeaways from the data
  context: string; // What the user might learn from this
}

export class ExplanationEngine {

  constructor() {
    console.info('[KAIROS-SPECTRA:ExplanationEngine] Initialized');
  }

  /**
   * Explain why a struggle was detected
   * 
   * @param event - The struggle event
   * @param confidence - Detection confidence score
   * @returns Natural language explanation
   */
  public explainStruggleDetection(
    event: StruggleEvent,
    confidence: number
  ): StruggleExplanation {
    const { pattern, interactionHistory } = event;
    const evidencePoints: string[] = [];
    let summary = '';
    let details = '';

    const patternType = pattern.type;

    switch (patternType) {
      case 'prolonged_hesitation':
        const hesitationDuration = this.calculateHesitationDuration(interactionHistory);
        summary = `You paused for ${Math.round(hesitationDuration / 1000)}s while viewing this data`;
        details = `I noticed you stopped interacting for ${Math.round(
          hesitationDuration / 1000
        )} seconds after hovering over data elements. This pattern often indicates you're trying to understand the information or looking for insights.`;
        
        evidencePoints.push(
          `${interactionHistory.length} interactions in the last ${Math.round((Date.now() - interactionHistory[0].timestamp) / 1000)}s`,
          `Hover activity on ${event.involvedElements.length} data element(s)`,
          `${Math.round(hesitationDuration / 1000)}s pause after last interaction`
        );
        break;

      case 'repetitive_movement':
        const switchCount = this.calculateSwitchCount(interactionHistory);
        summary = `You switched between ${event.involvedElements.length} elements ${switchCount} times`;
        details = `I detected you moving back and forth between ${event.involvedElements.length} different elements ${switchCount} times. This typically suggests you're comparing information or looking for patterns across the data.`;
        
        evidencePoints.push(
          `${switchCount} switches between elements`,
          `${event.involvedElements.length} unique elements involved`,
          `Pattern observed over ${Math.round((Date.now() - interactionHistory[0].timestamp) / 1000)}s`
        );
        break;

      case 'rapid_switching':
        const rapidSwitches = interactionHistory.filter(e => e.type === 'click').length;
        summary = `You rapidly clicked ${rapidSwitches} times across multiple elements`;
        details = `I noticed ${rapidSwitches} rapid clicks across different elements in quick succession. This often indicates you're searching for specific information or trying different options.`;
        
        evidencePoints.push(
          `${rapidSwitches} rapid clicks detected`,
          `Average time between clicks: ${this.calculateAvgTimeBetweenClicks(interactionHistory)}ms`,
          `${event.involvedElements.length} different elements clicked`
        );
        break;

      default:
        summary = 'Unusual interaction pattern detected';
        details = 'I observed an interaction pattern that suggests you might benefit from assistance.';
    }

    return {
      summary,
      details,
      confidence,
      evidencePoints,
    };
  }

  /**
   * Explain why a specific visualization was recommended
   * 
   * @param goal - Analytical goal (e.g., 'compare_trends')
   * @param vizType - Visualization type (e.g., 'bar_chart')
   * @param data - The extracted data
   * @returns Explanation of recommendation
   */
  public explainVizRecommendation(
    goal: string,
    vizType: string,
    data: ExtractedData[]
  ): VizRecommendationExplanation {
    const dataCharacteristics: string[] = [];
    let alternatives: string[] = [];
    let analyticalGoal = '';
    let summary = '';
    let details = '';

    // Analyze data characteristics
    const tableData = data.find(d => d.type === 'table');
    if (tableData) {
      const schema = tableData.schema;
      if (schema?.columns) {
        dataCharacteristics.push(
          `Your data has ${schema.columns.length} columns: ${schema.columns.slice(0, 3).join(', ')}${schema.columns.length > 3 ? '...' : ''}`
        );
      }
      if (schema?.rows) {
        dataCharacteristics.push(`${schema.rows} data points available`);
      }

      // Check for numeric columns
      const numericFields = schema?.fields?.filter(f => f.type === 'number') || [];
      if (numericFields.length > 0) {
        dataCharacteristics.push(
          `${numericFields.length} numeric column(s) suitable for quantitative comparison`
        );
      }
    }

    // Goal-specific explanations
    switch (goal) {
      case 'compare_trends':
        analyticalGoal = 'Compare values across categories to identify trends and patterns';
        
        switch (vizType) {
          case 'bar_chart':
            summary = 'Bar charts are ideal for comparing values across categories';
            details = `I recommended a bar chart because your data contains categorical information (${
              tableData?.schema?.columns?.[0] || 'categories'
            }) with numeric values that you want to compare. Bar charts make it easy to see which items are larger or smaller at a glance.`;
            alternatives = [
              'Line Chart: Better for showing changes over time',
              'Scatter Plot: Better for showing relationships between two variables',
            ];
            break;

          case 'line_chart':
            summary = 'Line charts excel at showing trends over time or sequential data';
            details = `I chose a line chart because your data appears to have a sequential or temporal dimension. Line charts help you see how values change across a continuous scale, making trends and patterns more visible.`;
            alternatives = [
              'Bar Chart: Better for discrete category comparisons',
              'Area Chart: Similar to line but emphasizes magnitude',
            ];
            break;

          case 'scatter_plot':
            summary = 'Scatter plots reveal relationships between two numeric variables';
            details = `A scatter plot was recommended because you have multiple numeric columns. This visualization helps you discover correlations, clusters, or outliers in your data.`;
            alternatives = [
              'Bar Chart: Better if categories are more important than relationships',
              'Heatmap: Better for seeing patterns in large datasets',
            ];
            break;

          default:
            summary = `${vizType} visualization recommended based on your data structure`;
            details = 'This visualization type matches your data characteristics and analytical goal.';
        }
        break;

      case 'identify_outliers':
        analyticalGoal = 'Find unusual or extreme values in your data';
        summary = `${vizType} helps highlight data points that stand out from the rest`;
        details = `For identifying outliers, ${vizType} provides visual cues that make extreme values easy to spot. You can quickly see which points deviate significantly from the norm.`;
        break;

      case 'show_distribution':
        analyticalGoal = 'Understand how values are spread across your dataset';
        summary = `${vizType} reveals the shape and spread of your data`;
        details = `This visualization shows you where most of your data points cluster and how they're distributed, helping you understand central tendencies and variance.`;
        break;

      case 'explore_relationships':
        analyticalGoal = 'Discover how different variables relate to each other';
        summary = `${vizType} makes correlations and patterns visible`;
        details = `By plotting multiple dimensions together, you can see how changes in one variable correspond to changes in another.`;
        break;

      default:
        analyticalGoal = 'Analyze and understand your data';
        summary = 'Visualization recommended based on data structure';
        details = 'This chart type should help you extract insights from your data.';
    }

    return {
      summary,
      details,
      reasoning: {
        dataCharacteristics,
        analyticalGoal,
        alternatives,
      },
    };
  }

  /**
   * Generate interpretation of what a chart shows
   * 
   * @param vizType - Type of visualization
   * @param spec - Vega-Lite specification
   * @param data - Source data
   * @returns Natural language interpretation
   */
  public interpretChart(
    vizType: string,
    spec: any,
    data: ExtractedData[]
  ): ChartInterpretation {
    const insights: string[] = [];
    let summary = '';
    let context = '';

    // Extract key information from spec
    const mark = spec.mark?.type || spec.mark || vizType;
    const encoding = spec.encoding || {};
    const xField = encoding.x?.field || 'x';
    const yField = encoding.y?.field || 'y';
    const dataValues = spec.data?.values || [];

    // Generate summary
    const rowCount = dataValues.length;
    const tableData = data.find(d => d.type === 'table');
    const sourceColumn = tableData?.schema?.columns?.[0] || 'categories';

    summary = `This ${mark} chart shows ${yField} across ${rowCount} ${sourceColumn}`;

    // Generate insights based on data analysis
    if (dataValues.length > 0) {
      // Find max/min values
      const yValues = dataValues.map((d: any) => d[yField]).filter((v: any) => typeof v === 'number');
      
      if (yValues.length > 0) {
        const maxValue = Math.max(...yValues);
        const minValue = Math.min(...yValues);
        const maxItem = dataValues.find((d: any) => d[yField] === maxValue);
        const minItem = dataValues.find((d: any) => d[yField] === minValue);

        if (maxItem && minItem && maxValue !== minValue) {
          insights.push(
            `Highest: ${maxItem[xField]} (${this.formatNumber(maxValue)})`
          );
          insights.push(
            `Lowest: ${minItem[xField]} (${this.formatNumber(minValue)})`
          );

          const range = maxValue - minValue;
          const avgValue = yValues.reduce((a: number, b: number) => a + b, 0) / yValues.length;
          insights.push(
            `Range: ${this.formatNumber(range)} (avg: ${this.formatNumber(avgValue)})`
          );
        }
      }

      // Identify trends
      if (mark === 'line' && yValues.length > 2) {
        const increasing = yValues.slice(1).every((v: number, i: number) => v >= yValues[i]);
        const decreasing = yValues.slice(1).every((v: number, i: number) => v <= yValues[i]);
        
        if (increasing) {
          insights.push('Overall trend: Increasing ↗');
        } else if (decreasing) {
          insights.push('Overall trend: Decreasing ↘');
        } else {
          insights.push('Overall trend: Mixed/Fluctuating');
        }
      }
    }

    // Context for user
    switch (mark) {
      case 'bar':
        context = 'Use this chart to quickly compare values and identify the highest/lowest items. The length of each bar represents the magnitude.';
        break;
      case 'line':
        context = 'Follow the line to see how values change. Upward slopes indicate increases, downward slopes show decreases.';
        break;
      case 'point':
      case 'circle':
        context = 'Each point represents one data item. Look for clusters, gaps, or outliers in the distribution.';
        break;
      default:
        context = 'Explore the visualization to discover patterns and insights in your data.';
    }

    return {
      summary,
      insights: insights.slice(0, 4), // Limit to top 4 insights
      context,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculateHesitationDuration(history: UserInteractionEvent[]): number {
    if (history.length < 2) return 3000; // Default
    const lastInteraction = history[history.length - 1];
    const now = Date.now();
    return now - lastInteraction.timestamp;
  }

  private calculateSwitchCount(history: UserInteractionEvent[]): number {
    let switches = 0;
    let lastElement: string | null = null;

    for (const interaction of history) {
      if (interaction.target && interaction.target.element !== lastElement) {
        switches++;
        lastElement = interaction.target.element;
      }
    }

    return Math.max(switches - 1, 0); // Subtract 1 since first isn't a switch
  }

  private calculateAvgTimeBetweenClicks(history: UserInteractionEvent[]): number {
    const clicks = history.filter(e => e.type === 'click');
    if (clicks.length < 2) return 0;

    let totalTime = 0;
    for (let i = 1; i < clicks.length; i++) {
      totalTime += clicks[i].timestamp - clicks[i - 1].timestamp;
    }

    return Math.round(totalTime / (clicks.length - 1));
  }

  private formatNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    } else if (Number.isInteger(value)) {
      return value.toString();
    } else {
      return value.toFixed(2);
    }
  }
}
