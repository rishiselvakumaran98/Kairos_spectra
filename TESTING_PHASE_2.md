# Phase 2 Testing Guide
**Quick Reference for KAIROS-SPECTRA Hierarchical Guidance**

---

## 🚀 Quick Start

### 1. Build & Load Extension
```bash
cd KAIROS-SPECTRA
npm run build
```

Then in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `dist/` folder

### 2. Test on Sample Pages

**Good Test Pages:**
- Wikipedia tables: https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)
- Google Finance charts: https://www.google.com/finance
- News articles with charts: https://www.nytimes.com (look for data visualizations)
- Public datasets: https://data.world or https://kaggle.com (table views)

---

## ✅ Test Checklist

### Test 1: Table → Chart Creation Flow

**Trigger:** Hover rapidly over table rows (3-4 times in different areas)

**Expected Flow:**
```
1. Purple panel appears (top-right)
   ✅ Header shows "KAIROS-SPECTRA"
   ✅ Context message: "I detected a table with columns: ..."
   ✅ Shows 3-4 analytical goal options

2. Click "Compare Trends"
   ✅ Transitions to viz selection
   ✅ Breadcrumb shows "← Back | Compare Trends"
   ✅ Shows 3 chart type options

3. Click "Bar Chart"
   ✅ Transitions to refinement view
   ✅ Chart renders in gray container
   ✅ Shows refinement input box
   ✅ Shows suggestion chips

4. Type "make this a line chart" + Enter
   ✅ Chart updates to line chart
   ✅ Input clears with success message
   ✅ No page reload

5. Click "← Change Chart"
   ✅ Returns to viz selection
   ✅ Can select different chart type

6. Click "×" dismiss button
   ✅ Panel disappears
   ✅ Can trigger again by hovering table
```

**Debug Commands (Console):**
```javascript
// Check if UI container exists
document.getElementById('kairos-spectra-ui')

// Check if CSS loaded
getComputedStyle(document.querySelector('.kairos-container'))

// Check if orchestrator active
// (Add debug hook: window.__KAIROS_DEBUG__.isActive())
```

---

### Test 2: Chart Analysis Mode (NEW)

**Trigger:** Hover over existing chart/visualization on page

**Expected Flow:**
```
1. Panel shows different UI
   ✅ Message: "I see you're looking at a [chart type]"
   ✅ Shows "Snip & Analyze Chart" button
   ✅ Shows text input for questions
   ✅ NO chart type selection (different from Test 1!)

2. Click "Snip & Analyze Chart"
   ✅ Full-screen dark overlay appears
   ✅ Instructions at top: "Click and drag to select"
   ✅ Cursor changes to crosshair

3. Click and drag over chart region
   ✅ Blue dashed rectangle follows mouse
   ✅ Semi-transparent fill

4. Release mouse
   ✅ Preview box appears with highlight
   ✅ Shows "↻ Re-select" and "✓ Analyze This Area"

5. Click "✓ Analyze This Area"
   ✅ Overlay disappears
   ✅ Shows "Analyzing chart..." spinner
   ✅ Then shows insights/trends/suggestions
   ✅ Follow-up question input appears

6. Type question: "What trends do you see?"
   ✅ Shows thinking state
   ✅ Answer appears in chat format
   ✅ Suggested follow-ups appear as chips
```

**Alternative: Direct Question**
```
1. From Chart Analysis UI, type question immediately
   ✅ "E.g., 'Which category has highest value?'"
   ✅ Press Enter or click "Ask →"
   ✅ Chat response appears
   ✅ Can ask follow-ups
```

---

### Test 3: Edge Cases

**3a. No Data Found**
- Hover over images, buttons, plain text
- ✅ **Expected:** No panel appears (silent failure)
- ✅ Console should show: "Struggle detected, but no data extracted"

**3b. Guidance Already Active**
- Open guidance panel (hover table)
- Try to trigger again (hover rapidly while panel visible)
- ✅ **Expected:** No second panel appears
- ✅ Console shows: "Ignoring struggle - guidance already active"

**3c. Malformed Refinement**
- Generate chart (Test 1, steps 1-3)
- Type gibberish: "asdfghjkl"
- ✅ **Expected:** Error message OR graceful fallback
- ✅ Chart doesn't disappear
- ✅ Can try again

**3d. Extension Context Invalidation**
- Open guidance panel
- Go to `chrome://extensions` and click "Reload" on KAIROS-SPECTRA
- Return to page
- ✅ **Expected:** Panel shows error or disappears gracefully
- ✅ Console warning: "Extension context invalidated"
- ✅ Page still functional, no crash

**3e. Multiple Tables on Page**
- Page with 2+ data tables
- Hover over first table → panel appears
- Dismiss panel (×)
- Hover over second table
- ✅ **Expected:** Panel appears again with correct table data
- ✅ Chart generated from correct table

**3f. Very Large Table**
- Table with 100+ rows, 10+ columns
- Hover to trigger guidance
- ✅ **Expected:** Context shows first 3-4 columns + "(+X more)"
- ✅ Chart generation doesn't freeze browser
- ✅ Vega-Lite might auto-sample data

---

## 🐛 Common Issues & Fixes

### Issue 1: Panel Doesn't Appear

**Symptoms:** Hover over table, nothing happens

**Checks:**
1. Open DevTools Console
2. Look for errors
3. Check `perceptionAgent` is active:
   ```javascript
   // In console (if exposed for debug):
   window.__KAIROS_DEBUG__.perceptionState()
   ```

**Possible Causes:**
- PerceptionAgent paused (shouldn't be on fresh page load)
- No struggle detected (need rapid hovering pattern)
- Data extraction failed (check console for "no data extracted")

**Fix:**
- Refresh page
- Try more exaggerated hovering (5-6 times)
- Check if table has proper HTML structure (`<table>`, `<tr>`, `<td>`)

---

### Issue 2: Chart Doesn't Render

**Symptoms:** Panel shows refinement UI but chart area is blank

**Checks:**
1. Console → filter by "Vega"
2. Look for CSP errors
3. Check Network tab → filter by "vega-sandbox"

**Possible Causes:**
- Vega bundle not loaded
- Iframe sandbox issue
- Invalid Vega-Lite spec

**Debug:**
```javascript
// Check if iframe created
document.querySelector('iframe[src*="vega-sandbox"]')

// Check if bundle exists
fetch(chrome.runtime.getURL('vega-sandbox-bundle.js'))
  .then(r => console.log('Bundle found:', r.ok))
```

**Fix:**
- Rebuild: `npm run build`
- Check `dist/vega-sandbox-bundle.js` exists (should be ~2.3 MB)
- Reload extension

---

### Issue 3: Refinement Doesn't Work

**Symptoms:** Type refinement, press Enter, nothing happens

**Checks:**
1. Console → filter by "refinement"
2. Check network for API calls (if using OpenAI/Claude)

**Possible Causes:**
- Missing API key (check background.ts configuration)
- VisualizationAgent.refineVisualization() threw error
- Invalid prompt parsing

**Debug:**
```javascript
// Check last state
window.__KAIROS_DEBUG__.getState()
// Look for refinementHistory array
```

**Fix:**
- Check API key environment variable
- Try simpler refinement: "change to line chart"
- Check console for specific error

---

### Issue 4: "Extension context invalidated"

**Symptoms:** Console shows this error, features stop working

**Cause:** Extension was reloaded while page was open

**Fix:**
- **Refresh the page** (F5 or Cmd+R)
- Extension functionality will restore

---

## 📊 Performance Benchmarks

**Expected Timings:**
- Struggle detection → Panel appears: **< 2 seconds**
- Goal selection → Viz selection: **< 500ms**
- Chart type selection → Chart renders: **< 3 seconds**
- Refinement prompt → Chart updates: **< 5 seconds** (depends on LLM API)

**If slower:**
- Check network (slow API responses)
- Check CPU usage (Vega rendering can be heavy for complex charts)
- Simplify data (fewer rows/columns)

---

## 🎨 Visual Verification

### Correct Styling

**Panel:**
- Width: 420px
- Position: Fixed top-right (80px from top, 24px from right)
- Background: White with rounded corners (16px radius)
- Shadow: Soft drop shadow
- Animation: Slides in from right

**Colors:**
- Primary: Purple gradient (#667eea → #764ba2)
- Success: Green (#10b981)
- Error: Red (#ef4444)
- Text: Dark gray (#1a1a1a) on white

**Typography:**
- Font: System fonts (SF Pro, Segoe UI)
- Sizes: 12-24px (hierarchical)
- Weights: 400 (regular), 600 (semibold), 700 (bold)

**If styling is wrong:**
- Check `dist/content.css` exists
- Verify manifest.json includes `"css": ["content.css"]`
- Check browser DevTools → Elements → `<style>` tags
- Force refresh (Cmd+Shift+R)

---

## 🧪 Advanced Testing

### Test with Custom Data

Create test HTML page:

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Test Table</h1>
  <table id="sales-data">
    <thead>
      <tr>
        <th>Month</th>
        <th>Sales</th>
        <th>Region</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Jan</td><td>1200</td><td>North</td></tr>
      <tr><td>Feb</td><td>1500</td><td>North</td></tr>
      <tr><td>Mar</td><td>1800</td><td>South</td></tr>
      <tr><td>Apr</td><td>2100</td><td>South</td></tr>
    </tbody>
  </table>
</body>
</html>
```

Save as `test.html`, open in Chrome with extension loaded.

**Expected Behavior:**
1. Hover over table rows
2. Panel appears with context: "I detected a table with columns: Month, Sales, Region"
3. Can generate charts from this data

---

## 📝 Bug Report Template

If you find issues, report with this format:

```
**Environment:**
- Chrome Version: [e.g., 120.0.6099.109]
- Extension Version: 0.1.0
- OS: [macOS/Windows/Linux]
- Test Page URL: [URL or "custom HTML"]

**Steps to Reproduce:**
1. Navigate to [URL]
2. Hover over [element type]
3. Click [button name]
4. ...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Console Errors:**
[Copy paste any red errors from console]

**Screenshots:**
[Attach if helpful]

**Workarounds:**
[If you found any]
```

---

## ✅ Sign-Off Checklist

Before declaring Phase 2 complete, verify:

- [ ] Table → Chart flow works end-to-end
- [ ] Chart Analysis Mode works for existing visualizations
- [ ] Snipping feature captures and analyzes chart regions
- [ ] Refinement loop updates charts correctly
- [ ] Back buttons navigate correctly
- [ ] Dismiss button closes panel and resumes perception
- [ ] No CSP violations in console
- [ ] Styling matches design system
- [ ] Performance is acceptable (< 5s for chart generation)
- [ ] Edge cases handle gracefully (no crashes)
- [ ] Console logs are informative but not excessive
- [ ] Extension reloading doesn't crash tabs

**Ready for Phase 3!** 🚀

---

## 🆘 Quick Help

**Panel won't appear?**
→ Check console for "no data extracted" message

**Chart won't render?**
→ Check Network tab for vega-sandbox-bundle.js (should be 2.3 MB)

**Refinement does nothing?**
→ Check API key configuration in background.ts

**Extension broke after reload?**
→ Refresh the page (F5)

**Still stuck?**
→ Check PHASE_2_IMPLEMENTATION.md for detailed debugging section
