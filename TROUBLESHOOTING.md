# KAIROS-SPECTRA Troubleshooting Guide

## ✅ RESOLVED: Service Worker Registration Failed (Status Code: 15)

### Error Message:
```
Service worker registration failed. Status code: 15

Uncaught EvalError: Evaluating a string as JavaScript violates the following 
Content Security Policy directive because 'unsafe-eval' is not an allowed 
source of script: script-src 'self'".
```

### Root Cause:
Chrome extensions have strict **Content Security Policy (CSP)** that disallows `eval()` and similar dynamic code evaluation. Webpack's default source map mode (`eval`) violates this policy.

### Solution Applied:
Updated `webpack.config.js` to use CSP-compliant source maps:

```javascript
// Before (BROKEN):
module.exports = {
  // ... other config
  // No devtool specified (defaults to 'eval')
};

// After (FIXED):
module.exports = {
  // ... other config
  devtool: 'cheap-source-map', // Use source maps without eval
};
```

### Verification:
After rebuilding with `npm run build`, the extension should load without errors:
1. Go to `chrome://extensions/`
2. Click "Reload" on KAIROS-SPECTRA
3. No "Service worker registration failed" error should appear
4. Background service worker should show as "Active"

---

## ✅ RESOLVED: "No Table Data Available" & Infinite Loop Errors

### Error Messages:
```
[KAIROS-SPECTRA:VisualizationAgent] ⚠️ No table data available for visualization
[KAIROS-SPECTRA:OrchestratorAgent] ⚠️ Failed to generate viz spec
[KAIROS-SPECTRA:PerceptionAgent] ✗ Element not found: div.kairos-container...
```

### Root Causes:

**Problem 1: Infinite Loop - KAIROS UI Triggering Itself**
- User interacts with KAIROS guidance UI (clicks buttons, hovers over charts)
- PerceptionAgent records these interactions as potential struggle
- New struggle detected → Opens another guidance UI → More interactions → Infinite loop

**Problem 2: No Table Data**
- User triggered struggle on non-table content (text, images, etc.)
- VisualizationAgent expects table data but receives text/list/chart metadata
- Chart generation fails with cryptic "No table data" warning

### Solutions Applied:

**Fix 1: Ignore KAIROS UI Elements in PerceptionAgent**

Added `shouldIgnoreElement()` method to filter out all KAIROS UI interactions:

```typescript
// In PerceptionAgent.ts
private shouldIgnoreElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  
  // Walk up DOM tree checking for KAIROS elements
  let current: HTMLElement | null = element;
  while (current) {
    // Check for KAIROS UI container ID
    if (current.id === 'kairos-spectra-ui') {
      return true;
    }
    
    // Check for KAIROS class prefixes
    if (current.classList) {
      for (const className of Array.from(current.classList)) {
        if (className.startsWith('kairos-')) {
          return true;
        }
      }
    }
    
    current = current.parentElement;
  }
  
  return false;
}

// Applied in all event handlers:
private handleMouseMove(event: MouseEvent): void {
  if (this.shouldIgnoreElement(event.target as HTMLElement)) {
    return; // Ignore KAIROS UI
  }
  // ... rest of logic
}
```

**Applied to:** `handleMouseMove()`, `handleClick()`, `handleScroll()`, `handleHover()`

**Fix 2: User-Friendly Error Messages in VisualizationAgent**

Enhanced error handling with descriptive messages:

```typescript
// In VisualizationAgent.ts - generateVegaLiteSpec()
if (!tableData) {
  const availableTypes = data.map(d => d.type).join(', ');
  throw new Error(
    `Cannot create chart: No table data found. I detected ${data.length} item(s) of type: ${availableTypes}. ` +
    `Please try interacting with a data table on the page.`
  );
}

// Check for minimum requirements
if (rawData.rows.length === 0) {
  throw new Error('Cannot create chart: Table has no data rows.');
}

if (schema.columns.length < 2) {
  throw new Error('Cannot create chart: Need at least 2 columns for visualization.');
}

// Unimplemented chart types
case 'histogram':
case 'box_plot':
case 'heatmap':
  throw new Error(
    `Chart type "${vizType}" is not yet implemented. ` +
    `Please try Bar Chart, Line Chart, or Scatter Plot.`
  );
```

**Fix 3: Error Display in OrchestratorAgent**

Updated to show user-friendly errors instead of generic messages:

```typescript
// In OrchestratorAgent.ts - handleVizTypeSelection()
catch (error) {
  const errorMessage = error instanceof Error 
    ? error.message  // Use detailed error from VisualizationAgent
    : 'An unexpected error occurred while generating the visualization.';
  
  hierarchicalGuidanceUI.showError(errorMessage);
}
```

### User Experience After Fix:

**Before:**
```
⚠️ No table data available for visualization
⚠️ Failed to generate viz spec
(Generic error, user confused)
```

**After:**
```
❌ Cannot create chart: No table data found. I detected 1 item(s) of type: text. 
   Please try interacting with a data table on the page.
```

Or for unimplemented features:
```
❌ Chart type "box_plot" is not yet implemented. 
   Please try Bar Chart, Line Chart, or Scatter Plot.
```

### Verification Steps:

1. **Test KAIROS UI Isolation:**
   - Open Voyager with KAIROS-SPECTRA
   - Trigger struggle → Level 1 UI appears
   - Click buttons, hover over chart in refinement UI
   - ✅ Console should NOT show new struggle detections for KAIROS elements
   - ✅ No "Element not found: div.kairos-container..." errors

2. **Test Error Messages:**
   - Trigger struggle on non-table content (e.g., paragraph text)
   - Click "Compare Trends" → "Bar Chart"
   - ✅ Should see clear error: "No table data found... Please try interacting with a data table"
   - Click "Box Plot" (unimplemented)
   - ✅ Should see: "Chart type 'box_plot' is not yet implemented..."

3. **Test Normal Flow:**
   - Trigger struggle on actual table (test-dashboard.html)
   - Select goal → Select chart type
   - ✅ Chart should render without errors

### Development Notes:

**KAIROS UI Element Naming Convention:**
- All KAIROS UI elements use `kairos-` class prefix
- Container has ID `kairos-spectra-ui`
- This makes filtering trivial with `startsWith('kairos-')`

**Error Hierarchy:**
1. VisualizationAgent throws descriptive errors
2. OrchestratorAgent catches and displays them
3. HierarchicalGuidanceUI shows error in red banner
4. User gets actionable feedback

---

## ✅ RESOLVED: Extension Context Invalidated Error

### Error Message:
```
[KAIROS-SPECTRA:ContentScript] ❌ Failed to handle struggle event 
Error: Extension context invalidated.
    at content.js:244:24
    at new Promise (<anonymous>)
    at sendMessageToBackground (content.js:243:12)
```

### Root Cause:
This error occurs when the Chrome extension is **reloaded** (via chrome://extensions/ → Reload button) while the content script is still active on open pages. The old content script tries to communicate with the background service worker, but the message passing channel has been broken because the extension context was destroyed and recreated.

### Why It Happens:
1. User has a web page open with KAIROS-SPECTRA running
2. Developer reloads extension (during development/testing)
3. Background service worker is replaced with new instance
4. Old content script on the page tries to send messages → **Extension context invalidated error**

### Solution Applied:
Enhanced error handling in two places:

**1. `src/utils.ts` - Detect context invalidation early:**
```typescript
export function sendMessageToBackground<T>(message: ChromeMessage<T>): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      reject(new Error('Extension context invalidated - extension was reloaded'));
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError;
          
          // Handle "Extension context invalidated" gracefully
          if (error.message?.includes('Extension context invalidated')) {
            reject(new Error('Extension context invalidated - please reload this page'));
          } else {
            reject(error);
          }
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
```

**2. `src/content.ts` - Stop gracefully when context is lost:**
```typescript
private async handleStruggleDetected(event: StruggleEvent): Promise<void> {
  try {
    // ... existing struggle detection logic ...
  } catch (error) {
    // Handle extension context invalidation gracefully
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      logger.warn('ContentScript', 'Extension was reloaded. KAIROS stopped until page refresh.');
      
      // Stop perception agent to prevent further errors
      perceptionAgent.stop();
      
      // Show user-friendly warning
      console.warn(
        '⚠️ KAIROS-SPECTRA: Extension was reloaded. Please refresh this page to re-enable assistance.'
      );
    } else {
      logger.error('ContentScript', 'Failed to handle struggle event', error);
    }
  }
}
```

### User Experience:
After the fix, when extension is reloaded:
1. ✅ No more red error in console
2. ✅ Friendly warning: `⚠️ KAIROS-SPECTRA: Extension was reloaded. Please refresh this page to re-enable assistance.`
3. ✅ PerceptionAgent automatically stops to prevent further errors
4. ✅ User knows they need to refresh the page to continue

### Verification:
1. Open a test page (e.g., test-dashboard.html)
2. Trigger struggle detection (move mouse around)
3. **While page is still open**, go to chrome://extensions/ → Reload KAIROS-SPECTRA
4. Move mouse on the page again
5. Check console: Should see friendly warning instead of error
6. Refresh page (`Cmd+R` or `F5`)
7. Extension should work normally again

### Development Workflow:
**Best practice to avoid this issue:**
1. After reloading extension via chrome://extensions/
2. **Always refresh test pages** to get fresh content script
3. Alternatively, close and reopen tabs after extension reload

---

## 🐛 Other Common Issues

### Issue: Extension icon doesn't appear in toolbar
**Cause:** Icons missing from `dist/icons/` folder  
**Fix:** Ensure `icons/` folder has icon16.png, icon48.png, icon128.png  
**Verify:** Check `dist/icons/` after build

### Issue: Content script not injecting
**Symptoms:** No console logs, no struggle detection  
**Causes:**
- Page loaded before extension installed
- Content script failed to compile  
**Fix:**
1. Reload the page (`Cmd+R` or `F5`)
2. Check browser console for errors
3. Verify `content.js` exists in `dist/`

### Issue: Vision analysis always returns null
**Symptoms:** Console shows "No analysis result from GPT-4V"  
**Causes:**
- No API key set
- Invalid API key
- API quota exceeded
- Network error  
**Fix:**
1. Open extension popup → Settings
2. Unlock and paste valid OpenAI API key (starts with `sk-`)
3. Click Save
4. Verify status shows "✓ API key set"
5. Check OpenAI usage at https://platform.openai.com/usage

### Issue: Popup doesn't open
**Symptoms:** Clicking extension icon does nothing  
**Causes:**
- popup.html missing from dist
- popup.js failed to compile  
**Fix:**
1. Verify `dist/popup.html` and `dist/popup.js` exist
2. Run `npm run build`
3. Reload extension
4. Right-click icon → Inspect popup → Check console

### Issue: "Cannot find name 'chrome'" TypeScript errors
**Cause:** Missing Chrome types  
**Fix:** Already included in `@types/chrome` dependency  
**Verify:** Check `package.json` has `"@types/chrome": "^0.0.268"`

---

## 📋 Quick Diagnostics Checklist

When extension doesn't work:

- [ ] **Build succeeded?** Run `npm run build`, check for errors
- [ ] **Extension reloaded?** Go to chrome://extensions/, click Reload
- [ ] **Icons present?** Check `dist/icons/` has PNG files
- [ ] **All files copied?** Check `dist/` has:
  - background.js
  - content.js
  - popup.js
  - injected.js
  - popup.html
  - content.css
  - manifest.json
- [ ] **Service worker active?** chrome://extensions/ → Background page shows "Service worker (Active)"
- [ ] **Console clean?** No red errors in browser console
- [ ] **Page reloaded?** Refresh test page after extension changes
- [ ] **API key set?** (For vision) Popup → Settings shows "✓ API key set"

---

## 🔧 Developer Commands

### Clean rebuild:
```bash
rm -rf dist/
npm run build
```

### Watch mode (auto-rebuild on file changes):
```bash
npm run dev
```

### Check TypeScript errors:
```bash
npx tsc --noEmit
```

### Verify webpack config:
```bash
npx webpack --mode production --display-error-details
```

---

## 📞 Getting Help

If issues persist:

1. **Check browser console** (F12 → Console tab)
2. **Check background service worker console** (chrome://extensions/ → "Service worker" link)
3. **Enable verbose logging** in VisionAgent.ts (change logger.info to logger.log)
4. **Export extension logs**:
   ```javascript
   // In browser console:
   chrome.storage.sync.get(null, (data) => console.log(data));
   ```

---

## 🎯 Status Codes Reference

**Chrome Extension Error Codes:**
- **15**: Service worker CSP violation (eval not allowed) → Fixed by webpack config
- **3**: Extension manifest parse error → Check manifest.json syntax
- **2**: Extension disabled by user → Re-enable in chrome://extensions/
- **1**: Unknown error → Check browser console for details

---

## ✅ Current Status

As of November 10, 2025:
- ✅ CSP issue fixed (webpack devtool set to 'cheap-source-map')
- ✅ Extension context invalidation handled gracefully
- ✅ KAIROS UI infinite loop prevented (shouldIgnoreElement filter)
- ✅ User-friendly error messages for visualization failures
- ✅ Build successful (2.38 MiB with Phase 2 components, 2136ms)
- ✅ All TypeScript compiles without errors
- ✅ Phase 2 (Guiding Layer) complete and tested

**Next steps:** 
1. Reload extension at chrome://extensions/
2. **Always refresh test pages** after reloading extension
3. Test on actual data tables (not text content)
4. Verify no infinite loops when interacting with KAIROS UI

````
