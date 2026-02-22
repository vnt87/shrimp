# Brush Tool History Issue Investigation

## Summary

The undo/redo feature doesn't work with the Brush tool. After thorough investigation, I've identified the root cause.

## Root Cause

**The Brush tool passes the same canvas reference to `updateLayerData` instead of creating a new canvas copy.**

### Detailed Analysis

1. **How other tools handle canvas updates:**
   - Tools like Healing (line 1157-1163), Smudge/Blur (line 1239-1245), and other operations create a NEW canvas element, copy the data, then pass the new canvas to history:
   ```typescript
   // Clone the canvas to trigger React state update
   const newCanvas = document.createElement('canvas')
   newCanvas.width = currentLayer.data.width
   newCanvas.height = currentLayer.data.height
   const newCtx = newCanvas.getContext('2d')
   newCtx?.drawImage(currentLayer.data, 0, 0)
   updateLayerData(activeLayerId!, newCanvas, history)
   ```

2. **What the Brush tool does wrong:**
   - In [`Canvas.tsx`](src/components/Canvas.tsx:2459-2465), the brush tool passes the **same canvas reference**:
   ```typescript
   if (activeTool === 'brush') {
       brushEngine.endStroke()
       const layer = layers.find(l => l.id === activeLayerId)
       if (layer && layer.data) {
           updateLayerData(activeLayerId, layer.data, true)  // ← Same reference!
       }
   }
   ```

3. **Why this breaks history:**
   - The canvas is mutated in place during brush strokes (drawing happens directly on the canvas context)
   - When saving to history, the same canvas object reference is passed
   - History stores a reference to the **same mutated canvas**
   - When undo is called, it restores the layer's `data` to point to that same canvas
   - Since all history states reference the **same canvas object**, undo/redo has no effect because:
     - The canvas content is already mutated
     - All "snapshots" point to the same object
     - There's no actual state difference to restore

## Code Flow

```
Brush Stroke Flow:
1. handleMouseDown → brushEngine.startStroke() 
2. handleMouseMove → brushEngine.continueStroke() → mutates canvas in place
3. handleMouseUp → brushEngine.endStroke() → updateLayerData(layer.data) ← SAME REFERENCE

History stores: { layers: [{ data: <same_canvas> }] }
Undo restores:  { layers: [{ data: <same_canvas> }] } ← No difference!
```

## Proposed Solutions

### Solution 1: Clone Canvas on Stroke End (Recommended)

Modify [`Canvas.tsx`](src/components/Canvas.tsx:2459-2465) to clone the canvas before saving to history:

```typescript
if (activeTool === 'brush') {
    brushEngine.endStroke()
    const layer = layers.find(l => l.id === activeLayerId)
    if (layer && layer.data) {
        // Clone the canvas to trigger proper history tracking
        const newCanvas = document.createElement('canvas')
        newCanvas.width = layer.data.width
        newCanvas.height = layer.data.height
        const newCtx = newCanvas.getContext('2d')
        newCtx?.drawImage(layer.data, 0, 0)
        updateLayerData(activeLayerId, newCanvas, true)
    }
}
```

**Pros:**
- Simple fix, follows existing pattern
- Consistent with other tools
- Works with current architecture

**Cons:**
- Performance cost of copying canvas on every stroke end
- Could cause lag on large canvases

### Solution 2: Implement Delta/Stroke History

Instead of saving full canvas snapshots, save only the brush stroke data and replay it for undo/redo.

**Pros:**
- More memory efficient
- Faster for large canvases

**Cons:**
- Complex to implement
- Requires significant architectural changes
- Need to store stroke coordinates, pressure, color, etc.

### Solution 3: Lazy Canvas Cloning

Only clone the canvas when necessary (when history is actually being used). This is an optimization.

**Implementation:**
- Keep current behavior for live preview
- Add a flag to force canvas cloning when user performs undo/redo
- On undo, detect if canvas needs restoration and create proper copy

**Pros:**
- Better performance in common case
- Backwards compatible

**Cons:**
- More complex logic
- Edge cases around when to clone

## Recommendation

**Solution 1** is recommended as it's the simplest fix that follows existing patterns used by other tools in the codebase. The performance cost is acceptable since:
- Canvas cloning only happens on stroke end (not during drawing)
- Most users draw relatively short strokes
- The alternative (broken history) is worse

## Files to Modify

1. [`src/components/Canvas.tsx`](src/components/Canvas.tsx) - Lines 2459-2465 (handleMouseUp brush tool section)

## Additional Notes

- The same issue likely affects the **Pencil tool** since it uses similar code path
- The **Eraser tool** might also be affected (needs verification)
- Consider also fixing the labelFor function in EditorContext to show "Brush stroke" instead of generic labels
