# Chart Analysis Mode - Implementation Guide

## Overview

KAIROS-SPECTRA now has **two distinct workflows** based on user context:

1. **Chart Analysis Mode** - For EXISTING charts/visualizations (NEW ✨)
2. **Chart Creation Mode** - For generating NEW charts from table data (Existing)

This separation ensures users get the right assistance based on their intent.

---

## The Problem

**Before:**
- User struggling with existing bar chart on Voyager
- System detected chart via vision but then showed chart type options (Histogram, Box Plot, etc.)
- User wanted **help understanding** the chart, not creating a new one
- Confusing UX - agent asking user to define what they're already looking at

**User's Request:**
> "I don't want the agent to give all these chart options for inference... I want the agent to instead give the user an option to snip (take screenshot) of the specific chart they are analyzing in the screen and allow the agent to infer using GPT 4V and the contextual information from general UI to give further Analysis information to the user."

---

## The Solution

### Intelligent Workflow Bifurcation

The `OrchestratorAgent` now detects user intent at the entry point:

```typescript
// In startHierarchicalGuidance()
const hasVisionChartData = extractionResult.extractedData.some(
  (d) => d.type === 'chart' || (d.data as any).extractedVia === 'vision'
);
const hasTableData = extractionResult.extractedData.some((d) => d.type === 'table');

// Route 1: EXISTING chart detected → Chart Analysis Mode
if (hasVisionChartData && !hasTableData) {
  await this.showChartAnalysisMode(extractionResult);
  return;
}

// Route 2: Table data detected → Chart Creation Mode (standard flow)
// ... continue with task planning UI ...
```

---

## Chart Analysis Mode Features

### 1. **Initial Analysis UI**

When user struggles with an existing chart, they see:

```
┌─────────────────────────────────────────────┐
│ 📊 Chart Analysis Assistant             × │
├─────────────────────────────────────────────┤
│ 👁️ I see you're looking at a bar chart    │
│    showing Origin vs Cylinders vs           │
│    Mean Acceleration                        │
├─────────────────────────────────────────────┤
│ How can I help you understand this chart?  │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ✂️ Snip & Analyze Chart             │   │
│ │ Take a screenshot of the specific    │   │
│ │ area you want analyzed               │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ or ask me directly:                        │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ E.g., "What trends do you see?"     │   │
│ │ or "Which category has highest      │   │
│ │ value?"                             │   │
│ └─────────────────────────────────────┘   │
│ [Ask →]                                    │
│                                             │
│ 💡 Suggested questions:                    │
│ [filter data] [export data] [compare]      │
└─────────────────────────────────────────────┘
```

### 2. **Snipping Mode** ✂️

User clicks "Snip & Analyze Chart":

1. Full-screen overlay appears with crosshair cursor
2. User clicks and drags to select chart region
3. System captures screenshot and crops to selection
4. GPT-4V analyzes the specific region
5. Returns: chartType, insights, trends, suggestions

**Snipping UI:**
```
┌─────────────────────────────────────────────┐
│ ✂️ Click and drag to select the chart area │
│ [Cancel (ESC)]                              │
└─────────────────────────────────────────────┘
[Crosshair cursor + selection rectangle]
```

### 3. **Chart Insights Display**

After analysis, user sees:

```
┌─────────────────────────────────────────────┐
│ 🔍 Chart Analysis Results                × │
├─────────────────────────────────────────────┤
│ Bar Chart Analysis                          │
│                                             │
│ 📊 Key Insights                            │
│ • Europe region shows highest mean         │
│   acceleration (18.69)                     │
│ • 6-cylinder engines are most common       │
│ • USA has widest cylinder distribution     │
│                                             │
│ 📈 Trends Detected                         │
│ • Acceleration decreases with more         │
│   cylinders                                │
│ • Regional patterns show manufacturing     │
│   preferences                              │
│                                             │
│ 💡 Suggestions                             │
│ • Filter by specific origin for detail     │
│ • Compare against displacement metric      │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Ask a follow-up question...         │   │
│ └─────────────────────────────────────┘   │
│ [Ask →]                                    │
└─────────────────────────────────────────────┘
```

### 4. **Conversational Follow-Up**

User can ask questions directly:

```
┌─────────────────────────────────────────────┐
│ 💬 Chart Assistant                      × │
├─────────────────────────────────────────────┤
│ You asked:                                  │
│ "Which origin has the fastest cars?"       │
│                                             │
│ Assistant:                                  │
│ Based on the chart, Europe has the highest │
│ mean acceleration (18.69), indicating      │
│ faster acceleration. USA is second at      │
│ 16.13, and Japan is third at 16.24.       │
│                                             │
│ 💡 You might also want to know:            │
│ [How does cylinder count affect this?]     │
│ [What's the sample size for each region?]  │
│                                             │
│ [✂️ Snip Another Area]                     │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Ask another question...             │   │
│ └─────────────────────────────────────┘   │
│ [Ask →]                                    │
└─────────────────────────────────────────────┘
```

---

## Technical Implementation

### New Methods in `OrchestratorAgent.ts`

1. **`showChartAnalysisMode()`** - Entry point for chart analysis
2. **`handleChartSnip()`** - Manages snipping workflow
3. **`handleChartQuestion()`** - Handles conversational Q&A

### New Methods in `HierarchicalGuidanceUI.ts`

1. **`showChartAnalysisUI()`** - Initial analysis interface with text input
2. **`showSnipMode()`** - Full-screen snipping overlay with canvas
3. **`showChartInsights()`** - Display analysis results
4. **`showThinking()`** - Loading state during GPT-4V analysis
5. **`showChatResponse()`** - Conversational response interface

### New Methods in `VisionAgent.ts`

1. **`analyzeChartSnippet()`** - Send cropped image to GPT-4V for analysis
2. **`answerChartQuestion()`** - Answer specific questions about chart
3. **`cropImage()`** - Crop screenshot to bounding box

---

## GPT-4V Prompts

### For Chart Snippet Analysis

```
You are an expert data analyst. Analyze this chart/visualization and provide:

1. Chart Type: What type of chart is this? (bar chart, line chart, scatter plot, etc.)
2. Key Insights: What are 3-5 key insights from this visualization?
3. Trends: What trends or patterns do you observe?
4. Suggestions: What additional analysis or questions would be valuable?

Format your response as JSON:
{
  "chartType": "...",
  "insights": ["...", "...", "..."],
  "trends": ["...", "...", "..."],
  "suggestions": ["...", "...", "..."]
}
```

### For Chart Question Answering

```
You are a helpful data analysis assistant. The user is looking at a [chartType] showing [dataDescription].

User's question: "[question]"

Please provide:
1. A clear, concise answer to their question based on what you see in the chart
2. 2-3 related follow-up questions they might want to ask

Format your response as JSON:
{
  "response": "Your answer here...",
  "followUpSuggestions": ["Question 1?", "Question 2?", "Question 3?"]
}
```

---

## User Experience Flow

### Scenario: User Analyzing Voyager Bar Chart

1. **Struggle Detection**
   - User hovers over bar chart
   - Clicks multiple times trying to understand data
   - PerceptionAgent detects struggle pattern

2. **Vision Analysis**
   - DataAgent extracts data (no table found)
   - VisionAgent analyzes screenshot → detects bar chart
   - ExtractedData: `type: 'chart'`, `extractedVia: 'vision'`

3. **Route to Chart Analysis Mode**
   - OrchestratorAgent checks: hasVisionChartData && !hasTableData
   - Routes to `showChartAnalysisMode()` instead of task planning

4. **User Options**
   - **Option A: Snip Chart**
     - Clicks "Snip & Analyze Chart"
     - Drags selection rectangle around chart
     - GPT-4V analyzes → insights displayed
   
   - **Option B: Ask Question**
     - Types "What trends do you see?"
     - GPT-4V answers based on chart image
     - Follow-up suggestions provided

5. **Iterative Exploration**
   - User asks follow-up questions
   - Can snip different areas if needed
   - Conversational interface maintains context

---

## Chart Creation Mode (Unchanged)

When user struggles with **table data**, the original flow continues:

1. Level 1: Task Planning (Compare Trends, Analyze Distribution, etc.)
2. Level 2: Viz Selection (Bar Chart, Line Chart, etc.)
3. Level 3: Refinement (Text input for customization)

**Detection:**
```typescript
if (hasTableData) {
  // Standard hierarchical guidance flow
  await hierarchicalGuidanceUI.showTaskPlanningUI(...);
}
```

---

## Key Differences

| Aspect | Chart Analysis Mode | Chart Creation Mode |
|--------|-------------------|-------------------|
| **Trigger** | Vision detects chart, no table | Table data found |
| **UI Flow** | Snip + Chat | Task → Viz Type → Refine |
| **User Goal** | Understand existing chart | Generate new chart |
| **Agent Role** | Data analyst/interpreter | Visualization generator |
| **Output** | Insights, trends, suggestions | Vega-Lite chart spec |
| **Interaction** | Conversational Q&A | Hierarchical menu |

---

## Testing Instructions

### Test Chart Analysis Mode

1. **Setup:**
   - Load Voyager in browser
   - Ensure KAIROS extension is active
   - Have OpenAI API key configured

2. **Trigger Struggle:**
   - Hover over bar chart (Origin vs Cylinders)
   - Click multiple times on chart area
   - Wait for struggle detection

3. **Verify Chart Analysis UI:**
   - Should see "Chart Analysis Assistant" header (not "KAIROS-SPECTRA")
   - Context message: "I see you're looking at a bar chart..."
   - Should see "Snip & Analyze Chart" button
   - Should see text input for questions

4. **Test Snipping:**
   - Click "Snip & Analyze Chart"
   - Full-screen overlay appears with crosshair
   - Drag rectangle around chart
   - Release mouse → analysis starts
   - Verify insights, trends, suggestions displayed

5. **Test Q&A:**
   - Type question: "What trends do you see?"
   - Click "Ask"
   - Verify thinking state appears
   - Verify answer displays in chat format
   - Verify follow-up suggestions appear

### Test Chart Creation Mode (Regression)

1. **Setup:**
   - Load test-dashboard.html with data table
   - Trigger struggle on table element

2. **Verify Standard Flow:**
   - Should see Level 1 Task Planning UI
   - Should see goal buttons (Compare Trends, etc.)
   - Clicking goal → Level 2 Viz Selection
   - Clicking viz type → Chart generation

---

## Future Enhancements

1. **Multi-turn Context Maintenance**
   - Store conversation history
   - Reference previous questions/answers
   - "As we discussed earlier..."

2. **Comparative Analysis**
   - Snip multiple charts
   - "Compare these two visualizations"
   - Side-by-side insights

3. **Export Insights**
   - Download analysis as markdown
   - Share insights with team
   - Generate report summaries

4. **Interactive Annotations**
   - Draw on chart during snipping
   - "What does this spike mean?"
   - Highlight specific data points

---

## Files Modified

- `src/agents/OrchestratorAgent.ts` - Added chart analysis routing and Q&A handlers
- `src/ui/HierarchicalGuidanceUI.ts` - Added 5 new UI methods for chart analysis
- `src/agents/VisionAgent.ts` - Added chart analysis and Q&A methods
- `src/content.css` - Added 300+ lines of styles for new UI components

**Build Size:** 2.41 MiB (minimal increase from previous 2.39 MiB)

---

## Summary

KAIROS-SPECTRA now **intelligently adapts** to user context:

- **Existing chart** → Conversational analysis with vision AI
- **Table data** → Hierarchical chart generation workflow

This solves the confusion where users analyzing charts were asked to select chart types, creating a much more natural and helpful experience.

The implementation maintains **backward compatibility** - all existing chart creation functionality works unchanged. The new chart analysis mode is an *additive* feature that activates only when appropriate.
