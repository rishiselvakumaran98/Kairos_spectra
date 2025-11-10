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
- ✅ Build successful (98.4 KiB, 954ms)
- ✅ All TypeScript compiles without errors
- ✅ Extension ready to load

**Next step:** Reload extension at chrome://extensions/
