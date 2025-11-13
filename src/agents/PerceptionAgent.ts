/**
 * PerceptionAgent Module
 * 
 * Purpose: The "eyes" of KAIROS-SPECTRA. Passively monitors user interactions
 * and detects struggle patterns.
 * 
 * Inspired by ProactiveVA (Zhao et al.) - Help-needed event detection
 * Adapted from COWPILOT - Event listener and interaction tracking architecture
 * 
 * Key Features:
 * - Non-intrusive passive monitoring (G17: user control)
 * - Struggle detection with confidence scores (G11: transparency)
 * - Efficient event buffering with sliding window
 * 
 * Struggle Patterns Detected:
 * 1. Prolonged Hesitation: User pauses for extended period
 * 2. Repetitive Movement: Mouse moves back and forth between elements
 * 3. Rapid Switching: Quick navigation between different areas
 */

import type {
  UserInteractionEvent,
  StrugglePattern,
  StruggleEvent,
  PerceptionAgentState,
  Point,
} from '../types';
import {
  PERCEPTION_CONFIG,
} from '../constants';
import {
  logger,
  calculateDistance,
  getElementSelector,
  isDataElement,
  generateId,
  throttle,
  last,
  slidingWindow,
} from '../utils';

export class PerceptionAgent {
  private state: PerceptionAgentState;
  private lastMousePosition: Point | null = null;
  private lastInteractionTime: number = Date.now();
  private hesitationTimer: number | null = null;
  private elementInteractionMap: Map<string, number[]> = new Map();
  
  // Event listener references for cleanup
  private listeners: Map<string, EventListener> = new Map();
  
  // Callbacks for external modules
  private onStruggleDetectedCallback?: (event: StruggleEvent) => void;

  constructor() {
    this.state = {
      isActive: false,
      interactionBuffer: [],
      config: {
        hesitationThresholdMs: PERCEPTION_CONFIG.HESITATION_THRESHOLD_MS,
        repetitiveMovementThreshold: PERCEPTION_CONFIG.REPETITIVE_MOVEMENT_THRESHOLD,
        minConfidenceThreshold: PERCEPTION_CONFIG.MIN_CONFIDENCE_THRESHOLD,
      },
    };
    
    logger.info('PerceptionAgent', 'Initialized');
  }

  // ========================================================================
  // Public API
  // ========================================================================

  public start(onStruggleDetected?: (event: StruggleEvent) => void): void {
    if (this.state.isActive) {
      logger.warn('PerceptionAgent', 'Already active');
      return;
    }

    this.state.isActive = true;
    this.state.monitoringStartedAt = Date.now();
    this.onStruggleDetectedCallback = onStruggleDetected;
    
    this.attachEventListeners();
    this.startHesitationDetection();
    
    logger.info('PerceptionAgent', 'Started monitoring user interactions');
  }

  public stop(): void {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    this.detachEventListeners();
    this.stopHesitationDetection();
    
    logger.info('PerceptionAgent', 'Stopped monitoring');
  }

  /**
   * Temporarily pause struggle detection (e.g., while guidance UI is active)
   * Unlike stop(), this doesn't remove event listeners - just stops analysis
   */
  public pause(): void {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    this.stopHesitationDetection();
    
    logger.info('PerceptionAgent', 'Paused struggle detection');
  }

  /**
   * Resume struggle detection after pause
   */
  public resume(): void {
    if (this.state.isActive) {
      return; // Already active
    }

    this.state.isActive = true;
    this.startHesitationDetection();
    
    logger.info('PerceptionAgent', 'Resumed struggle detection');
  }

  public getState(): PerceptionAgentState {
    return { ...this.state };
  }

  /**
   * Get recent interactions for GUM learning
   * @param limit Maximum number of recent interactions to return
   */
  public getRecentInteractions(limit: number = 50): UserInteractionEvent[] {
    return this.state.interactionBuffer.slice(-limit);
  }

  public updateConfig(config: Partial<PerceptionAgentState['config']>): void {
    this.state.config = { ...this.state.config, ...config };
    logger.debug('PerceptionAgent', 'Config updated', this.state.config);
  }

  // ========================================================================
  // Event Listener Setup (adapted from COWPILOT)
  // ========================================================================

  private attachEventListeners(): void {
    // Mouse movement (throttled for performance)
    const mouseMoveListener = throttle(
      this.handleMouseMove.bind(this),
      PERCEPTION_CONFIG.MOUSE_MOVEMENT_SAMPLE_RATE_MS
    );
    document.addEventListener('mousemove', mouseMoveListener as EventListener);
    this.listeners.set('mousemove', mouseMoveListener as EventListener);

    // Clicks
    const clickListener = this.handleClick.bind(this) as EventListener;
    document.addEventListener('click', clickListener, true); // Use capture phase
    this.listeners.set('click', clickListener);

    // Scroll (throttled)
    const scrollListener = throttle(
      this.handleScroll.bind(this),
      PERCEPTION_CONFIG.SCROLL_VELOCITY_SAMPLE_RATE_MS
    );
    document.addEventListener('scroll', scrollListener as EventListener, true);
    this.listeners.set('scroll', scrollListener as EventListener);

    // Hover detection (mouseenter on data elements)
    const hoverListener = this.handleHover.bind(this) as EventListener;
    document.addEventListener('mouseenter', hoverListener, true);
    this.listeners.set('mouseenter', hoverListener);

    logger.debug('PerceptionAgent', 'Event listeners attached');
  }

  private detachEventListeners(): void {
    this.listeners.forEach((listener, eventType) => {
      document.removeEventListener(eventType, listener, true);
    });
    this.listeners.clear();
    logger.debug('PerceptionAgent', 'Event listeners detached');
  }

  // ========================================================================
  // Event Handlers
  // ========================================================================

  private handleMouseMove(event: MouseEvent): void {
    const currentPosition: Point = { x: event.clientX, y: event.clientY };
    
    // Ignore interactions with KAIROS UI elements to prevent infinite loops
    if (this.shouldIgnoreElement(event.target as HTMLElement)) {
      return;
    }
    
    // Check for significant movement
    if (this.lastMousePosition) {
      const distance = calculateDistance(this.lastMousePosition, currentPosition);
      
      if (distance > PERCEPTION_CONFIG.SIGNIFICANT_MOVEMENT_THRESHOLD_PX) {
        this.recordInteraction({
          type: 'mousemove',
          timestamp: Date.now(),
          target: this.extractTargetInfo(event.target as HTMLElement),
          position: currentPosition,
        });
        
        // Reset hesitation timer on significant movement
        this.resetHesitationTimer();
      }
    }
    
    this.lastMousePosition = currentPosition;
    this.lastInteractionTime = Date.now();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Ignore interactions with KAIROS UI elements to prevent infinite loops
    if (this.shouldIgnoreElement(target)) {
      return;
    }
    
    this.recordInteraction({
      type: 'click',
      timestamp: Date.now(),
      target: this.extractTargetInfo(target),
      position: { x: event.clientX, y: event.clientY },
    });
    
    // Track clicks on data elements for repetitive pattern detection
    if (isDataElement(target)) {
      const selector = getElementSelector(target);
      const timestamps = this.elementInteractionMap.get(selector) || [];
      timestamps.push(Date.now());
      this.elementInteractionMap.set(selector, timestamps);
      
      logger.interaction('Click on data element', { selector });
      
      // Check for repetitive movement pattern
      this.detectRepetitiveMovement();
    }
    
    this.resetHesitationTimer();
    this.lastInteractionTime = Date.now();
  }

  private handleScroll(event: Event): void {
    const target = event.target as HTMLElement | Document | Window;
    
    // Scroll events on document/window don't provide useful target info
    if (target === document || target === window || !(target instanceof HTMLElement)) {
      return;
    }
    
    // Ignore interactions with KAIROS UI elements to prevent infinite loops
    if (this.shouldIgnoreElement(target)) {
      return;
    }
    
    this.recordInteraction({
      type: 'scroll',
      timestamp: Date.now(),
      target: this.extractTargetInfo(target),
    });
    
    this.resetHesitationTimer();
    this.lastInteractionTime = Date.now();
  }

  private handleHover(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Ignore interactions with KAIROS UI elements to prevent infinite loops
    if (this.shouldIgnoreElement(target)) {
      return;
    }
    
    if (isDataElement(target)) {
      this.recordInteraction({
        type: 'hover',
        timestamp: Date.now(),
        target: this.extractTargetInfo(target),
        position: { x: event.clientX, y: event.clientY },
      });
      
      logger.interaction('Hover on data element', { 
        element: target.tagName 
      });
    }
  }

  /**
   * Check if an element should be ignored (e.g., KAIROS UI elements)
   * This prevents infinite loops where interacting with guidance UI triggers new guidance
   */
  private shouldIgnoreElement(element: HTMLElement | null): boolean {
    if (!element) return false;
    
    // Check if element or any parent is the KAIROS UI container
    let current: HTMLElement | null = element;
    while (current) {
      // Check for KAIROS UI container ID
      if (current.id === 'kairos-spectra-ui') {
        return true;
      }
      
      // Check for KAIROS class prefixes
      if (current.classList) {
        for (const className of Array.from(current.classList)) {
          if (className.startsWith('kairos-')) {
            return true;
          }
        }
      }
      
      current = current.parentElement;
    }
    
    return false;
  }

  // ========================================================================
  // Interaction Recording & Buffer Management
  // ========================================================================

  private recordInteraction(event: UserInteractionEvent): void {
    // Add to buffer
    this.state.interactionBuffer.push(event);
    
    // Maintain buffer size
    const maxSize = PERCEPTION_CONFIG.MAX_INTERACTION_BUFFER_SIZE;
    if (this.state.interactionBuffer.length > maxSize) {
      this.state.interactionBuffer = this.state.interactionBuffer.slice(-maxSize);
    }
    
    // Clean old interactions (outside time window)
    const windowStart = Date.now() - PERCEPTION_CONFIG.INTERACTION_BUFFER_WINDOW_MS;
    this.state.interactionBuffer = this.state.interactionBuffer.filter(
      e => e.timestamp > windowStart
    );
    
    logger.interaction('Recorded', event);
  }

  private extractTargetInfo(element: HTMLElement): UserInteractionEvent['target'] {
    const rect = element.getBoundingClientRect();
    
    return {
      element: getElementSelector(element),
      tagName: element.tagName,
      classList: Array.from(element.classList),
      textContent: element.textContent?.substring(0, 100) || undefined,
      boundingRect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        toJSON: rect.toJSON.bind(rect),
      },
    };
  }

  // ========================================================================
  // Struggle Detection: Prolonged Hesitation
  // Detects when user pauses for extended period (potential confusion)
  // ========================================================================

  private startHesitationDetection(): void {
    this.resetHesitationTimer();
  }

  private stopHesitationDetection(): void {
    if (this.hesitationTimer !== null) {
      window.clearTimeout(this.hesitationTimer);
      this.hesitationTimer = null;
    }
  }

  private resetHesitationTimer(): void {
    this.stopHesitationDetection();
    
    this.hesitationTimer = window.setTimeout(() => {
      this.detectProlongedHesitation();
    }, this.state.config.hesitationThresholdMs);
  }

  private detectProlongedHesitation(): void {
    const now = Date.now();
    const duration = now - this.lastInteractionTime;
    
    // Only detect if there was prior activity
    if (this.state.interactionBuffer.length === 0) {
      return;
    }
    
    // Get last few interactions to determine context
    const recentInteractions = this.state.interactionBuffer.slice(-5);
    const involvedElements = this.getUniqueElements(recentInteractions);
    
    // Higher confidence if user was interacting with data elements
    const hasDataElements = involvedElements.some(el => isDataElement(el));
    const confidence = hasDataElements ? 0.8 : 0.6;
    
    if (confidence >= this.state.config.minConfidenceThreshold) {
      const pattern: StrugglePattern = {
        type: 'prolonged_hesitation',
        confidence,
        detectedAt: now,
        metadata: { duration },
      };
      
      this.fireStruggleEvent(pattern, recentInteractions, involvedElements);
    }
  }

  // ========================================================================
  // Struggle Detection: Repetitive Movement
  // Detects back-and-forth mouse movement between elements (comparison behavior)
  // Inspired by ProactiveVA's help-needed event detection
  // ========================================================================

  private detectRepetitiveMovement(): void {
    // Look for pairs of elements that user is switching between
    const recentWindow = Date.now() - 10000; // Last 10 seconds
    
    // Clean old entries from element interaction map
    this.elementInteractionMap.forEach((timestamps, selector) => {
      const recent = timestamps.filter(t => t > recentWindow);
      if (recent.length === 0) {
        this.elementInteractionMap.delete(selector);
      } else {
        this.elementInteractionMap.set(selector, recent);
      }
    });
    
    // Find pairs with repetitive interactions
    const elements = Array.from(this.elementInteractionMap.entries());
    
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const [selector1, timestamps1] = elements[i];
        const [selector2, timestamps2] = elements[j];
        
        // Count alternating pattern
        const allInteractions = [
          ...timestamps1.map(t => ({ selector: selector1, time: t })),
          ...timestamps2.map(t => ({ selector: selector2, time: t })),
        ].sort((a, b) => a.time - b.time);
        
        // Count switches between the two elements
        let switchCount = 0;
        for (let k = 1; k < allInteractions.length; k++) {
          if (allInteractions[k].selector !== allInteractions[k - 1].selector) {
            switchCount++;
          }
        }
        
        if (switchCount >= this.state.config.repetitiveMovementThreshold) {
          const confidence = Math.min(0.9, 0.5 + (switchCount * 0.1));
          
          if (confidence >= this.state.config.minConfidenceThreshold) {
            const pattern: StrugglePattern = {
              type: 'repetitive_movement',
              confidence,
              detectedAt: Date.now(),
              metadata: {
                elementsPair: [selector1, selector2],
                repeatCount: switchCount,
              },
            };
            
            // Get actual DOM elements
            const el1 = document.querySelector(selector1) as HTMLElement;
            const el2 = document.querySelector(selector2) as HTMLElement;
            const involvedElements = [el1, el2].filter(Boolean);
            
            // Get relevant interactions
            const relevantInteractions = this.state.interactionBuffer.filter(
              e => e.target.element === selector1 || e.target.element === selector2
            );
            
            this.fireStruggleEvent(pattern, relevantInteractions, involvedElements);
            
            // Clear these elements from map to avoid duplicate detections
            this.elementInteractionMap.delete(selector1);
            this.elementInteractionMap.delete(selector2);
          }
        }
      }
    }
  }

  // ========================================================================
  // Struggle Event Creation & Firing
  // ========================================================================

  private fireStruggleEvent(
    pattern: StrugglePattern,
    interactionHistory: UserInteractionEvent[],
    involvedElements: HTMLElement[]
  ): void {
    // Prevent duplicate events within short time window
    if (
      this.state.lastStruggleDetection &&
      Date.now() - this.state.lastStruggleDetection < 5000
    ) {
      logger.debug('PerceptionAgent', 'Suppressing duplicate struggle event');
      return;
    }
    
    const struggleEvent: StruggleEvent = {
      id: generateId(),
      pattern,
      interactionHistory,
      involvedElements,
      context: {
        pageURL: window.location.href,
        timestamp: Date.now(),
      },
    };
    
    this.state.lastStruggleDetection = Date.now();
    
    logger.struggle('Struggle detected!', {
      type: pattern.type,
      confidence: pattern.confidence,
      elements: involvedElements.length,
    });
    
    // Notify callback
    if (this.onStruggleDetectedCallback) {
      this.onStruggleDetectedCallback(struggleEvent);
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private getUniqueElements(interactions: UserInteractionEvent[]): HTMLElement[] {
    const selectors = new Set(
      interactions
        .map(i => i.target.element)
        .filter(selector => selector && selector.trim().length > 0) // Filter out empty selectors
    );
    const elements: HTMLElement[] = [];
    
    logger.debug('PerceptionAgent', `Attempting to find ${selectors.size} unique elements`);
    
    selectors.forEach(selector => {
      try {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          elements.push(element);
          logger.debug('PerceptionAgent', `✓ Found element: ${selector}`);
        } else {
          logger.debug('PerceptionAgent', `✗ Element not found: ${selector}`);
        }
      } catch (error) {
        // Invalid selector, skip it
        logger.debug('PerceptionAgent', `✗ Invalid selector: "${selector}"`, error);
      }
    });
    
    logger.debug('PerceptionAgent', `Found ${elements.length} / ${selectors.size} elements`);
    return elements;
  }
}

// Export singleton instance for use in content script
export const perceptionAgent = new PerceptionAgent();
