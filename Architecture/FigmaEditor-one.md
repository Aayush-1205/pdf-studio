This is exactly the right pivot. DOM-based PDF editors (using absolute positioned `<div>` tags over a PDF) always hit a ceiling when it comes to performance, precise zooming, and complex selections.

By shifting to a **Figma-style SVG/Canvas architecture**, we gain infinite zooming, panning, bounding-box selections, and flawless performance. Since you do **not** want a database or Liveblocks (real-time collaboration), we will adapt the architecture from the video to rely entirely on your local **Zustand** store and your **Virtual File System (VFS)**.

Here is the production-grade implementation plan for **Phase 3: The Figma-Style PDF Engine**.

---

### 📦 1. New Dependencies Required

To achieve the exact mechanics from the video (smooth drawing, random IDs), add these to your current PDF Studio stack:

```bash
npm install perfect-freehand nanoid

```

- `perfect-freehand`: Converts raw pointer coordinates into smooth SVG paths (mimics Figma's pencil tool).
- `nanoid`: Generates tiny, fast IDs for our layers.

---

### 🧠 2. The Core State Engine (Zustand)

In the video, they used Liveblocks `useStorage` and `useMutation`. We must replace this entirely with **Zustand**. This central store will manage the camera (viewport), the active tool, and all PDF overlay layers.

**Create `src/store/useCanvasStore.ts`:**

```typescript
import { create } from "zustand";
import { nanoid } from "nanoid";

// --- Types ---
export type Point = { x: number; y: number };
export type Camera = { x: number; y: number; zoom: number };
export type LayerType = "RECTANGLE" | "ELLIPSE" | "TEXT" | "PATH";

export type Layer = {
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  opacity: number;
  // Specifics
  points?: number[][]; // For Path (perfect-freehand)
  text?: string;
  fontSize?: number;
  fontFamily?: string; // For Text
};

export enum CanvasMode {
  None, // Pointer tool
  Inserting, // Placing a new shape
  Translating, // Moving a shape
  Resizing, // Dragging handles
  Pencil, // Freehand drawing
  SelectionNet, // Dragging a multi-select box
}

type CanvasState = {
  camera: Camera;
  mode: CanvasMode;
  layerType?: LayerType; // What are we currently inserting?
  layers: Record<string, Layer>; // The actual data
  layerIds: string[]; // Z-Index order (bottom to top)
  selection: string[]; // Currently selected layer IDs
  pencilDraft: number[][] | null; // Intermediate drawing state

  // Actions
  setCamera: (camera: Camera) => void;
  setMode: (mode: CanvasMode, type?: LayerType) => void;
  insertLayer: (type: LayerType, point: Point) => void;
  updateLayer: (id: string, data: Partial<Layer>) => void;
  setSelection: (ids: string[]) => void;
  deleteLayers: () => void;
  // ... pointer actions (startDrawing, continueDrawing, endDrawing)
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  mode: CanvasMode.None,
  layers: {},
  layerIds: [],
  selection: [],
  pencilDraft: null,

  setCamera: (camera) => set({ camera }),
  setMode: (mode, layerType) => set({ mode, layerType }),

  insertLayer: (type, point) => {
    const id = nanoid();
    const newLayer: Layer = {
      type,
      x: point.x,
      y: point.y,
      width: 100,
      height: 100,
      fill: "#D9D9D9",
      stroke: "#000000",
      opacity: 100,
      text: type === "TEXT" ? "Double click to edit" : undefined,
      fontSize: type === "TEXT" ? 16 : undefined,
    };

    set((state) => ({
      layers: { ...state.layers, [id]: newLayer },
      layerIds: [...state.layerIds, id],
      selection: [id], // Auto-select new item
      mode: CanvasMode.None, // Switch back to pointer after insert
    }));
  },

  updateLayer: (id, data) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], ...data },
      },
    })),

  setSelection: (ids) => set({ selection: ids }),

  deleteLayers: () =>
    set((state) => {
      const newLayers = { ...state.layers };
      state.selection.forEach((id) => delete newLayers[id]);
      return {
        layers: newLayers,
        layerIds: state.layerIds.filter((id) => !state.selection.includes(id)),
        selection: [],
      };
    }),
}));
```

---

### 🖼️ 3. The Infinite Viewport Engine (`<svg>`)

Figma works by wrapping everything in a massive `<svg>` and translating an inner `<g>` group based on the `camera`.

When the user imports a PDF via `pdfjs-dist`, we render it onto a `<canvas>`, convert that to a Data URL (or use a Next.js `<img>` tag), and place it at the absolute bottom `z-index` of our SVG.

**Create `src/components/editor/Canvas.tsx`:**

```tsx
"use client";
import { useCallback, useEffect } from "react";
import { useCanvasStore, CanvasMode } from "@/store/useCanvasStore";
import { pointerEventToCanvasPoint } from "@/utils/coordinates"; // Math translation

export default function InfiniteCanvas({ pdfBackgroundUrl }) {
  const { camera, setCamera, mode, layers, layerIds, selection } =
    useCanvasStore();

  // 1. Panning & Zooming (Mouse Wheel)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Zooming
        const zoomSpeed = 0.01;
        setCamera({ ...camera, zoom: camera.zoom - e.deltaY * zoomSpeed });
      } else {
        // Panning
        setCamera({
          ...camera,
          x: camera.x - e.deltaX,
          y: camera.y - e.deltaY,
        });
      }
    },
    [camera, setCamera],
  );

  // 2. Pointer Events (Delegating to tools)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const point = pointerEventToCanvasPoint(e, camera);

      if (mode === CanvasMode.Inserting) {
        // Insert shape at exact mouse coordinates
        useCanvasStore
          .getState()
          .insertLayer(useCanvasStore.getState().layerType!, point);
      }
      // Handle pencil start, translation start, etc.
    },
    [camera, mode],
  );

  return (
    <main className="fixed inset-0 w-full h-full bg-[#E5E5E5] overflow-hidden touch-none">
      <svg
        className="w-full h-full"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        // onPointerMove={...} onPointerUp={...}
      >
        <g
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          }}
        >
          {/* Base PDF Background */}
          {pdfBackgroundUrl && (
            <image
              href={pdfBackgroundUrl}
              x={0}
              y={0}
              width={800}
              height={1130}
            />
          )}

          {/* Render User Layers */}
          {layerIds.map((id) => (
            <LayerComponent
              key={id}
              id={id}
              layer={layers[id]}
              isSelected={selection.includes(id)}
            />
          ))}

          {/* Render the Selection Bounding Box / Resize Handles */}
          {selection.length > 0 && <SelectionBox />}
        </g>
      </svg>

      {/* Absolute Positioned UI */}
      <BottomToolbar />
      <LeftSidebar />
      <RightPropertyPanel />
    </main>
  );
}
```

---

### 🎨 4. Rendering Layers & The Bounding Box

Every shape the user adds is rendered mathematically inside the `<g>` tag. If it is selected, a blue `<rect>` with 8 drag handles is drawn over it.

**Create `src/components/editor/LayerComponent.tsx`:**

```tsx
import { Layer } from "@/store/useCanvasStore";

export default function LayerComponent({ id, layer, isSelected }) {
  const handlePointerDown = (e) => {
    e.stopPropagation(); // Prevent canvas from interpreting as an empty click
    useCanvasStore.getState().setSelection([id]);
    // Set mode to translating to begin moving...
  };

  switch (layer.type) {
    case "RECTANGLE":
      return (
        <rect
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          fill={layer.fill}
          stroke={layer.stroke}
          onPointerDown={handlePointerDown}
          className="cursor-pointer"
        />
      );
    case "TEXT":
      return (
        <foreignObject
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
        >
          <div
            contentEditable={isSelected} // Like Figma, double click or select to edit
            style={{
              fontSize: layer.fontSize,
              fontFamily: layer.fontFamily,
              color: layer.fill,
            }}
            onPointerDown={handlePointerDown}
          >
            {layer.text}
          </div>
        </foreignObject>
      );
    // Add ELLIPSE and PATH (using perfect-freehand getStroke)
    default:
      return null;
  }
}
```

---

### 🛠️ 5. The Contextual Property Panel (Right Sidebar)

In Figma, if you click a `RECTANGLE`, you see color and border radius options. If you click `TEXT`, you see Font selection.

**Directive for Antigravity - Right Sidebar Logic:**

1. Use `useCanvasStore` to get the `layers` and `selection`.
2. If `selection.length === 0`, hide the sidebar (or show the base "Page Color" settings).
3. If `selection.length === 1`, inspect the `layer.type`.
4. Render Shadcn/Radix UI Input fields for `layer.width` and `layer.height`.
5. When the user types into an input field, dispatch `updateLayer(id, { width: newWidth })`. The shape on the SVG canvas will instantly update.

---

### 🔗 6. Integration: The "Export Bake"

Because your data is now perfectly separated from the DOM (living mathematically in Zustand), baking to PDF via `pdf-lib` (your Phase 2 architecture) is incredibly reliable.

When the user clicks **Export**, you do **not** use `html2canvas` (which ruins resolution). Instead:

1. Fetch the base PDF bytes from `idb-keyval`.
2. Fetch the `layerIds` and `layers` from `useCanvasStore.getState()`.
3. Pass both to your Comlink Web Worker.
4. The worker iterates through the layers array.

- If `layer.type === 'RECTANGLE'`, it calls `page.drawRectangle({ x, y, width, height, color })`.
- If `layer.type === 'TEXT'`, it embeds the font with `@pdf-lib/fontkit` and calls `page.drawText({ text, x, y })`.

---

### 🎹 Next Steps & Guidelines for Antigravity

To execute this, instruct Antigravity to build sequentially:

1. **"Build the Zustand Store first."** Ensure all layer properties are typed.
2. **"Build the InfiniteCanvas component."** Get the `onWheel` panning and zooming to work purely with a blank SVG before adding items.
3. **"Build the Toolbar and Layer Insertion."** Ensure clicking "Rectangle" drops a rectangle object into Zustand, which instantly renders in the SVG.
4. **"Build the SelectionBox."** Add the logic to draw a blue outline around active layers and listen for global keyboard shortcuts (`Delete`/`Backspace` to trigger `deleteLayers`).
