/**
 * KAIROS-SPECTRA Utility Functions
 * Shared helpers for the extension
 */

import type { Point, BoundingBox, ChromeMessage, MessageType } from './types';
import { DEBUG } from './constants';

// ============================================================================
// Logging Utilities (with G11 transparency built-in)
// ============================================================================

export const logger = {
  debug: (module: string, message: string, data?: any) => {
    if (DEBUG.ENABLED && DEBUG.VERBOSE) {
      console.log(`[KAIROS-SPECTRA:${module}] ${message}`, data || '');
    }
  },
  
  info: (module: string, message: string, data?: any) => {
    if (DEBUG.ENABLED) {
      console.info(`[KAIROS-SPECTRA:${module}] ${message}`, data || '');
    }
  },
  
  warn: (module: string, message: string, data?: any) => {
    console.warn(`[KAIROS-SPECTRA:${module}] ⚠️ ${message}`, data || '');
  },
  
  error: (module: string, message: string, error?: any) => {
    console.error(`[KAIROS-SPECTRA:${module}] ❌ ${message}`, error || '');
  },
  
  struggle: (message: string, data?: any) => {
    if (DEBUG.LOG_STRUGGLES) {
      console.log(`[KAIROS-SPECTRA:Struggle] 🎯 ${message}`, data || '');
    }
  },
  
  interaction: (message: string, data?: any) => {
    if (DEBUG.LOG_INTERACTIONS) {
      console.log(`[KAIROS-SPECTRA:Interaction] 👆 ${message}`, data || '');
    }
  },
  
  data: (message: string, data?: any) => {
    if (DEBUG.LOG_DATA_EXTRACTION) {
      console.log(`[KAIROS-SPECTRA:Data] 📊 ${message}`, data || '');
    }
  },
};

// ============================================================================
// Geometry Utilities
// ============================================================================

export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function getBoundingBox(element: HTMLElement): BoundingBox {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function doBoxesOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.left + box1.width < box2.left ||
    box2.left + box2.width < box1.left ||
    box1.top + box1.height < box2.top ||
    box2.top + box2.height < box1.top
  );
}

export function isPointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.left + box.width &&
    point.y >= box.top &&
    point.y <= box.top + box.height
  );
}

// ============================================================================
// DOM Utilities
// ============================================================================

export function getElementSelector(element: HTMLElement): string {
  // Generate a unique CSS selector for an element
  if (!element || !element.tagName) {
    return 'body'; // Fallback for invalid elements
  }
  
  if (element.id) {
    return `#${element.id}`;
  }
  
  const path: string[] = [];
  let current: HTMLElement | null = element;
  
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }
    
    // Add nth-of-type if there are siblings with same tag
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        sibling => sibling.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  // Ensure we always return a valid selector
  return path.length > 0 ? path.join(' > ') : 'body';
}

export function isDataElement(element: HTMLElement | null | undefined): boolean {
  if (!element || !element.tagName) {
    return false;
  }
  
  const tagName = element.tagName.toLowerCase();
  const dataElements = ['table', 'canvas', 'svg', 'ul', 'ol'];
  
  if (dataElements.includes(tagName)) {
    return true;
  }
  
  // Check for common data visualization class names and roles
  const className = element.className?.toString().toLowerCase() || '';
  const role = element.getAttribute('role')?.toLowerCase() || '';
  
  const dataPatterns = ['chart', 'graph', 'table', 'grid', 'plot', 'visualization', 'dataviz'];
  
  return dataPatterns.some(pattern => 
    className.includes(pattern) || role.includes(pattern)
  );
}

export function getVisibleElements(selector: string): HTMLElement[] {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).filter(el => {
    const element = el as HTMLElement;
    const rect = element.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      window.getComputedStyle(element).visibility !== 'hidden' &&
      window.getComputedStyle(element).display !== 'none'
    );
  }) as HTMLElement[];
}

// ============================================================================
// Message Passing Utilities (adapted from COWPILOT)
// ============================================================================

export function createMessage<T>(
  type: MessageType,
  payload: T,
  source: 'content' | 'background' | 'injected'
): ChromeMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    source,
  };
}

export function sendMessageToBackground<T>(message: ChromeMessage<T>): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function sendMessageToTab<T>(tabId: number, message: ChromeMessage<T>): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// ============================================================================
// Time Utilities
// ============================================================================

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Array Utilities
// ============================================================================

export function slidingWindow<T>(array: T[], windowSize: number): T[][] {
  const windows: T[][] = [];
  for (let i = 0; i <= array.length - windowSize; i++) {
    windows.push(array.slice(i, i + windowSize));
  }
  return windows;
}

export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
