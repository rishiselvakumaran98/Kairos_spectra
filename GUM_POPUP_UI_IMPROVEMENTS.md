# GUM Popup UI Improvements

## Overview
Enhanced the GUM (General User Model) popup UI to show only recent, relevant propositions by default, with improved sorting controls and access to complete historical data.

## Problem Statement
- The GUM popup was showing propositions from 3+ days ago ("3d ago" entries)
- Old entries are not useful in a quick-glance popup interface
- Users needed a way to filter for recent activity
- Users needed sorting options (by confidence vs. by time)
- Users needed access to complete historical logs separately

## Solution Implemented

### 1. Time-Based Filtering (Last 10 Minutes Default)
**File**: `src/ui/HierarchicalGuidanceUI.ts`

Added helper method `filterPropositionsByTime()`:
```typescript
private filterPropositionsByTime(
  propositions: import('../types').Proposition[],
  minutesAgo: number = 10
): import('../types').Proposition[]
```

- Filters propositions to last N minutes (default: 10)
- Applied to `showHesitationPopup()` before grouping by category
- Shows message when no recent propositions exist
- Complete history available via "View Complete List" button

### 2. Smart Sorting
**File**: `src/ui/HierarchicalGuidanceUI.ts`

Added helper method `sortPropositions()`:
```typescript
private sortPropositions(
  propositions: import('../types').Proposition[],
  sortBy: 'confidence' | 'datetime' = 'confidence'
): import('../types').Proposition[]
```

**Confidence Sorting** (default):
- Sorts by effective confidence (confidence × decayScore)
- If two propositions have similar confidence (within 0.01), prefers more recent
- Ensures highest-quality, most relevant insights appear first

**Datetime Sorting**:
- Sorts by `updatedAt` timestamp (most recent first)
- Useful for seeing chronological activity

### 3. User Controls in Full Model View
**File**: `src/ui/HierarchicalGuidanceUI.ts`

Enhanced `showUserModelModal()` with:
- Dropdown to switch between sorting modes:
  - "Confidence Score" (default)
  - "Most Recent"
- **Reset All button** to completely clear the user model
  - Red styling to indicate destructive action
  - Confirmation dialog with warning message
  - Shows count of propositions being deleted
  - Implements G8 (efficient dismissal) and G17 (user control)
- Automatically re-renders when sorting changes
- Maintains edit/delete functionality

### 4. Visual Improvements
**File**: `src/content.css`

Added `.user-model-controls` styling:
```css
.user-model-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  /* ... control bar with sort dropdown and reset button */
}

.kairos-sort-dropdown {
  /* Styled to match KAIROS-SPECTRA aesthetic */
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  /* ... hover and focus states */
}

.kairos-reset-all-btn {
  /* Red warning colors for destructive action */
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
  /* ... hover animation with lift effect */
}
```

## User Experience Flow

### Quick Popup View (`showHesitationPopup`)
1. User pauses on page
2. Popup shows **top 3 insights from last 10 minutes**:
   - Identity (who you are)
   - Activity (what you're doing)
   - Goal (what you want to achieve)
3. Sorted by highest confidence × most recent
4. If no recent activity:
   - Shows "No recent activity in the last 10 minutes"
   - Prompts user to view complete history
5. "View my complete user model" button → Full modal

### Complete Model View (`showUserModelModal`)
1. User clicks "View my complete user model"
2. Modal shows **ALL propositions** (no time filter)
3. Grouped by category (Identity, Goals, Activities, Preferences, Context)
4. Sorting dropdown available:
   - Default: Confidence Score (highest quality first)
   - Alternative: Most Recent (chronological)
5. Edit/delete controls for each proposition
6. Transparency into how KAIROS learns

## Technical Details

### Proposition Data Structure
```typescript
interface Proposition {
  id: string;
  text: string;
  confidence: number;      // 0-1 scale
  createdAt: number;       // Unix timestamp (ms)
  updatedAt: number;       // Unix timestamp (ms)
  decayScore: number;      // 0-1 scale (temporal decay)
  category: 'identity' | 'goal' | 'preference' | 'context' | 'activity';
  grounding: {
    reasoning: string;
    evidence: string[];
  };
}
```

### Effective Confidence Calculation
```typescript
const effectiveConfidence = proposition.confidence * proposition.decayScore;
```

This ensures:
- High-confidence propositions are prioritized
- Older propositions naturally decay in relevance
- Recent activity gets appropriate weight

### Time Filtering Implementation
```typescript
const cutoffTime = Date.now() - (minutesAgo * 60 * 1000);
return propositions.filter(p => p.updatedAt >= cutoffTime);
```

## Files Modified

1. **src/ui/HierarchicalGuidanceUI.ts** (3 new methods, 2 enhanced methods)
   - `filterPropositionsByTime()` - NEW
   - `sortPropositions()` - NEW
   - `showHesitationPopup()` - ENHANCED (added time filter + sorting)
   - `showUserModelModal()` - ENHANCED (added sorting dropdown + reset button)

2. **src/content.css** (85 new lines)
   - `.user-model-controls` - Control bar styling
   - `.kairos-sort-dropdown` - Dropdown styling with hover/focus states
   - `.kairos-reset-all-btn` - Reset button with warning colors and animations

3. **src/agents/OrchestratorAgent.ts** (1 new method)
   - `resetAllPropositions()` - NEW (handles reset request)

4. **src/agents/GeneralUserAgent.ts** (1 new method)
   - `clearAllPropositions()` - NEW (clears all propositions from storage)

5. **src/background.ts** (1 new handler, 1 new message type)
   - `handleGUMResetAll()` - NEW (message handler for reset)
   - Added `GUM_RESET_ALL_PROPOSITIONS` case in message listener

6. **src/types.ts** (1 new message type)
   - `GUM_RESET_ALL_PROPOSITIONS` - NEW message type for reset operation

## Human-AI Guidelines Compliance

This implementation aligns with Amershi et al. (2019) guidelines:

- **G11 (Transparency)**: Users can see all learned propositions
- **G12 (Memory)**: System remembers user context over time
- **G17 (User Control)**: Users can edit, delete, and sort propositions
- **G4 (Time to Impact)**: Recent propositions surfaced immediately
- **G13 (Feedback)**: Edit/delete provides corrective feedback to GUM

## Testing Recommendations

1. **Time Filtering**:
   - Verify only last 10 minutes shown in quick popup
   - Verify empty state message when no recent activity
   - Verify "View Complete List" shows all historical data

2. **Sorting**:
   - Verify confidence sorting prioritizes high-confidence items
   - Verify datetime sorting shows most recent first
   - Verify dropdown persists selection during re-render

3. **Reset All Feature**:
   - Verify reset button appears only when propositions exist
   - Verify confirmation dialog shows correct proposition count
   - Verify all propositions cleared after confirmation
   - Verify modal closes after reset
   - Verify storage is actually cleared (persistent across reloads)
   - Verify denial (clicking "Cancel") prevents reset

4. **UI/UX**:
   - Verify styling matches KAIROS-SPECTRA aesthetic
   - Verify dropdown is accessible (keyboard navigation)
   - Verify smooth transitions when changing sort mode
   - Verify reset button has appropriate warning styling (red)

5. **Edge Cases**:
   - Zero propositions (new user) - reset button should not appear
   - Only old propositions (>10 min ago)
   - Many propositions (scroll behavior)
   - Propositions with identical confidence scores

## Future Enhancements

1. **Configurable Time Window**:
   - Allow users to adjust the 10-minute default
   - Add preset options (5min, 15min, 1hr, All)

2. **Advanced Filters**:
   - Filter by category in full view
   - Filter by confidence threshold
   - Search/filter by text content

3. **Visualization**:
   - Timeline view of proposition evolution
   - Confidence score trends over time
   - Category distribution charts

4. **Proactive Notifications**:
   - Alert when high-confidence proposition emerges
   - Suggest reviewing old propositions for accuracy

## Build Status

✅ Build successful (webpack 5.102.1)
- No compilation errors
- Only bundle size warnings (expected)
- `content.js`: 188 KiB (includes UI code)
- `HierarchicalGuidanceUI.ts`: 43.6 KiB compiled

## Deployment Notes

1. Load unpacked extension in Chrome
2. Navigate to any webpage
3. Trigger GUM popup (either via hesitation detection or manual trigger)
4. Verify time filtering works (only recent entries)
5. Click "View my complete user model"
6. Test sorting dropdown functionality

---

**Author**: GitHub Copilot  
**Date**: 2025  
**Version**: KAIROS-SPECTRA v0.1.0 (Phase 5)  
**Related**: PHASE_5_PROACTIVE_TOOL_GENERATION.md
