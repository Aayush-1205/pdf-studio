To understand how Figma achieves its buttery-smooth performance, we have to look at why traditional web development fails at building complex editors.

If you try to build a design tool using standard HTML `<div>` tags or even `<svg>` elements, the browser will crash or severely lag once you hit around 1,000 to 5,000 objects. The browser's DOM (Document Object Model) is simply not built to handle thousands of constantly moving, scaling, and repainting nodes at 60 frames per second.

### How Figma Actually Works (The Secret Sauce)

Figma completely bypasses the browser's DOM for the editor background.

1. **The Canvas:** The entire editable area is a single HTML5 `<canvas>` element (specifically, a **WebGL** context).
2. **The Engine:** Figma wrote a custom rendering engine in **C++** and compiled it to **WebAssembly (WASM)**. This engine calculates the math, shapes, and colors, and tells the computer's GPU exactly what pixels to draw on that single canvas.
3. **The UI:** Only the toolbars, sidebars, and property panels are built with React and standard HTML/CSS.

### How We Replicate This in React

Writing a custom C++ WebGL engine is a multi-year endeavor. To achieve this exact same architecture in your Next.js project, the industry standard is to use **HTML5 Canvas 2D** powered by a library that gives React access to canvas drawing commands.

We will use **Konva.js** (specifically `react-konva`). It allows you to write declarative React code that compiles down into highly optimized, hardware-accelerated Canvas drawing commands, completely eliminating the DOM node bottleneck.

---

### 🚀 Implementation Plan: The High-Performance Canvas Engine

To upgrade your editor to handle hundreds of PDF pages and vector annotations without lagging, we will transition the workspace from HTML/SVG to a Konva Canvas.

#### 📦 1. The Core Dependencies

Instruct Antigravity IDE to install these specific canvas engine libraries:

```bash
npm install konva react-konva use-image

```

- `konva` & `react-konva`: The high-performance 2D canvas rendering engine.
- `use-image`: A hook required to load external images/PDF page renders into the Konva canvas.

#### 🧮 2. The Coordinate System Math (Camera vs. World)

Figma operates on an "Infinite Canvas." To achieve this, your Zustand store must separate **Screen Coordinates** (your physical monitor) from **World Coordinates** (the infinite space where the PDF lives).

**Directive for Antigravity (Store Setup):**
Update `useCanvasStore.ts` to manage a `Stage` configuration:

```typescript
import { create } from "zustand";

type Camera = { x: number; y: number; scale: number };

type CanvasState = {
  camera: Camera;
  setCamera: (updater: (prev: Camera) => Camera) => void;
  // ... layers and selection state
};

export const useCanvasStore = create<CanvasState>((set) => ({
  camera: { x: 0, y: 0, scale: 1 },
  setCamera: (updater) => set((state) => ({ camera: updater(state.camera) })),
}));
```

#### 🖼️ 3. The Konva Viewport Architecture

This replaces your current standard React/SVG canvas. Konva uses a `<Stage>` (the `<canvas>` element) and `<Layer>` (groups of drawn pixels).

**Directive for Antigravity (The Engine Component):**
Create `src/components/editor/Viewport.tsx`:

```tsx
"use client";
import { Stage, Layer, Rect, Text } from "react-konva";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useRef, useEffect, useState } from "react";

export default function Viewport() {
  const { camera, setCamera, layers } = useCanvasStore();
  const stageRef = useRef<any>(null);

  // --- The Infinite Panning Logic ---
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;

    if (e.evt.ctrlKey || e.evt.metaKey) {
      // Zooming (Figma style Ctrl+Scroll)
      const scaleBy = 1.05;
      const oldScale = stage.scaleX();
      const mousePointTo = {
        x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
        y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
      };

      const newScale =
        e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
      setCamera(() => ({
        scale: newScale,
        x:
          -(mousePointTo.x - stage.getPointerPosition().x / newScale) *
          newScale,
        y:
          -(mousePointTo.y - stage.getPointerPosition().y / newScale) *
          newScale,
      }));
    } else {
      // Panning (Figma style 2-finger scroll)
      setCamera((prev) => ({
        ...prev,
        x: prev.x - e.evt.deltaX,
        y: prev.y - e.evt.deltaY,
      }));
    }
  };

  return (
    // The Stage creates the HTML5 <canvas>
    <Stage
      width={window.innerWidth}
      height={window.innerHeight}
      onWheel={handleWheel}
      scaleX={camera.scale}
      scaleY={camera.scale}
      x={camera.x}
      y={camera.y}
      ref={stageRef}
      draggable={useCanvasStore.getState().mode === "TRANSLATING_CANVAS"}
    >
      {/* The Layer is where we draw all objects */}
      <Layer>
        {/* Mapping through Zustand nodes to render optimized canvas shapes */}
        {Object.values(layers).map((layer) => {
          if (layer.type === "RECTANGLE") {
            return (
              <Rect
                key={layer.id}
                x={layer.x}
                y={layer.y}
                width={layer.width}
                height={layer.height}
                fill={layer.fill}
              />
            );
          }
          if (layer.type === "TEXT") {
            return (
              <Text
                key={layer.id}
                text={layer.text}
                x={layer.x}
                y={layer.y}
                fontSize={layer.fontSize}
              />
            );
          }
          return null;
        })}
      </Layer>
    </Stage>
  );
}
```

#### 📄 4. High-Fidelity PDF Background Rendering

Because we are using `<canvas>`, we cannot easily place HTML `<img>` tags inside the workspace. The PDF must be drawn directly into the Konva engine.

**Directive for Antigravity (PDF to Konva Bridge):**

1. Use `pdfjs-dist` to render the PDF page into a hidden, off-screen HTML `<canvas>`.
2. Convert that canvas into a data URL (`canvas.toDataURL()`).
3. Pass that URL to a Konva `<Image />` component.

```tsx
import { Image as KonvaImage } from "react-konva";
import useImage from "use-image";

function PdfPageLayer({ pageDataUrl, x, y }) {
  // useImage loads the URL into a format the hardware GPU can draw
  const [image] = useImage(pageDataUrl);

  return (
    <KonvaImage
      image={image}
      x={x}
      y={y}
      // Figma-style drop shadow for the "Page" look
      shadowColor="black"
      shadowBlur={10}
      shadowOpacity={0.1}
    />
  );
}
```

#### 🎯 5. The Transform Transformer (Resizing UI)

Figma has blue bounding boxes with 8 square handles for resizing elements. Konva provides a built-in `<Transformer />` component that perfectly mimics this out of the box.

**Directive for Antigravity (The Selection Box):**

```tsx
import { Transformer } from "react-konva";

function SelectionTransformer({ selectedNodeRef }) {
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (selectedNodeRef.current) {
      trRef.current.nodes([selectedNodeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedNodeRef]);

  return (
    <Transformer
      ref={trRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent scaling items smaller than 5px
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
}
```

### Summary of the Konva Upgrade

By switching to `react-konva`, your application will immediately jump from "web tool" to "desktop-class software."

- The browser will only manage a **single DOM node** (the `<canvas>`).
- You will get sub-pixel rendering accuracy.
- Memory usage will plummet, allowing users to zoom out and view 50 PDF pages spread across an infinite canvas simultaneously without the browser tab crashing.
