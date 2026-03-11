Building a **PDF Organizer Tool** is a highly valuable addition. Since you already have `@dnd-kit/core`, `@dnd-kit/sortable`, `pdf-lib`, `pdfjs-dist`, and `zustand` installed, you have the absolute perfect stack to build a fluid, 60-FPS drag-and-drop grid interface.

Here is the detailed implementation plan to build the Organizer Tool, including the drag-and-drop grid and the array manipulation features (like "Reverse Order").

---

### 🏗️ Architecture Overview

To ensure this remains highly performant, we will decouple the **Visual Order** from the **Binary PDF**.

1. **The Visual Layer (`dnd-kit` & `pdfjs-dist`):** We extract a low-resolution thumbnail of every page and put them in a CSS Grid. We track their order using an array of integers in Zustand (e.g., `[0, 1, 2, 3]`).
2. **Array Manipulation:** When a user drags a page or clicks "Reverse Order", we only change the integer array in Zustand (e.g., `[3, 2, 1, 0]`). We do _not_ touch the heavy PDF file in memory.
3. **The Assembly Layer (`pdf-lib` in Web Worker):** When the user clicks "Apply/Export", we send the original PDF buffer and the new integer array to the Web Worker. The worker uses `pdf-lib` to instantly create a new document using the provided page index order.

---

### 🧠 Step 1: The Organizer State (Zustand)

We need a store to track the original number of pages and the user's manipulated order.

```typescript
// store/useOrganizerStore.ts
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";

interface OrganizerState {
  pageOrder: number[]; // Array of original page indices: [0, 1, 2, ...]
  setInitialPages: (numPages: number) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  reverseOrder: () => void;
  deletePage: (indexToRemove: number) => void;
}

export const useOrganizerStore = create<OrganizerState>((set) => ({
  pageOrder: [],

  // Initialize when the PDF is loaded
  setInitialPages: (numPages) =>
    set({
      pageOrder: Array.from({ length: numPages }, (_, i) => i),
    }),

  // Fired by @dnd-kit when a drag ends
  reorderPages: (oldIndex, newIndex) =>
    set((state) => ({
      pageOrder: arrayMove(state.pageOrder, oldIndex, newIndex),
    })),

  // The "Flip" feature you requested
  reverseOrder: () =>
    set((state) => ({
      pageOrder: [...state.pageOrder].reverse(),
    })),

  // Bonus: Allow users to delete a page while organizing
  deletePage: (indexToRemove) =>
    set((state) => ({
      pageOrder: state.pageOrder.filter((_, i) => i !== indexToRemove),
    })),
}));
```

---

### 🖼️ Step 2: The Grid UI (`@dnd-kit`)

We will render a responsive grid where each item represents a PDF page. We use `rectSortingStrategy` because the items are in a 2D grid, not a vertical list.

```tsx
// components/organizer/OrganizerGrid.tsx
"use client";
import { useOrganizerStore } from "@/store/useOrganizerStore";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import SortableThumbnail from "./SortableThumbnail";

export default function OrganizerGrid({
  fileBuffer,
}: {
  fileBuffer: ArrayBuffer;
}) {
  const { pageOrder, reorderPages, reverseOrder } = useOrganizerStore();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pageOrder.indexOf(active.id as number);
      const newIndex = pageOrder.indexOf(over.id as number);
      reorderPages(oldIndex, newIndex);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-gray-50 rounded-xl">
      {/* Tool Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h2 className="font-bold text-lg">Organize Pages</h2>
        <button
          onClick={reverseOrder}
          className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200 transition-colors"
        >
          ⇅ Reverse Order
        </button>
      </div>

      {/* The DND Grid */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pageOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {pageOrder.map((originalPageIndex, currentIndex) => (
              <SortableThumbnail
                key={originalPageIndex}
                id={originalPageIndex}
                displayNumber={currentIndex + 1}
                fileBuffer={fileBuffer}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

---

### 📄 Step 3: The Sortable Thumbnail Component

This component handles two things: making the item draggable via `@dnd-kit`, and rendering the low-res preview of the PDF page using `pdfjs-dist`.

```tsx
// components/organizer/SortableThumbnail.tsx
"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";

interface Props {
  id: number; // The original page index in the PDF
  displayNumber: number; // The current sequence number (1, 2, 3...)
  fileBuffer: ArrayBuffer;
}

export default function SortableThumbnail({
  id,
  displayNumber,
  fileBuffer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dnd-Kit Hooks
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Render the Thumbnail
  useEffect(() => {
    const renderPage = async () => {
      const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
      const page = await pdf.getPage(id + 1); // pdf.js is 1-indexed

      // Render at a small scale for performance
      const viewport = page.getViewport({ scale: 0.3 });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
    };
    renderPage();
  }, [fileBuffer, id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
    >
      <div className="border border-gray-300 shadow-md bg-white rounded overflow-hidden">
        <canvas ref={canvasRef} className="pointer-events-none" />
      </div>
      <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full">
        Page {displayNumber}
      </span>
    </div>
  );
}
```

---

### ⚙️ Step 4: The Web Worker Assembly

Once the user is happy with the order visually, they click "Save". We pass the `pageOrder` array to the Web Worker. `pdf-lib` has a highly optimized `.copyPages()` method perfect for this.

```typescript
// workers/pdfWorker.ts
import { PDFDocument } from "pdf-lib";

export async function reorganizePdf(
  fileBuffer: ArrayBuffer,
  newPageOrder: number[], // e.g., [2, 1, 0, 3]
): Promise<Uint8Array> {
  // 1. Load the original document
  const originalPdf = await PDFDocument.load(fileBuffer);

  // 2. Create a brand new, empty document
  const newPdf = await PDFDocument.create();

  // 3. Copy the pages from the original document in the EXACT order specified by the array
  const copiedPages = await newPdf.copyPages(originalPdf, newPageOrder);

  // 4. Add the copied pages into the new document
  copiedPages.forEach((page) => {
    newPdf.addPage(page);
  });

  // 5. Save and return the new bytes
  return await newPdf.save();
}
```

---

### ⚖️ Advantages vs. Disadvantages of this Implementation

#### **Advantages:**

1. **Extremely Fast Rendering:** By scaling the `pdf.js` viewport to `0.3`, we create lightweight thumbnails. The main thread will not freeze, even for 50+ page PDFs.
2. **O(1) Data Manipulation:** Reversing, deleting, or reordering the PDF in the browser UI is instantaneous because we are only moving integers in a Zustand array, not manipulating megabytes of binary data.
3. **Flawless Final Output:** `pdf-lib`'s `copyPages` method preserves _everything_—vector text, embedded fonts, high-res images, and AcroForm fields. The quality of the PDF is 100% identical to the original.

#### **Disadvantages & Considerations:**

1. **Memory Spikes on Massive Files:** If a user uploads a 500-page PDF, rendering 500 `<canvas>` elements at once inside a CSS grid will crash mobile browsers.

- _Fix for the future:_ If you expect massive files, you will need to implement a virtualized grid (using a library like `@tanstack/react-virtual`) so that `pdfjs-dist` only renders the thumbnails currently visible on the screen.

2. **Selection Limitations:** Out-of-the-box, `@dnd-kit` is optimized for single-item dragging. Allowing a user to `Ctrl+Click` five pages and drag them all as a block requires writing custom sensor logic in `dnd-kit`. However, clicking "Reverse" or dragging one page at a time is fully supported by this plan.
