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
  
  // Rate limiting & caching
  private lastAnalysisTime: number = 0;
  private readonly MIN_ANALYSIS_INTERVAL_MS = 10000; // 10 seconds between calls
  private analysisCache = new Map<string, { result: VisionAnalysisResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds cache lifetime

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
      // Rate limiting: Prevent too many API calls
      const now = Date.now();
      const timeSinceLastAnalysis = now - this.lastAnalysisTime;
      if (timeSinceLastAnalysis < this.MIN_ANALYSIS_INTERVAL_MS) {
        logger.warn('VisionAgent', 'Rate limited - too soon since last analysis', {
          timeSinceLastMs: timeSinceLastAnalysis,
          minIntervalMs: this.MIN_ANALYSIS_INTERVAL_MS,
        });
        return null;
      }

      // Check cache for recent analysis of same area
      const cacheKey = `${Math.round(mousePosition.x / 100)}_${Math.round(mousePosition.y / 100)}`;
      const cached = this.analysisCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
        logger.info('VisionAgent', 'Using cached analysis', { cacheKey });
        return this.convertToExtractedData(cached.result, mousePosition, elementSelector);
      }

      logger.info('VisionAgent', 'Starting vision analysis', { mousePosition });
      this.lastAnalysisTime = now;

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

      // Cache the result
      this.analysisCache.set(cacheKey, { result: analysis, timestamp: now });
      
      // Clean old cache entries
      this.cleanCache();

      // Step 3: Convert to ExtractedData format
      return this.convertToExtractedData(analysis, mousePosition, elementSelector, screenshot);

    } catch (error) {
      logger.error('VisionAgent', 'Vision analysis failed', error);
      return null;
    }
  }

  /**
   * Convert VisionAnalysisResult to ExtractedData format
   */
  private convertToExtractedData(
    analysis: VisionAnalysisResult,
    mousePosition: Point,
    elementSelector?: string,
    screenshot?: string
  ): ExtractedData {
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
        screenshot, // CRITICAL: Store screenshot for later use
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
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.analysisCache.delete(key);
      }
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

        // Compress image to reduce API costs (max 800px width, JPEG 70%)
        const MAX_WIDTH = 800;
        let finalCanvas = canvas;
        
        if (canvas.width > MAX_WIDTH) {
          const scale = MAX_WIDTH / canvas.width;
          const compressedCanvas = document.createElement('canvas');
          compressedCanvas.width = MAX_WIDTH;
          compressedCanvas.height = canvas.height * scale;
          
          const compressedCtx = compressedCanvas.getContext('2d');
          if (compressedCtx) {
            compressedCtx.drawImage(canvas, 0, 0, compressedCanvas.width, compressedCanvas.height);
            finalCanvas = compressedCanvas;
          }
        }
        
        // Use JPEG with 0.7 quality for smaller file size (was PNG)
        resolve(finalCanvas.toDataURL('image/jpeg', 0.7));
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

        const prompt = `Analyze screenshot at RED CIRCLE (${mousePosition.x}, ${mousePosition.y}).

Return JSON:
{
  "elementType": "table"|"chart"|"graph"|"canvas"|"form"|"unknown",
  "description": "brief description",
  "chartType": "type if chart",
  "dataDescription": "data shown",
  "possibleActions": ["actions"],
  "confidence": 0-1
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
                    detail: 'low', // Low detail to reduce tokens (was 'high')
                  },
                },
              ],
            },
          ],
          max_tokens: 300, // Reduced from 500
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

  // ============================================================================
  // NEW: Chart Analysis Methods
  // ============================================================================

  /**
   * Analyze a snipped/cropped chart region
   */
  public async analyzeChartSnippet(
    screenshotData: string,
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Promise<{
    chartType: string;
    insights: string[];
    trends: string[];
    suggestions: string[];
  } | null> {
    try {
      logger.info('VisionAgent', 'Analyzing chart snippet', { boundingBox });

      if (!this.apiKey) {
        logger.warn('VisionAgent', 'No API key configured');
        return null;
      }

      // Crop the screenshot to the bounding box
      const croppedImage = await this.cropImage(screenshotData, boundingBox);

      // Send to GPT-4V with analysis-focused prompt
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are an expert data analyst. Analyze this chart/visualization and provide:

1. Chart Type: What type of chart is this? (bar chart, line chart, scatter plot, etc.)
2. Key Insights: What are 3-5 key insights from this visualization?
3. Trends: What trends or patterns do you observe?
4. Suggestions: What additional analysis or questions would be valuable?

Format your response as JSON:
{
  "chartType": "...",
  "insights": ["...", "...", "..."],
  "trends": ["...", "...", "..."],
  "suggestions": ["...", "...", "..."]
}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: croppedImage,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
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
        logger.warn('VisionAgent', 'Empty response from GPT-4V');
        return null;
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('VisionAgent', 'Could not extract JSON from response');
        return null;
      }

      const analysisResult = JSON.parse(jsonMatch[0]);

      logger.info('VisionAgent', 'Chart snippet analyzed successfully');
      return analysisResult;

    } catch (error) {
      logger.error('VisionAgent', 'Failed to analyze chart snippet', error);
      return null;
    }
  }

  /**
   * Answer a specific question about a chart using GPT-4V
   */
  public async answerChartQuestion(
    question: string,
    chartData: any
  ): Promise<{
    response: string;
    followUpSuggestions: string[];
  } | null> {
    try {
      logger.info('VisionAgent', 'Answering chart question', { question, chartData });

      if (!this.apiKey) {
        logger.warn('VisionAgent', 'No API key configured');
        return null;
      }

      // Extract chart information - handle both ExtractedData and raw data formats
      const chartType = chartData.data?.chartType || chartData.chartType || 'visualization';
      const dataDescription = chartData.data?.dataDescription || chartData.dataDescription || '';
      
      // Try multiple paths to find the screenshot
      const chartImage = 
        chartData.data?.screenshot ||  // From ExtractedData.data.screenshot
        chartData.screenshot ||         // From raw data
        chartData.data?.data?.screenshot; // Nested structure

      if (!chartImage) {
        logger.warn('VisionAgent', 'No chart image available for question answering', {
          chartDataKeys: Object.keys(chartData),
          dataKeys: chartData.data ? Object.keys(chartData.data) : 'no data property'
        });
        return null;
      }

      logger.info('VisionAgent', 'Found chart image, sending to GPT-4V');

      // Send question to GPT-4V with chart context
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are a helpful data analysis assistant. The user is looking at a ${chartType}${dataDescription ? ` showing ${dataDescription}` : ''}.

User's question: "${question}"

Please provide:
1. A clear, concise answer to their question based on what you see in the chart
2. 2-3 related follow-up questions they might want to ask

Format your response as JSON:
{
  "response": "Your answer here...",
  "followUpSuggestions": ["Question 1?", "Question 2?", "Question 3?"]
}`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: chartImage,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0.5,
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
        logger.warn('VisionAgent', 'Empty response from GPT-4V');
        return null;
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('VisionAgent', 'Could not extract JSON from response');
        return null;
      }

      const answerResult = JSON.parse(jsonMatch[0]);

      logger.info('VisionAgent', 'Chart question answered successfully');
      return answerResult;

    } catch (error) {
      logger.error('VisionAgent', 'Failed to answer chart question', error);
      return null;
    }
  }

  /**
   * Crop image to bounding box
   */
  private async cropImage(
    imageData: string,
    boundingBox: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = boundingBox.width;
        canvas.height = boundingBox.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw cropped region
        ctx.drawImage(
          img,
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height,
          0,
          0,
          boundingBox.width,
          boundingBox.height
        );

        // Convert to data URL
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  }
}

// Singleton instance
export const visionAgent = new VisionAgent();
