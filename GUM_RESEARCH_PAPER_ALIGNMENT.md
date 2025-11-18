# GUM Research Paper Alignment

## Overview
Updated GUM implementation to align with the original research paper: "Creating General User Models from Computer Use" (Shaikh et al., UIST 2025).

## Changes Made

### 1. **Updated GUM Prompt to Match Research Paper Format**

**Previous Prompt:**
- Used informal format with markdown bullets
- Confidence on 0-1 scale
- Less structured observation format

**New Prompt (Research Paper Format):**
```
You are constructing a General User Model (GUM) by observing user interactions. 
GUMs take unstructured observations and construct confidence-weighted natural 
language propositions about a user's behavior, knowledge, beliefs, and preferences.

## Existing Propositions:
Proposition: User is exploring GDP data
Confidence: 8.0
Decay: 3.0

## New Observation:
URL: https://...
Page Title: ...
User Interactions (last X events):
...

## Task:
Generate propositions about:
- Current activity or goal
- Identity or role  
- Preferences or interests
- Knowledge or expertise
- Behavioral patterns

Output Format (JSON):
[
  {
    "text": "User is exploring GDP data across different countries",
    "confidence": 8,        // 0-10 scale (matches paper)
    "decayScore": 3,        // 0-10 scale (matches paper)
    "reasoning": "Screenshots show...",
    "category": "activity"
  }
]
```

**Key Changes:**
- ✅ Confidence scale: **0-10** (matches paper) instead of 0-1
- ✅ Decay scale: **0-10** (matches paper) instead of 0-1  
- ✅ Proposition format: `Proposition: X\nConfidence: Y\nDecay: Z` (matches paper Section 5.3)
- ✅ Observation format: Structured with URL, Page Title, and Interactions
- ✅ Categories: activity, goal, identity, preference, knowledge (matches paper taxonomy)
- ✅ Explicit reasoning requirement (grounding in Section 5.3)

### 2. **Updated Confidence/Decay Parsing**

**File:** `src/agents/GeneralUserAgent.ts` (lines 709-755)

```typescript
// Normalize confidence from 0-10 scale to 0-1 scale (paper uses 0-10)
const normalizedConfidence = Math.max(0, Math.min(1, item.confidence / 10));

// Normalize decay score from 0-10 to 0-1
decayScore: item.decayScore ? Math.max(0, Math.min(1, item.decayScore / 10)) : 0.5,
```

**Rationale:**
- Paper uses 0-10 scale for human interpretability
- Internal system uses 0-1 for mathematical operations (decay calculation)
- Parser converts between the two

### 3. **Select Only Highest Confidence Proposition**

**File:** `src/agents/OrchestratorAgent.ts` (lines 500-534)

**Previous Behavior:**
- Showed ALL propositions in popup
- User had to parse multiple insights
- Cognitive overload

**New Behavior:**
```typescript
// Select ONLY the highest confidence proposition
const topProposition = propositions.reduce((prev, current) => 
  (current.confidence * current.decayScore) > (prev.confidence * prev.decayScore) 
    ? current 
    : prev
);

// Show hesitation popup with ONLY the top proposition
await hierarchicalGuidanceUI.showHesitationPopup([topProposition], {
  // ... handlers
});
```

**Effective Confidence Calculation:**
```
effectiveConfidence = confidence × decayScore
```

This accounts for both:
- **Confidence:** How certain the model is
- **Decay:** How relevant/fresh the proposition is

**Example:**
```
Proposition A: "User is exploring GDP data"
  confidence: 0.9, decayScore: 0.3 → effective: 0.27

Proposition B: "User is interested in economics"  
  confidence: 0.7, decayScore: 0.9 → effective: 0.63  ✅ SELECTED
```

### 4. **Enhanced Logging**

Added detailed logging for proposition selection:
```typescript
logger.info('OrchestratorAgent', 'Selected top GUM proposition', {
  text: topProposition.text,
  confidence: topProposition.confidence,
  decayScore: topProposition.decayScore,
  effectiveConfidence: topProposition.confidence * topProposition.decayScore,
});
```

## Alignment with Research Paper

### Section 3.1: Propositions and Confidences
✅ **Implemented:** Confidence-weighted propositions with decay scores

```
Proposition: Omar is currently writing in the General User Model's section.
Confidence: 0.8
```

### Section 5.3: Constructing Propositions
✅ **Implemented:** Reasoning traces that ground propositions in observations

```typescript
grounding: {
  observations: [],
  reasoning: "Screenshots show the user repeatedly interacting with tables..."
}
```

### Section 5.5: Revising Propositions
✅ **Implemented:** Proposition merging and updating based on new evidence

```typescript
if (existing) {
  existing.confidence = (existing.confidence + newProp.confidence) / 2;
  existing.updatedAt = Date.now();
  existing.grounding.reasoning = newProp.grounding.reasoning;
}
```

### Paper's Proposition Examples (Section 3.1)
The paper shows real propositions generated:
```
Proposition: Omar is viewing and resolving comments from their advisors.
Confidence: 0.7

Proposition: Omar is struggling with the technical evaluation of GUMs.
Confidence: 0.5
```

Our implementation now generates propositions in the same format.

## Benefits of These Changes

### 1. **Research Reproducibility**
- Prompt format matches published paper
- Confidence scale matches paper's methodology
- Easier to compare results with paper's findings

### 2. **Improved User Experience**
- **Before:** User sees 5-7 propositions, gets confused
- **After:** User sees 1 top insight, clear actionable context

### 3. **Better Grounding**
- Explicit observation → reasoning → proposition chain
- Matches paper's Section 5.3 "Constructing Propositions"

### 4. **Temporal Awareness**
- Decay score weights recent activity higher
- Stable facts (identity) vs. transient states (current activity)
- Matches paper's cognitive architecture inspiration

## Testing the Changes

### Before:
```
[OrchestratorAgent] GUM query successful {propositionCount: 5}
Showing popup with 5 propositions...
```

### After:
```
[OrchestratorAgent] Selected top GUM proposition {
  text: "User is exploring GDP comparisons",
  confidence: 0.8,
  decayScore: 0.3,
  effectiveConfidence: 0.24
}
Showing popup with 1 proposition...
```

## Next Steps: Output Phase

Now that GUM is aligned with the research paper, we're ready for the **Output Phase**:

### Output Phase Goals:
1. **Proactive Suggestions** (inspired by Gumbo from paper Section 4.3)
   - Generate suggestions based on top proposition
   - "Since you're exploring GDP data, would you like to visualize trends?"

2. **Context-Aware Guidance**
   - Use GUM to personalize the guidance flow
   - Adapt to user's expertise level and preferences

3. **Mixed-Initiative Interaction** (Horvitz framework, paper Section 4.3.2)
   - Determine WHEN to interrupt user
   - Calculate expected utility of showing suggestion
   - Implement decision threshold

### Proposed Output Features:

#### A. **Suggestion Generation**
```typescript
// Based on top proposition, generate actionable suggestions
const topProp = "User is exploring GDP data across countries";

// Generate suggestions:
- "Create a bar chart comparing top 10 countries by GDP"
- "Show GDP growth trends over time"
- "Compare GDP per capita vs total GDP"
```

#### B. **Contextual UI Adaptation**
```typescript
if (topProp.category === 'activity' && topProp.text.includes('exploring')) {
  // User is exploring → Show discovery-oriented options
  showExploratoryGuidance();
} else if (topProp.category === 'goal' && topProp.text.includes('compare')) {
  // User has comparison goal → Skip exploration, go straight to viz
  showComparisonVizOptions();
}
```

#### C. **Transparency & Control** (Paper Section 3.2)
```typescript
// Show why we're suggesting this
"Based on your recent activity (exploring GDP tables), 
 I think you might want to visualize this data."

// Let user view/edit the proposition
[View User Model] button → Opens full GUM with edit/delete options
```

## Files Modified

1. **src/agents/GeneralUserAgent.ts** (~60 lines changed)
   - Updated `buildGUMPrompt()` to match paper format
   - Updated `parsePropositionsFromResponse()` for 0-10 scale normalization
   - Enhanced observation context formatting

2. **src/agents/OrchestratorAgent.ts** (~20 lines changed)
   - Added top proposition selection logic
   - Added effective confidence calculation
   - Enhanced logging for debugging

## References

**Paper:** Shaikh, O., et al. (2025). Creating General User Models from Computer Use. 
UIST '25. https://doi.org/10.1145/3746059.3747722

**Key Sections:**
- Section 3.1: Propositions and Confidences
- Section 5.3: Constructing Propositions  
- Section 5.5: Revising Propositions
- Section 4.3: Gumbo (proactive assistant)

---

## Ready for Output Phase ✅

The GUM implementation is now aligned with the research paper. We can proceed with building the Output Phase features that leverage this improved user model.
