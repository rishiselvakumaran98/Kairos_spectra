/**
 * DataAgent Module
 * 
 * Purpose: The "hands" of KAIROS-SPECTRA. Extracts structured data from DOM elements
 * when the PerceptionAgent detects a struggle event.
 * 
 * Key Features:
 * - Intelligent data type detection (tables, charts, lists, text)
 * - Confidence scoring for data quality (G2: clarity)
 * - Non-destructive scraping (read-only operations)
 * - Performance-optimized with timeouts
 * 
 * Data Types Supported:
 * 1. Tables (HTML tables, role="grid")
 * 2. Charts (Canvas, SVG, visualization libraries)
 * 3. Lists (ul, ol, role="list")
 * 4. Text & Numbers
 */

import type {
  StruggleEvent,
  ExtractedData,
  DataExtractionResult,
  DataAgentState,
  DataType,
} from '../types';
import {
  DATA_AGENT_CONFIG,
  DATA_ELEMENT_SELECTORS,
} from '../constants';
import {
  logger,
  getElementSelector,
  generateId,
} from '../utils';

export class DataAgent {
  private state: DataAgentState;

  constructor() {
    this.state = {
      isActive: true,
      pendingExtractions: [],
      extractionHistory: new Map(),
    };
    
    logger.info('DataAgent', 'Initialized');
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Extract data from elements involved in a struggle event
   * This is the main entry point triggered by PerceptionAgent
   */
  public async extractFromStruggleEvent(
    struggleEvent: StruggleEvent
  ): Promise<DataExtractionResult> {
    const startTime = Date.now();
    
    logger.data('Starting extraction for struggle event', {
      eventId: struggleEvent.id,
      elements: struggleEvent.involvedElements.length,
    });

    this.state.pendingExtractions.push(struggleEvent.id);

    try {
      const extractedData: ExtractedData[] = [];
      const processedElements = new Set<HTMLElement>();

      // CRITICAL FIX: Look for parent tables first when cells are detected
      for (const element of struggleEvent.involvedElements) {
        // If this is a table cell, find the parent table instead
        const dataElement = this.findDataContainer(element);
        
        // Skip if we already processed this element
        if (processedElements.has(dataElement)) {
          continue;
        }
        processedElements.add(dataElement);
        
        const data = await this.extractFromElement(dataElement);
        if (data) {
          extractedData.push(data);
        }
      }

      // Also scan nearby elements for additional context
      const nearbyData = await this.extractNearbyData(struggleEvent.involvedElements);
      nearbyData.forEach(data => {
        // Avoid duplicates
        const isDuplicate = extractedData.some(
          existing => existing.sourceElement === data.sourceElement
        );
        if (!isDuplicate) {
          extractedData.push(data);
        }
      });

      const result: DataExtractionResult = {
        struggleEventId: struggleEvent.id,
        extractedData,
        timestamp: Date.now(),
        metadata: {
          elementsScraped: struggleEvent.involvedElements.length,
          extractionDurationMs: Date.now() - startTime,
        },
      };

      this.state.extractionHistory.set(struggleEvent.id, result);
      this.state.pendingExtractions = this.state.pendingExtractions.filter(
        id => id !== struggleEvent.id
      );

      logger.data('Extraction complete', {
        eventId: struggleEvent.id,
        dataExtracted: extractedData.length,
        types: extractedData.map(d => d.type).join(', '),
        durationMs: result.metadata.extractionDurationMs,
      });

      return result;
    } catch (error) {
      logger.error('DataAgent', 'Extraction failed', error);
      
      // Remove from pending
      this.state.pendingExtractions = this.state.pendingExtractions.filter(
        id => id !== struggleEvent.id
      );
      
      throw error;
    }
  }

  public getExtractionHistory(eventId: string): DataExtractionResult | undefined {
    return this.state.extractionHistory.get(eventId);
  }

  public clearHistory(): void {
    this.state.extractionHistory.clear();
    logger.debug('DataAgent', 'History cleared');
  }

  // ========================================================================
  // Data Extraction - Main Logic
  // ========================================================================

  private async extractFromElement(element: HTMLElement): Promise<ExtractedData | null> {
    const dataType = this.detectDataType(element);
    
    if (dataType === 'unknown') {
      logger.debug('DataAgent', 'Unknown data type, skipping', {
        element: element.tagName,
      });
      return null;
    }

    const selector = getElementSelector(element);

    try {
      let data: any;
      let confidence: number;

      switch (dataType) {
        case 'table':
          ({ data, confidence } = this.extractTableData(element));
          break;
        case 'chart':
          ({ data, confidence } = this.extractChartData(element));
          break;
        case 'list':
          ({ data, confidence } = this.extractListData(element));
          break;
        case 'text':
          ({ data, confidence } = this.extractTextData(element));
          break;
        case 'number':
          ({ data, confidence } = this.extractNumberData(element));
          break;
        default:
          return null;
      }

      if (confidence < DATA_AGENT_CONFIG.MIN_DATA_CONFIDENCE) {
        logger.debug('DataAgent', 'Low confidence extraction, skipping', {
          type: dataType,
          confidence,
        });
        return null;
      }

      const extractedData: ExtractedData = {
        type: dataType,
        sourceElement: selector,
        confidence,
        data,
        schema: this.generateSchema(dataType, data),
      };

      logger.data('Extracted data', {
        type: dataType,
        confidence,
        dataSize: JSON.stringify(data).length,
      });

      return extractedData;
    } catch (error) {
      logger.error('DataAgent', `Failed to extract ${dataType} data`, error);
      return null;
    }
  }

  // ========================================================================
  // Data Type Detection
  // ========================================================================

  /**
   * Find the actual data container element
   * If user hovers over a table cell, find the parent table
   * If user hovers over a chart element, find the parent chart container
   */
  private findDataContainer(element: HTMLElement): HTMLElement {
    // Check if element is a table cell - traverse up to find table
    if (element.tagName === 'TD' || element.tagName === 'TH' || element.tagName === 'TR') {
      let current = element;
      while (current && current !== document.body) {
        if (current.tagName === 'TABLE') {
          logger.debug('DataAgent', 'Found parent table for cell', {
            cell: element.tagName,
            table: getElementSelector(current),
          });
          return current;
        }
        current = current.parentElement as HTMLElement;
      }
    }

    // Check if element is inside a role-based grid
    const gridParent = element.closest('[role="grid"], [role="table"]');
    if (gridParent) {
      logger.debug('DataAgent', 'Found parent grid/table via role', {
        element: element.tagName,
        grid: getElementSelector(gridParent as HTMLElement),
      });
      return gridParent as HTMLElement;
    }

    // Check if element is inside a chart container
    const chartParent = element.closest('svg, canvas, [class*="chart"], [class*="plot"], [class*="graph"]');
    if (chartParent) {
      logger.debug('DataAgent', 'Found parent chart container', {
        element: element.tagName,
        chart: getElementSelector(chartParent as HTMLElement),
      });
      return chartParent as HTMLElement;
    }

    // Return original element if no container found
    return element;
  }

  private detectDataType(element: HTMLElement): DataType {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase() || '';
    const className = element.className?.toString().toLowerCase() || '';

    // Table detection
    if (
      tagName === 'table' ||
      role === 'table' ||
      role === 'grid' ||
      className.includes('table') ||
      className.includes('grid')
    ) {
      return 'table';
    }

    // Chart detection
    if (
      tagName === 'canvas' ||
      tagName === 'svg' ||
      className.includes('chart') ||
      className.includes('graph') ||
      className.includes('plot') ||
      className.includes('visualization')
    ) {
      return 'chart';
    }

    // List detection
    if (
      tagName === 'ul' ||
      tagName === 'ol' ||
      role === 'list' ||
      role === 'listbox'
    ) {
      return 'list';
    }

    // Text vs Number detection
    const textContent = element.textContent?.trim() || '';
    
    if (textContent.length > 0) {
      const numberPattern = /^[\d,.\s$€£¥%+-]+$/;
      if (numberPattern.test(textContent)) {
        return 'number';
      }
      return 'text';
    }

    return 'unknown';
  }

  // ========================================================================
  // Extraction Methods by Data Type
  // ========================================================================

  private extractTableData(element: HTMLElement): { data: any; confidence: number } {
    const rows: string[][] = [];
    let confidence = 0.7;

    // Try to find table structure
    let tableElement = element;
    if (element.tagName !== 'TABLE') {
      tableElement = element.querySelector('table') || element;
    }

    // Extract headers
    const headers: string[] = [];
    const headerCells = tableElement.querySelectorAll('th');
    headerCells.forEach(cell => {
      headers.push(cell.textContent?.trim() || '');
    });

    // Extract rows
    const tableRows = tableElement.querySelectorAll('tr');
    tableRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        const rowData: string[] = [];
        cells.forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });
        rows.push(rowData);
      }
    });

    // If no standard table, try role-based grid
    if (rows.length === 0) {
      const gridRows = tableElement.querySelectorAll('[role="row"]');
      gridRows.forEach(row => {
        const cells = row.querySelectorAll('[role="gridcell"], [role="columnheader"]');
        const rowData: string[] = [];
        cells.forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });
        if (rowData.length > 0) {
          rows.push(rowData);
        }
      });
    }

    // Validate table quality
    if (
      rows.length >= DATA_AGENT_CONFIG.TABLE_MIN_ROWS &&
      rows[0]?.length >= DATA_AGENT_CONFIG.TABLE_MIN_COLS
    ) {
      confidence = 0.9;
    } else if (rows.length > 0) {
      confidence = 0.6;
    } else {
      confidence = 0.3;
    }

    const data = {
      headers: headers.length > 0 ? headers : null,
      rows,
      rowCount: rows.length,
      columnCount: rows[0]?.length || 0,
    };

    return { data, confidence };
  }

  private extractChartData(element: HTMLElement): { data: any; confidence: number } {
    // For charts, we extract metadata and visible text
    // Actual pixel data extraction would require canvas/SVG parsing
    
    const data: any = {
      type: 'chart',
      chartType: this.inferChartType(element),
      dimensions: {
        width: element.offsetWidth,
        height: element.offsetHeight,
      },
      labels: this.extractChartLabels(element),
      title: this.extractChartTitle(element),
    };

    // Attempt to extract data attributes (some libraries store data here)
    const dataAttrs: any = {};
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        try {
          dataAttrs[attr.name] = JSON.parse(attr.value);
        } catch {
          dataAttrs[attr.name] = attr.value;
        }
      }
    });

    if (Object.keys(dataAttrs).length > 0) {
      data.dataAttributes = dataAttrs;
    }

    // Confidence based on available information
    let confidence = 0.5; // Base confidence for chart detection
    if (data.labels.length > 0) confidence += 0.2;
    if (data.title) confidence += 0.1;
    if (Object.keys(dataAttrs).length > 0) confidence += 0.2;

    return { data, confidence: Math.min(confidence, 1.0) };
  }

  private extractListData(element: HTMLElement): { data: any; confidence: number } {
    const items: string[] = [];
    
    const listItems = element.querySelectorAll('li, [role="listitem"]');
    listItems.forEach(item => {
      const text = item.textContent?.trim();
      if (text) {
        items.push(text);
      }
    });

    const confidence = items.length > 0 ? 0.8 : 0.3;

    const data = {
      items,
      itemCount: items.length,
    };

    return { data, confidence };
  }

  private extractTextData(element: HTMLElement): { data: any; confidence: number } {
    const text = element.textContent?.trim() || '';
    
    const data = {
      text,
      length: text.length,
    };

    const confidence = text.length > 10 ? 0.7 : 0.5;

    return { data, confidence };
  }

  private extractNumberData(element: HTMLElement): { data: any; confidence: number } {
    const text = element.textContent?.trim() || '';
    
    // Clean and parse number
    const cleaned = text.replace(/[^0-9.,+-]/g, '');
    const value = parseFloat(cleaned.replace(/,/g, ''));

    const data = {
      rawText: text,
      numericValue: isNaN(value) ? null : value,
      formatted: text,
    };

    const confidence = !isNaN(value) ? 0.8 : 0.4;

    return { data, confidence };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private async extractNearbyData(elements: HTMLElement[]): Promise<ExtractedData[]> {
    const nearbyData: ExtractedData[] = [];
    
    // For each element, look for data visualizations nearby
    for (const element of elements) {
      const parent = element.parentElement;
      if (!parent) continue;

      // Find tables nearby
      const nearbyTables = Array.from(
        parent.querySelectorAll(DATA_ELEMENT_SELECTORS.TABLES.join(','))
      ) as HTMLElement[];

      // Find charts nearby
      const nearbyCharts = Array.from(
        parent.querySelectorAll(DATA_ELEMENT_SELECTORS.CHARTS.join(','))
      ) as HTMLElement[];

      const nearbyElements = [...nearbyTables, ...nearbyCharts]
        .filter(el => !elements.includes(el))
        .slice(0, DATA_AGENT_CONFIG.MAX_ELEMENTS_TO_SCRAPE);

      for (const nearbyElement of nearbyElements) {
        const extracted = await this.extractFromElement(nearbyElement);
        if (extracted) {
          nearbyData.push(extracted);
        }
      }
    }

    return nearbyData;
  }

  private inferChartType(element: HTMLElement): string {
    const className = element.className?.toString().toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    
    const combined = `${className} ${ariaLabel}`;

    if (combined.includes('bar')) return 'bar';
    if (combined.includes('line')) return 'line';
    if (combined.includes('pie')) return 'pie';
    if (combined.includes('scatter')) return 'scatter';
    if (combined.includes('area')) return 'area';
    if (combined.includes('histogram')) return 'histogram';
    
    return 'unknown';
  }

  private extractChartLabels(element: HTMLElement): string[] {
    const labels: string[] = [];
    
    // Look for text elements in SVG
    if (element.tagName === 'svg') {
      const textElements = element.querySelectorAll('text');
      textElements.forEach(text => {
        const content = text.textContent?.trim();
        if (content && content.length < 50) { // Filter out long text
          labels.push(content);
        }
      });
    }
    
    // Look for legend items
    const legendItems = element.querySelectorAll('[class*="legend"] text, [class*="label"]');
    legendItems.forEach(item => {
      const content = item.textContent?.trim();
      if (content && !labels.includes(content)) {
        labels.push(content);
      }
    });

    return labels.slice(0, 20); // Limit to avoid noise
  }

  private extractChartTitle(element: HTMLElement): string | null {
    // Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check for title element in SVG
    if (element.tagName === 'svg') {
      const titleEl = element.querySelector('title');
      if (titleEl) return titleEl.textContent?.trim() || null;
    }

    // Look for nearby headings
    const parent = element.parentElement;
    if (parent) {
      const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) return heading.textContent?.trim() || null;
    }

    return null;
  }

  private generateSchema(dataType: DataType, data: any): ExtractedData['schema'] {
    if (dataType === 'table' && data.headers) {
      return {
        columns: data.headers,
        rows: data.rowCount,
        fields: data.headers.map((name: string) => ({
          name,
          type: 'string', // Could be enhanced with type inference
        })),
      };
    }

    return undefined;
  }
}

// Export singleton instance
export const dataAgent = new DataAgent();
