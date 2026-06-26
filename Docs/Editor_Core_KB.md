# 📚 Editor State, History & Interaction Core — Knowledge Base (KB)

**Module:** Editor Core  
**Last Updated:** June 27, 2026  
**KB Type:** Module-Level Knowledge Base  
**Status:** Implemented and Verified  

---

## 🧭 Overview & Goal

The **Editor Core** forms the foundation of all user interactions inside the canvas workspace. It is responsible for handling document layout, tracking transient UI events (like drawing, dragging, and resizing), and maintaining a lightweight, command-based history stack for undo/redo actions.

Key goals:
1. **Decoupled Architecture:** Separate document data from UI interaction states.
2. **Command-based Undo/Redo:** Replace full-state JSON serialization with lightweight, invertible commands to prevent memory leaks and degradation.
3. **Pure Page Calculations:** Centralize relative page positioning, margins, and hit-testing coordinates.
4. **Container-Aware Coordinates:** Abstract pointer event translations using wrapper boundaries rather than relying on viewport-relative values.

---

## 🏗️ Architecture

```
                 Canvas.tsx (Rendering Stage Shell)
                             │
                             ▼
         useCanvasPointerController (Stage Events Hook)
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   useDocumentStore   useInteractionStore   useHistoryStore
   (Persistent State)  (Transient UI state)  (Undo/Redo commands)
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
          useCanvasStore (Typed Composition Facade)
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     TextEditorOverlay   LayerComponent    MeasurementsOverlay
                         (Dispatcher)
                             │
        ┌───────────┬────────┴───────────┬───────────┐
        ▼           ▼                    ▼           ▼
    TextLayer   ImageLayer           PathLayer   ShapeLayer
```

---

## 🗂️ Module File Map

| File Path | Role |
|---|---|
| [store/useCanvasStore.ts](file:///c:/Users/Aayush/Webs/pdf/store/useCanvasStore.ts) | **Unified Composition Facade:** Exposes combined document, interaction, and history states with typed `getState` and `setState` forwards to avoid breaking existing code. |
| [store/editor/useDocumentStore.ts](file:///c:/Users/Aayush/Webs/pdf/store/editor/useDocumentStore.ts) | **Document Store:** Manages persistent state (layers, page definitions, selections) and handles structural mutations. |
| [store/editor/useInteractionStore.ts](file:///c:/Users/Aayush/Webs/pdf/store/editor/useInteractionStore.ts) | **Interaction Store:** Handles temporary user input data (guides, active translation offset, pencil stroke draft, resize handle indicators). |
| [store/editor/useHistoryStore.ts](file:///c:/Users/Aayush/Webs/pdf/store/editor/useHistoryStore.ts) | **History Store:** Stores linear stacks of `past` and `future` executable history commands. |
| [lib/editor/pageLayout.ts](file:///c:/Users/Aayush/Webs/pdf/lib/editor/pageLayout.ts) | **Page Layout Library:** Computes global stacking coordinates and provides helpers to translate screen clicks into page-relative positions. |
| [components/editor/controllers/useCanvasPointerController.ts](file:///c:/Users/Aayush/Webs/pdf/components/editor/controllers/useCanvasPointerController.ts) | **Pointer Controller Hook:** Binds down/move/up event sequences on the stage and coordinates inserting/drawing rules. |
| [components/editor/LayerComponent.tsx](file:///c:/Users/Aayush/Webs/pdf/components/editor/LayerComponent.tsx) | **Dispatcher:** Decides which renderer file to invoke based on layer type. |
| [components/editor/renderers/](file:///c:/Users/Aayush/Webs/pdf/components/editor/renderers) | **Modular Renderers:** Specialized Konva draw modules separated into `ShapeLayer.tsx`, `TextLayer.tsx`, `ImageLayer.tsx`, and `PathLayer.tsx`. |

---

## 💡 Important Design Patterns & Technical Details

### 1. Command-based Invertible History
Snapshot-based history becomes sluggish as layers multiply. We define a simple invertible command interface:
```ts
export interface HistoryCommand {
  label: string;
  do: () => void;
  undo: () => void;
}
```
Whenever a mutation occurs, we construct and pass a command to `useHistoryStore.getState().execute(cmd)`. This maintains atomic transitions.

### 2. Event Batching
To keep the history stack clean, we do not commit commands during move or resize loops:
- **Translating / Resizing:** Keep updating coordinates in the document store directly with `saveHistoryAction = false` on every pointer move event.
- **On Pointer Up:** Check if the coordinates actually shifted from the initial bounds stored at `startTranslating` or `startResizing`. If they did, commit **one** command tracking the difference.
- **Drawing:** Accumulate path points on pointer move. On pointer release, build the Konva path object and push exactly **one** insert path command onto the history stack.

### 3. Container-Aware Math
Standard pointer event math can drift when menus, side panels, or canvas rulers shift the viewport layout. Coordinates are normalized against the current stage container box client position:
```ts
export function pointerEventToCanvasPoint(
  e: React.PointerEvent,
  container: HTMLElement,
  camera: Camera,
): Point {
  const rect = container.getBoundingClientRect();
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;
  return {
    x: Math.round(localX / camera.zoom - camera.x),
    y: Math.round(localY / camera.zoom - camera.y),
  };
}
```

### 4. Immuta-Safe Loops
React hooks expect variables in the rendering loop to remain immutable. When calculating page offsets, avoid accumulators with outer reassignments:
- *Bad:* Using `let currentY = 0; pages.map(...)` mutating `currentY` on each loop (violates `react-hooks/immutability`).
- *Good:* Mapping indices with pure layout math functions (`pages.map((_, idx) => getPageTopOffset(idx, pages))`).

---

## 🛠️ Contributor Guidelines

1. **Keep Renderers Focused:** If you are adding a new graphic element, shape preset, or annotation overlay, create a separate renderer file inside `components/editor/renderers/` and update `LayerComponent.tsx` to dispatch to it. Do not bloat other layers.
2. **ESLint Ref Directives:** Accessing refs during render is forbidden by react-hooks rules. When building dynamic selection boxes with Konva nodes, declare `/* eslint-disable react-hooks/refs */` explicitly at the top of the file to protect the ref caching mechanism.
