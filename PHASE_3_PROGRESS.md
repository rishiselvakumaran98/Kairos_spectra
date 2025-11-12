# Phase 3: Trust & Transparency Layer - Progress Report

**Date**: November 12, 2025  
**Status**: Partially Complete (2/5 core components implemented)  
**Branch**: `phase_v3`

---

## 🎯 Phase 3 Overview

**Goal**: Build user trust through transparency, explanations, and controllable automation.

**Research Foundation**:
- **G2 (Clarity)**: Clear communication of confidence and uncertainty
- **G6 (User Control)**: Give users control over automation
- **G11 (Transparency)**: Explain agent reasoning and decisions

**Inspired By**:
- FlowForge's in-situ design cards and semantic zooming
- BrowserGym's AgentXRay trace visualization
- ProactiveVA's transparency mechanisms

---

## ✅ Completed Components

### 1. ExplanationEngine Agent

**File**: `src/agents/ExplanationEngine.ts` (380 lines)

**Purpose**: Generate natural language explanations for all agent decisions to implement transparency (G11).

**Key Classes & Methods**:

#### **ExplanationEngine**
Main agent responsible for generating human-readable explanations.

##### Methods:

**`explainStruggleDetection(event: StruggleEvent, confidence: number): StruggleExplanation`**
- Explains why the system detected user confusion
- Analyzes interaction patterns:
  - **Prolonged Hesitation**: Pause duration and context
  - **Repetitive Movement**: Switch count between elements
  - **Rapid Switching**: Click frequency and element count
- Returns:
  - `summary`: One-line explanation (e.g., "You paused for 4s while viewing this data")
  - `details`: Full reasoning paragraph
  - `evidencePoints`: Array of observed behaviors (e.g., "3 switches between elements")
  - `confidence`: Confidence score (0-1)

**Example Output**:
```typescript
{
  summary: "You switched between 2 elements 5 times",
  details: "I detected you moving back and forth between 2 different elements 5 times. This typically suggests you're comparing information or looking for patterns across the data.",
  confidence: 0.75,
  evidencePoints: [
    "5 switches between elements",
    "2 unique elements involved",
    "Pattern observed over 8s"
  ]
}
```

---

**`explainVizRecommendation(goal: string, vizType: string, data: ExtractedData[]): VizRecommendationExplanation`**
- Explains why a specific visualization was recommended
- Analyzes data characteristics (columns, rows, numeric fields)
- Maps analytical goals to appropriate chart types
- Returns:
  - `summary`: One-line reason (e.g., "Bar charts are ideal for comparing values across categories")
  - `details`: Detailed explanation paragraph
  - `reasoning.dataCharacteristics`: Array of data properties (e.g., "5 columns", "14 data points")
  - `reasoning.analyticalGoal`: What question this answers
  - `reasoning.alternatives`: Other chart types with reasons not chosen

**Supported Goals**:
- `compare_trends`: Compare values across categories
- `identify_outliers`: Find unusual/extreme values
- `show_distribution`: Understand value spread
- `explore_relationships`: Discover correlations

**Supported Viz Types**:
- `bar_chart`: Discrete category comparisons
- `line_chart`: Trends over time/sequential data
- `scatter_plot`: Relationships between numeric variables

**Example Output**:
```typescript
{
  summary: "Bar charts are ideal for comparing values across categories",
  details: "I recommended a bar chart because your data contains categorical information (Country/Territory) with numeric values that you want to compare. Bar charts make it easy to see which items are larger or smaller at a glance.",
  reasoning: {
    dataCharacteristics: [
      "Your data has 3 columns: Country/Territory, IMF(2025), GDP forecast",
      "14 data points available",
      "2 numeric column(s) suitable for quantitative comparison"
    ],
    analyticalGoal: "Compare values across categories to identify trends and patterns",
    alternatives: [
      "Line Chart: Better for showing changes over time",
      "Scatter Plot: Better for showing relationships between two variables"
    ]
  }
}
```

---

**`interpretChart(vizType: string, spec: any, data: ExtractedData[]): ChartInterpretation`**
- Generates insights from rendered visualizations
- Performs automatic data analysis:
  - Identifies highest/lowest values
  - Calculates averages and ranges
  - Detects trends (increasing/decreasing for line charts)
- Returns:
  - `summary`: Description of what the chart shows
  - `insights`: Array of key takeaways (max 4)
  - `context`: How to interpret the visualization

**Example Output**:
```typescript
{
  summary: "This bar chart shows IMF(2025)[6] across 14 Country/Territory",
  insights: [
    "Highest: United States (30.6K)",
    "Lowest: Mexico (1.9K)",
    "Range: 28.8K (avg: 6.5K)"
  ],
  context: "Use this chart to quickly compare values and identify the highest/lowest items. The length of each bar represents the magnitude."
}
```

---

**Helper Methods**:
- `calculateHesitationDuration()`: Computes pause time from interaction history
- `calculateSwitchCount()`: Counts element switches in repetitive movement
- `calculateAvgTimeBetweenClicks()`: Average click interval for rapid switching
- `formatNumber()`: Human-readable numbers (e.g., "30.6K", "1.2M")

---

### 2. TrustIndicatorUI Component

**File**: `src/ui/TrustIndicatorUI.ts` (360 lines)  
**File**: `src/content.css` (added 450+ lines of Phase 3 styles)

**Purpose**: Visual components to display trust indicators, confidence scores, and data provenance.

**Key Classes & Methods**:

#### **TrustIndicatorUI**

##### Configuration:
```typescript
interface TrustIndicatorConfig {
  showConfidenceBadges: boolean;    // Default: true
  showDataSources: boolean;          // Default: true
  showReasoningTrail: boolean;       // Default: true
  expandByDefault: boolean;          // Default: false
}
```

##### Methods:

**`createConfidenceBadge(confidence: number, label: string): HTMLElement`**
- Creates color-coded confidence badges
- **Color Scheme**:
  - **High (≥75%)**: Green gradient (#10b981 → #059669)
  - **Medium (50-74%)**: Yellow gradient (#f59e0b → #d97706)
  - **Low (<50%)**: Red gradient (#ef4444 → #dc2626)
- Visual elements:
  - Progress bar showing percentage
  - Numeric percentage display
  - Tooltip with confidence explanation
- Implements **G2 (Clarity)** by making confidence levels visually distinct

**HTML Structure**:
```html
<div class="kairos-trust-badge kairos-trust-badge-high">
  <div class="kairos-trust-badge-content">
    <div class="kairos-trust-badge-label">DETECTION CONFIDENCE</div>
    <div class="kairos-trust-badge-score">
      <div class="kairos-trust-badge-bar">
        <div class="kairos-trust-badge-fill" style="width: 85%"></div>
      </div>
      <span class="kairos-trust-badge-percentage">85%</span>
    </div>
  </div>
</div>
```

---

**`createDataSourceIndicator(sourceType: string, sourceDescription: string, elementSelector?: string): HTMLElement`**
- Shows where data came from (data provenance)
- Displays source icon based on type:
  - 📋 Table
  - 📊 Chart
  - 📝 List
  - 📄 Text
- Optional "Highlight Source" button with functionality
- When clicked, highlights the source element on the page for 3 seconds
- Implements **G11 (Transparency)** by grounding data in visible page elements

**HTML Structure**:
```html
<div class="kairos-trust-source">
  <div class="kairos-trust-source-content">
    <span class="kairos-trust-source-icon">📋</span>
    <div class="kairos-trust-source-text">
      <div class="kairos-trust-source-label">Data Source</div>
      <div class="kairos-trust-source-desc">Table with 14 rows and 3 columns</div>
    </div>
    <button class="kairos-trust-source-highlight-btn" title="Highlight source">🔍</button>
  </div>
</div>
```

---

**`createStruggleExplanationCard(explanation: StruggleExplanation): HTMLElement`**
- Expandable card showing why struggle was detected
- Components:
  - Header with brain icon 🧠 and confidence badge
  - Summary (always visible)
  - Expandable details section with:
    - Full reasoning paragraph
    - Evidence list (bullet points)
  - Toggle button ("▼ Show More" / "▲ Show Less")
- Implements **G11 (Transparency)** by explaining detection reasoning

**Visual Design**:
- White background with subtle shadow
- Confidence badge in header (color-coded)
- Expandable details with smooth animation
- Evidence section with light gray background

---

**`createVizExplanationCard(explanation: VizRecommendationExplanation): HTMLElement`**
- Expandable card explaining visualization recommendation
- Components:
  - Header with chart icon 📊
  - Summary (always visible)
  - Expandable sections:
    - **📈 Your Data**: Data characteristics list
    - **🎯 Analytical Goal**: What question this answers
    - **🔄 Other Options**: Alternative visualizations
  - Toggle button
- Implements **G11 (Transparency)** by justifying chart selection

---

**`createChartInterpretationPanel(interpretation: ChartInterpretation): HTMLElement`**
- Golden-highlighted panel with chart insights
- Components:
  - Lightbulb icon 💡 header
  - Summary description
  - Key insights list (max 4 items with arrow bullets)
  - Context/guidance section
- Visual Design:
  - Yellow gradient background (#fef3c7 → #fde68a)
  - White insight cards
  - Orange arrow bullets
- Helps users understand what the chart reveals

**Example**:
```
💡 What This Chart Shows
━━━━━━━━━━━━━━━━━━━━━━
This bar chart shows GDP across 14 countries

Key Insights:
→ Highest: United States (30.6K)
→ Lowest: Mexico (1.9K)
→ Range: 28.8K (avg: 6.5K)

💬 Use this chart to quickly compare values and identify 
the highest/lowest items. The length of each bar represents 
the magnitude.
```

---

**`createReasoningTrail(steps: Array<{label: string; confidence?: number}>): HTMLElement`**
- Breadcrumb-style decision trail showing agent's reasoning path
- Visual elements:
  - Numbered steps (1, 2, 3...) in purple gradient circles
  - Step labels
  - Optional confidence scores per step
  - Arrows (→) between steps
- Implements **G11 (Transparency)** by revealing decision sequence

**Example**:
```
Agent Decision Path:
━━━━━━━━━━━━━━━━━━━
① Detected hesitation (80%) → ② Extracted table data (90%) → 
③ Recommended bar chart (75%) → ④ Generated visualization (100%)
```

---

**Helper Methods**:
- `getConfidenceLevel(confidence: number)`: Returns 'high' | 'medium' | 'low'
- `getConfidenceExplanation(level, percentage)`: Tooltip text for badges
- `getSourceIcon(sourceType)`: Emoji for data source type
- `highlightSourceElement(selector)`: Highlights element on page with animation

---

### CSS Styling (content.css additions)

**450+ lines of Phase 3 styles** including:

#### Confidence Badges
- `.kairos-trust-badge`: Container with border and padding
- `.kairos-trust-badge-bar`: Progress bar background
- `.kairos-trust-badge-fill`: Animated gradient fill (green/yellow/red)
- `.kairos-trust-badge-percentage`: Bold percentage text
- `.kairos-trust-badge-mini`: Inline badge variant

#### Data Source Indicators
- `.kairos-trust-source`: Blue-accented container
- `.kairos-trust-source-highlight-btn`: Blue button with hover effect
- `.kairos-trust-source-highlight`: Pulsing outline animation for highlighted elements
- `@keyframes pulse-highlight`: 1s pulse animation

#### Explanation Cards
- `.kairos-trust-explanation-card`: White card with shadow
- `.kairos-trust-explanation-details`: Expandable section (max-height animation)
- `.kairos-trust-evidence`: Gray evidence box
- `.kairos-trust-toggle-details`: Full-width toggle button

#### Chart Interpretation
- `.kairos-trust-interpretation-panel`: Golden gradient background
- `.kairos-trust-insights-list`: Custom arrow bullets (→)
- `.kairos-trust-interpretation-context`: Italic guidance text

#### Reasoning Trail
- `.kairos-trust-reasoning-trail`: Dashed border container
- `.kairos-trust-trail-step`: Pill-shaped step containers
- `.kairos-trust-trail-number`: Purple gradient circle badges
- `.kairos-trust-trail-arrow`: Gray arrows between steps

**Design System Consistency**:
- Uses existing KAIROS-SPECTRA color palette
- Matches purple gradient theme (#667eea → #764ba2)
- Consistent border radius (6-12px)
- Smooth transitions (0.2-0.3s)

---

## 📊 Implementation Statistics

| Component | Lines of Code | Key Features |
|-----------|--------------|--------------|
| ExplanationEngine.ts | 380 | 3 explanation methods, 4 helper methods |
| TrustIndicatorUI.ts | 360 | 5 UI creation methods, 4 helper methods |
| content.css (Phase 3) | 450+ | 50+ CSS classes, 2 animations |
| **Total** | **1,190+** | **Core trust & transparency infrastructure** |

---

## 🔬 Technical Highlights

### 1. **Explanation Generation Algorithm**

The ExplanationEngine uses pattern matching to generate contextual explanations:

```typescript
// Pattern: Prolonged Hesitation
const hesitationDuration = calculateHesitationDuration(interactionHistory);
summary = `You paused for ${Math.round(hesitationDuration / 1000)}s while viewing this data`;

// Pattern: Repetitive Movement  
const switchCount = calculateSwitchCount(interactionHistory);
summary = `You switched between ${involvedElements.length} elements ${switchCount} times`;
```

### 2. **Confidence Categorization**

Three-tier confidence system for clarity:

```typescript
getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.75) return 'high';    // Green
  if (confidence >= 0.5) return 'medium';   // Yellow
  return 'low';                              // Red
}
```

### 3. **Data Analysis for Insights**

Automatic chart interpretation:

```typescript
// Find extremes
const maxValue = Math.max(...yValues);
const minValue = Math.min(...yValues);

// Detect trends (line charts)
const increasing = yValues.slice(1).every((v, i) => v >= yValues[i]);
const decreasing = yValues.slice(1).every((v, i) => v <= yValues[i]);
```

### 4. **Source Highlighting**

Visual grounding with smooth animation:

```typescript
highlightSourceElement(selector: string): void {
  const element = document.querySelector(selector);
  element.classList.add('kairos-trust-source-highlight');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Auto-remove after 3s
  setTimeout(() => element.classList.remove('...'), 3000);
}
```

---

## 🎨 Visual Design Principles

### Color Coding for Confidence
- **Green (#10b981)**: High confidence (≥75%) - "I'm quite certain"
- **Yellow (#f59e0b)**: Medium confidence (50-74%) - "I think this is right"
- **Red (#ef4444)**: Low confidence (<50%) - "This is my best guess"

### Information Hierarchy
1. **Always Visible**: Summaries, high-level insights
2. **Expandable**: Detailed reasoning, evidence, alternatives
3. **On-Demand**: Source highlighting, reasoning trails

### Progressive Disclosure
- Default collapsed state (avoid information overload)
- Clear toggle buttons with state indicators (▼/▲)
- Smooth animations (0.3s max-height transition)

---

## 🧪 Research Alignment

### G2 (Clarity) - Achieved ✅
- **Confidence badges** with color coding and percentages
- **Progress bars** for visual confidence representation
- **Clear explanations** in plain language (no jargon)
- **Tooltips** for additional context

### G11 (Transparency) - Achieved ✅
- **Struggle explanations** with evidence points
- **Viz recommendations** with reasoning and alternatives
- **Data source indicators** with highlighting
- **Reasoning trails** showing decision sequence
- **Chart interpretations** explaining what the data shows

### G6 (User Control) - Partial 🟡
- **Expandable sections** (user controls information depth)
- **Optional highlighting** (user triggers source grounding)
- **Pending**: Auto-generate toggle, pause/resume, undo/redo (Task 4)

---

## 📋 Pending Components (Not Yet Implemented)

### 3. AnalyticalJourneyMap Component
**Purpose**: Timeline visualization of entire analytical session

**Planned Features**:
- Chronological event timeline (struggles, decisions, refinements)
- Zoomable/scrollable interface
- Replay functionality
- Event filtering (show only struggles, only viz changes, etc.)
- Inspired by BrowserGym's AgentXRay

**Files to Create**:
- `src/ui/AnalyticalJourneyMap.ts`
- CSS additions for timeline visualization

---

### 4. Controllable Automation Features
**Purpose**: Give users control over agent behavior (G6)

**Planned Features**:
- **Auto-generate toggle**: Automatic vs manual chart generation
- **Pause/resume button**: Temporarily disable perception monitoring
- **Undo/redo**: Revert visualization changes
- **Save/export**: Download charts as PNG/SVG
- **Settings panel**: Configure thresholds and preferences

**Integration Points**:
- Add controls to HierarchicalGuidanceUI header
- Wire up to PerceptionAgent (pause/resume)
- Wire up to VisualizationAgent (undo/redo)
- Add browser storage for user preferences

---

### 5. Integration with Existing UI
**Purpose**: Connect Phase 3 components to Phase 2's HierarchicalGuidanceUI

**Required Changes**:

**In OrchestratorAgent**:
- Instantiate ExplanationEngine
- Generate explanations at each state transition
- Pass explanations to UI

**In HierarchicalGuidanceUI**:
- Add TrustIndicatorUI instance
- Display confidence badges in headers
- Show explanation cards in Level 1 (Task Planning)
- Show viz explanation in Level 2 (Viz Selection)
- Show chart interpretation in Level 3 (Refinement)
- Add "View Journey" button to open AnalyticalJourneyMap

**Example Integration**:
```typescript
// In showTaskPlanningUI()
const struggleExplanation = this.explanationEngine.explainStruggleDetection(
  event, 
  event.pattern.confidence
);
const explanationCard = this.trustIndicatorUI.createStruggleExplanationCard(
  struggleExplanation
);
uiContainer.appendChild(explanationCard);
```

---

## 🚧 Current Limitations

1. **No Integration Yet**: Components exist but aren't wired into the UI
2. **No Journey Map**: Timeline visualization not implemented
3. **No User Controls**: Can't pause/resume or undo yet
4. **Static Explanations**: No LLM integration (template-based)
5. **No Persistence**: Settings and journey history not saved

---

## 🎯 Next Steps (Priority Order)

### Immediate (Required for MVP)
1. **[CRITICAL] Integration** (Task 5)
   - Wire ExplanationEngine into OrchestratorAgent
   - Add TrustIndicatorUI to HierarchicalGuidanceUI
   - Display explanations at each level
   - Estimated: 3-4 hours

2. **[HIGH] User Controls** (Task 4)
   - Auto-generate toggle
   - Pause/resume perception
   - Undo/redo viz changes
   - Estimated: 2-3 hours

### Nice-to-Have (For Full Phase 3)
3. **[MEDIUM] AnalyticalJourneyMap** (Task 3)
   - Timeline UI component
   - Event tracking and storage
   - Replay functionality
   - Estimated: 4-5 hours

4. **[LOW] Advanced Features**
   - Save/export charts
   - Settings panel
   - LLM-powered explanations
   - Estimated: 3-4 hours

---

## 📁 File Structure

```
KAIROS-SPECTRA/
├── src/
│   ├── agents/
│   │   ├── ExplanationEngine.ts          ← ✅ NEW (Phase 3)
│   │   ├── PerceptionAgent.ts            (Phase 1)
│   │   ├── DataAgent.ts                  (Phase 1)
│   │   ├── VisionAgent.ts                (Phase 1)
│   │   ├── OrchestratorAgent.ts          (Phase 2)
│   │   └── VisualizationAgent.ts         (Phase 2)
│   ├── ui/
│   │   ├── TrustIndicatorUI.ts           ← ✅ NEW (Phase 3)
│   │   ├── HierarchicalGuidanceUI.ts     (Phase 2)
│   │   └── AnalyticalJourneyMap.ts       ← ⏳ PENDING (Phase 3)
│   ├── content.css                       ← ✅ UPDATED (Phase 3 styles)
│   ├── content.ts                        (Main orchestration)
│   └── types.ts                          (Shared types)
├── PHASE_3_PROGRESS.md                   ← ✅ THIS FILE
├── TESTING_PHASE_3.md                    ← ⏳ TO BE CREATED
└── PHASE_3_IMPLEMENTATION.md             ← ⏳ TO BE CREATED
```

---

## 💡 Usage Examples (Once Integrated)

### Example 1: Struggle Detection with Explanation

```typescript
// User hovers over table repeatedly (4 times)
// PerceptionAgent detects struggle

// OrchestratorAgent calls ExplanationEngine
const explanation = explanationEngine.explainStruggleDetection(
  struggleEvent,
  0.75
);

// HierarchicalGuidanceUI displays explanation card
const card = trustIndicatorUI.createStruggleExplanationCard(explanation);

// User sees:
// ┌────────────────────────────────────────┐
// │ 🧠 Why I Detected This          [75%]  │
// ├────────────────────────────────────────┤
// │ You switched between 2 elements 4 times│
// │                                        │
// │ ▼ Show More                            │
// └────────────────────────────────────────┘
```

### Example 2: Viz Recommendation with Reasoning

```typescript
// User selects "Compare Trends" goal
// OrchestratorAgent recommends bar chart

const vizExplanation = explanationEngine.explainVizRecommendation(
  'compare_trends',
  'bar_chart',
  extractedData
);

const card = trustIndicatorUI.createVizExplanationCard(vizExplanation);

// User sees:
// ┌────────────────────────────────────────┐
// │ 📊 Why This Visualization?             │
// ├────────────────────────────────────────┤
// │ Bar charts are ideal for comparing     │
// │ values across categories               │
// │                                        │
// │ ▼ Show More                            │
// │   📈 Your Data:                        │
// │   • 3 columns: Country, GDP, Region    │
// │   • 14 data points available           │
// │   • 2 numeric columns                  │
// │                                        │
// │   🎯 Analytical Goal:                  │
// │   Compare values across categories     │
// │                                        │
// │   🔄 Other Options:                    │
// │   • Line Chart: Better for time series │
// └────────────────────────────────────────┘
```

### Example 3: Chart Interpretation

```typescript
// Chart rendered successfully
// VisualizationAgent generates interpretation

const interpretation = explanationEngine.interpretChart(
  'bar',
  vegaLiteSpec,
  extractedData
);

const panel = trustIndicatorUI.createChartInterpretationPanel(interpretation);

// User sees:
// ┌────────────────────────────────────────┐
// │ 💡 What This Chart Shows               │
// ├────────────────────────────────────────┤
// │ This bar chart shows GDP across 14     │
// │ countries                              │
// │                                        │
// │ Key Insights:                          │
// │ → Highest: United States (30.6K)       │
// │ → Lowest: Mexico (1.9K)                │
// │ → Range: 28.8K (avg: 6.5K)             │
// │                                        │
// │ 💬 Use this chart to quickly compare   │
// │    values and identify highest/lowest  │
// └────────────────────────────────────────┘
```

---

## 🏆 Success Criteria (For Phase 3 MVP)

### Functional Requirements ✅/⏳
- [x] Generate struggle explanations with evidence
- [x] Generate viz recommendations with alternatives
- [x] Generate chart interpretations with insights
- [x] Display confidence badges (color-coded)
- [x] Show data source indicators
- [x] Expandable explanation cards
- [x] Highlight source elements on demand
- [ ] Integrate with existing UI (Task 5)
- [ ] Add pause/resume control (Task 4)
- [ ] Add undo/redo functionality (Task 4)

### Non-Functional Requirements
- [ ] Explanations are clear and jargon-free (User testing needed)
- [ ] Confidence scores are accurate (Validation needed)
- [ ] UI is responsive and accessible (Testing needed)
- [ ] Performance: <500ms to generate explanation

### Research Goals (G2, G6, G11)
- [x] **G2 (Clarity)**: Implemented via confidence badges and clear language
- [ ] **G6 (User Control)**: Partially implemented (pending pause/undo)
- [x] **G11 (Transparency)**: Implemented via explanations and data source grounding

---

## 📝 Notes for Future Development

### Potential Enhancements
1. **LLM Integration**: Use GPT-4/Claude for richer explanations
2. **Personalization**: Learn user preferences for explanation detail level
3. **A/B Testing**: Test different explanation phrasings
4. **Accessibility**: Add ARIA labels, keyboard navigation
5. **Multilingual**: Support explanations in multiple languages

### Known Issues
- None currently (components not yet integrated)

### Dependencies
- Phase 1 (PerceptionAgent, DataAgent) ✅
- Phase 2 (OrchestratorAgent, HierarchicalGuidanceUI) ✅
- Vega-Lite spec structure (for chart interpretation) ✅

---

## 🎓 Research Contributions

This implementation directly addresses gaps identified in prior work:

1. **ProactiveVA** (Zhao et al.): Added missing transparency layer
2. **FlowForge** (Wang et al.): Implemented in-situ explanations and confidence indicators
3. **BrowserGym** (AgentXRay): Planned journey map visualization

**Novel Contributions**:
- **Three-tier confidence visualization** (green/yellow/red)
- **Data source highlighting** with smooth scroll-to animation
- **Automatic chart interpretation** with insights generation
- **Alternative recommendations** (not just "what" but "why not others")

---

**End of Progress Report**

*For testing procedures, see `TESTING_PHASE_3.md`*  
*For full implementation details, see `PHASE_3_IMPLEMENTATION.md`*  
*For Phase 2 context, see `PHASE_2_SUMMARY.md`*
