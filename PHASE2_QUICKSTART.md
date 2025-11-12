# KAIROS-SPECTRA Phase 2 - Quick Start Guide

**Test the Hierarchical Guidance UI!**

---

## ✅ Prerequisites

1. ✅ Extension built successfully (`npm run build`)
2. ✅ Extension loaded in Chrome (`chrome://extensions/`)
3. ✅ OpenAI API key configured (for vision fallback - optional for basic testing)

---

## 🚀 Test Scenario 1: Basic Table (DOM Extraction)

### Preparation:
1. Open the test dashboard HTML file:
   ```
   file:///path/to/KAIROS-SPECTRA/test-dashboard.html
   ```

2. Open Developer Console (F12)

### Expected Flow:

**Step 1: Trigger Struggle Detection**
- Hover over the **Sales Table** for 3+ seconds without clicking
- Move mouse back and forth between table rows 3+ times

**Step 2: Level 1 UI Appears**
You should see a floating panel appear in the top-right:

```
┌──────────────────────────────────────┐
│ 🧭 KAIROS-SPECTRA                 × │
├──────────────────────────────────────┤
│ 💡 I detected a table with columns: │
│    Product, Sales, Profit            │
│    Confidence: 92%                   │
├──────────────────────────────────────┤
│ Level 1: Choose Your Goal            │
├──────────────────────────────────────┤
│ [📈 Compare Trends]                  │
│ [📊 Analyze Distribution]            │
│ [🔍 Find Outliers]                   │
└──────────────────────────────────────┘
```

**Step 3: Select Analytical Goal**
- Click **"📈 Compare Trends"**

**Step 4: Level 2 UI Appears**
```
┌──────────────────────────────────────┐
│ 📊 KAIROS-SPECTRA                 × │
├──────────────────────────────────────┤
│ ← Back | Compare Trends              │
├──────────────────────────────────────┤
│ Level 2: Choose Visualization Type   │
├──────────────────────────────────────┤
│ [📈 Line Chart]  [📊 Bar Chart]      │
│ [⚫ Scatter Plot]                     │
└──────────────────────────────────────┘
```

**Step 5: Select Visualization Type**
- Click **"📊 Bar Chart"**

**Step 6: Level 3 UI Appears with Rendered Chart**
```
┌──────────────────────────────────────┐
│ 🎨 KAIROS-SPECTRA                 × │
├──────────────────────────────────────┤
│ ← Change Chart                       │
├──────────────────────────────────────┤
│ Level 3: Refine Your Visualization   │
├──────────────────────────────────────┤
│                                      │
│   [Vega-Lite Bar Chart Renders Here] │
│                                      │
├──────────────────────────────────────┤
│ 💬 Tell me how to improve:           │
│ ┌────────────────────────┐ [Refine]  │
│ │ e.g., "add color"      │           │
│ └────────────────────────┘           │
│ Try: [📈 Line] [🎨 Color] [📊 Stack] │
└──────────────────────────────────────┘
```

**Step 7: Refine the Chart**
- Type: **"make this a line chart"**
- Press **Enter** or click **Refine**
- Watch the chart update to a line chart!

**Step 8: Try More Refinements**
- Type: **"add color"** → Bar colors change
- Type: **"make this a stacked bar chart"** → Bars stack

---

## 🎨 Test Scenario 2: Complex Viz (Vision Fallback)

### Preparation:
1. Open Voyager in browser:
   ```
   https://vega.github.io/voyager/
   ```

2. Load the **Cars** dataset

3. Create a scatter plot (MPG vs Horsepower)

### Expected Flow:

**Step 1: Trigger Struggle**
- Hover over the scatter plot for 4+ seconds
- Move mouse between different data points

**Step 2: Vision Analysis Runs**
Console should show:
```
[KAIROS-SPECTRA:ContentScript] DOM extraction failed, trying vision analysis
[KAIROS-SPECTRA:VisionAgent] Starting vision analysis
[KAIROS-SPECTRA:VisionAgent] Vision analysis complete
```

**Step 3: Level 1 UI with Vision Context**
```
┌──────────────────────────────────────┐
│ 🧭 KAIROS-SPECTRA                 × │
├──────────────────────────────────────┤
│ 💡 I see you're exploring a scatter  │
│    plot showing MPG vs Horsepower    │
│    Confidence: 85%                   │
├──────────────────────────────────────┤
│ Level 1: Choose Your Goal            │
│ ...                                  │
```

---

## 🐛 Troubleshooting

### Issue: UI Doesn't Appear

**Possible Causes:**
1. Struggle not detected (hover longer, move more)
2. Extension not loaded (check chrome://extensions/)
3. Console errors (check Developer Console)

**Fix:**
```javascript
// Manually trigger from console:
const event = { 
  pattern: { type: 'prolonged_hesitation', confidence: 0.9 },
  interactionHistory: [],
  involvedElements: [document.querySelector('table')]
};
// This will test if OrchestratorAgent is working
```

### Issue: Chart Doesn't Render

**Possible Causes:**
1. No table data extracted
2. Vega-embed failed to load
3. Invalid Vega-Lite spec

**Fix:**
Check console for errors:
```
[KAIROS-SPECTRA:VisualizationAgent] Failed to render chart
```

### Issue: Vision Fallback Doesn't Work

**Possible Causes:**
1. No OpenAI API key set
2. Invalid API key format
3. API quota exceeded

**Fix:**
1. Open extension popup → Settings
2. Verify API key is set: "✓ API key set (XX chars)"
3. Check OpenAI usage: https://platform.openai.com/usage

### Issue: Refinement Doesn't Update Chart

**Possible Causes:**
1. Keyword not recognized
2. Invalid refinement request
3. Console error in VisualizationAgent

**Fix:**
Try simple refinements first:
- "line chart"
- "bar chart"
- "add color"

---

## 📊 Testing Checklist

### Level 1: Task Planning
- [ ] UI appears after struggle detection
- [ ] Context message shows extracted data description
- [ ] Confidence percentage displayed
- [ ] All 3 goal buttons visible: Compare Trends, Analyze Distribution, Find Outliers
- [ ] Hover effect works (button lifts)
- [ ] Click "Compare Trends" transitions to Level 2

### Level 2: Viz Selection
- [ ] Back button visible with breadcrumb
- [ ] Viz type buttons match selected goal
- [ ] Grid layout (2 columns) displays correctly
- [ ] Hover effect works (scale 1.05)
- [ ] Click "Bar Chart" transitions to Level 3

### Level 3: Refinement
- [ ] Chart renders correctly
- [ ] Vega-Lite canvas visible
- [ ] Text input field present
- [ ] Refine button enabled
- [ ] Suggestion chips clickable
- [ ] Typing + Enter triggers refinement
- [ ] Chart updates without page reload
- [ ] Success feedback shown in placeholder

### Navigation
- [ ] Back button from Level 2 returns to Level 1
- [ ] Back button from Level 3 returns to Level 2
- [ ] Dismiss (×) button hides UI
- [ ] State resets after dismiss

### Styling
- [ ] Floating panel positioned top-right
- [ ] Shadow and border-radius applied
- [ ] Smooth slide-in animation (0.4s)
- [ ] Purple gradient on Level 1 context
- [ ] Green accent on Level 2 buttons
- [ ] Scrollbar appears if content exceeds 80vh

---

## 🎯 Success Criteria

**Phase 2 is working if:**

1. ✅ Struggle detection triggers hierarchical UI (not just console logs)
2. ✅ User can navigate through all 3 levels
3. ✅ Chart generates and renders correctly
4. ✅ Refinement updates chart in real-time
5. ✅ UI is non-intrusive and dismissible

---

## 📝 What to Look For

### Console Output (Example)

```
[KAIROS-SPECTRA:PerceptionAgent] Struggle detected: prolonged_hesitation
[KAIROS-SPECTRA:DataAgent] Extracting data from 1 elements
[KAIROS-SPECTRA:DataAgent] Extracted table: 3 columns, 5 rows
[KAIROS-SPECTRA:ContentScript] Triggering Orchestrator guidance...
[KAIROS-SPECTRA:OrchestratorAgent] Starting hierarchical guidance flow
[KAIROS-SPECTRA:OrchestratorAgent] Task Planning UI shown
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Showing Task Planning UI
[KAIROS-SPECTRA:OrchestratorAgent] Goal selected: compare_trends
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Showing Viz Selection UI
[KAIROS-SPECTRA:OrchestratorAgent] Viz type selected: bar_chart
[KAIROS-SPECTRA:VisualizationAgent] Generating Vega-Lite spec
[KAIROS-SPECTRA:VisualizationAgent] Spec generated successfully
[KAIROS-SPECTRA:VisualizationAgent] Rendering Vega-Lite chart
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Showing Refinement UI
[KAIROS-SPECTRA:OrchestratorAgent] User refinement requested: "add color"
[KAIROS-SPECTRA:VisualizationAgent] Refining visualization
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Updating chart
[KAIROS-SPECTRA:VisualizationAgent] Chart rendered successfully
```

### Expected UI Screenshots

**Level 1:**
- Purple gradient background
- Context message with 💡 icon
- 3 large goal buttons with emoji icons
- Footer with help text

**Level 2:**
- Green accent colors
- Breadcrumb navigation
- 2-column grid of viz type buttons
- Each button has emoji, title, description

**Level 3:**
- Rendered Vega-Lite chart (canvas)
- Text input with placeholder
- Refine button (purple gradient)
- Suggestion chips below input

---

## 🚀 Next Steps After Testing

Once Phase 2 is validated:

1. **Test on Multiple Sites:**
   - E-commerce dashboards
   - Data science notebooks
   - BI tools (Tableau Public, Looker)

2. **Collect Metrics:**
   - Time from struggle → chart rendered
   - Number of refinement iterations
   - User satisfaction (qualitative)

3. **Document Findings:**
   - What works well?
   - What's confusing?
   - Where do users get stuck?

4. **Plan Phase 3:**
   - LLM-powered refinement (GPT-4 prompt engineering)
   - Multi-chart dashboards
   - Export/sharing functionality

---

## 💡 Tips for Best Experience

1. **Use a clean test page first** (test-dashboard.html) to verify basic functionality
2. **Check console frequently** - all agents log their actions
3. **Try different refinements** - keyword matching is simple but effective
4. **Dismiss and retry** - each struggle detection is independent
5. **Test navigation** - back buttons should preserve state correctly

---

**Happy Testing! 🎉**

For issues, check:
- Console errors
- TROUBLESHOOTING.md
- PHASE2_ARCHITECTURE.md (technical details)
