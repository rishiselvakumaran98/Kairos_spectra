# Phase 5: Proactive Tool Generation - Implementation Complete

## Overview

Phase 5 transforms KAIROS-SPECTRA from a **reactive analyst** (responding to user struggles) into a truly **proactive collaborator** that autonomously creates new tools for users.

This implementation connects three cutting-edge research concepts:

1. **GUM (General User Model)** - Strategic understanding of *who the user is*
2. **JIT Objectives (Just-In-Time Objectives)** - Translation of strategic understanding into *actionable needs*
3. **Generative Interfaces** - Generation of *new UI widgets* to fulfill those needs

## Architecture

### The Agentic Loop

```
┌─────────────────────────────────────────────────────────────┐
│                   PROACTIVE GENERATION CYCLE                │
│                    (Every 5 minutes)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  1. GUM Agent    │
                    │  (GPT-4o-mini)   │
                    └──────────────────┘
                              │
                    Gets highest confidence
                    proposition (>= 0.8)
                              │
                              ▼
                    ┌──────────────────┐
                    │ 2. JIT Agent     │
                    │    (GPT-4o)      │
                    └──────────────────┘
                              │
                    Generates actionable
                    objective from belief
                              │
                              ▼
                    ┌──────────────────┐
                    │ 3. GenUI Agent   │
                    │    (GPT-4o)      │
                    └──────────────────┘
                              │
                    Generates HTML/CSS/JS
                    widget code
                              │
                              ▼
                    ┌──────────────────┐
                    │ 4. Storage &     │
                    │    Notification  │
                    └──────────────────┘
                              │
                    Stores widget + notifies
                    user (G18 compliance)
                              │
                              ▼
                         User sees tool
```

## Implementation Details

### New Agents

#### 1. **JIT_ObjectiveAgent.ts**
- **Purpose**: Translate GUM propositions into actionable objectives
- **Model**: GPT-4o (strategic reasoning)
- **Input**: High-confidence proposition (e.g., "User is a Ph.D. student writing a research paper")
- **Output**: Actionable objective (e.g., "A tool to track and format citations in APA/MLA style")
- **Key Methods**:
  - `generateActionableObjective(proposition)` - Main entry point
  - `generateMultipleObjectives(propositions, maxCount)` - Batch generation

**Example Output**:
```json
{
  "objective": "A tool to track and format citations in APA/MLA style",
  "reasoning": "Ph.D. students need to manage references systematically",
  "toolType": "tracker",
  "complexity": "moderate",
  "confidence": 0.85
}
```

#### 2. **Generative_UIAgent.ts**
- **Purpose**: Generate complete UI widgets from objectives
- **Model**: GPT-4o (code generation specialist)
- **Input**: Actionable objective
- **Output**: Self-contained HTML/CSS/JS code
- **Key Methods**:
  - `generateUIWidget(objective)` - Generate widget code
  - `validateWidget(widget)` - Security and quality checks
  - `generatePreviewHTML(widget)` - Create standalone preview

**Example Output**:
```json
{
  "html": "<div class=\"kairos-widget-container\">...</div>",
  "css": ".kairos-widget-container { padding: 20px; ... }",
  "js": "const widget = { initialize() { ... } };",
  "metadata": {
    "objective": "Citation tracker",
    "toolType": "tracker",
    "generatedAt": 1699999999999,
    "complexity": "moderate"
  }
}
```

#### 3. **Enhanced GeneralUserAgent.ts**
- **New Methods**:
  - `getHighestConfidenceProposition()` - Returns top proposition by effective confidence (confidence × decayScore)
  - `callGUMModel(history)` - Direct interface for background script to trigger inference

### Background Script Enhancements

**New Features**:
1. **Proactive Generation Loop** - Runs every 5 minutes
2. **Widget Storage** - Persistent storage of generated tools
3. **User Notification** - G18 compliance (notify about changes)
4. **Global Controls** - G17 compliance (enable/disable generation)
5. **Usage Tracking** - Monitor widget usage and ratings

**New Message Types**:
- `NEW_TOOL_GENERATED` - Notify user about new widget
- `GET_STORED_WIDGETS` - Retrieve all widgets
- `TOGGLE_PROACTIVE_GENERATION` - Enable/disable proactive mode
- `DELETE_WIDGET` - Remove widget (G8: efficient dismissal)
- `RATE_WIDGET` - User feedback
- `OPEN_WIDGET` - Track usage

### Type Definitions

**New Types in `types.ts`**:
```typescript
interface ActionableObjective {
  objective: string;
  reasoning: string;
  toolType?: 'calculator' | 'tracker' | 'checker' | 'analyzer' | 'formatter' | 'monitor' | 'custom';
  complexity?: 'simple' | 'moderate' | 'complex';
  confidence: number;
  sourceProposition: { id: string; text: string; };
}

interface GeneratedWidget {
  html: string;
  css: string;
  js: string;
  metadata: {
    objective: string;
    toolType: string;
    generatedAt: number;
    complexity: string;
  };
}

interface StoredWidget {
  id: string;
  widget: GeneratedWidget;
  createdAt: number;
  usageCount: number;
  lastUsedAt: number;
  userRating?: number; // 1-5 stars
  isVisible: boolean;
  isPinned: boolean;
}
```

## Multi-Model Orchestration (Cursor 2.0 Pattern)

Following the Cursor 2.0 architecture, we use different models for different tasks:

| Task | Model | Reasoning |
|------|-------|-----------|
| **GUM Inference** | GPT-4o-mini | Deep context understanding, cost-effective for frequent updates |
| **JIT Objective** | GPT-4o | Strategic reasoning about user needs |
| **Code Generation** | GPT-4o | Superior code generation capabilities |
| **Visual Analysis** | GPT-4V | Vision-specific tasks (existing implementation) |

## Human-AI Interaction Guidelines Compliance

### G17: Provide Global Controls
- **Implementation**: Toggle in settings panel: `[x] Allow Proactive Tool Generation`
- **Storage**: Persisted in `chrome.storage.sync`
- **Effect**: User can completely disable the proactive loop

### G18: Notify About Changes
- **Implementation**: Notification when new tool generated
- **Message**: "Hi, I've analyzed your workflow and built a new 'Citation Tracker' tool for you. You can find it in your KAIROS-SPECTRA panel."
- **Channels**: 
  - In-page notification (content script)
  - Chrome notification (system level)

### G8: Support Efficient Dismissal
- **Implementation**: Delete button on each widget
- **Effect**: Permanent removal from storage
- **Message**: `DELETE_WIDGET` handled in background script

## Usage Flow

### 1. Automatic Generation (Proactive)

```javascript
// Every 5 minutes, background script runs:
async runProactiveGenerationCycle() {
  // 1. Get top proposition from GUM
  const proposition = await generalUserAgent.getHighestConfidenceProposition();
  
  // 2. Check if new and high confidence (>= 0.8)
  if (proposition && effectiveConfidence >= 0.8 && proposition.id !== lastPropositionId) {
    
    // 3. Generate objective
    const objective = await jitObjectiveAgent.generateActionableObjective(proposition);
    
    // 4. Generate widget
    const widget = await generativeUIAgent.generateUIWidget(objective);
    
    // 5. Store and notify user
    storeWidget(widget);
    notifyUser(widget, objective);
  }
}
```

### 2. Manual Control (User-Initiated)

```javascript
// User can toggle proactive generation
chrome.runtime.sendMessage({
  type: 'TOGGLE_PROACTIVE_GENERATION',
  payload: { enabled: false }
});

// User can delete widgets
chrome.runtime.sendMessage({
  type: 'DELETE_WIDGET',
  payload: { id: 'widget_123' }
});

// User can rate widgets (feedback loop)
chrome.runtime.sendMessage({
  type: 'RATE_WIDGET',
  payload: { id: 'widget_123', rating: 5 }
});
```

## Example Scenarios

### Scenario 1: Research Paper Writing

**GUM Proposition**:
```json
{
  "text": "User is a Ph.D. student writing a research paper",
  "confidence": 0.9,
  "decayScore": 0.95,
  "category": "identity"
}
```

**JIT Objective**:
```json
{
  "objective": "A tool to track and format citations in APA/MLA style",
  "toolType": "tracker",
  "complexity": "moderate"
}
```

**Generated Widget**:
- Citation list with add/remove buttons
- Format selector (APA/MLA/Chicago)
- Export to BibTeX functionality
- Real-time citation formatting

### Scenario 2: Data Analysis

**GUM Proposition**:
```json
{
  "text": "User is comparing GDP data across multiple countries",
  "confidence": 0.85,
  "decayScore": 0.7,
  "category": "activity"
}
```

**JIT Objective**:
```json
{
  "objective": "A tool to visualize and sort country GDP values in a table",
  "toolType": "analyzer",
  "complexity": "moderate"
}
```

**Generated Widget**:
- Sortable table with country names and GDP values
- Bar chart visualization
- Filter by region/continent
- Export to CSV functionality

### Scenario 3: Shopping Planning

**GUM Proposition**:
```json
{
  "text": "User is shopping for a friend's wedding in Chicago",
  "confidence": 0.82,
  "decayScore": 0.6,
  "category": "goal"
}
```

**JIT Objective**:
```json
{
  "objective": "A tool to check the weather forecast in Chicago for the next 10 days",
  "toolType": "checker",
  "complexity": "simple"
}
```

**Generated Widget**:
- Weather forecast display
- Temperature high/low
- Precipitation probability
- Clothing recommendations

## Configuration

### Settings in `chrome.storage.sync`
```javascript
{
  "proactive_generation_enabled": true, // G17: Global control
  "openai_api_key": "sk-...", // API key for all models
}
```

### Settings in `chrome.storage.local`
```javascript
{
  "generated_widgets": [
    {
      "id": "widget_abc123",
      "widget": { html, css, js, metadata },
      "createdAt": 1699999999999,
      "usageCount": 5,
      "lastUsedAt": 1700000000000,
      "userRating": 4,
      "isVisible": true,
      "isPinned": false
    }
  ]
}
```

## Testing

### Manual Testing Steps

1. **Enable Proactive Generation**:
   - Open KAIROS-SPECTRA popup
   - Toggle "Allow Proactive Tool Generation" ON
   - Verify setting persists after refresh

2. **Trigger Generation Cycle**:
   - Browse normally for 5+ minutes
   - Interact with data-heavy pages
   - Wait for GUM to build high-confidence proposition
   - Check for notification when tool generated

3. **View Generated Widgets**:
   - Open KAIROS-SPECTRA panel
   - See list of generated widgets
   - Click to open widget in modal/panel
   - Test widget functionality

4. **Delete Widget (G8 Compliance)**:
   - Click delete button on widget
   - Verify widget removed from list
   - Confirm removal persists after refresh

5. **Rate Widget**:
   - Give widget 1-5 star rating
   - Verify rating saved
   - Check rating influences future generations (future work)

### Automated Testing (Future Work)

```javascript
describe('Phase 5: Proactive Tool Generation', () => {
  it('should generate widget when high-confidence proposition exists', async () => {
    // Mock GUM proposition
    const proposition = mockHighConfidenceProposition();
    
    // Run generation cycle
    await background.runProactiveGenerationCycle();
    
    // Verify widget created
    const widgets = background.getStoredWidgets();
    expect(widgets.length).toBe(1);
  });
  
  it('should notify user about new tool (G18)', async () => {
    // Mock notification spy
    const notifySpy = jest.spyOn(chrome.notifications, 'create');
    
    // Generate widget
    await background.runProactiveGenerationCycle();
    
    // Verify notification sent
    expect(notifySpy).toHaveBeenCalled();
  });
});
```

## Future Enhancements

### Short-Term (Next Sprint)
1. **Widget UI Panel** - Visual interface in sidebar to browse/manage widgets
2. **Widget Injection** - Dynamically inject widget HTML into page DOM
3. **Widget Persistence** - Keep widgets visible across page navigations
4. **Widget Customization** - User can edit widget appearance/behavior

### Medium-Term
1. **Feedback Loop** - User ratings influence objective generation
2. **Widget Templates** - Pre-built templates for common tool types
3. **Multi-Widget Coordination** - Widgets can communicate with each other
4. **Context-Aware Positioning** - Place widgets near relevant page content

### Long-Term
1. **Adaptive Learning** - ML model learns which widgets users prefer
2. **Collaborative Filtering** - Recommend widgets based on similar users
3. **Widget Marketplace** - Share/discover community-created widgets
4. **Advanced GenUI** - Use full GenUI pipeline (WebDSL, iterative refinement)

## File Structure

```
KAIROS-SPECTRA/
├── src/
│   ├── agents/
│   │   ├── GeneralUserAgent.ts ✅ (Enhanced)
│   │   ├── JIT_ObjectiveAgent.ts ✅ (NEW)
│   │   ├── Generative_UIAgent.ts ✅ (NEW)
│   │   ├── PerceptionAgent.ts (Existing)
│   │   ├── VisionAgent.ts (Existing)
│   │   └── VisualizationAgent.ts (Existing)
│   ├── background.ts ✅ (Enhanced with proactive loop)
│   ├── types.ts ✅ (Added ActionableObjective, GeneratedWidget, StoredWidget)
│   └── ...
└── docs/
    └── PHASE_5_PROACTIVE_TOOL_GENERATION.md ✅ (This file)
```

## Summary

Phase 5 successfully implements **Proactive Tool Generation** by connecting three research paradigms:

- **GUM** provides strategic user understanding
- **JIT Objectives** translate beliefs into actionable needs  
- **Generative Interfaces** create concrete UI solutions

The system adheres to **Human-AI Interaction Guidelines** (G8, G17, G18), uses **multi-model orchestration** (Cursor 2.0 pattern), and runs autonomously in the background while giving users full control.

**Build Status**: ✅ Successful (webpack compiled with warnings about bundle size)

**Next Steps**: Implement UI panel for widget management and injection system.
