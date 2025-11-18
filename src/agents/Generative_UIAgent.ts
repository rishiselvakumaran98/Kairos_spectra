/**
 * Generative_UIAgent (Generative Interface Builder)
 * Phase 5: Proactive Tool Generation
 * 
 * Purpose: Generate HTML/CSS/JS code for UI widgets from actionable objectives
 * 
 * Inspired by: "Generative Interface Models" research
 * 
 * Key Responsibility:
 * - Takes actionable objective from JIT_ObjectiveAgent
 * - Generates complete, self-contained HTML/CSS/JS widget code
 * - Code is production-ready and can be injected directly into the page
 * 
 * Architecture Flow:
 * 1. Input: Actionable objective (e.g., "A tool to track citations")
 * 2. Process: Use GPT-4o to generate code based on objective
 * 3. Output: {html, css, js} object ready for injection
 * 
 * Model Selection:
 * - Uses GPT-4o (code generation specialist) per Cursor 2.0 architecture
 * - Optimized for generating clean, functional frontend code
 * 
 * Code Generation Guidelines:
 * - Simple, semantic HTML
 * - Modern CSS with flexbox/grid
 * - Vanilla JavaScript (no dependencies)
 * - Self-contained (no external API calls unless specified)
 * - Accessible (ARIA attributes where appropriate)
 * - Responsive design
 */

import type { ActionableObjective } from './JIT_ObjectiveAgent';
import { logger } from '../utils';

// ============================================================================
// Generative UI Type Definitions
// ============================================================================

/**
 * Generated widget code (HTML, CSS, JS)
 */
export interface GeneratedWidget {
  html: string; // HTML structure
  css: string; // CSS styles
  js: string; // JavaScript functionality
  metadata: {
    objective: string;
    toolType: string;
    generatedAt: number;
    complexity: string;
  };
}

/**
 * Widget generation result with validation
 */
export interface WidgetGenerationResult {
  success: boolean;
  widget?: GeneratedWidget;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// Generative_UIAgent Class
// ============================================================================

export class Generative_UIAgent {
  private apiKey: string | null = null;
  private modelName: string = 'gpt-4o'; // Code generation specialist

  constructor() {
    logger.info('Generative_UIAgent', 'Initialized with GPT-4o for UI generation');
  }

  /**
   * Initialize with API key
   */
  public async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    logger.info('Generative_UIAgent', 'API key configured');
  }

  /**
   * CORE METHOD: Generate UI widget from actionable objective
   * 
   * @param objective - Actionable objective from JIT_ObjectiveAgent
   * @returns Generated widget code (HTML, CSS, JS)
   */
  public async generateUIWidget(objective: ActionableObjective): Promise<WidgetGenerationResult> {
    if (!this.apiKey) {
      logger.error('Generative_UIAgent', 'No API key configured');
      return {
        success: false,
        error: 'API key not configured',
      };
    }

    logger.info('Generative_UIAgent', 'Generating widget', {
      objective: objective.objective,
      toolType: objective.toolType,
      complexity: objective.complexity,
    });

    try {
      // Build the widget generation prompt
      const prompt = this.buildWidgetPrompt(objective);

      // Call LLM (GPT-4o)
      const response = await this.callLLM(prompt);

      // Parse and validate response
      const widget = this.parseWidgetFromResponse(response, objective);

      if (!widget) {
        return {
          success: false,
          error: 'Failed to parse widget from LLM response',
        };
      }

      // Validate generated code
      const validation = this.validateWidget(widget);
      
      logger.info('Generative_UIAgent', 'Widget generated successfully', {
        htmlLength: widget.html.length,
        cssLength: widget.css.length,
        jsLength: widget.js.length,
        warnings: validation.warnings?.length || 0,
      });

      return {
        success: true,
        widget,
        warnings: validation.warnings,
      };

    } catch (error) {
      logger.error('Generative_UIAgent', 'Failed to generate widget', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build the prompt for generating widget code
   * Inspired by Generative Interface Models approach
   */
  private buildWidgetPrompt(objective: ActionableObjective): string {
    return `You are an expert front-end developer. Your task is to generate the code for a simple, standalone web widget to fulfill a specific user objective.

## Objective:
"${objective.objective}"

## Context:
- Tool Type: ${objective.toolType}
- Complexity: ${objective.complexity}
- Source Proposition: "${objective.sourceProposition.text}"
- Reasoning: ${objective.reasoning}

## Requirements:

### HTML:
- Provide clean, semantic HTML structure
- Use meaningful element IDs and classes
- Include proper heading hierarchy (h1, h2, etc.)
- Add ARIA labels for accessibility where appropriate
- Keep structure minimal and focused on the objective

### CSS:
- Provide modern, clean CSS
- Use flexbox or grid for layouts
- Include hover states and transitions for interactivity
- Make it visually appealing with good spacing and typography
- Ensure responsive design (works on different screen sizes)
- Use a professional color scheme with good contrast
- All styles should be scoped to avoid conflicts (use a unique prefix like ".kairos-widget-")

### JavaScript:
- Provide vanilla JavaScript (no external libraries/frameworks)
- Implement the core functionality described in the objective
- Add event listeners for user interactions
- Include input validation where appropriate
- Handle edge cases gracefully
- Add helpful user feedback (success messages, error states)
- Use modern ES6+ syntax (const/let, arrow functions, template literals)

## Design Guidelines:
1. **Simple & Focused**: One clear purpose, not multiple features
2. **Self-Contained**: No external API calls unless absolutely necessary for the objective
3. **User-Friendly**: Clear labels, helpful placeholders, intuitive interactions
4. **Professional**: Clean design, good UX, no clutter
5. **Accessible**: Keyboard navigation, ARIA labels, good contrast
6. **Performant**: Lightweight code, no unnecessary complexity

## Example Tools by Type:
${this.getExamplesByToolType(objective.toolType || 'custom')}

## Output Format:
Respond with a single JSON object in this exact format:

{
  "html": "<div class=\\"kairos-widget-container\\">...</div>",
  "css": ".kairos-widget-container { ... }",
  "js": "// Widget functionality\\nconst widget = { ... };"
}

**IMPORTANT**: 
- Return ONLY valid JSON, no additional text before or after
- Escape all quotes in the code strings properly
- Keep code concise but functional
- Test your logic mentally before outputting

Generate the code now:`;
  }

  /**
   * Get example tools by type to guide generation
   */
  private getExamplesByToolType(toolType: string): string {
    const examples: Record<string, string> = {
      calculator: `
- ROI Calculator: Input fields for revenue and cost, calculate button, result display
- Unit Converter: Dropdown for units, input field, instant conversion
- Price Comparison: Multiple input fields, calculation logic, visual comparison`,
      
      tracker: `
- Citation Tracker: List of citations, add/remove buttons, format selector (APA/MLA)
- Task Tracker: Todo list with checkboxes, add task input, progress indicator
- Time Tracker: Start/stop buttons, elapsed time display, session history`,
      
      checker: `
- Weather Checker: Location input, fetch forecast button, display results
- Link Checker: URL input, validation button, status display
- Password Strength Checker: Password input, real-time strength indicator`,
      
      analyzer: `
- Text Analyzer: Text area input, analyze button, stats display (word count, readability)
- Data Summarizer: Input data, calculate statistics, visualize in simple chart
- Comparison Tool: Side-by-side comparison of two inputs with highlighting`,
      
      formatter: `
- Date Formatter: Date input, format selector, formatted output
- Text Formatter: Text input, formatting options (uppercase, lowercase, title case)
- Number Formatter: Number input, format options (currency, percentage, decimal)`,
      
      monitor: `
- Status Monitor: Display of current status, refresh button, alert indicators
- Progress Monitor: Progress bar, percentage display, estimated time remaining
- Notification Monitor: List of notifications, mark as read, clear all`,
      
      custom: `
- Focus on the specific objective provided
- Think about the minimal features needed to be useful
- Prioritize clarity and simplicity over complexity`,
    };

    return examples[toolType] || examples.custom;
  }

  /**
   * Call LLM API (GPT-4o for code generation)
   */
  private async callLLM(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert front-end developer specializing in generating clean, functional web widgets. Always respond with valid JSON only containing html, css, and js fields.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent code generation
        max_tokens: 2048, // Enough for a complete widget
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API call failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (!text) {
      throw new Error('No content in OpenAI API response');
    }

    logger.debug('Generative_UIAgent', 'OpenAI response received', {
      model: data.model,
      tokenUsage: data.usage,
    });

    return text;
  }

  /**
   * Parse widget code from LLM response
   */
  private parseWidgetFromResponse(
    response: string,
    objective: ActionableObjective
  ): GeneratedWidget | null {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = response.trim();
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // Try to find JSON object in the response
        const jsonObjectMatch = response.match(/\{[\s\S]*"html"[\s\S]*"css"[\s\S]*"js"[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        }
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      if (
        typeof parsed.html !== 'string' ||
        typeof parsed.css !== 'string' ||
        typeof parsed.js !== 'string'
      ) {
        logger.warn('Generative_UIAgent', 'Invalid widget structure in response', {
          hasHtml: typeof parsed.html === 'string',
          hasCss: typeof parsed.css === 'string',
          hasJs: typeof parsed.js === 'string',
        });
        return null;
      }

      const widget: GeneratedWidget = {
        html: parsed.html.trim(),
        css: parsed.css.trim(),
        js: parsed.js.trim(),
        metadata: {
          objective: objective.objective,
          toolType: objective.toolType || 'custom',
          generatedAt: Date.now(),
          complexity: objective.complexity || 'moderate',
        },
      };

      return widget;

    } catch (error) {
      logger.error('Generative_UIAgent', 'Failed to parse widget from response', error);
      logger.debug('Generative_UIAgent', 'Raw response', response.substring(0, 500));
      return null;
    }
  }

  /**
   * Validate generated widget code
   * Basic sanity checks for security and functionality
   */
  private validateWidget(widget: GeneratedWidget): { valid: boolean; warnings?: string[] } {
    const warnings: string[] = [];

    // Check for dangerous patterns
    if (widget.html.includes('<script') || widget.css.includes('<script')) {
      warnings.push('HTML/CSS contains <script> tags - should use separate JS field');
    }

    if (widget.js.includes('eval(') || widget.js.includes('Function(')) {
      warnings.push('JavaScript contains eval() or Function() - potential security risk');
    }

    // Check for external resources (should be self-contained)
    if (widget.html.match(/https?:\/\//)) {
      warnings.push('HTML contains external URLs - widget should be self-contained');
    }

    // Check minimum content
    if (widget.html.length < 50) {
      warnings.push('HTML seems too short - may be incomplete');
    }

    if (widget.css.length < 20) {
      warnings.push('CSS seems too short - may be missing styles');
    }

    logger.debug('Generative_UIAgent', 'Widget validation complete', {
      valid: warnings.length === 0,
      warningCount: warnings.length,
    });

    return {
      valid: warnings.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate preview HTML for testing widget
   * Combines HTML, CSS, JS into single HTML file
   */
  public generatePreviewHTML(widget: GeneratedWidget): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KAIROS Widget Preview - ${widget.metadata.objective}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    ${widget.css}
  </style>
</head>
<body>
  ${widget.html}
  <script>
    ${widget.js}
  </script>
</body>
</html>`;
  }
}

// Export singleton instance
export const generativeUIAgent = new Generative_UIAgent();
