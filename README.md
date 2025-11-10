# KAIROS-SPECTRA

**Proactive, Mixed-Initiative Visual Analytics Assistant**

A research prototype exploring novel human-agent interaction for visual data exploration that solves the "brittleness vs. burden" tradeoff in autonomous agents.

## 🎯 Core Philosophy

Traditional autonomous agents are either:
- **Too brittle**: Fail on complex visual tasks (UINavBench, OS-Kairos)
- **Too burdensome**: Require constant step-by-step approval (COWPILOT)

KAIROS-SPECTRA creates a "thinking scaffold" for analysis by:
1. **Proactively detecting** when users struggle with data analysis
2. **Guiding users** through hierarchical exploration of the analytical design space
3. **Maintaining transparency** and user control (following Amershi et al. Guidelines for Human-AI Interaction)

## 📋 Project Status

### ✅ Phase 1: The "Sensing" Layer (COMPLETE)

**Built:** Nov 7-10, 2025

**Components:**
- ✅ **PerceptionAgent**: Monitors user interactions and detects struggle patterns
  - Prolonged hesitation detection
  - Repetitive movement between elements
  - Rapid switching behavior
- ✅ **DataAgent**: Extracts structured data from DOM elements
  - Table extraction
  - Chart metadata extraction
  - List and text data extraction
  - Confidence scoring for all extractions

**Key Features:**
- Non-intrusive passive monitoring
- Chrome message passing architecture (adapted from COWPILOT)
- Struggle detection with confidence scores (G11: transparency)
- Efficient event buffering with sliding window

### 🚧 Phase 2: The "Guiding" Layer (Nov 11-14)

**Planned Components:**
- OrchestratorAgent: Main controller managing UI and agent state
- Hierarchical Abstraction UI (inspired by FlowForge):
  - Level 1: Task Planning (analytical goals)
  - Level 2: Agent Assignment (visualization types)
  - Level 3: Refinement (iterative improvement)
- VisualizationAgent: Generates Vega-Lite specifications

### 🚧 Phase 3: The "Trust & Transparency" Layer (Nov 15-19)

**Planned Components:**
- Analytical Journey Map (inspired by BrowserGym's AgentXRay)
- Semantic Zooming for visualizations (inspired by FlowForge)
- Agent confidence indicators
- Visual grounding of data sources

### 🚧 Phase 4: Final Sprint & Study Prep (Nov 20-23)

**Planned:**
- In-situ Design Cards (inspired by FlowForge)
- User study packaging
- Performance optimization

## 🏗️ Architecture

```
KAIROS-SPECTRA/
├── src/
│   ├── agents/
│   │   ├── PerceptionAgent.ts    # User interaction monitoring
│   │   ├── DataAgent.ts           # Data extraction from DOM
│   │   └── (Future phases...)
│   ├── background.ts              # Extension service worker
│   ├── content.ts                 # Content script coordinator
│   ├── popup.ts                   # Extension popup UI
│   ├── injected.ts                # Page-level script
│   ├── types.ts                   # TypeScript definitions
│   ├── constants.ts               # Configuration values
│   └── utils.ts                   # Shared utilities
├── manifest.json                  # Chrome extension manifest
├── webpack.config.js              # Build configuration
└── package.json                   # Dependencies
```

## 🚀 Installation & Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Chrome (latest)

### Setup

1. **Install dependencies:**
```bash
cd KAIROS-SPECTRA
npm install
```

2. **Build the extension:**
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run dev
```

3. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `KAIROS-SPECTRA/dist` folder

4. **Test on a dashboard:**
   - Navigate to any webpage with data visualizations (tables, charts)
   - Open DevTools Console (F12)
   - Interact with data elements (hover, click, move mouse between charts)
   - Watch for struggle detection logs in console

### Development Tips

**Enable debug mode:** All debug logging is enabled by default in `src/constants.ts`:
```typescript
export const DEBUG = {
  ENABLED: true,
  LOG_INTERACTIONS: true,
  LOG_STRUGGLES: true,
  LOG_DATA_EXTRACTION: true,
  VERBOSE: true,
};
```

**Monitor agent activity:**
- Click the extension icon to see the popup with live stats
- Check DevTools console for detailed logs:
  - `[KAIROS-SPECTRA:Interaction]` - User interactions
  - `[KAIROS-SPECTRA:Struggle]` - Detected struggle events
  - `[KAIROS-SPECTRA:Data]` - Data extraction results

**Adjust struggle detection sensitivity:**

Edit `src/constants.ts`:
```typescript
export const PERCEPTION_CONFIG = {
  HESITATION_THRESHOLD_MS: 3000,      // Lower = more sensitive
  REPETITIVE_MOVEMENT_THRESHOLD: 3,    // Lower = more sensitive
  MIN_CONFIDENCE_THRESHOLD: 0.6,       // Lower = more detections
};
```

## 🧪 Testing Phase 1

### Test Scenario 1: Prolonged Hesitation

1. Navigate to a page with a data table
2. Hover over the table
3. Stop moving your mouse for 3+ seconds
4. Expected: Struggle event fires with type `prolonged_hesitation`

### Test Scenario 2: Repetitive Movement

1. Navigate to a page with multiple charts or tables
2. Click on one chart
3. Click on another chart
4. Repeat alternating clicks 3+ times
5. Expected: Struggle event fires with type `repetitive_movement`

### Verify Data Extraction

When a struggle event fires, check the console for:
```
==================================================
🎯 KAIROS-SPECTRA: Struggle Detected
==================================================
Pattern: repetitive_movement
Confidence: 85.0%
Elements involved: 2
Data extracted: 2

Extracted Data:
  1. Type: table, Confidence: 90.0%
     Data: { headers: [...], rows: [...] }
  2. Type: chart, Confidence: 65.0%
     Data: { chartType: 'bar', labels: [...] }
==================================================
```

## 📚 Theoretical Foundation

This prototype implements concepts from:

1. **ProactiveVA** (Zhao et al.): Help-needed event detection for visual analytics
2. **FlowForge** (Hao et al.): Hierarchical abstraction levels for analytical design
3. **COWPILOT**: Chrome extension architecture for web automation
4. **BrowserGym**: Agent observation and action spaces
5. **Amershi et al.**: Guidelines for Human-AI Interaction (especially G2, G9, G11, G17)

## 🔬 Research Goals

1. **Validate** struggle detection accuracy in real-world analysis tasks
2. **Measure** cognitive load reduction vs. step-by-step approval systems
3. **Explore** optimal balance between agent proactivity and user control
4. **Evaluate** user trust through transparency mechanisms

## 📝 Configuration Reference

### Perception Agent Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `HESITATION_THRESHOLD_MS` | 3000 | Time (ms) of inactivity before hesitation detected |
| `REPETITIVE_MOVEMENT_THRESHOLD` | 3 | Number of back-and-forth movements to trigger |
| `MIN_CONFIDENCE_THRESHOLD` | 0.6 | Minimum confidence to fire struggle event |
| `MAX_INTERACTION_BUFFER_SIZE` | 100 | Maximum interaction events stored |
| `INTERACTION_BUFFER_WINDOW_MS` | 30000 | Time window for interaction history |

### Data Agent Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MAX_EXTRACTION_DEPTH` | 5 | Maximum DOM levels to traverse |
| `MAX_ELEMENTS_TO_SCRAPE` | 50 | Maximum elements to extract per event |
| `TABLE_MIN_ROWS` | 2 | Minimum rows to classify as table |
| `TABLE_MIN_COLS` | 2 | Minimum columns to classify as table |
| `EXTRACTION_TIMEOUT_MS` | 5000 | Timeout for extraction operations |
| `MIN_DATA_CONFIDENCE` | 0.5 | Minimum confidence for data extraction |

## 🐛 Known Issues (Phase 1)

- TypeScript compilation warnings for Chrome API types (expected in development)
- Event listeners use type assertions (will be refined in Phase 2)
- Injected script not yet integrated with data extraction pipeline
- No UI overlay yet (Phase 2 feature)

## 🎓 Citation

If you use this code in your research, please cite:

```
@software{kairos-spectra-2025,
  title = {KAIROS-SPECTRA: Proactive Visual Analytics Assistant},
  author = {KAIROS Research Team},
  year = {2025},
  url = {https://github.com/[username]/KAIROS-SPECTRA}
}
```

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

This is a research prototype. For questions or collaboration:
- Open an issue on GitHub
- Contact: [Your Email]

---

**Built with:** TypeScript, Chrome Extension APIs, Vega-Lite  
**Inspired by:** ProactiveVA, FlowForge, COWPILOT, BrowserGym, OS-Kairos
