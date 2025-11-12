# Phase 3 Testing Plan
**KAIROS-SPECTRA Trust & Transparency Layer**

---

## 🎯 Testing Objectives

1. **Verify Explanation Quality**: Ensure explanations are clear, accurate, and helpful
2. **Validate Confidence Scores**: Check confidence indicators match actual certainty
3. **Test Visual Components**: Confirm UI elements render correctly and are interactive
4. **Assess User Understanding**: Validate that transparency features build trust

---

## 📋 Test Suites

### Suite 1: ExplanationEngine Unit Tests

**Test File**: `tests/phase3/test_explanation_engine.ts`

#### Test 1.1: Struggle Detection Explanations

**Test Cases**:

| Pattern | Input | Expected Summary | Expected Evidence |
|---------|-------|------------------|-------------------|
| Prolonged Hesitation | 4s pause, 3 elements | "You paused for 4s while viewing this data" | ["3 interactions in the last 10s", "Hover activity on 3 data element(s)", "4s pause after last interaction"] |
| Repetitive Movement | 5 switches, 2 elements | "You switched between 2 elements 5 times" | ["5 switches between elements", "2 unique elements involved", "Pattern observed over Xs"] |
| Rapid Switching | 8 rapid clicks, 4 elements | "You rapidly clicked 8 times across multiple elements" | ["8 rapid clicks detected", "Average time between clicks: Xms", "4 different elements clicked"] |

**Test Code**:
```typescript
describe('ExplanationEngine - explainStruggleDetection', () => {
  let engine: ExplanationEngine;
  
  beforeEach(() => {
    engine = new ExplanationEngine();
  });
  
  it('should explain prolonged hesitation correctly', () => {
    const event: StruggleEvent = {
      id: 'test-1',
      pattern: {
        type: 'prolonged_hesitation',
        confidence: 0.8,
        detectedAt: Date.now(),
        metadata: { duration: 4000 }
      },
      interactionHistory: [
        { type: 'hover', timestamp: Date.now() - 4000, target: {...} },
        { type: 'hover', timestamp: Date.now() - 2000, target: {...} },
      ],
      involvedElements: [elem1, elem2, elem3],
      context: { pageURL: 'test', timestamp: Date.now() }
    };
    
    const explanation = engine.explainStruggleDetection(event, 0.8);
    
    expect(explanation.summary).toContain('paused for');
    expect(explanation.summary).toContain('4s');
    expect(explanation.confidence).toBe(0.8);
    expect(explanation.evidencePoints).toHaveLength(3);
    expect(explanation.evidencePoints[0]).toContain('interactions');
  });
});
```

---

#### Test 1.2: Viz Recommendation Explanations

**Test Cases**:

| Goal | Viz Type | Data | Expected Summary | Expected Alternatives |
|------|----------|------|------------------|----------------------|
| compare_trends | bar_chart | Table (3 cols, 14 rows, 2 numeric) | "Bar charts are ideal for comparing values" | ["Line Chart: Better for...", "Scatter Plot: Better for..."] |
| identify_outliers | scatter_plot | Table (4 cols, 20 rows, 3 numeric) | "Scatter plots reveal relationships" | [...] |
| show_distribution | histogram | List (100 numeric values) | "Histograms show value spread" | [...] |

**Test Code**:
```typescript
it('should explain bar chart recommendation for comparison goal', () => {
  const data: ExtractedData[] = [{
    type: 'table',
    sourceElement: 'table',
    confidence: 0.9,
    data: { headers: ['Country', 'GDP', 'Region'], rows: 14 },
    schema: {
      columns: ['Country', 'GDP', 'Region'],
      rows: 14,
      fields: [
        { name: 'Country', type: 'string' },
        { name: 'GDP', type: 'number' },
        { name: 'Region', type: 'string' }
      ]
    }
  }];
  
  const explanation = engine.explainVizRecommendation(
    'compare_trends',
    'bar_chart',
    data
  );
  
  expect(explanation.summary).toContain('Bar charts');
  expect(explanation.summary).toContain('comparing');
  expect(explanation.reasoning.dataCharacteristics).toContain(
    expect.stringContaining('3 columns')
  );
  expect(explanation.reasoning.analyticalGoal).toContain('Compare');
  expect(explanation.reasoning.alternatives).toHaveLength(2);
  expect(explanation.reasoning.alternatives[0]).toContain('Line Chart');
});
```

---

#### Test 1.3: Chart Interpretation

**Test Cases**:

| Viz Type | Data Values | Expected Summary | Expected Insights |
|----------|-------------|------------------|-------------------|
| bar | [{x: 'US', y: 30615}, {x: 'China', y: 19398}] | "This bar chart shows y across 2 x" | ["Highest: US (30.6K)", "Lowest: China (19.4K)", "Range: 11.2K"] |
| line | [{x: 1, y: 10}, {x: 2, y: 15}, {x: 3, y: 20}] | "This line chart shows..." | ["Highest: ...", "Lowest: ...", "Overall trend: Increasing ↗"] |

**Test Code**:
```typescript
it('should interpret bar chart with insights', () => {
  const spec = {
    mark: 'bar',
    encoding: { x: { field: 'country' }, y: { field: 'gdp' } },
    data: {
      values: [
        { country: 'United States', gdp: 30615 },
        { country: 'China', gdp: 19398 },
        { country: 'Germany', gdp: 5093 }
      ]
    }
  };
  
  const data: ExtractedData[] = [{
    type: 'table',
    sourceElement: 'table',
    confidence: 0.9,
    data: {},
    schema: { columns: ['country', 'gdp'], rows: 3 }
  }];
  
  const interpretation = engine.interpretChart('bar', spec, data);
  
  expect(interpretation.summary).toContain('bar chart');
  expect(interpretation.summary).toContain('gdp');
  expect(interpretation.insights).toContain(
    expect.stringContaining('Highest: United States')
  );
  expect(interpretation.insights).toContain(
    expect.stringContaining('Lowest: Germany')
  );
  expect(interpretation.context).toContain('compare');
});
```

---

### Suite 2: TrustIndicatorUI Component Tests

**Test File**: `tests/phase3/test_trust_indicator_ui.ts`

#### Test 2.1: Confidence Badge Rendering

**Test Cases**:

| Confidence | Expected Level | Expected Color | Expected Percentage |
|------------|----------------|----------------|---------------------|
| 0.85 | high | green (#10b981) | 85% |
| 0.65 | medium | yellow (#f59e0b) | 65% |
| 0.35 | low | red (#ef4444) | 35% |

**Test Code**:
```typescript
describe('TrustIndicatorUI - createConfidenceBadge', () => {
  let ui: TrustIndicatorUI;
  
  beforeEach(() => {
    ui = new TrustIndicatorUI();
  });
  
  it('should create high confidence badge (green)', () => {
    const badge = ui.createConfidenceBadge(0.85, 'Detection');
    
    expect(badge.classList.contains('kairos-trust-badge')).toBe(true);
    expect(badge.classList.contains('kairos-trust-badge-high')).toBe(true);
    expect(badge.textContent).toContain('85%');
    expect(badge.textContent).toContain('DETECTION');
    
    const fill = badge.querySelector('.kairos-trust-badge-fill') as HTMLElement;
    expect(fill.style.width).toBe('85%');
  });
  
  it('should create medium confidence badge (yellow)', () => {
    const badge = ui.createConfidenceBadge(0.65, 'Recommendation');
    
    expect(badge.classList.contains('kairos-trust-badge-medium')).toBe(true);
    expect(badge.textContent).toContain('65%');
  });
  
  it('should create low confidence badge (red)', () => {
    const badge = ui.createConfidenceBadge(0.35, 'Analysis');
    
    expect(badge.classList.contains('kairos-trust-badge-low')).toBe(true);
    expect(badge.textContent).toContain('35%');
  });
});
```

---

#### Test 2.2: Data Source Indicator

**Test Cases**:

| Source Type | Description | Selector Provided | Expected Icon | Expected Highlight Button |
|-------------|-------------|-------------------|---------------|---------------------------|
| table | "Table with 14 rows" | Yes | 📋 | Visible |
| chart | "Bar chart" | No | 📊 | Hidden |
| list | "Ordered list" | Yes | 📝 | Visible |

**Test Code**:
```typescript
it('should create data source indicator with highlight button', () => {
  const indicator = ui.createDataSourceIndicator(
    'table',
    'Table with 14 rows and 3 columns',
    'table.wikitable'
  );
  
  expect(indicator.classList.contains('kairos-trust-source')).toBe(true);
  expect(indicator.textContent).toContain('Table with 14 rows');
  expect(indicator.querySelector('.kairos-trust-source-icon')?.textContent).toBe('📋');
  
  const btn = indicator.querySelector('.kairos-trust-source-highlight-btn');
  expect(btn).not.toBeNull();
  expect(btn?.getAttribute('title')).toBe('Highlight source');
});

it('should hide highlight button when no selector provided', () => {
  const indicator = ui.createDataSourceIndicator('chart', 'Bar chart');
  
  const btn = indicator.querySelector('.kairos-trust-source-highlight-btn');
  expect(btn).toBeNull();
});
```

---

#### Test 2.3: Explanation Cards

**Test Cases**:

| Card Type | expandByDefault | Expected Initial State | After Click |
|-----------|----------------|------------------------|-------------|
| Struggle | false | Details hidden | Details visible |
| Viz | false | Details hidden | Details visible |
| Struggle | true | Details visible | Details hidden |

**Test Code**:
```typescript
it('should create expandable struggle explanation card', () => {
  const explanation: StruggleExplanation = {
    summary: 'You paused for 4s',
    details: 'I noticed you stopped...',
    confidence: 0.75,
    evidencePoints: ['3 interactions', '4s pause']
  };
  
  const card = ui.createStruggleExplanationCard(explanation);
  
  // Check structure
  expect(card.classList.contains('kairos-trust-explanation-card')).toBe(true);
  expect(card.textContent).toContain('You paused for 4s');
  expect(card.textContent).toContain('75%');
  
  // Check initial state (collapsed)
  const details = card.querySelector('.kairos-trust-explanation-details') as HTMLElement;
  expect(details.classList.contains('expanded')).toBe(false);
  
  // Click toggle
  const toggleBtn = card.querySelector('.kairos-trust-toggle-details') as HTMLButtonElement;
  toggleBtn.click();
  
  // Check expanded state
  expect(details.classList.contains('expanded')).toBe(true);
  expect(toggleBtn.textContent).toContain('Show Less');
  expect(card.textContent).toContain('I noticed you stopped');
  expect(card.textContent).toContain('3 interactions');
});
```

---

#### Test 2.4: Chart Interpretation Panel

**Test Code**:
```typescript
it('should create chart interpretation panel with insights', () => {
  const interpretation: ChartInterpretation = {
    summary: 'This bar chart shows GDP across 14 countries',
    insights: [
      'Highest: United States (30.6K)',
      'Lowest: Mexico (1.9K)',
      'Range: 28.8K (avg: 6.5K)'
    ],
    context: 'Use this chart to quickly compare values...'
  };
  
  const panel = ui.createChartInterpretationPanel(interpretation);
  
  expect(panel.classList.contains('kairos-trust-interpretation-panel')).toBe(true);
  expect(panel.textContent).toContain('This bar chart shows GDP');
  expect(panel.textContent).toContain('Highest: United States');
  expect(panel.textContent).toContain('Lowest: Mexico');
  expect(panel.textContent).toContain('Range: 28.8K');
  expect(panel.textContent).toContain('Use this chart to quickly compare');
  
  const insights = panel.querySelectorAll('.kairos-trust-insights-list li');
  expect(insights).toHaveLength(3);
});
```

---

### Suite 3: Integration Tests (Once Integrated)

**Test File**: `tests/phase3/test_integration.ts`

#### Test 3.1: End-to-End Explanation Flow

**Scenario**: User hovers over table → Struggle detected → Explanation shown

**Steps**:
1. Load Wikipedia GDP table page
2. Simulate 4 rapid hovers over table rows
3. Wait for struggle detection
4. Verify explanation card appears
5. Check explanation content

**Expected Results**:
- Explanation card visible in UI
- Summary mentions "switched" or "paused"
- Confidence badge shows 60-80%
- Evidence points list is populated
- Toggle button works

---

#### Test 3.2: Viz Recommendation with Explanation

**Scenario**: Struggle detected → Goal selected → Viz recommended with explanation

**Steps**:
1. Trigger struggle detection
2. Click "Compare Trends" goal
3. Verify viz explanation card appears
4. Check recommendation reasoning

**Expected Results**:
- Viz explanation card visible
- Summary explains why bar chart recommended
- Data characteristics section lists columns/rows
- Alternatives section shows line chart, scatter plot
- Expand/collapse works

---

#### Test 3.3: Chart Interpretation Display

**Scenario**: Chart generated → Interpretation shown automatically

**Steps**:
1. Generate bar chart from table data
2. Wait for chart render
3. Verify interpretation panel appears

**Expected Results**:
- Golden interpretation panel visible
- Summary describes chart type and data
- Insights show highest/lowest values
- Context provides interpretation guidance

---

### Suite 4: Visual Regression Tests

**Tool**: Percy.io or similar

**Test Cases**:

| Component | Viewport | State | Snapshot Name |
|-----------|----------|-------|---------------|
| Confidence Badge | Desktop | High (85%) | `confidence-badge-high` |
| Confidence Badge | Desktop | Medium (65%) | `confidence-badge-medium` |
| Confidence Badge | Desktop | Low (35%) | `confidence-badge-low` |
| Explanation Card | Desktop | Collapsed | `explanation-card-collapsed` |
| Explanation Card | Desktop | Expanded | `explanation-card-expanded` |
| Interpretation Panel | Desktop | With 3 insights | `interpretation-panel` |
| Data Source Indicator | Desktop | With highlight button | `data-source-indicator` |
| Reasoning Trail | Desktop | 4 steps | `reasoning-trail` |

---

### Suite 5: Accessibility Tests

**Test File**: `tests/phase3/test_accessibility.ts`

#### Test 5.1: Keyboard Navigation

**Test Cases**:
- [ ] Tab through explanation card should focus toggle button
- [ ] Enter on toggle button should expand/collapse
- [ ] Tab through reasoning trail should focus each step
- [ ] Escape should close expanded details

#### Test 5.2: Screen Reader Compatibility

**Test Cases**:
- [ ] Confidence badges have aria-label with percentage
- [ ] Explanation cards have proper heading structure
- [ ] Evidence lists are properly announced
- [ ] Toggle buttons announce expanded/collapsed state

#### Test 5.3: Color Contrast

**Test Cases**:
- [ ] Green badge text: WCAG AA compliant
- [ ] Yellow badge text: WCAG AA compliant
- [ ] Red badge text: WCAG AA compliant
- [ ] All text on golden background: WCAG AA compliant

**Tool**: axe-core or WAVE

---

### Suite 6: Performance Tests

**Test File**: `tests/phase3/test_performance.ts`

#### Test 6.1: Explanation Generation Speed

**Test Cases**:

| Method | Input Size | Max Time |
|--------|-----------|----------|
| explainStruggleDetection | 100 interactions | 50ms |
| explainVizRecommendation | 1000 row table | 100ms |
| interpretChart | 500 data points | 150ms |

**Test Code**:
```typescript
it('should generate struggle explanation in <50ms', async () => {
  const largeHistory: UserInteractionEvent[] = Array(100).fill({...});
  const event: StruggleEvent = {...};
  
  const start = performance.now();
  const explanation = engine.explainStruggleDetection(event, 0.8);
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(50);
  expect(explanation.summary).toBeDefined();
});
```

#### Test 6.2: UI Rendering Performance

**Test Cases**:
- [ ] Create 10 confidence badges: <100ms
- [ ] Create 5 explanation cards: <200ms
- [ ] Expand/collapse animation: smooth 60fps
- [ ] Highlight source element: <50ms

---

## 🧪 Manual Testing Checklist

### Test Session 1: Explanation Quality

**Page**: https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)

**Steps**:
1. [ ] Hover over table rows 4 times (trigger struggle)
2. [ ] Read struggle explanation
   - [ ] Is the summary clear and accurate?
   - [ ] Does the confidence level feel right?
   - [ ] Are evidence points helpful?
3. [ ] Click "▼ Show More"
   - [ ] Does animation work smoothly?
   - [ ] Is detailed explanation understandable?
4. [ ] Click "Compare Trends"
5. [ ] Read viz recommendation explanation
   - [ ] Is the reason for bar chart clear?
   - [ ] Are data characteristics accurate?
   - [ ] Do alternatives make sense?
6. [ ] Select "Bar Chart"
7. [ ] Read chart interpretation
   - [ ] Is summary accurate?
   - [ ] Are insights correct (highest/lowest/average)?
   - [ ] Is context helpful?

**Evaluation Criteria**:
- [ ] All explanations use plain language (no jargon)
- [ ] Confidence scores match subjective certainty
- [ ] Evidence is specific and verifiable
- [ ] Insights are accurate and useful

---

### Test Session 2: Visual Design

**Page**: Same Wikipedia page

**Steps**:
1. [ ] Check confidence badge colors
   - [ ] High (>75%): Green
   - [ ] Medium (50-75%): Yellow
   - [ ] Low (<50%): Red
2. [ ] Check data source indicator
   - [ ] Icon matches type (📋 for table)
   - [ ] Description is clear
   - [ ] Highlight button exists
3. [ ] Click highlight button
   - [ ] Blue outline appears on source table
   - [ ] Smooth scroll to element
   - [ ] Highlight fades after 3s
4. [ ] Check explanation card styling
   - [ ] White background, subtle shadow
   - [ ] Purple accent colors
   - [ ] Readable font sizes
5. [ ] Check interpretation panel
   - [ ] Golden gradient background
   - [ ] Arrow bullets visible
   - [ ] Clear visual hierarchy

**Evaluation Criteria**:
- [ ] All colors match design system
- [ ] Text is readable (good contrast)
- [ ] Animations are smooth
- [ ] Layout is clean and organized

---

### Test Session 3: Interaction

**Page**: Same Wikipedia page

**Steps**:
1. [ ] Expand/collapse explanation card
   - [ ] Toggle button text changes (▼/▲)
   - [ ] Animation is smooth (0.3s)
   - [ ] No layout jumping
2. [ ] Expand/collapse viz explanation
   - [ ] Same smooth behavior
3. [ ] Click highlight button multiple times
   - [ ] Previous highlight removes before new one
   - [ ] No duplicate highlights
4. [ ] Scroll page while explanation visible
   - [ ] Explanation stays in fixed position
   - [ ] No rendering glitches

**Evaluation Criteria**:
- [ ] All interactions feel responsive
- [ ] No janky animations
- [ ] UI state updates correctly

---

## 📊 Test Coverage Goals

| Category | Target Coverage |
|----------|----------------|
| ExplanationEngine methods | 90%+ |
| TrustIndicatorUI methods | 85%+ |
| CSS visual components | 100% (manual) |
| Integration flows | 75%+ |
| Accessibility | WCAG AA |
| Performance | <200ms all methods |

---

## 🐛 Known Issues to Test

1. **Number Formatting**: Test with very large numbers (>1B)
2. **Long Explanations**: Test with 10+ data characteristics
3. **Empty Data**: Test with 0 insights
4. **Multiple Source Highlights**: Ensure only one highlighted at a time
5. **Mobile Responsiveness**: Test on small screens (not yet optimized)

---

## 🚀 Regression Testing (After Integration)

Once Phase 3 is integrated with Phase 2, rerun:

- [ ] All Phase 1 tests (PerceptionAgent, DataAgent)
- [ ] All Phase 2 tests (OrchestratorAgent, HierarchicalGuidanceUI)
- [ ] New Phase 3 tests
- [ ] Build size check (<5MB total)
- [ ] Page load impact (<100ms slower)

---

## 📝 Test Results Template

```markdown
## Test Run: [Date]

**Tester**: [Name]  
**Environment**: Chrome [Version], macOS [Version]  
**Test Page**: [URL]

### Suite 1: ExplanationEngine
- [x] Test 1.1: Struggle Explanations - PASS
- [x] Test 1.2: Viz Explanations - PASS
- [ ] Test 1.3: Chart Interpretation - FAIL (see issues)

### Issues Found:
1. **Issue #1**: Chart interpretation missing average for line charts
   - Severity: Medium
   - Steps to Reproduce: Generate line chart, check insights
   - Expected: Average shown
   - Actual: Only trend shown
   
### Manual Testing:
- [x] Explanation Quality - PASS (clear and helpful)
- [x] Visual Design - PASS (matches design system)
- [x] Interaction - PASS (smooth animations)

### Overall: 90% Pass Rate
```

---

## 🎯 Success Criteria

Phase 3 is ready for user study when:

- [ ] All unit tests pass (>85% coverage)
- [ ] All visual regression tests pass
- [ ] Accessibility score: WCAG AA
- [ ] Performance: All methods <200ms
- [ ] Manual testing: No critical issues
- [ ] 3+ independent testers validate explanation quality
- [ ] Integration complete (wired into Phase 2 UI)

---

**End of Testing Plan**

*For implementation details, see `PHASE_3_PROGRESS.md`*  
*For integration guide, see `PHASE_3_IMPLEMENTATION.md` (to be created)*
