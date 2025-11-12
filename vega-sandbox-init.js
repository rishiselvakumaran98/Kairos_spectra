/**
 * Vega Sandbox Initialization Script
 * Handles message passing between parent content script and sandboxed iframe
 */

console.log('[Vega Sandbox] Sandbox page loaded');

window.addEventListener('load', () => {
  console.log('[Vega Sandbox] Window load event');
  if (typeof window.vegaEmbed === 'function') {
    console.log('[Vega Sandbox] vegaEmbed is available');
    window.parent.postMessage({ type: 'VEGA_SANDBOX_READY' }, '*');
  } else {
    console.error('[Vega Sandbox] vegaEmbed is NOT available after bundle load');
  }
});

window.addEventListener('message', async (event) => {
  console.log('[Vega Sandbox] Received message:', event.data);
  
  if (event.data.type === 'RENDER_VEGA') {
    try {
      const spec = event.data.spec;
      console.log('[Vega Sandbox] Rendering spec:', spec);
      
      const container = document.getElementById('vis');
      container.innerHTML = ''; // Clear previous chart
      
      await window.vegaEmbed(container, spec, {
        actions: {
          export: true,
          source: false,
          compiled: false,
          editor: false,
        },
        renderer: 'canvas',
      });
      
      console.log('[Vega Sandbox] Render succeeded');
      
      // Notify parent that rendering succeeded
      window.parent.postMessage({ 
        type: 'VEGA_RENDER_SUCCESS' 
      }, '*');
      
    } catch (error) {
      console.error('[Vega Sandbox] Vega rendering error:', error);
      
      // Show error in iframe
      const container = document.getElementById('vis');
      container.innerHTML = `
        <div class="error">
          <strong>Chart Rendering Error:</strong><br>
          ${error.message || 'Unknown error'}
        </div>
      `;
      
      // Notify parent of error
      window.parent.postMessage({ 
        type: 'VEGA_RENDER_ERROR',
        error: error.message || 'Unknown error' 
      }, '*');
    }
  }
});
