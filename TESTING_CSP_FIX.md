# Testing the CSP Fix

## Quick Start

1. **Reload the Extension**
   ```
   Chrome → Extensions → KAIROS-SPECTRA → Reload icon
   ```

2. **Refresh Your Test Page**
   - Open `test-dashboard.html`
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)

3. **Trigger Chart Generation**
   - Hover over the "Sales Data" table
   - Wait for struggle detection
   - Select "Compare Trends" → "Bar Chart"

## What Changed

### Before (❌ CSP Error)
```
content.js tried to use vegaEmbed directly
→ Vega tried to use eval()
→ CSP blocked it
→ EvalError: unsafe-eval not allowed
```

### After (✅ Sandboxed Iframe)
```
content.js creates iframe with vega-sandbox.html
→ iframe loads Vega from CDN (not bundled)
→ iframe receives spec via postMessage
→ Vega renders inside iframe (eval allowed in sandbox)
→ Success message sent back to content.js
```

## Verification Checklist

- [ ] No CSP errors in console
- [ ] Chart appears in KAIROS UI
- [ ] Chart is interactive (hover tooltips work)
- [ ] Export button works
- [ ] Refinement works (try "make it a line chart")
- [ ] Bundle size is ~152 KiB (was 2.43 MiB)

## Debugging

### If chart doesn't appear:

1. **Check Console for Errors**
   ```
   Look for: [KAIROS-SPECTRA:VisualizationAgent]
   ```

2. **Verify Sandbox Loaded**
   ```javascript
   // In console, check if iframe exists:
   document.querySelector('iframe[src*="vega-sandbox"]')
   ```

3. **Check PostMessage Communication**
   ```javascript
   // Add listener to see messages:
   window.addEventListener('message', (e) => {
     console.log('Message:', e.data);
   });
   ```

### If iframe is blank:

1. **Check Network Tab**
   - Should see `vega-sandbox.html` loaded
   - CDN scripts should load (vega@5, vega-lite@5, vega-embed@6)

2. **Check Iframe Console**
   - Right-click iframe → Inspect
   - Check for JS errors in iframe context

## Expected Console Output

```
[KAIROS-SPECTRA:VisualizationAgent] Generating Vega-Lite spec
[KAIROS-SPECTRA:VisualizationAgent] Spec generated successfully
[KAIROS-SPECTRA:VisualizationAgent] Rendering Vega-Lite chart via sandboxed iframe
[KAIROS-SPECTRA:VisualizationAgent] Chart rendered successfully in sandbox
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Refinement UI shown with chart
```

## Performance Notes

- **First render**: ~500-800ms (CDN load + chart render)
- **Subsequent renders**: ~100-200ms (CDN cached)
- **Bundle size**: 152 KiB (94% smaller than before!)

## File Changes Summary

```
✅ vega-sandbox.html          (NEW - sandboxed rendering environment)
✅ manifest.json              (added sandbox declaration)
✅ webpack.config.js          (copy vega-sandbox.html to dist)
✅ VisualizationAgent.ts      (use iframe instead of direct vegaEmbed)
✅ CSP_VEGA_FIX.md           (updated documentation)
❌ vega-embed import          (REMOVED - no longer needed)
```

---

**Status**: ✅ Ready to test  
**Date**: November 10, 2025
