# Vision Integration - Quick Start

## 🚀 In 3 Steps:

### 1. Set API Key (One Time)
```javascript
// Paste in Chrome DevTools console:
chrome.storage.sync.set({
  openai_api_key: "sk-your-openai-key-here"
});
```

### 2. Reload Extension
- `chrome://extensions/` → Click reload on KAIROS-SPECTRA

### 3. Test on Voyager
- Visit: https://vega.github.io/voyager/
- Load "Cars" dataset
- Hover on scatter plot for 3+ seconds
- Watch console for vision analysis! 🎉

---

## 📊 Expected Output

```
[KAIROS-SPECTRA:ContentScript] DOM extraction failed, trying vision analysis
[KAIROS-SPECTRA:VisionAgent] Vision analysis complete {type: 'chart', confidence: 0.85}

================================================================================
🎯 KAIROS-SPECTRA: Struggle Detected
================================================================================
Pattern: prolonged_hesitation
Data extracted: 1

📊 Extracted Data:
  1. Type: chart, Confidence: 85.0%
     chartType: "scatter plot"
     dataDescription: "Comparing gas vs miles"
     extractedVia: "vision" ← This means GPT-4V was used!
================================================================================
```

---

## 🔍 How to Know Vision is Working

**Look for these logs:**
1. `"DOM extraction failed, trying vision analysis"`
2. `"Starting vision analysis"`
3. `"Vision analysis complete"`
4. `extractedVia: "vision"` in the data

**Cost:** ~$0.02 per struggle event that uses vision

---

## 📖 Full Docs

- **Setup Guide**: `VISION_SETUP.md`
- **Implementation Summary**: `VISION_SUMMARY.md`
- **Development Guide**: `DEVELOPMENT_GUIDE.md`

---

## ⚡ Quick Debug

**No vision analysis?**
```javascript
// Check if API key is set:
chrome.storage.sync.get(['openai_api_key'], (result) => {
  console.log('API Key:', result.openai_api_key ? 'SET ✓' : 'NOT SET ✗');
});
```

**Still not working?**
- Make sure you're on a complex site (not test-dashboard.html)
- DOM must fail first (check for `dataExtracted: 0`)
- Check console for error messages
