/**
 * KAIROS-SPECTRA Vision Agent
 * 
 * Uses GPT-4V (Vision) to analyze screenshots when DOM extraction fails.
 * This is critical for complex web apps (Voyager, Tableau, Looker) where
 * data is rendered in Canvas/SVG and not accessible via DOM scraping.
 * 
 * Flow:
 * 1. Capture screenshot of viewport
 * 2. Draw mouse cursor position
 * 3. Send to GPT-4V with prompt asking "what data/visualization is at cursor?"
 * 4. Return structured description of the visual element
 */

import type { Point, ExtractedData } from '../types';
import { logger } from '../utils';

interface VisionAnalysisResult {
  elementType: 'table' | 'chart' | 'graph' | 'canvas' | 'form' | 'unknown';
  description: string;
  chartType?: string; // e.g., "scatter plot", "line chart", "bar chart"
  dataDescription?: string; // e.g., "comparing gas vs miles data points"
  possibleActions?: string[]; // e.g., ["filter data", "change chart type", "export"]
  confidence: number;
}

export class VisionAgent {
  private apiKey: string | null = null;
  private apiEndpoint = 'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.loadApiKey();
  }

  /**
   * Analyze what visual element the user is struggling with
   */
  public async analyzeStrugglePoint(
    mousePosition: Point,
    elementSelector?: string
  ): Promise<ExtractedData | null> {
    try {
      logger.info('VisionAgent', 'Starting vision analysis', { mousePosition });

      // Step 1: Capture screenshot with mouse cursor marked
      const screenshot = await this.captureScreenshotWithCursor(mousePosition);
      
      if (!screenshot) {
        logger.warn('VisionAgent', 'Failed to capture screenshot');
        return null;
      }

      // Step 2: Send to GPT-4V for analysis
      const analysis = await this.sendToGPT4V(screenshot, mousePosition, elementSelector);
      
      if (!analysis) {
        logger.warn('VisionAgent', 'No analysis result from GPT-4V');
        return null;
      }

      // Step 3: Convert to ExtractedData format
      const extractedData: ExtractedData = {
        type: this.mapElementTypeToDataType(analysis.elementType),
        sourceElement: elementSelector || `vision-based@${mousePosition.x},${mousePosition.y}`,
        confidence: analysis.confidence,
        data: {
          elementType: analysis.elementType,
          description: analysis.description,
          chartType: analysis.chartType,
          dataDescription: analysis.dataDescription,
          possibleActions: analysis.possibleActions,
          extractedVia: 'vision',
          mousePosition,
          url: window.location.href,
          timestamp: Date.now(),
        },
      };

      logger.info('VisionAgent', 'Vision analysis complete', {
        type: extractedData.type,
        confidence: extractedData.confidence,
      });

      return extractedData;

    } catch (error) {
      logger.error('VisionAgent', 'Vision analysis failed', error);
      return null;
    }
  }

  /**
   * Capture screenshot and draw cursor position
   */
  private async captureScreenshotWithCursor(mousePosition: Point): Promise<string | null> {
    try {
      // Use Chrome's captureVisibleTab API
      const dataUrl = await new Promise<string>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CAPTURE_SCREENSHOT',
            payload: { mousePosition },
            timestamp: Date.now(),
            source: 'content',
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response?.screenshot) {
              resolve(response.screenshot);
            } else {
              reject(new Error('No screenshot in response'));
            }
          }
        );
      });

      // Draw cursor indicator on the screenshot
      const annotatedScreenshot = await this.drawCursorOnScreenshot(dataUrl, mousePosition);
      
      return annotatedScreenshot;

    } catch (error) {
      logger.error('VisionAgent', 'Screenshot capture failed', error);
      return null;
    }
  }

  /**
   * Draw a red circle at cursor position to help GPT-4V locate struggle point
   */
  private async drawCursorOnScreenshot(
    screenshotDataUrl: string,
    mousePosition: Point
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw the screenshot
        ctx.drawImage(img, 0, 0);

        // Draw cursor indicator (red circle with crosshair)
        const scale = img.width / window.innerWidth;
        const scaledX = mousePosition.x * scale;
        const scaledY = mousePosition.y * scale;

        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

        // Circle
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(scaledX - 30, scaledY);
        ctx.lineTo(scaledX + 30, scaledY);
        ctx.moveTo(scaledX, scaledY - 30);
        ctx.lineTo(scaledX, scaledY + 30);
        ctx.stroke();

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = screenshotDataUrl;
    });
  }

  /**
   * Send screenshot to GPT-4V for analysis
   */
  private async sendToGPT4V(
    screenshotDataUrl: string,
    mousePosition: Point,
    elementSelector?: string
  ): Promise<VisionAnalysisResult | null> {
    if (!this.apiKey) {
      logger.warn('VisionAgent', 'No OpenAI API key configured');
      return null;
    }

    const prompt = `You are analyzing a screenshot from a data analysis/visualization tool to help a user who appears to be struggling.

The user's mouse cursor is marked with a RED CIRCLE at position (${mousePosition.x}, ${mousePosition.y}).

${elementSelector ? `DOM selector (if available): ${elementSelector}` : 'No DOM information available (likely Canvas/SVG rendering).'}

Please analyze:
1. What type of visual element is at the cursor location? (table, chart, graph, form, canvas, etc.)
2. If it's a chart/graph, what type? (scatter plot, line chart, bar chart, pie chart, etc.)
3. What data or information is being displayed?
4. What analytical task might the user be trying to accomplish?
5. What actions are available at this location? (e.g., filter, zoom, export, change view)

Respond in JSON format:
{
  "elementType": "table" | "chart" | "graph" | "canvas" | "form" | "unknown",
  "description": "Brief description of what's at the cursor",
  "chartType": "specific chart type if applicable",
  "dataDescription": "What data/information is shown",
  "possibleActions": ["action1", "action2", ...],
  "confidence": 0.0-1.0
}`;

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o', // GPT-4 with vision
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: screenshotDataUrl,
                    detail: 'high', // High detail for better analysis
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.3, // Low temperature for more consistent analysis
        }),
      });

      if (!response.ok) {
        logger.error('VisionAgent', 'GPT-4V API error', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        logger.warn('VisionAgent', 'No content in GPT-4V response');
        return null;
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('VisionAgent', 'No JSON found in response', { content });
        return null;
      }

      const analysis: VisionAnalysisResult = JSON.parse(jsonMatch[0]);
      return analysis;

    } catch (error) {
      logger.error('VisionAgent', 'GPT-4V request failed', error);
      return null;
    }
  }

  /**
   * Load API key from Chrome storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      this.apiKey = result.openai_api_key || null;
      
      if (!this.apiKey) {
        logger.warn('VisionAgent', 'No OpenAI API key found in storage. Vision analysis will be disabled.');
        logger.info('VisionAgent', 'Set API key via: chrome.storage.sync.set({openai_api_key: "sk-..."})');
      } else {
        logger.info('VisionAgent', 'OpenAI API key loaded successfully');
      }
    } catch (error) {
      logger.error('VisionAgent', 'Failed to load API key', error);
    }
  }

  /**
   * Map vision element type to our data type enum
   */
  private mapElementTypeToDataType(
    elementType: VisionAnalysisResult['elementType']
  ): ExtractedData['type'] {
    switch (elementType) {
      case 'table':
        return 'table';
      case 'chart':
      case 'graph':
      case 'canvas':
        return 'chart';
      default:
        return 'text';
    }
  }

  /**
   * Set API key programmatically (for testing)
   */
  public async setApiKey(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    await chrome.storage.sync.set({ openai_api_key: apiKey });
    logger.info('VisionAgent', 'API key updated');
  }
}

// Singleton instance
export const visionAgent = new VisionAgent();
