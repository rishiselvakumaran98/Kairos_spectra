# GUM Interaction Feeding Fix

## Problem
GUM (GeneralUserAgent) was consistently returning **0 propositions** despite user interactions because:

1. **Interactions were never sent to GUM** - The content script never fed `interactionHistory` to the background script
2. **Service worker context error** - Background script tried to access `window.location.href` which doesn't exist in service workers
3. **No continuous learning** - GUM only got data when struggles were detected, missing most user activity

## Root Cause Analysis

From the error logs:
```
[GeneralUserAgent] Data available for inference {interactionCount: 0, pageContentLength: 0, observationCount: 0}
[GeneralUserAgent] ⚠️ No data to infer from yet - no interactions or page content
```

The flow was broken:
- ✅ PerceptionAgent captured interactions in content script
- ❌ Content script never sent interactions to background
- ❌ GUM in background had 0 observations
- ❌ Inference returned 0 propositions

## Solution Implemented

### 1. **Immediate Feeding on Struggle Detection** (`content.ts`)

```typescript
// Send interaction history WITH struggle event
const message = createMessage(
  'STRUGGLE_DETECTED',
  {
    struggleEvent: event,
    extractionResult,
    interactionHistory: event.interactionHistory, // NEW: Send interactions
  },
  'content'
);
```

### 2. **Handle Interactions in Background** (`background.ts`)

```typescript
private handleStruggleDetected(
  payload: { 
    struggleEvent: StruggleEvent; 
    extractionResult: DataExtractionResult; 
    interactionHistory?: UserInteractionEvent[] // NEW parameter
  },
  tabId?: number
): void {
  // Feed interactions to GUM FIRST (before inference)
  if (interactionHistory && interactionHistory.length > 0) {
    this.feedInteractionsToGUM(interactionHistory, struggleEvent.context.pageURL);
  }
  // ... rest of handler
}
```

### 3. **Fix Service Worker Context Error** (`background.ts`)

```typescript
private async feedInteractionsToGUM(
  interactions: UserInteractionEvent[], 
  pageURL?: string // Get URL from content script, not from window
): Promise<void> {
  if (!this.gumInitialized || interactions.length === 0) {
    return;
  }

  try {
    await generalUserAgent.addObservation({
      source: 'interaction',
      data: interactions,
      metadata: {
        pageURL: pageURL, // Use passed URL, not window.location.href
      },
    });

    logger.info('Background', 'Fed interactions to GUM', {
      count: interactions.length,
      pageURL: pageURL,
    });
  } catch (error) {
    logger.error('Background', 'Failed to feed interactions to GUM', error);
  }
}
```

### 4. **Periodic Interaction Feeding** (`content.ts`)

```typescript
/**
 * Periodically send interaction history to GUM for continuous learning
 */
private startPeriodicInteractionFeed(): void {
  this.interactionFeedInterval = window.setInterval(() => {
    const interactions = perceptionAgent.getRecentInteractions(50); // Last 50
    
    if (interactions.length > 0) {
      const message = createMessage(
        'AGENT_STATE_UPDATE',
        {
          interactionHistory: interactions,
          url: window.location.href,
        },
        'content'
      );

      sendMessageToBackground(message).catch((error) => {
        logger.debug('ContentScript', 'Failed to send periodic interactions');
      });
    }
  }, 15000); // Every 15 seconds
}
```

### 5. **Add getRecentInteractions Method** (`PerceptionAgent.ts`)

```typescript
/**
 * Get recent interactions for GUM learning
 * @param limit Maximum number of recent interactions to return
 */
public getRecentInteractions(limit: number = 50): UserInteractionEvent[] {
  return this.state.interactionBuffer.slice(-limit);
}
```

## Expected Behavior After Fix

### Immediate Feeding (On Struggle)
1. User interacts with page (hovers, clicks, scrolls)
2. PerceptionAgent detects struggle (e.g., 4+ second pause)
3. Content script sends `interactionHistory` with struggle event
4. Background feeds interactions to GUM **before** triggering inference
5. GUM now has observations to work with
6. Inference generates propositions based on interaction patterns

### Continuous Feeding (Every 15 Seconds)
1. Content script collects last 50 interactions
2. Sends to background via `AGENT_STATE_UPDATE`
3. Background feeds to GUM
4. GUM continuously learns user behavior patterns
5. More data = better propositions over time

## Testing Instructions

1. **Reload Extension**: Go to `chrome://extensions`, reload KAIROS-SPECTRA
2. **Open Background Console**: Click "Service Worker" under your extension
3. **Test on Wikipedia**: Open https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)
4. **Interact**: Hover over table, click elements for 20-30 seconds
5. **Trigger Struggle**: Pause for 4+ seconds
6. **Check Logs**: Look for:

```
[Background] Fed interactions to GUM {count: X, pageURL: 'https://...'} ✅
[GeneralUserAgent] Data available for inference {interactionCount: X, ...} ✅ (X > 0)
[GeneralUserAgent] Calling OpenAI GPT-4 for inference... ✅
[GeneralUserAgent] Propositions parsed {count: X, ...} ✅ (X > 0)
[OrchestratorAgent] GUM query successful {propositionCount: X} ✅ (X > 0)
```

## Files Modified

1. **src/content.ts** (+35 lines)
   - Added `interactionHistory` to `STRUGGLE_DETECTED` message
   - Added `startPeriodicInteractionFeed()` method for continuous learning

2. **src/background.ts** (+10 lines)
   - Updated `handleStruggleDetected()` to accept and feed interactions
   - Fixed `feedInteractionsToGUM()` to accept `pageURL` parameter (no `window` access)
   - Updated `AGENT_STATE_UPDATE` handler to pass URL

3. **src/agents/PerceptionAgent.ts** (+8 lines)
   - Added `getRecentInteractions()` method to expose interaction buffer

## Architecture Improvement

**Before:**
```
Content Script → Background → GUM
   (no data)         ↓          ↓
                  (empty)   (0 propositions)
```

**After:**
```
Content Script → Background → GUM
   (interactions)     ↓          ↓
   every 15s      (feed data) (generates propositions)
   + on struggle
```

## Key Insights

1. **Service Worker Limitations**: Service workers can't access DOM or `window` - must get context from content scripts
2. **Data Flow Critical**: GUM needs observations BEFORE inference can generate propositions
3. **Continuous Learning**: Periodic feeding (every 15s) provides richer data than struggle-only feeding
4. **Timing Matters**: Feed interactions BEFORE triggering immediate inference

## Next Steps

- Test to confirm propositions are now generated (count > 0)
- Monitor background console for successful inference
- Verify GUM popup shows relevant propositions
- Consider optimizing feed frequency (15s vs 30s vs on-demand)
