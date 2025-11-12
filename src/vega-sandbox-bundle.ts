/**
 * Vega Sandbox Entry Point
 * Bundles Vega libraries for use in sandboxed iframe
 */

import vegaEmbed from 'vega-embed';

// Make vegaEmbed globally available
(window as any).vegaEmbed = vegaEmbed;

console.log('[Vega Sandbox] vegaEmbed loaded and exposed globally');
