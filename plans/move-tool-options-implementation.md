# Move Tool Options — Implementation Plan

## Overview

This document records the feasibility analysis and implementation decisions for adding
Photoshop-style Move tool options to the tool options bar.

---

## Features Implemented

### 1. Auto-Select (checkbox + Layer / Group dropdown)

**Photoshop behaviour**  
When *Auto-Select* is checked, clicking anywhere on the canvas automatically picks the
topmost visible layer whose opaque pixels are under the cursor, instead of requiring the
user to first click a layer in the Layers panel.  The dropdown selects whether the unit
of selection is an individual *Layer* or an entire *Group*.

**Implementation**  
- Added `moveAutoSelect: boolean` and `moveAutoSelectTarget: 'layer' | 'group'` to
  `ToolOptions` in `App.tsx`.
- In `Canvas.tsx → handleMouseDown`, when `activeTool === 'move'`:
  - A recursive `findLayerAtPoint()` helper walks the layer tree (reversed so the topmost
    rendered layer is found first).
  - For image layers it samples a single pixel via `getImageData` to skip fully
    transparent pixels (so clicking through a transparent area won't steal focus).
  - For text layers it falls back to a bounding-box estimate (pixi text metrics are not
    available at mousedown time).
  - When `moveAutoSelectTarget === 'group'` the helper returns the parent group node
    instead of the individual child layer.
- Legacy behaviour (text-layer auto-click without the flag) is preserved as a fallback
  for backward compatibility.

**Feasibility rating: ✅ Fully feasible**

---

### 2. Show Transform Controls (checkbox)

**Photoshop behaviour**  
A thin bounding-box with eight resize/rotate handles appears around the active layer
directly on the canvas while the Move tool is active.  Dragging a corner scales the
layer; dragging outside rotates it.  This is *identical* to the Transform tool's
overlay, just surfaced from the Move tool.

**Implementation**  
- Added `moveShowTransformControls: boolean` to `ToolOptions`.
- In `PixiScene` (inside `Canvas.tsx`) the `TransformOverlayWrapper` was already
  rendered when `activeTool === 'transform'`.  The condition was extended to also render
  when `activeTool === 'move' && toolOptions?.moveShowTransformControls`.
- The existing `TransformOverlay` component (handles, drag-to-scale, drag-to-rotate,
  history commit on mouse-up) is reused with **zero duplication**.

**Feasibility rating: ✅ Fully feasible — zero extra code beyond a condition change**

---

### 3. Alignment Buttons (6 buttons)

**Photoshop behaviour**  
Six icon buttons align the active layer relative to the canvas (or a selection, if one
is active):  align left edges, centre horizontally, align right edges, align top edges,
centre vertically, align bottom edges.

**Implementation**  
- `ToolOptionsBar.tsx` gains `alignActiveLayer(alignment: string)` which:
  1. Finds the active layer.
  2. Reads its pixel dimensions (`layer.data.width/height` for image layers, bounding
     box estimate for text layers).
  3. Calls `updateLayerPosition(id, newX, newY, true)` — the `true` flag commits the
     change to the undo history.
- Six custom inline SVG icons are defined as local components inside
  `renderMoveOptions()`.  Each icon shows two rectangles aligned to the relevant edge or
  centre line, matching the visual style of Photoshop's icons.
- The buttons are disabled (opacity 0.4, `disabled` attribute) when no layer is active.

**Known limitation — text layer size**  
For text layers the width/height is estimated from character count × font-size because
the Pixi `pixiText` object's measured width is only available after the first Pixi tick,
not synchronously at the time the button is pressed.  A future improvement could cache
the measured size from the `PixiLayerRecursive` component's `useTick` callback into
EditorContext.

**Feasibility rating: ✅ Fully feasible (text size estimation is an acceptable trade-off)**

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.tsx` | Added `moveAutoSelect`, `moveAutoSelectTarget`, `moveShowTransformControls` to `ToolOptions` interface and `defaultToolOptions` |
| `src/components/ToolOptionsBar.tsx` | Added `renderMoveOptions()` with Auto-Select toggle, Layer/Group dropdown, Show Transform Controls toggle, six alignment buttons, SVG icon components, and `alignActiveLayer()` helper |
| `src/components/Canvas.tsx` | Extended `handleMouseDown` with recursive `findLayerAtPoint()` for auto-select; extended `PixiScene` transform-overlay condition to include move+showTransformControls |

---

## Potential Future Enhancements

| Feature | Effort | Notes |
|---------|--------|-------|
| Align to *selection* bounds (not canvas) | Low | Check `selection` in `alignActiveLayer`; use selection x/y/w/h instead of canvas size |
| Distribute spacing between multiple selected layers | Medium | Requires multi-selection support (not yet implemented) |
| Cmd/Shift+click to add layers to selection for group-align | Medium | Requires multi-selection state in EditorContext |
| Accurate text-layer size in alignment | Low | Cache measured Pixi text size into EditorContext from `PixiLayerRecursive` |
| Snap-to-canvas-centre cursor feedback | Low | Show a magenta guide line when a layer's centre snaps to canvas centre during drag |
