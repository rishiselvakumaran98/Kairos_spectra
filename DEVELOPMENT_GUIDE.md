# KAIROS-SPECTRA Development Guide

## 🎉 Phase 1 Complete!

The "Sensing" Layer has been successfully implemented. This guide will help you build, test, and iterate on the prototype.

---

## 📦 Quick Start

### 1. Install Dependencies

```bash
cd /Users/rishiselvakumaran/Desktop/Fall_2025/Research_work/Mixed-Initiative-UI-Agent/KAIROS-SPECTRA
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This compiles TypeScript and bundles the extension into the `dist/` folder.

### 3. Load Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select: `/Users/rishiselvakumaran/Desktop/Fall_2025/Research_work/Mixed-Initiative-UI-Agent/KAIROS-SPECTRA/dist`

### 4. Test on Dashboard

1. Open `test-dashboard.html` in Chrome (File > Open File)
2. Open DevTools Console (F12)
3. Try the test scenarios below

---

## 🧪 Testing Phase 1

### Test Scenario 1: Prolonged Hesitation

**Goal:** Trigger hesitation-based struggle detection

**Steps:**
1. Hover your mouse over the "Sales Data" table
2. Keep your mouse completely still for 3+ seconds
3. Watch the console

**Expected Output:**
```
[KAIROS-SPECTRA:Struggle] 🎯 Struggle detected! {
  type: "prolonged_hesitation",
  confidence: 0.8,
  elements: 1
}
```

**Followed by:**
```
==================================================
🎯 KAIROS-SPECTRA: Struggle Detected
==================================================
Pattern: prolonged_hesitation
Confidence: 80.0%
Elements involved: 1
Data extracted: 1

Extracted Data:
  1. Type: table, Confidence: 90.0%
     Data: { headers: [...], rows: [...] }
==================================================
```

### Test Scenario 2: Repetitive Movement

**Goal:** Trigger repetitive movement detection

**Steps:**
1. Click on the "Sales Data" table
2. Click on the "Revenue Trends" chart
3. Click back on "Sales Data"
4. Click on "Revenue Trends" again
5. Repeat 1-2 more times

**Expected Output:**
```
[KAIROS-SPECTRA:Struggle] 🎯 Struggle detected! {
  type: "repetitive_movement",
  confidence: 0.7,
  elements: 2
}
```

**Data extraction should show:**
- Table data from "Sales Data"
- Chart metadata from "Revenue Trends"

### Test Scenario 3: Monitor Extension Status

**Steps:**
1. Click the KAIROS-SPECTRA extension icon in Chrome toolbar
2. Popup should show:
   - Status: 🟢 Active
   - Interactions: (number of recorded interactions)
   - Struggles: (number of detected struggles)

### Test Scenario 4: Verify Data Extraction Quality

**Steps:**
1. Trigger any struggle event
2. In console, examine the "Extracted Data" section
3. Verify:
   - Tables have `headers` and `rows`
   - Charts have `chartType` and `labels`
   - Confidence scores are reasonable (>0.5)

---

## 🔧 Development Workflow

### Watch Mode (Recommended)

```bash
npm run dev
```

This watches for file changes and rebuilds automatically. After each build:
1. Go to `chrome://extensions/`
2. Click the refresh icon on KAIROS-SPECTRA
3. Reload the test page

### Debugging Tips

**Enable verbose logging:**
All logging is enabled by default. To adjust, edit `src/constants.ts`:

```typescript
export const DEBUG = {
  ENABLED: true,
  LOG_INTERACTIONS: true,    // See every click/hover/scroll
  LOG_STRUGGLES: true,        // See struggle detection
  LOG_DATA_EXTRACTION: true,  // See data scraping
  VERBOSE: true,              // Extra detailed logs
};
```

**Adjust sensitivity:**

Make struggles trigger more easily:
```typescript
export const PERCEPTION_CONFIG = {
  HESITATION_THRESHOLD_MS: 2000,      // 2 seconds instead of 3
  REPETITIVE_MOVEMENT_THRESHOLD: 2,    // 2 repeats instead of 3
  MIN_CONFIDENCE_THRESHOLD: 0.5,       // Lower bar
};
```

**Inspect agent state:**

Add this to console:
```javascript
// Get perception agent state
chrome.runtime.sendMessage({
  type: 'PERCEPTION_STATUS',
  timestamp: Date.now(),
  source: 'content'
});
```

---

## 🐛 Troubleshooting

### Extension not loading

**Symptom:** Error when loading unpacked extension

**Fix:**
1. Ensure you built with `npm run build`
2. Select the `dist/` folder, not the root folder
3. Check for build errors in terminal

### No struggle events detected

**Symptom:** Interacting with page but no console logs

**Possible causes:**
1. Content script not injected
   - Reload the page after loading extension
   - Check for errors in console
   
2. Sensitivity too low
   - Adjust thresholds in `src/constants.ts`
   - Rebuild with `npm run build`

3. DevTools not showing logs
   - Ensure Console is visible
   - Check filter isn't hiding KAIROS-SPECTRA logs

### TypeScript errors during build

**Common warnings (safe to ignore):**
- `Cannot find name 'chrome'` - These are resolved at runtime
- `NodeJS.Timeout` warnings - Type definitions issue, doesn't affect functionality

**Real errors:**
- Syntax errors in TypeScript files
- Missing imports
- Check terminal output for specifics

### Data extraction returns empty arrays

**Symptom:** Struggle detected but no data extracted

**Debugging:**
1. Check if elements are actually data visualizations
2. Verify elements are visible (not `display: none`)
3. Add debug logs in `DataAgent.ts`:
   ```typescript
   console.log('Extracting from:', element.tagName, element.className);
   ```

---

## 📊 Monitoring & Metrics

### Key Metrics to Track

**Perception Agent:**
- Interaction buffer size (should stay under 100)
- Struggle detection rate
- Confidence scores distribution

**Data Agent:**
- Extraction success rate
- Data type distribution (table vs chart vs text)
- Confidence scores for extractions

**Performance:**
- Extraction duration (should be <5000ms)
- Memory usage of interaction buffer
- Event listener overhead

### Add Custom Logging

Edit any agent file to add metrics:

```typescript
logger.info('PerceptionAgent', 'Metrics', {
  bufferSize: this.state.interactionBuffer.length,
  strugglesDetected: struggleCount,
  avgConfidence: totalConfidence / struggleCount,
});
```

---

## 🚀 Next Steps: Preparing for Phase 2

### Tasks Before Phase 2

- [ ] Test on multiple real dashboards (Tableau Public, Google Analytics, etc.)
- [ ] Fine-tune struggle detection thresholds based on testing
- [ ] Document any false positives/negatives
- [ ] Collect baseline metrics (detection accuracy, data extraction quality)

### Phase 2 Preview

**What we'll build:**
1. **OrchestratorAgent**: Manages UI state and coordinates agents
2. **Hierarchical UI**: Toast/modal for analytical goal selection
3. **VisualizationAgent**: Generates Vega-Lite specs from extracted data
4. **Refine-Vis Loop**: Iterative chart improvement

**UI Mockup Flow:**
```
User struggles → Perception detects → Data extracted
↓
Toast appears: "I noticed you're comparing data. Would you like to:"
  [Compare Trends] [Analyze Distribution] [Find Outliers]
↓
User clicks "Compare Trends"
↓
Modal updates: "Choose visualization:"
  [Line Chart] [Bar Chart] [Scatter Plot]
↓
User clicks "Bar Chart"
↓
Vega-Lite chart generated and displayed
↓
User can refine: "Make this a stacked bar chart"
```

---

## 📝 Development Notes

### Code Architecture

**Message Flow:**
```
Web Page (DOM)
    ↓ (event listeners)
PerceptionAgent (detects struggle)
    ↓ (callback)
ContentScript (coordinates)
    ↓ (triggers extraction)
DataAgent (scrapes data)
    ↓ (sends message)
BackgroundScript (logs/stores)
    ↓ (future: triggers UI)
OrchestratorAgent (Phase 2)
```

**File Responsibilities:**
- `PerceptionAgent.ts`: Pure interaction monitoring logic
- `DataAgent.ts`: Pure data extraction logic
- `content.ts`: Coordination and Chrome messaging
- `background.ts`: Extension lifecycle and storage
- `utils.ts`: Shared helpers (no side effects)

### Design Principles (Following Amershi et al.)

**G2 (Clarity):** All confidence scores are surfaced to user
**G9 (Efficient Correction):** Future refinement loop for visualizations
**G11 (Transparency):** Agent reasoning will be visible in Phase 3
**G17 (User Control):** User always chooses actions, agent only suggests

---

## 🎓 Research Questions for Phase 1 Testing

1. **Accuracy**: How often does the agent correctly identify struggle?
2. **Timing**: Is the 3-second hesitation threshold appropriate?
3. **Context**: Do detected struggles correlate with actual analytical challenges?
4. **Data Quality**: How accurate is the extracted data for downstream tasks?

### Collect User Feedback

When testing with others, ask:
- "Did you feel the detection was intrusive or helpful?"
- "Were the detected struggle moments actually when you were confused?"
- "How would you prefer to be notified of assistance?"

---

## ✅ Phase 1 Checklist

- [x] Project structure created
- [x] PerceptionAgent implemented with 3 struggle patterns
- [x] DataAgent implemented with 5 data types
- [x] Chrome extension architecture (background, content, popup)
- [x] Shared utilities and types
- [x] Test dashboard created
- [x] Documentation written
- [ ] Tested on real dashboards
- [ ] Thresholds tuned
- [ ] Baseline metrics collected

---

## 📞 Support

For questions or issues:
1. Check this guide first
2. Review console logs for errors
3. Check GitHub issues (if repository exists)
4. Contact research team

---

**Happy Building! 🚀**

You've successfully completed Phase 1 of KAIROS-SPECTRA. The sensing layer is now operational and ready for testing. Once you've validated the struggle detection and data extraction, we'll move to Phase 2: building the hierarchical guidance UI.
