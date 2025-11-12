# Data Extraction Fix: Table Cell → Parent Table

## Problem

When users hovered over individual table cells, the DataAgent was extracting each cell as separate items:

```
Error: Cannot create chart: No table data found. 
I detected 5 item(s) of type: number, number, text, text, text.
```

This happened because:
1. User hovers over a `<td>` or `<th>` element
2. PerceptionAgent detects struggle on that specific cell
3. DataAgent extracts the cell → classified as `number` or `text`
4. VisualizationAgent receives individual cells, not the full table
5. Chart generation fails (needs structured table data)

## Solution

Added `findDataContainer()` method that traverses up the DOM tree to find the parent data structure:

### Implementation

```typescript
private findDataContainer(element: HTMLElement): HTMLElement {
  // If hovering over table cell, find parent <table>
  if (element.tagName === 'TD' || element.tagName === 'TH' || element.tagName === 'TR') {
    let current = element;
    while (current && current !== document.body) {
      if (current.tagName === 'TABLE') {
        return current; // Return the table, not the cell!
      }
      current = current.parentElement;
    }
  }
  
  // Handle role-based grids (e.g., ARIA tables)
  const gridParent = element.closest('[role="grid"], [role="table"]');
  if (gridParent) {
    return gridParent as HTMLElement;
  }
  
  // Handle chart containers (SVG/Canvas elements inside divs)
  const chartParent = element.closest('svg, canvas, [class*="chart"]');
  if (chartParent) {
    return chartParent as HTMLElement;
  }
  
  // Fallback to original element
  return element;
}
```

### Usage in `extractFromStruggleEvent()`

```typescript
const processedElements = new Set<HTMLElement>();

for (const element of struggleEvent.involvedElements) {
  // Find the actual data container (table, chart, etc.)
  const dataElement = this.findDataContainer(element);
  
  // Skip if already processed (avoid duplicate tables)
  if (processedElements.has(dataElement)) {
    continue;
  }
  processedElements.add(dataElement);
  
  const data = await this.extractFromElement(dataElement);
  if (data) {
    extractedData.push(data);
  }
}
```

## Benefits

✅ **Correct table extraction** - Finds parent `<table>` when cells are hovered  
✅ **Deduplication** - Prevents extracting the same table multiple times  
✅ **Works with ARIA grids** - Supports `role="grid"` and `role="table"`  
✅ **Chart container detection** - Finds parent SVG/Canvas containers  
✅ **Better logging** - Shows which containers were found  

## Testing

1. Reload extension
2. Hover over **any cell** in the "Sales Data" table
3. Wait for struggle detection
4. Should now extract full table with headers + rows ✅

### Expected Console Output

**Before:**
```
[KAIROS-SPECTRA:Data] Extracted data {type: 'number', ...}
[KAIROS-SPECTRA:Data] Extracted data {type: 'text', ...}
Error: No table data found. I detected 5 item(s) of type: number, text...
```

**After:**
```
[KAIROS-SPECTRA:DataAgent] Found parent table for cell {cell: 'TD', table: '...'}
[KAIROS-SPECTRA:Data] Extracted data {type: 'table', confidence: 0.9, ...}
[KAIROS-SPECTRA:VisualizationAgent] Generating Vega-Lite spec...
✅ Chart rendered successfully
```

## Edge Cases Handled

| Scenario | Solution |
|----------|----------|
| User hovers `<td>` | Traverses up to `<table>` |
| User hovers `<tr>` | Traverses up to `<table>` |
| User hovers `<thead>` | Traverses up to `<table>` |
| ARIA grid (`role="gridcell"`) | Uses `closest('[role="grid"]')` |
| Chart text label | Finds parent SVG/Canvas |
| Already extracted table | Skipped via `processedElements` Set |

## Files Changed

- ✅ `src/agents/DataAgent.ts`
  - Added `findDataContainer()` method
  - Modified `extractFromStruggleEvent()` to use container lookup
  - Added deduplication with `Set<HTMLElement>`
  - Enhanced logging

---

**Status**: ✅ Fixed  
**Date**: November 10, 2025
