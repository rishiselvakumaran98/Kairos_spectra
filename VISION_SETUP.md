# Vision-Enhanced Phase 1 Setup Guide

## 🎯 Overview

KAIROS-SPECTRA now includes **GPT-4V (Vision) fallback** for complex web apps where DOM extraction fails (like Voyager, Tableau, Looker, etc.).

### How it Works:

1. **Primary: DOM extraction** (fast, works for HTML tables)
2. **Fallback: GPT-4V vision** (when `dataExtracted: 0`)
   - Captures screenshot with cursor position marked
   - Sends to GPT-4V: "What data/visualization is at the red circle?"
   - Returns structured description of what user is stuck on

---

## 📋 Prerequisites

### 1. OpenAI API Key

You need a **GPT-4V-enabled API key** from OpenAI:
- Sign up at https://platform.openai.com/
- Create API key with GPT-4 Vision access
- **Cost**: ~$0.01-0.05 per screenshot analysis (high detail)

### 2. Set API Key in Chrome

**Option A: Via Console (Recommended)**
```javascript
// Open DevTools console and run:
chrome.storage.sync.set({
  openai_api_key: "sk-your-actual-api-key-here"
});
```

**Option B: Via Extension Popup (Future)**
We'll add a settings UI in Phase 2.

### 3. Verify API Key Loaded

```javascript
// Check if key is set:
chrome.storage.sync.get(['openai_api_key'], (result) => {
  console.log('API Key:', result.openai_api_key ? 'SET ✓' : 'NOT SET ✗');
});
```

---

## 🚀 Build & Test

### 1. Build Extension

```bash
cd /Users/rishiselvakumaran/Desktop/Fall_2025/Research_work/Mixed-Initiative-UI-Agent/KAIROS-SPECTRA
npm run build
```

### 2. Reload Extension

1. Go to `chrome://extensions/`
2. Click reload icon on KAIROS-SPECTRA

### 3. Test on Voyager

1. Open https://vega.github.io/voyager/
2. Load a dataset (e.g., "Cars")
3. Hover over a scatter plot
4. Wait 3+ seconds (trigger prolonged hesitation)

**Expected Console Output:**
```
[KAIROS-SPECTRA:ContentScript] DOM extraction failed, trying vision analysis
[KAIROS-SPECTRA:VisionAgent] Starting vision analysis {mousePosition: {x: 500, y: 300}}
[KAIROS-SPECTRA:VisionAgent] Vision analysis complete {type: 'chart', confidence: 0.85}
================================================================================
🎯 KAIROS-SPECTRA: Struggle Detected
================================================================================
Pattern: prolonged_hesitation
Confidence: 80.0%
Elements involved: 0
Data extracted: 1

📊 Extracted Data:

  1. Type: chart, Confidence: 85.0%
     Data: {
       elementType: "chart",
       description: "Scatter plot visualization",
       chartType: "scatter plot",
       dataDescription: "Comparing gas vs miles with colored points representing number of cylinders",
       possibleActions: ["filter data", "change chart type", "zoom", "select points"],
       extractedVia: "vision",
       mousePosition: {x: 500, y: 300}
     }
================================================================================
```

---

## 🔧 Configuration

### Adjust Vision Analysis Behavior

Edit `src/agents/VisionAgent.ts`:

```typescript
// Line ~175: Change GPT-4V model
model: 'gpt-4-turbo', // Use turbo for faster/cheaper analysis

// Line ~185: Adjust detail level
detail: 'low', // Use 'low' to reduce costs (less accurate)

// Line ~192: Change temperature
temperature: 0.1, // Even more deterministic
```

### Disable Vision Fallback

If you want to test DOM-only extraction:

```javascript
// In Chrome console:
chrome.storage.sync.remove('openai_api_key');
```

Reload the page - vision analysis will be skipped.

---

## 📊 Understanding Vision Output

### ExtractedData Structure

When vision is used, the `data` field contains:

```typescript
{
  elementType: "chart" | "table" | "graph" | "canvas" | "form" | "unknown",
  description: string,           // Human-readable description
  chartType?: string,             // "scatter plot", "line chart", etc.
  dataDescription?: string,       // What data is shown
  possibleActions?: string[],     // ["filter", "zoom", "export"]
  extractedVia: "vision",         // Indicates GPT-4V was used
  mousePosition: {x, y},          // Where user was stuck
  url: string,                    // Page URL
  timestamp: number               // When extracted
}
```

### Confidence Scores

- **DOM extraction**: Usually 0.7-0.9 (deterministic)
- **Vision extraction**: Varies 0.5-0.95 (GPT-4V's assessment)

---

## 🐛 Troubleshooting

### Vision analysis not triggering

**Symptom:** Still seeing `dataExtracted: 0` even on Voyager

**Checklist:**
1. API key set? Run: `chrome.storage.sync.get(['openai_api_key'])`
2. Check console for errors: "No OpenAI API key configured"
3. Ensure you're on a complex web app (not test-dashboard.html)

### Screenshot permission denied

**Symptom:** Error: "Cannot capture tab"

**Fix:**
1. Check manifest.json has `"activeTab"` permission ✓
2. Ensure you clicked on the page before hovering (tab must be active)
3. Some sites block screenshots (e.g., Netflix) - this is expected

### Vision analysis too slow

**Symptom:** 3-5 second delay after struggle detected

**Expected:** Vision analysis requires:
- Screenshot capture: ~100ms
- API request to OpenAI: 2-4 seconds
- Response parsing: ~50ms

**To speed up:**
- Use `detail: 'low'` in GPT-4V request (line 185)
- Switch to `gpt-4-turbo` model (faster, cheaper)

### Incorrect analysis

**Symptom:** GPT-4V says "table" but it's actually a chart

**Debugging:**
1. Check the screenshot being sent (add debug log)
2. Is the cursor marker visible in the right place?
3. Try increasing `detail` from 'low' to 'high'
4. Adjust the prompt in `sendToGPT4V()` to be more specific

---

## 💰 Cost Estimates

### GPT-4V Pricing (as of Nov 2025)

- **Input**: $10 / 1M tokens
- **Output**: $30 / 1M tokens
- **Image (high detail)**: ~$0.01-0.05 per image

### Expected Usage:

- **10 struggle events/hour** × **$0.02/screenshot** = **$0.20/hour**
- **Testing session (2 hours)** = **$0.40**
- **User study (10 participants, 1 hour each)** = **$2.00**

**Recommendation:** Start with a $5 credit to test.

---

## ✅ Phase 1 Vision Checklist

- [ ] OpenAI API key obtained
- [ ] API key set in Chrome storage
- [ ] Extension rebuilt with VisionAgent
- [ ] Tested on simple site (test-dashboard.html) - DOM works
- [ ] Tested on complex site (Voyager) - Vision works
- [ ] Vision analysis returns reasonable descriptions
- [ ] Confidence scores make sense
- [ ] Ready for Phase 2 (OrchestratorAgent can use vision data)

---

## 🚀 Next Steps

Once vision is working:

1. **Tune the prompt** in `VisionAgent.ts` for better accuracy
2. **Test on multiple sites**:
   - Tableau Public dashboards
   - Google Data Studio
   - Observable notebooks
   - PowerBI embedded reports
3. **Collect metrics**:
   - How often does DOM fail?
   - Vision accuracy vs DOM accuracy
   - User preference (speed vs richness)
4. **Proceed to Phase 2**: OrchestratorAgent can now work with both DOM and vision data!

---

## 📞 Support

**Vision-specific issues:**
- Check OpenAI API status: https://status.openai.com/
- Review API usage: https://platform.openai.com/usage
- Check rate limits: 500 RPM for GPT-4V (plenty for testing)

**General KAIROS-SPECTRA issues:**
- See DEVELOPMENT_GUIDE.md
- Check console logs for detailed errors

---

**Happy Testing! 🎉**

You now have a robust fallback for complex web apps where traditional DOM scraping fails!
