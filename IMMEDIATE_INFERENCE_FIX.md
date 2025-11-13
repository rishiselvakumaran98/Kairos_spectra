# Immediate GUM Inference Fix

**Date**: November 12, 2025  
**Issue**: GUM had 0 propositions when struggle detected  
**Root Cause**: GUM inference only ran every 60s, but struggle popup appeared immediately

---

## Problem

Your console showed:
```
[KAIROS-SPECTRA:OrchestratorAgent] GUM query successful {propositionCount: 0}
[KAIROS-SPECTRA:OrchestratorAgent] ⚠️ No GUM propositions available, showing default message
```

This happened because:
1. Extension starts → GUM initializes
2. User interacts with Wikipedia GDP table → Interactions collected
3. User hesitates for 4s → Struggle detected **immediately**
4. OrchestratorAgent queries GUM → **0 propositions** (60s timer hasn't fired yet!)
5. Fallback to old Task Planning UI (not GUM popup)

---

## Solution

**Trigger GUM inference IMMEDIATELY when struggle detected**, don't wait 60 seconds!

### Changes Made

#### 1. GeneralUserAgent.ts (+40 lines)

**New Method**: `triggerImmediateInference()`
```typescript
public async triggerImmediateInference(): Promise<void> {
  logger.info('GeneralUserAgent', 'Immediate inference triggered (struggle detected)');
  
  const pageContent = this.extractPageContent();
  const recentInteractions = this.getRecentInteractions();
  
  if (recentInteractions.length === 0 && !pageContent) {
    logger.warn('GeneralUserAgent', 'No data to infer from yet');
    return;
  }
  
  // Run inference NOW, bypass 60s timer
  await this.runInference(recentInteractions, pageContent);
}
```

**Helper Method**: `getRecentInteractions()`
```typescript
private getRecentInteractions(): UserInteractionEvent[] {
  const interactions: UserInteractionEvent[] = [];
  
  // Extract interactions from observations
  for (const obs of this.state.observations) {
    if (obs.source === 'interaction' && Array.isArray(obs.data)) {
      interactions.push(...obs.data);
    }
  }
  
  // Return last 50 interactions
  return interactions.slice(-50);
}
```

#### 2. types.ts (+1 line)

**New Message Type**:
```typescript
export type MessageType =
  | ...
  | 'GUM_TRIGGER_INFERENCE'; // NEW
```

#### 3. background.ts (+25 lines)

**New Message Handler**:
```typescript
case 'GUM_TRIGGER_INFERENCE':
  this.handleGUMTriggerInference(sendResponse);
  return true;
```

**New Handler Method**:
```typescript
private async handleGUMTriggerInference(
  sendResponse: (response: any) => void
): Promise<void> {
  try {
    logger.info('Background', 'Triggering immediate GUM inference');
    await generalUserAgent.triggerImmediateInference();
    
    const propositions = generalUserAgent.getPropositions();
    sendResponse({ 
      success: true, 
      propositions,
      count: propositions.length 
    });
  } catch (error) {
    logger.error('Background', 'Failed to trigger GUM inference', error);
    sendResponse({ error: 'Inference trigger failed' });
  }
}
```

#### 4. OrchestratorAgent.ts (+20 lines)

**Updated**: `showHesitationPopupWithGUM()`
```typescript
private async showHesitationPopupWithGUM(extractionResult: DataExtractionResult): Promise<void> {
  logger.info('OrchestratorAgent', 'Showing hesitation popup with GUM propositions');

  try {
    // FIRST: Trigger immediate GUM inference
    logger.info('OrchestratorAgent', 'Triggering immediate GUM inference for struggle context');
    
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'GUM_TRIGGER_INFERENCE',
          payload: {},
          timestamp: Date.now(),
          source: 'orchestrator',
        },
        (response) => {
          if (response && response.success) {
            logger.info('OrchestratorAgent', 'Immediate inference complete', {
              propositionCount: response.count,
            });
          }
          resolve();
        }
      );
    });

    // THEN: Query GUM for fresh propositions
    const propositions = await this.queryGUM({
      minConfidence: 0.3,
      applyDecay: true,
    });
    
    // Show GUM popup with propositions...
  }
}
```

---

## How It Works Now

### Old Flow (BROKEN)
```
User hesitates → Struggle detected → Query GUM → 0 propositions → Fallback to old UI
                                   ↑
                          (60s timer hasn't fired yet)
```

### New Flow (FIXED)
```
User hesitates → Struggle detected → Trigger immediate inference → Wait for GPT-4 → Query GUM → Show GUM popup
                                            ↓
                                    Collects last 50 interactions
                                    Extracts page content (GDP table)
                                    Calls OpenAI GPT-4
                                    Generates propositions NOW
                                            ↓
                                    Returns fresh propositions!
```

---

## Testing Instructions

1. **Reload Extension**:
   ```bash
   cd KAIROS-SPECTRA
   npm run build
   # Then reload in chrome://extensions
   ```

2. **Navigate to Wikipedia GDP Table**:
   - Open: https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)
   - Interact with table: Hover, click cells, scroll

3. **Trigger Struggle**:
   - Pause mouse for 4+ seconds (prolonged hesitation)
   - OR click same cell repeatedly

4. **Verify GUM Popup Appears**:
   - Check console logs:
     ```
     [KAIROS-SPECTRA:OrchestratorAgent] Triggering immediate GUM inference
     [KAIROS-SPECTRA:GeneralUserAgent] Running GUM inference
     [KAIROS-SPECTRA:GeneralUserAgent] Inference complete {newPropositions: 3, totalPropositions: 3}
     [KAIROS-SPECTRA:OrchestratorAgent] Immediate inference complete {propositionCount: 3}
     [KAIROS-SPECTRA:OrchestratorAgent] GUM query successful {propositionCount: 3}
     ```
   - GUM popup should show with propositions like:
     - **Activity**: "User is exploring economic data on Wikipedia" (75%)
     - **Goal**: "User wants to compare GDP figures across countries" (70%)
     - **Context**: "User is on a data-rich page with tables" (85%)

5. **Verify Propositions Are Dynamic**:
   - Should NOT be empty
   - Should reference actual page content (GDP, countries, table)
   - Should reflect your interactions (hovering, clicking)

---

## Expected Console Output

```
[KAIROS-SPECTRA:PerceptionAgent] Struggle detected! {type: 'prolonged_hesitation', confidence: 0.8}
[KAIROS-SPECTRA:ContentScript] Struggle event received
[KAIROS-SPECTRA:DataAgent] Starting data extraction
[KAIROS-SPECTRA:DataAgent] ✓ Found 1 tables
[KAIROS-SPECTRA:OrchestratorAgent] Starting hierarchical guidance flow
[KAIROS-SPECTRA:OrchestratorAgent] Struggle detected - showing GUM user model popup
[KAIROS-SPECTRA:OrchestratorAgent] Triggering immediate GUM inference for struggle context
[KAIROS-SPECTRA:Background] Triggering immediate GUM inference
[KAIROS-SPECTRA:GeneralUserAgent] Immediate inference triggered (struggle detected)
[KAIROS-SPECTRA:GeneralUserAgent] Running GUM inference {interactions: 45, currentPropositions: 0}
[KAIROS-SPECTRA:GeneralUserAgent] Calling OpenAI GPT-4 for inference
[KAIROS-SPECTRA:GeneralUserAgent] OpenAI inference successful {tokens: 2341}
[KAIROS-SPECTRA:GeneralUserAgent] Parsed 4 propositions from LLM response
[KAIROS-SPECTRA:GeneralUserAgent] Inference complete {newPropositions: 4, totalPropositions: 4}
[KAIROS-SPECTRA:OrchestratorAgent] Immediate inference complete {propositionCount: 4}
[KAIROS-SPECTRA:OrchestratorAgent] GUM query successful {propositionCount: 4}
[KAIROS-SPECTRA:HierarchicalGuidanceUI] Showing hesitation popup with 4 GUM propositions
```

---

## API Requirements

**Critical**: Make sure OpenAI API key is configured!

```javascript
// In console:
chrome.storage.sync.set({ openai_api_key: 'sk-YOUR_KEY_HERE' });

// Verify:
chrome.storage.sync.get(['openai_api_key'], (result) => {
  console.log('API Key:', result.openai_api_key ? '✓ Set' : '✗ Missing');
});
```

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `src/agents/GeneralUserAgent.ts` | +40 | Added `triggerImmediateInference()` method |
| `src/types.ts` | +1 | Added `GUM_TRIGGER_INFERENCE` message type |
| `src/background.ts` | +25 | Added message handler for immediate inference |
| `src/agents/OrchestratorAgent.ts` | +20 | Trigger immediate inference before querying |
| `GUM_INTEGRATION_SUMMARY.md` | +10 | Updated documentation |

**Total**: ~96 lines added

---

## Benefits

✅ **No more empty GUM popups** - Propositions generated on-demand  
✅ **Contextually relevant** - Uses current page + recent interactions  
✅ **Instant feedback** - User sees GUM insights immediately  
✅ **Backward compatible** - 60s periodic updates still run for continuous learning  
✅ **Performance** - Only triggers when needed (struggle detected)

---

## Troubleshooting

### Still seeing 0 propositions?

**Check 1**: API Key configured?
```javascript
chrome.storage.sync.get(['openai_api_key'], console.log);
```

**Check 2**: GUM initialized?
```
Look for: [BackgroundScript] GUM initialized successfully with OpenAI API
```

**Check 3**: Interactions collected?
```
Look for: [KAIROS-SPECTRA:Background] Fed interactions to GUM {count: 45}
```

**Check 4**: Inference running?
```
Look for: [KAIROS-SPECTRA:GeneralUserAgent] Running GUM inference
```

**Check 5**: OpenAI API working?
```
Look for: [KAIROS-SPECTRA:GeneralUserAgent] OpenAI inference successful
```

If API call fails, you'll see:
```
[KAIROS-SPECTRA:GeneralUserAgent] Inference failed Error: OpenAI API error...
```

---

**Status**: ✅ **FIXED** - GUM now triggers immediate inference on struggle detection  
**Testing**: Ready for manual testing with Wikipedia GDP table  
**Next**: Verify propositions are accurate and relevant to user's activity

