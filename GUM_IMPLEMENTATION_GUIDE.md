# GUM Integration - Next Steps Guide
**Quick Reference for Phase 2-4 Implementation**

---

## ✅ What's Complete (Phase 1)

1. **GeneralUserAgent.ts** (650+ lines)
   - Core GUM framework implemented
   - Periodic inference loop (60s)
   - Persistent storage in chrome.storage.local
   - Query API with filters
   - CRUD operations on propositions

2. **Background Script Integration**
   - GUM initialization on startup
   - Message handlers for all GUM operations
   - Interaction feeding from PerceptionAgent

3. **Type Definitions**
   - Proposition, Observation, QueryParams types
   - New message types for GUM communication

---

## 🎯 Phase 2: Orchestrator + UI Integration (NEXT)

### Task 1: Enhance OrchestratorAgent with GUM Context

**File**: `src/agents/OrchestratorAgent.ts`

**Location**: Modify `startHierarchicalGuidance()` method

**Before (Tactical Only)**:
```typescript
public async startHierarchicalGuidance(
  struggleEvent: StruggleEvent,
  extractionResult: DataExtractionResult
): Promise<void> {
  // Infer context from data only
  const context = this.inferContext(extractionResult);
  
  // Show UI with generic goals
  this.ui.showLevel1(context, ['compare_trends', 'find_outliers']);
}
```

**After (Tactical + Strategic)**:
```typescript
public async startHierarchicalGuidance(
  struggleEvent: StruggleEvent,
  extractionResult: DataExtractionResult
): Promise<void> {
  // Query GUM for strategic context
  const gumContext = await this.queryGUM({
    category: 'goal',
    minConfidence: 0.6,
    timestampCutoff: Date.now() - 300000, // Last 5 minutes
  });
  
  // Infer context from both tactical data and strategic GUM
  const context = this.inferContextWithGUM(extractionResult, gumContext);
  
  // Generate smart goal buttons based on user model
  const goals = this.generateGoalsFromGUM(gumContext, extractionResult);
  
  // Show UI with personalized goals
  this.ui.showLevel1(context, goals);
}
```

**New Methods to Add**:

1. **queryGUM()** - Send message to background script
```typescript
private async queryGUM(params: QueryParams): Promise<Proposition[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      createMessage('GUM_QUERY', params, 'content'),
      (response) => {
        resolve(response.propositions || []);
      }
    );
  });
}
```

2. **inferContextWithGUM()** - Enhanced context inference
```typescript
private inferContextWithGUM(
  extraction: DataExtractionResult,
  gumProps: Proposition[]
): InferredContext {
  const dataContext = this.inferContext(extraction); // Original logic
  
  // Add GUM insights to message
  const gumInsights = gumProps
    .slice(0, 2) // Top 2 most confident
    .map(p => p.text)
    .join(', ');
  
  return {
    ...dataContext,
    message: gumInsights
      ? `${dataContext.message} Based on your activity, you might be: ${gumInsights}.`
      : dataContext.message,
    gumPropositions: gumProps, // Store for later use
  };
}
```

3. **generateGoalsFromGUM()** - Smart goal generation
```typescript
private generateGoalsFromGUM(
  gumProps: Proposition[],
  extraction: DataExtractionResult
): AnalyticalGoal[] {
  const defaultGoals: AnalyticalGoal[] = [
    'compare_trends',
    'analyze_distribution',
    'find_outliers',
  ];
  
  // Look for goal-related propositions
  const goalProps = gumProps.filter(p => 
    p.category === 'goal' || p.category === 'activity'
  );
  
  // Map propositions to analytical goals
  const gumGoals: AnalyticalGoal[] = [];
  
  for (const prop of goalProps) {
    const text = prop.text.toLowerCase();
    
    if (text.includes('compar') || text.includes('contrast')) {
      gumGoals.push('compare_trends');
    }
    if (text.includes('distribution') || text.includes('spread')) {
      gumGoals.push('analyze_distribution');
    }
    if (text.includes('outlier') || text.includes('anomal')) {
      gumGoals.push('find_outliers');
    }
    if (text.includes('correlation') || text.includes('relationship')) {
      gumGoals.push('correlation_analysis');
    }
  }
  
  // Combine GUM goals with defaults (deduplicate)
  return [...new Set([...gumGoals, ...defaultGoals])].slice(0, 4);
}
```

---

### Task 2: Add "Show User Model" Button to UI

**File**: `src/ui/HierarchicalGuidanceUI.ts`

**Step 1**: Add button to UI container
```typescript
private createUIContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'kairos-spectra-ui';
  
  // ... existing UI elements ...
  
  // Add User Model button
  const userModelBtn = this.createUserModelButton();
  container.appendChild(userModelBtn);
  
  return container;
}
```

**Step 2**: Create button
```typescript
private createUserModelButton(): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'kairos-user-model-btn';
  btn.innerHTML = '👤 My User Model';
  btn.title = 'View what the system knows about you';
  
  btn.addEventListener('click', () => {
    this.showUserModelModal();
  });
  
  return btn;
}
```

**Step 3**: Create modal
```typescript
private async showUserModelModal(): Promise<void> {
  // Query all propositions
  const propositions = await this.queryAllPropositions();
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'kairos-modal kairos-user-model-modal';
  
  modal.innerHTML = `
    <div class="kairos-modal-content">
      <div class="kairos-modal-header">
        <h2>Your User Model</h2>
        <button class="kairos-modal-close">✕</button>
      </div>
      <div class="kairos-modal-body">
        ${this.renderPropositionsByCategory(propositions)}
      </div>
      <div class="kairos-modal-footer">
        <button class="kairos-btn-secondary" onclick="this.closest('.kairos-modal').remove()">
          Close
        </button>
      </div>
    </div>
  `;
  
  // Close button handler
  modal.querySelector('.kairos-modal-close')?.addEventListener('click', () => {
    modal.remove();
  });
  
  document.body.appendChild(modal);
}
```

**Step 4**: Render propositions
```typescript
private renderPropositionsByCategory(propositions: Proposition[]): string {
  const categories = ['identity', 'goal', 'preference', 'context', 'activity'];
  const categoryLabels = {
    identity: '🎓 Identity',
    goal: '🎯 Current Goals',
    preference: '⚙️ Preferences',
    context: '📍 Context',
    activity: '🔄 Activity',
  };
  
  let html = '';
  
  for (const cat of categories) {
    const props = propositions.filter(p => p.category === cat);
    if (props.length === 0) continue;
    
    html += `
      <div class="kairos-proposition-category">
        <h3>${categoryLabels[cat]}</h3>
        ${props.map(p => this.renderProposition(p)).join('')}
      </div>
    `;
  }
  
  return html || '<p class="kairos-empty-state">No user model data yet. Keep using the extension!</p>';
}
```

**Step 5**: Render individual proposition
```typescript
private renderProposition(prop: Proposition): string {
  const confidenceClass = prop.confidence >= 0.75 ? 'high' : 
                          prop.confidence >= 0.5 ? 'medium' : 'low';
  
  return `
    <div class="kairos-proposition-card">
      <div class="kairos-proposition-header">
        <span class="kairos-proposition-text">${prop.text}</span>
        <span class="kairos-confidence-badge kairos-confidence-${confidenceClass}">
          ${(prop.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div class="kairos-proposition-details">
        <small class="kairos-proposition-reasoning">
          💡 ${prop.grounding.reasoning}
        </small>
      </div>
      <div class="kairos-proposition-actions">
        <button class="kairos-btn-icon" onclick="editProposition('${prop.id}')" title="Edit">
          ✏️
        </button>
        <button class="kairos-btn-icon" onclick="deleteProposition('${prop.id}')" title="Delete">
          🗑️
        </button>
      </div>
    </div>
  `;
}
```

**Step 6**: Add CSS (append to `content.css`)
```css
/* User Model Button */
.kairos-user-model-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.kairos-user-model-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

/* Modal */
.kairos-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.kairos-modal-content {
  background: white;
  border-radius: 12px;
  width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.kairos-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.kairos-modal-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
}

.kairos-modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: all 0.2s;
}

.kairos-modal-close:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.kairos-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Proposition Cards */
.kairos-proposition-category {
  margin-bottom: 24px;
}

.kairos-proposition-category h3 {
  font-size: 16px;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 12px;
}

.kairos-proposition-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.kairos-proposition-card:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.kairos-proposition-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.kairos-proposition-text {
  flex: 1;
  font-size: 15px;
  color: #1f2937;
  font-weight: 500;
}

.kairos-confidence-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.kairos-confidence-high {
  background: #d1fae5;
  color: #065f46;
}

.kairos-confidence-medium {
  background: #fef3c7;
  color: #92400e;
}

.kairos-confidence-low {
  background: #fee2e2;
  color: #991b1b;
}

.kairos-proposition-details {
  margin-bottom: 12px;
}

.kairos-proposition-reasoning {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.5;
}

.kairos-proposition-actions {
  display: flex;
  gap: 8px;
}

.kairos-btn-icon {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.kairos-btn-icon:hover {
  background: #f3f4f6;
  border-color: #667eea;
}

.kairos-empty-state {
  text-align: center;
  color: #9ca3af;
  padding: 40px;
  font-size: 15px;
}
```

---

## 🧪 Testing Checklist

### Phase 1 Tests (GUM Core)

- [ ] GUM initializes on extension load
- [ ] API key is loaded from storage
- [ ] Propositions persist across sessions
- [ ] Update loop runs every 60s
- [ ] Observations are added correctly
- [ ] Query filters work (category, confidence, time)
- [ ] LLM API calls succeed
- [ ] Propositions are parsed from JSON response
- [ ] Merge logic updates existing propositions
- [ ] Decay reduces confidence over time

### Phase 2 Tests (Orchestrator Integration)

- [ ] OrchestratorAgent queries GUM before showing UI
- [ ] Context message includes GUM insights
- [ ] Goal buttons are generated from GUM propositions
- [ ] "Show User Model" button appears in UI
- [ ] Modal displays all propositions by category
- [ ] Confidence badges show correct colors
- [ ] Edit/delete buttons are functional
- [ ] Modal closes properly

### Integration Test Flow

1. **Setup**:
   - Install extension
   - Add Gemini API key to storage
   - Navigate to Wikipedia GDP table page

2. **Generate User Model**:
   - Interact with page for 30 seconds (hover, click rows)
   - Wait 60 seconds for GUM update
   - Open console and check: `chrome.storage.local.get(['gum_propositions'])`

3. **Verify Propositions**:
   - Should see 3-7 propositions
   - At least one should mention "GDP" or "economic data"
   - Confidence scores should vary (not all 1.0)
   - Categories should be assigned

4. **Test UI Integration**:
   - Trigger struggle detection (4 rapid clicks)
   - Check that context message includes GUM insights
   - Verify goal buttons are relevant to user activity
   - Click "Show User Model" button
   - Verify modal shows propositions

---

## 🚀 Quick Commands

```bash
# Build extension
cd KAIROS-SPECTRA
npm run build

# Watch for changes
npm run watch

# Check for errors
npm run lint

# Test in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer Mode
# 3. Load unpacked -> select dist/ folder
```

---

## 📝 API Key Setup

Users need to provide Gemini API key for GUM to work:

```javascript
// In browser console:
chrome.storage.local.set({
  'gemini_api_key': 'YOUR_API_KEY_HERE'
});

// Get free API key at:
// https://ai.google.dev/
```

---

## 🎯 Success Criteria

Phase 2 is complete when:

1. ✅ OrchestratorAgent queries GUM before showing guidance
2. ✅ Context messages include GUM insights (e.g., "Based on your activity, you might be comparing economic data")
3. ✅ Goal buttons are personalized (not just generic defaults)
4. ✅ "Show User Model" button displays in UI
5. ✅ Modal shows propositions grouped by category
6. ✅ Confidence badges use correct colors (green/yellow/red)
7. ✅ User can read reasoning for each proposition
8. ✅ Manual testing on Wikipedia shows relevant propositions

---

## 🐛 Debugging Tips

### GUM Not Updating

**Check**:
- API key is set: `chrome.storage.local.get(['gemini_api_key'])`
- GUM is started: Check console for "GUM started" log
- Observations are being added: Check `chrome.storage.local.get(['gum_observations'])`
- Update timer is running: Should see "Running GUM inference" every 60s

### Propositions Are Generic

**Check**:
- Interaction history is being captured (check PerceptionAgent buffer)
- Page content is extracted (should be 500+ chars)
- LLM response contains specific details (check console logs)
- Prompt includes recent interactions (check buildGUMPrompt output)

### UI Button Not Appearing

**Check**:
- CSS is loaded (check content.css includes user-model-btn styles)
- Button is appended to container (check DOM inspector)
- Z-index is high enough (should be 10000+)
- Button not hidden behind other elements

---

**Next Action**: Start with Task 1 (OrchestratorAgent enhancement)  
**Estimated Time**: 2-3 hours for full Phase 2 implementation  
**Branch**: `phase_v2_GUM`

*Last Updated: November 12, 2025*
