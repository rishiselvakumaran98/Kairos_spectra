/**
 * KAIROS-SPECTRA Visualization Agent
 * Phase 2: "Viz-as-Agent" - Chart Generation Module
 * 
 * Responsibilities:
 * - Convert ExtractedData to Vega-Lite specifications
 * - Map analytical goals + viz types to chart configs
 * - Handle refinement requests (e.g., "make this a stacked bar chart")
 * - Render charts using sandboxed iframe (CSP-compliant)
 * 
 * Supports:
 * - Bar Charts, Line Charts (Phase 2 MVP)
 * - Scatter Plots, Histograms, Box Plots (future)
 */

import type {
  ExtractedData,
  AnalyticalGoal,
  VizType,
  RefinementRequest,
} from '../types';
import { logger } from '../utils';

export class VisualizationAgent {
  private apiKey: string | null = null;
  private apiEndpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    logger.info('VisualizationAgent', 'Initialized with Vega-Lite rendering engine');
    this.loadApiKey();
  }

  /**
   * Generate a Vega-Lite specification from extracted data
   * 
   * @param data - Extracted data from DataAgent or VisionAgent
   * @param goal - Analytical goal selected by user
   * @param vizType - Visualization type selected by user
   * @returns Vega-Lite spec object or null if generation fails
   */
  public async generateVegaLiteSpec(
    data: ExtractedData[],
    goal: AnalyticalGoal,
    vizType: VizType
  ): Promise<any | null> {
    try {
      logger.info('VisualizationAgent', 'Generating Vega-Lite spec', { goal, vizType });

      // Try to find table data first (best for creating new visualizations)
      const tableData = data.find((d) => d.type === 'table');

      // If no table data, check if we have vision/chart data
      const visionData = data.find((d) => (d.data as any).extractedVia === 'vision');
      const chartData = data.find((d) => d.type === 'chart');

      // New capability: if we only have vision/chart data, attempt vision→text→Vega-Lite generation
      if (!tableData && (visionData || chartData)) {
        const sourceData = visionData || chartData;
        const visionSpec = await this.generateSpecFromVisionContext(sourceData!, goal, vizType);
        if (visionSpec) {
          logger.info('VisualizationAgent', 'Generated spec from vision context');
          return visionSpec;
        }
        // If vision-based generation failed, fall back to previous guidance/error message
        const chartType = (sourceData!.data as any).chartType || 'chart';
        const dataDesc = (sourceData!.data as any).dataDescription || '';
        throw new Error(
          `I detected a ${chartType}${dataDesc ? ` (${dataDesc})` : ''} on this page. ` +
          `\n\n📊 I can help you analyze this visualization by:\n` +
          `• Explaining trends and patterns I see\n` +
          `• Suggesting filters or transformations\n` +
          `• Comparing with other data\n\n` +
          `💡 To create a NEW chart, please interact with a data table on the page instead.`
        );
      }

      if (!tableData) {
        const availableTypes = data.map(d => d.type).join(', ');
        throw new Error(
          `Cannot create chart: No table data found. I detected ${data.length} item(s) of type: ${availableTypes}. ` +
          `Please try interacting with a data table on the page.`
        );
      }

      // Extract table structure
      const { schema, data: rawData } = tableData;

      if (!schema || !schema.columns || !rawData || !rawData.rows) {
        throw new Error(
          'Cannot create chart: Table data is incomplete or malformed. ' +
          'The table may be missing columns or rows.'
        );
      }

      // Check for minimum data requirements
      if (rawData.rows.length === 0) {
        throw new Error('Cannot create chart: Table has no data rows.');
      }

      if (schema.columns.length < 2) {
        throw new Error('Cannot create chart: Need at least 2 columns for visualization.');
      }

      // Convert table rows to Vega-Lite format
      const vegaData = this.convertTableToVegaFormat(rawData.rows, schema.columns);

      // Generate spec based on viz type
      let spec: any = null;

      switch (vizType) {
        case 'bar_chart':
          spec = this.generateBarChart(vegaData, schema.columns, goal);
          break;
        case 'line_chart':
          spec = this.generateLineChart(vegaData, schema.columns, goal);
          break;
        case 'scatter_plot':
          spec = this.generateScatterPlot(vegaData, schema.columns, goal);
          break;
        case 'histogram':
        case 'box_plot':
        case 'heatmap':
          throw new Error(
            `Chart type "${vizType}" is not yet implemented. ` +
            `Please try Bar Chart, Line Chart, or Scatter Plot.`
          );
        default:
          logger.warn('VisualizationAgent', 'Unsupported viz type (using bar chart fallback)', { vizType });
          spec = this.generateBarChart(vegaData, schema.columns, goal);
      }

      logger.info('VisualizationAgent', 'Spec generated successfully');
      return spec;

    } catch (error) {
      // Re-throw user-friendly errors
      if (error instanceof Error && error.message.startsWith('Cannot create chart:')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('I detected a')) {
        throw error; // Vision/chart data guidance message
      }
      
      logger.error('VisualizationAgent', 'Failed to generate spec', error);
      throw new Error('Failed to generate chart: An unexpected error occurred.');
    }
  }

  /**
   * Refine an existing visualization based on user prompt
   * Implements Amershi et al. G9: Support efficient correction
   * 
   * @param request - Refinement request with user prompt and current spec
   * @returns Updated Vega-Lite spec or null
   */
  public async refineVisualization(request: RefinementRequest): Promise<any | null> {
    try {
      logger.info('VisualizationAgent', 'Refining visualization', { prompt: request.userPrompt });

      const { userPrompt, currentSpec, originalData } = request;

      // Simple keyword-based refinement (can be enhanced with LLM later)
      const lowerPrompt = userPrompt.toLowerCase();

      // Clone current spec
      let newSpec = JSON.parse(JSON.stringify(currentSpec));

      // Check for chart type changes
      if (lowerPrompt.includes('bar chart') || lowerPrompt.includes('bar graph')) {
        const tableData = originalData.find((d) => d.type === 'table');
        if (tableData) {
          const vegaData = this.convertTableToVegaFormat(tableData.data.rows, tableData.schema!.columns!);
          newSpec = this.generateBarChart(vegaData, tableData.schema!.columns!, 'compare_trends');
        }
      } else if (lowerPrompt.includes('line chart') || lowerPrompt.includes('line graph')) {
        const tableData = originalData.find((d) => d.type === 'table');
        if (tableData) {
          const vegaData = this.convertTableToVegaFormat(tableData.data.rows, tableData.schema!.columns!);
          newSpec = this.generateLineChart(vegaData, tableData.schema!.columns!, 'compare_trends');
        }
      } else if (lowerPrompt.includes('scatter')) {
        const tableData = originalData.find((d) => d.type === 'table');
        if (tableData) {
          const vegaData = this.convertTableToVegaFormat(tableData.data.rows, tableData.schema!.columns!);
          newSpec = this.generateScatterPlot(vegaData, tableData.schema!.columns!, 'find_outliers');
        }
      }

      // Check for stacking
      if (lowerPrompt.includes('stacked')) {
        if (newSpec.mark === 'bar' || newSpec.mark?.type === 'bar') {
          newSpec.mark = { type: 'bar', stacked: true };
        }
      }

      // Check for color changes
      if (lowerPrompt.includes('color') || lowerPrompt.includes('colour')) {
        // Add color encoding if not present
        if (!newSpec.encoding.color && newSpec.data.values.length > 0) {
          const firstField = Object.keys(newSpec.data.values[0])[0];
          newSpec.encoding.color = {
            field: firstField,
            type: 'nominal',
          };
        }
      }

      logger.info('VisualizationAgent', 'Visualization refined');
      return newSpec;

    } catch (error) {
      logger.error('VisualizationAgent', 'Failed to refine visualization', error);
      return null;
    }
  }

  /**
   * Render a Vega-Lite spec in a DOM container
   * Uses sandboxed iframe to bypass CSP restrictions
   * 
   * @param spec - Vega-Lite specification
   * @param container - HTML element to render into
   */
  public async renderVegaLite(spec: any, container: HTMLElement): Promise<void> {
    try {
      logger.info('VisualizationAgent', 'Rendering Vega-Lite chart via sandboxed iframe');
      
      // Clear container
      container.innerHTML = '';
      
      // Create sandboxed iframe
      const iframe = document.createElement('iframe');
      // CRITICAL: allow-same-origin is needed for CDN script loading
      // This is safe because the iframe only loads our controlled vega-sandbox.html
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = 'none';
      
      // Load sandbox HTML
      const sandboxUrl = chrome.runtime.getURL('vega-sandbox.html');
      iframe.src = sandboxUrl;
      
      container.appendChild(iframe);
      
      // Wait for iframe to load and send spec
      await new Promise<void>((resolve, reject) => {
        let isReady = false;
        
        const messageHandler = (event: MessageEvent) => {
          // Verify message is from our iframe
          if (event.source !== iframe.contentWindow) return;
          
          const { type, error } = event.data;
          
          if (type === 'VEGA_SANDBOX_READY') {
            isReady = true;
            // Send spec to iframe for rendering
            iframe.contentWindow?.postMessage({
              type: 'RENDER_VEGA',
              spec,
            }, '*');
          } else if (type === 'VEGA_RENDER_SUCCESS') {
            window.removeEventListener('message', messageHandler);
            logger.info('VisualizationAgent', 'Chart rendered successfully in sandbox');
            resolve();
          } else if (type === 'VEGA_RENDER_ERROR') {
            window.removeEventListener('message', messageHandler);
            logger.error('VisualizationAgent', 'Sandbox rendering error', error);
            reject(new Error(error || 'Chart rendering failed'));
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (!isReady) {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Sandbox iframe failed to load'));
          }
        }, 10000);
      });

    } catch (error) {
      logger.error('VisualizationAgent', 'Failed to render chart', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods - Chart Generation
  // ============================================================================

  /**
   * Convert table rows to Vega-Lite data format
   */
  private convertTableToVegaFormat(rows: any[][], columns: string[]): any[] {
    return rows.map((row) => {
      const obj: any = {};
      columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });
  }

  /**
   * Generate a bar chart spec
   */
  private generateBarChart(data: any[], columns: string[], goal: AnalyticalGoal): any {
    // Pick X and Y fields intelligently
    const xField = columns[0]; // First column as category
    const yField = columns[1]; // Second column as value

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `Bar chart comparing ${xField} and ${yField}`,
      data: { values: data },
      mark: 'bar',
      encoding: {
        x: {
          field: xField,
          type: this.inferFieldType(data, xField),
          axis: { labelAngle: -45 },
        },
        y: {
          field: yField,
          type: 'quantitative',
          // Remove aggregate to avoid expression evaluation
          // aggregate: this.shouldAggregate(data, yField) ? 'sum' : undefined,
        },
        tooltip: [
          { field: xField, type: this.inferFieldType(data, xField) },
          { field: yField, type: 'quantitative' },
        ],
      },
      width: 400,
      height: 300,
    };
  }

  /**
   * Generate a line chart spec
   */
  private generateLineChart(data: any[], columns: string[], goal: AnalyticalGoal): any {
    const xField = columns[0];
    const yField = columns[1];

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `Line chart showing trends in ${yField} over ${xField}`,
      data: { values: data },
      mark: { type: 'line', point: true },
      encoding: {
        x: {
          field: xField,
          type: this.inferFieldType(data, xField),
          axis: { labelAngle: -45 },
        },
        y: {
          field: yField,
          type: 'quantitative',
        },
        tooltip: [
          { field: xField, type: this.inferFieldType(data, xField) },
          { field: yField, type: 'quantitative' },
        ],
      },
      width: 400,
      height: 300,
    };
  }

  /**
   * Generate a scatter plot spec
   */
  private generateScatterPlot(data: any[], columns: string[], goal: AnalyticalGoal): any {
    const xField = columns[0];
    const yField = columns[1];
    const colorField = columns[2] || columns[0]; // Use 3rd column for color if available

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: `Scatter plot comparing ${xField} vs ${yField}`,
      data: { values: data },
      mark: { type: 'point', size: 100 },
      encoding: {
        x: {
          field: xField,
          type: 'quantitative',
        },
        y: {
          field: yField,
          type: 'quantitative',
        },
        color: {
          field: colorField,
          type: this.inferFieldType(data, colorField),
        },
        tooltip: columns.map((col) => ({
          field: col,
          type: this.inferFieldType(data, col),
        })),
      },
      width: 400,
      height: 300,
    };
  }

  /**
   * Infer Vega field type from data
   */
  private inferFieldType(data: any[], field: string): 'quantitative' | 'nominal' | 'ordinal' | 'temporal' {
    if (data.length === 0) return 'nominal';

    const sample = data[0][field];

    if (typeof sample === 'number') {
      return 'quantitative';
    } else if (sample instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(sample))) {
      return 'temporal';
    } else {
      return 'nominal';
    }
  }

  /**
   * Determine if field should be aggregated
   */
  private shouldAggregate(data: any[], field: string): boolean {
    // If there are duplicate values, we should aggregate
    const values = data.map((d) => d[field]);
    const uniqueValues = new Set(values);
    return values.length !== uniqueValues.size;
  }

  // ==========================================================================
  // Vision → Text → Vega-Lite Generation
  // ==========================================================================

  /**
   * Generate a Vega-Lite spec heuristically (optionally with LLM assistance) from vision-only context.
   * This enables a pipeline when the user is looking at an existing chart but wants a reusable spec.
   * Returns null if generation is not possible.
   */
  private async generateSpecFromVisionContext(
    visionData: ExtractedData,
    goal: AnalyticalGoal,
    vizType: VizType
  ): Promise<any | null> {
    try {
      const vData: any = visionData.data || {};
      const chartTypeRaw: string = (vData.chartType || vizType || 'chart').toLowerCase();
      const dataDescription: string = vData.dataDescription || '';

      // Heuristic field extraction from description (e.g., "sales vs profit over months")
      const fields = this.extractFieldNames(dataDescription);
      if (fields.length < 2) {
        // Provide generic field names
        fields.push('category');
        fields.push('value');
      }

      // Attempt LLM-assisted spec synthesis if API key available
      let llmSpec: any | null = null;
      if (this.apiKey) {
        llmSpec = await this.requestLLMVegaSpec(chartTypeRaw, dataDescription, fields);
      }

      if (llmSpec) {
        llmSpec.meta = { generatedFromVision: true, strategy: 'llm', sourceElement: visionData.sourceElement };
        return llmSpec;
      }

      // Fallback: Construct a placeholder spec with synthetic data for refinement
      const syntheticData = this.buildSyntheticData(fields);
      const mark = this.mapChartTypeToMark(chartTypeRaw);
      const spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        description: `Vision-derived placeholder for ${chartTypeRaw}${dataDescription ? `: ${dataDescription}` : ''}`,
        data: { values: syntheticData },
        mark,
        encoding: this.buildEncoding(fields, mark),
        width: 400,
        height: 300,
        meta: { generatedFromVision: true, strategy: 'heuristic', sourceElement: visionData.sourceElement },
      };
      return spec;
    } catch (error) {
      logger.error('VisualizationAgent', 'Vision-based spec generation failed', error);
      return null;
    }
  }

  /** Attempt to call GPT model to synthesize Vega-Lite spec */
  private async requestLLMVegaSpec(chartType: string, description: string, fields: string[]): Promise<any | null> {
    try {
      const prompt = `You are a data visualization assistant. Create a concise valid Vega-Lite v5 JSON spec given:
Chart Type: ${chartType}
Description: ${description || 'N/A'}
Fields (guessed): ${fields.join(', ')}
Guidelines:
- Use inline data with 5-8 rows consistent with the description.
- Prefer meaningful field types (quantitative for measures, nominal for categories, temporal if date-like).
- Do not include any comments or explanatory text outside the JSON.
- Return ONLY the JSON object.`;

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        logger.warn('VisualizationAgent', 'LLM spec request failed', { status: response.status });
        return null;
      }
      const data = await response.json();
      const content: string = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('VisualizationAgent', 'LLM response lacked JSON');
        return null;
      }
      const spec = JSON.parse(jsonMatch[0]);
      // Basic validation: must have data + encoding
      if (!spec.data || !spec.encoding) {
        logger.warn('VisualizationAgent', 'LLM spec missing required keys');
        return null;
      }
      return spec;
    } catch (error) {
      logger.error('VisualizationAgent', 'LLM spec synthesis error', error);
      return null;
    }
  }

  /** Extract potential field names from description */
  private extractFieldNames(description: string): string[] {
    if (!description) return [];
    // Split on common separators
    const lowered = description.toLowerCase();
    const separators = [' vs ', ' by ', ' over ', ' against ', ' comparing ', ' per '];
    for (const sep of separators) {
      if (lowered.includes(sep.trim())) {
        const parts = lowered.split(sep.trim());
        return parts.map(p => p.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')).filter(Boolean).slice(0, 3);
      }
    }
    // Fallback tokenize
    const tokens = lowered.split(/[^a-z0-9]+/g).filter(t => t.length > 2);
    return tokens.slice(0, 3);
  }

  /** Build synthetic inline data */
  private buildSyntheticData(fields: string[]): any[] {
    const rows: any[] = [];
    const categories = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < categories.length; i++) {
      const row: any = {};
      fields.forEach((f, idx) => {
        if (idx === 0) row[f] = categories[i];
        else row[f] = Math.round(Math.random() * 100 + i * 5);
      });
      rows.push(row);
    }
    return rows;
  }

  /** Map chart type string to Vega-Lite mark */
  private mapChartTypeToMark(chartType: string): any {
    if (chartType.includes('line')) return { type: 'line', point: true };
    if (chartType.includes('bar') || chartType.includes('column')) return 'bar';
    if (chartType.includes('scatter') || chartType.includes('point')) return { type: 'point', size: 100 };
    if (chartType.includes('area')) return 'area';
    return 'bar'; // fallback
  }

  /** Build encoding object based on fields and mark */
  private buildEncoding(fields: string[], mark: any): any {
    const [xField, yField, extraField] = fields;
    const encoding: any = {
      x: { field: xField, type: 'nominal', axis: { labelAngle: -45 } },
      y: { field: yField || 'value', type: 'quantitative' },
      tooltip: fields.filter(Boolean).map(f => ({ field: f, type: f === xField ? 'nominal' : 'quantitative' }))
    };
    if (extraField) {
      encoding.color = { field: extraField, type: 'nominal' };
    }
    return encoding;
  }

  /** Load API key similar to VisionAgent */
  private async loadApiKey(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      this.apiKey = result.openai_api_key || null;
      if (!this.apiKey) {
        logger.warn('VisualizationAgent', 'No OpenAI API key found – LLM spec synthesis disabled');
      } else {
        logger.info('VisualizationAgent', 'API key loaded for vision→spec synthesis');
      }
    } catch (error) {
      logger.error('VisualizationAgent', 'Failed to load API key', error);
    }
  }
}

// Singleton instance
export const visualizationAgent = new VisualizationAgent();
