/**
 * KAIROS-SPECTRA Injected Script
 * 
 * This script runs in the page context (not the extension context)
 * and can access page-level JavaScript variables and functions.
 * 
 * Used for advanced data extraction from visualization libraries
 * that store data in JavaScript objects.
 */

(function() {
  'use strict';

  console.log('[KAIROS-SPECTRA] Injected script loaded');

  // Listen for messages from content script
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) {
      return;
    }

    if (event.data.type === 'KAIROS_EXTRACT_PAGE_DATA') {
      const data = extractPageLevelData();
      
      window.postMessage({
        type: 'KAIROS_PAGE_DATA_RESPONSE',
        payload: data,
      }, '*');
    }
  });

  /**
   * Extract data from common visualization libraries
   * that store data in global variables or window properties
   */
  function extractPageLevelData(): any {
    const extractedData: any = {
      timestamp: Date.now(),
      visualizationLibraries: detectVisualizationLibraries(),
      chartData: extractChartData(),
    };

    return extractedData;
  }

  /**
   * Detect which visualization libraries are loaded
   */
  function detectVisualizationLibraries(): string[] {
    const libraries: string[] = [];

    // @ts-ignore
    if (typeof window.Plotly !== 'undefined') libraries.push('Plotly');
    // @ts-ignore
    if (typeof window.Highcharts !== 'undefined') libraries.push('Highcharts');
    // @ts-ignore
    if (typeof window.Chart !== 'undefined') libraries.push('Chart.js');
    // @ts-ignore
    if (typeof window.d3 !== 'undefined') libraries.push('D3.js');
    // @ts-ignore
    if (typeof window.vega !== 'undefined') libraries.push('Vega');
    // @ts-ignore
    if (typeof window.vegaEmbed !== 'undefined') libraries.push('Vega-Embed');

    return libraries;
  }

  /**
   * Attempt to extract chart data from visualization library instances
   */
  function extractChartData(): any[] {
    const chartData: any[] = [];

    // Example: Extract from Plotly
    // @ts-ignore
    if (typeof window.Plotly !== 'undefined') {
      const plotlyDivs = document.querySelectorAll('.plotly');
      plotlyDivs.forEach((div: any) => {
        if (div.data) {
          chartData.push({
            library: 'Plotly',
            data: div.data,
            layout: div.layout,
          });
        }
      });
    }

    // Example: Extract from Chart.js
    // @ts-ignore
    if (typeof window.Chart !== 'undefined') {
      // @ts-ignore
      const instances = window.Chart.instances;
      if (instances) {
        Object.values(instances).forEach((chart: any) => {
          if (chart?.config?.data) {
            chartData.push({
              library: 'Chart.js',
              data: chart.config.data,
            });
          }
        });
      }
    }

    return chartData;
  }

  // Notify that injected script is ready
  window.postMessage({
    type: 'KAIROS_INJECTED_READY',
  }, '*');
})();
