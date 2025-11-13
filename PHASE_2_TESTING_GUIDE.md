# Phase 2 Testing Guide

## Quick Start Testing

### Prerequisites
1. ✅ **OpenAI API key** configured in extension settings (NOT Gemini)
2. ✅ KAIROS-SPECTRA extension loaded in Chrome
3. ✅ Phase 2 branch: `phase_v2_GUM`

**Important**: GUM now uses **OpenAI GPT-4** (same as rest of KAIROS-SPECTRA system)

---

## Test 1: Hesitation Popup with GUM Propositions

### Objective
Verify that hesitation popup appears with personalized GUM propositions when user pauses.

### Steps
1. **Navigate to test page:**
   ```
   https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)
   ```

2. **Interact with page:**
   - Scroll to the GDP table
   - Hover over table cells for 2-3 seconds
   - Click on different rows

3. **Trigger hesitation:**
   - **STOP all mouse movement for 4 seconds**
   - Keep mouse still (no clicks, no scrolling)

4. **Verify hesitation popup:**
   - ✅ Popup appears within 500ms
   - ✅ Shows header: "⏸️ I noticed you paused..."
   - ✅ Displays GUM propositions:
     - 👤 Identity card (e.g., "User is a data analyst")
     - 🔍 Activity card (e.g., "User is exploring GDP data")
     - 🎯 Goal card (e.g., "User wants to compare trends")
   - ✅ Each card shows confidence badge (color-coded)
   - ✅ Action button: "📊 Explore this goal with visualizations"
   - ✅ Link: "📖 View my complete user model"

### Expected Behavior
- **First time**: Popup may show fallback message if GUM hasn't run inference yet (wait 60s)
- **After 60s**: GUM propositions should appear based on your interactions
- **Propositions**: Reflect your browsing patterns (e.g., if you explored GDP data, propositions mention "GDP" or "economic data")

### Screenshots
- [ ] Hesitation popup with propositions
- [ ] Confidence badges (green/yellow/red)

---

## Test 2: User Model Modal (Transparency)

### Objective
Verify full user model transparency and user control features.

### Steps
1. **Open user model:**
   - Trigger hesitation popup (as in Test 1)
   - Click "📖 View my complete user model"

2. **Verify modal content:**
   - ✅ Header: "🧠 Your User Model"
   - ✅ Intro text: "This is what I've learned about you..."
   - ✅ Propositions grouped by category:
     - 👤 Identity
     - 🎯 Goals
     - 🔍 Activities
     - ⭐ Preferences
     - 📍 Context

3. **Verify proposition cards:**
   - ✅ Each card shows:
     - Confidence badge (e.g., "85% confident")
     - Age (e.g., "2h ago")
     - Proposition text
     - Expandable reasoning: "▼ Why I believe this"
     - Edit button: "✏️ Edit"
     - Delete button: "🗑️ Delete"

4. **Test edit functionality:**
   - Click "✏️ Edit" on any proposition
   - ✅ Prompt appears with current text
   - Enter new text: "User is exploring COVID-19 data"
   - ✅ Proposition updates in modal

5. **Test delete functionality:**
   - Click "🗑️ Delete" on any proposition
   - ✅ Confirmation dialog appears
   - Click OK
   - ✅ Proposition removed from modal

### Expected Behavior
- Modal displays all propositions collected by GUM
- Confidence badges are color-coded:
  - **Green** (80-100%): High confidence
  - **Yellow** (50-79%): Medium confidence
  - **Red** (0-49%): Low confidence
- Age is human-readable (e.g., "5m ago", "2h ago", "3d ago")
- Edit and delete operations update immediately

### Screenshots
- [ ] User model modal with grouped propositions
- [ ] Expanded reasoning section
- [ ] Edit dialog
- [ ] Delete confirmation

---

## Test 3: Enhanced Context Inference

### Objective
Verify that GUM propositions enhance context messages in standard guidance flow.

### Steps
1. **Trigger struggle (not hesitation):**
   - Rapidly scroll up/down on GDP table (triggers `rapid_switching`)
   - OR
   - Click back and forth between two table rows multiple times (triggers `repetitive_movement`)

2. **Verify enhanced context:**
   - ✅ Standard guidance UI appears (Task Planning level)
   - ✅ Context message includes GUM insight:
     - **Without GUM**: "I detected a table with columns: Country, GDP, Population..."
     - **With GUM**: "Based on your recent activity, I think you're trying to compare GDP trends across countries. I detected a table with columns: Country, GDP, Population..."

### Expected Behavior
- GUM propositions enhance the context message
- Base message is preserved (data description)
- Enhanced message is prepended with GUM insight

### Screenshots
- [ ] Enhanced context message with GUM insight

---

## Test 4: GUM Inference Updates

### Objective
Verify that GUM updates propositions based on new interactions.

### Steps
1. **Interact for 1 minute:**
   - Browse Wikipedia GDP page
   - Hover over table cells
   - Read article sections

2. **Wait 60 seconds** (GUM update interval)

3. **Check developer console:**
   ```javascript
   // Open Chrome DevTools (F12)
   // Go to Console
   // Run:
   chrome.runtime.sendMessage({ type: 'GUM_GET_PROPOSITIONS' }, console.log)
   ```

4. **Verify propositions:**
   - ✅ Propositions reflect recent activity
   - ✅ Confidence scores are reasonable (0.3-0.9)
   - ✅ Categories are correct (identity, goal, activity, etc.)
   - ✅ Grounding reasoning is present

5. **Interact more and wait another 60s:**
   - Switch to different Wikipedia page (e.g., COVID-19 data)
   - Repeat console check

6. **Verify proposition updates:**
   - ✅ New propositions added for new activity
   - ✅ Old propositions decay (lower confidence)
   - ✅ Irrelevant propositions removed (confidence < 0.3)

### Expected Behavior
- Propositions update every 60 seconds
- Confidence scores decay over time (exponential decay, half-life 7 days)
- New interactions generate new propositions
- Old propositions are pruned when confidence falls below 0.3

---

## Test 5: Goal Mapping (Hesitation → Task Planning)

### Objective
Verify that clicking "Explore this goal" in hesitation popup correctly maps to analytical goal.

### Steps
1. **Trigger hesitation popup:**
   - Follow Test 1 steps

2. **Click action button:**
   - Click "📊 Explore this goal with visualizations"

3. **Verify transition:**
   - ✅ Hesitation popup closes
   - ✅ Standard Task Planning UI appears
   - ✅ Correct goal is pre-selected based on GUM proposition:
     - GUM: "compare trends" → Goal: "Compare Trends"
     - GUM: "find outliers" → Goal: "Find Outliers"
     - GUM: "analyze distribution" → Goal: "Analyze Distribution"

### Expected Behavior
- Seamless transition from hesitation popup to task planning
- Goal mapping is intelligent (keyword-based)
- User can still change goal if mapping is incorrect

---

## Debugging Tips

### Check GUM Status
```javascript
// Open Chrome DevTools Console
chrome.runtime.sendMessage({ type: 'GUM_GET_PROPOSITIONS' }, console.log)
```

### Force GUM Update
```javascript
// Trigger immediate inference (instead of waiting 60s)
chrome.runtime.sendMessage({ 
  type: 'GUM_FORCE_UPDATE', 
  payload: {} 
}, console.log)
```

### Check Background Logs
1. Right-click extension icon → "Manage Extension"
2. Click "Inspect views: background page"
3. Check console for GUM logs:
   - `[GeneralUserAgent] Running inference...`
   - `[GeneralUserAgent] Generated X propositions`
   - `[OrchestratorAgent] HESITATION detected`

### Common Issues

**Issue 1: Hesitation popup doesn't appear**
- ✅ Check PerceptionAgent is running (not paused)
- ✅ Ensure mouse is completely still for 4 seconds
- ✅ Verify DataAgent extracted data from page

**Issue 2: No GUM propositions**
- ✅ Wait at least 60 seconds after first interaction
- ✅ Check **OpenAI** API key is configured (not Gemini!)
- ✅ Check console for GUM errors
- ✅ Verify GeneralUserAgent is initialized

**Issue 3: Propositions don't update**
- ✅ GUM runs every 60 seconds, not real-time
- ✅ Check `updateIntervalMs` in GeneralUserAgent.ts
- ✅ Force update using debug command above

**Issue 4: Wrong propositions**
- ✅ GUM learns over time (needs multiple sessions)
- ✅ Clear propositions: `chrome.storage.local.remove('gum_propositions')`
- ✅ Check `minConfidenceThreshold` (default 0.3)

---

## Test Results Template

```markdown
## Test Results

**Date:** YYYY-MM-DD  
**Tester:** [Your Name]  
**Build:** Phase 2 (branch: phase_v2_GUM)

### Test 1: Hesitation Popup
- [ ] PASS / [ ] FAIL
- Notes: _____________________________________________

### Test 2: User Model Modal
- [ ] PASS / [ ] FAIL
- Notes: _____________________________________________

### Test 3: Enhanced Context
- [ ] PASS / [ ] FAIL
- Notes: _____________________________________________

### Test 4: GUM Updates
- [ ] PASS / [ ] FAIL
- Notes: _____________________________________________

### Test 5: Goal Mapping
- [ ] PASS / [ ] FAIL
- Notes: _____________________________________________

### Overall Assessment
- [ ] Ready for Phase 3
- [ ] Needs fixes
- Critical Issues: ____________________________________
```

---

## Next Steps After Testing

1. **If all tests pass:**
   - ✅ Mark Phase 2 complete
   - ✅ Create Phase 3 branch: `phase_v3_journey_map`
   - ✅ Begin AnalyticalJourneyMap integration

2. **If tests fail:**
   - ❌ Document issues in GitHub Issues
   - ❌ Fix bugs and retest
   - ❌ Update implementation summary

---

**Happy Testing!** 🎉
