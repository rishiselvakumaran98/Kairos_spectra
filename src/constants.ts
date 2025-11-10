/**
 * KAIROS-SPECTRA Constants
 * Configuration values for the extension
 */

// ============================================================================
// Perception Agent Configuration
// ============================================================================

export const PERCEPTION_CONFIG = {
  // Struggle detection thresholds
  HESITATION_THRESHOLD_MS: 3000, // 3 seconds of no interaction
  REPETITIVE_MOVEMENT_THRESHOLD: 3, // 3+ movements between same elements
  RAPID_SWITCHING_THRESHOLD_MS: 500, // Switches within 500ms
  MIN_CONFIDENCE_THRESHOLD: 0.6, // Minimum confidence to fire event
  
  // Interaction buffer
  MAX_INTERACTION_BUFFER_SIZE: 100,
  INTERACTION_BUFFER_WINDOW_MS: 30000, // 30 seconds
  
  // Mouse movement tracking
  MOUSE_MOVEMENT_SAMPLE_RATE_MS: 100,
  SIGNIFICANT_MOVEMENT_THRESHOLD_PX: 20,
  
  // Scroll tracking
  SCROLL_VELOCITY_SAMPLE_RATE_MS: 100,
  RAPID_SCROLL_THRESHOLD: 1000, // px/s
  
  // Hover detection
  HOVER_THRESHOLD_MS: 1000, // 1 second hover
} as const;

// ============================================================================
// Data Agent Configuration
// ============================================================================

export const DATA_AGENT_CONFIG = {
  // Extraction strategies
  MAX_EXTRACTION_DEPTH: 5, // Max levels to traverse DOM
  MAX_ELEMENTS_TO_SCRAPE: 50,
  
  // Data type detection
  TABLE_MIN_ROWS: 2,
  TABLE_MIN_COLS: 2,
  NUMBER_THRESHOLD: 0.7, // 70% of content must be numeric
  
  // Performance
  EXTRACTION_TIMEOUT_MS: 5000,
  
  // Confidence scoring
  MIN_DATA_CONFIDENCE: 0.5,
} as const;

// ============================================================================
// Chrome Extension Configuration
// ============================================================================

export const EXTENSION_CONFIG = {
  // Message passing
  MESSAGE_TIMEOUT_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  
  // Storage
  STORAGE_QUOTA_BYTES: 5 * 1024 * 1024, // 5MB
  
  // UI
  OVERLAY_Z_INDEX: 999999,
} as const;

// ============================================================================
// Logging & Debugging
// ============================================================================

export const DEBUG = {
  ENABLED: true, // Set to false in production
  LOG_INTERACTIONS: true,
  LOG_STRUGGLES: true,
  LOG_DATA_EXTRACTION: true,
  VERBOSE: true,
} as const;

// ============================================================================
// Selectors for Data Scraping
// Common patterns for data visualization elements
// ============================================================================

export const DATA_ELEMENT_SELECTORS = {
  TABLES: [
    'table',
    '[role="table"]',
    '[role="grid"]',
    '.data-table',
    '.datatable',
  ],
  CHARTS: [
    'canvas',
    'svg',
    '[role="img"][aria-label*="chart"]',
    '[class*="chart"]',
    '[id*="chart"]',
    '.vega-embed',
    '.plotly',
    '.highcharts-container',
  ],
  LISTS: [
    'ul',
    'ol',
    '[role="list"]',
    '[role="listbox"]',
  ],
} as const;
