/**
 * KAIROS-SPECTRA Type Definitions
 * Phase 1: Perception & Data Layer
 * Phase 2: Guiding Layer
 */

// ============================================================================
// Perception Agent Types
// ============================================================================

/**
 * Raw user interaction event captured by DOM listeners
 */
export interface UserInteractionEvent {
  type: 'click' | 'mousemove' | 'scroll' | 'hover' | 'pause';
  timestamp: number;
  target: {
    element: string; // CSS selector
    tagName: string;
    classList: string[];
    textContent?: string;
    boundingRect: DOMRect;
  };
  position?: {
    x: number;
    y: number;
  };
  scrollVelocity?: number;
}

/**
 * Struggle detection patterns
 * Based on ProactiveVA (Zhao et al.) help-needed event detection
 */
export interface StrugglePattern {
  type: 'prolonged_hesitation' | 'repetitive_movement' | 'rapid_switching';
  confidence: number; // 0-1
  detectedAt: number;
  metadata: {
    duration?: number; // ms
    elementsPair?: [string, string]; // CSS selectors
    repeatCount?: number;
  };
}

/**
 * Struggle event fired when PerceptionAgent detects user difficulty
 * Implements G11 (transparency) - includes confidence score
 */
export interface StruggleEvent {
  id: string;
  pattern: StrugglePattern;
  interactionHistory: UserInteractionEvent[];
  involvedElements: HTMLElement[];
  context: {
    pageURL: string;
    timestamp: number;
  };
}

// ============================================================================
// Data Agent Types
// ============================================================================

/**
 * Type of data extracted from DOM elements
 */
export type DataType = 'table' | 'chart' | 'text' | 'number' | 'list' | 'unknown';

/**
 * Structured data extracted from a DOM element
 */
export interface ExtractedData {
  type: DataType;
  sourceElement: string; // CSS selector
  confidence: number; // 0-1, for G2 (clarity of confidence)
  data: any; // Flexible based on type
  schema?: {
    columns?: string[];
    rows?: number;
    fields?: { name: string; type: 'string' | 'number' | 'date' }[];
  };
}

/**
 * Result from DataAgent scraping operation
 */
export interface DataExtractionResult {
  struggleEventId: string;
  extractedData: ExtractedData[];
  timestamp: number;
  metadata: {
    elementsScraped: number;
    extractionDurationMs: number;
  };
}

// ============================================================================
// Message Types (Chrome Extension Communication)
// Adapted from COWPILOT's message passing architecture
// ============================================================================

export type MessageType =
  | 'INTERACTION_EVENT'
  | 'STRUGGLE_DETECTED'
  | 'DATA_EXTRACTION_REQUEST'
  | 'DATA_EXTRACTION_COMPLETE'
  | 'PERCEPTION_STATUS'
  | 'AGENT_STATE_UPDATE'
  | 'CAPTURE_SCREENSHOT';

export interface ChromeMessage<T = any> {
  type: MessageType;
  payload: T;
  timestamp: number;
  source: 'content' | 'background' | 'injected';
}

// ============================================================================
// Agent State
// ============================================================================

export interface PerceptionAgentState {
  isActive: boolean;
  monitoringStartedAt?: number;
  interactionBuffer: UserInteractionEvent[];
  lastStruggleDetection?: number;
  config: {
    hesitationThresholdMs: number;
    repetitiveMovementThreshold: number;
    minConfidenceThreshold: number;
  };
}

export interface DataAgentState {
  isActive: boolean;
  pendingExtractions: string[]; // struggle event IDs
  extractionHistory: Map<string, DataExtractionResult>;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// Phase 2: Orchestrator & Guidance Types
// Based on FlowForge (Hao et al.) hierarchical abstraction levels
// ============================================================================

/**
 * FlowForge-inspired hierarchical UI levels
 * Level 1: Task Planning (analytical goals)
 * Level 2: Agent Assignment (viz type selection)
 * Level 3: Agent Optimization (refinement loop)
 */
export type GuidanceLevel = 'TASK_PLANNING' | 'VIZ_SELECTION' | 'REFINEMENT';

/**
 * Analytical goals presented at Task Planning level
 */
export type AnalyticalGoal = 
  | 'compare_trends'
  | 'analyze_distribution'
  | 'find_outliers'
  | 'correlation_analysis'
  | 'custom';

/**
 * Visualization types for Agent Assignment level
 */
export type VizType = 
  | 'line_chart'
  | 'bar_chart'
  | 'scatter_plot'
  | 'histogram'
  | 'box_plot'
  | 'heatmap';

/**
 * OrchestratorAgent state machine
 */
export interface OrchestratorState {
  currentLevel: GuidanceLevel;
  extractionResult: DataExtractionResult | null;
  selectedGoal: AnalyticalGoal | null;
  selectedVizType: VizType | null;
  currentVizSpec: any | null; // Vega-Lite spec
  refinementHistory: string[];
  isUIVisible: boolean;
}

/**
 * Context inference for Level 1 UI
 * Smart messages based on extracted data
 */
export interface InferredContext {
  message: string; // e.g., "I see you're exploring a scatter plot..."
  dataElements: string[]; // e.g., ["Sales Table", "Profit Chart"]
  confidence: number;
}

/**
 * Refinement request from user at Level 3
 */
export interface RefinementRequest {
  userPrompt: string;
  currentSpec: any;
  originalData: ExtractedData[];
}
