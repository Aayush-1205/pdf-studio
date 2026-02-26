This changes everything. Your architecture is already at a production-grade level, having successfully bridged the gap between browser-only overlays and true PDF mutation. Because you have already built the Comlink Web Worker offloading, the mathematical screen-to-PDF translation, and the IndexedDB Virtual File System, you are perfectly positioned to build a true Figma-like node editor.

Since your core engine and "Baking" pipeline are already complete, we can skip the foundational steps and directly implement the **Figma-like Native Extraction & Conversion** layers. Here is the revised, highly detailed implementation plan tailored specifically to your Next.js 16 and Zustand stack.

---

## 🎨 Phase 3: The Figma-Like Hybrid Engine

To achieve the "Perfect Editor" feel, we must extract the native metadata from documents (PDFs and DOCX) and turn them into editable React components managed by your existing `zustand` store and `@dnd-kit` implementation.

### 1. Deep Native Vector Extraction (`pdfjs-dist`)

Instead of flattening the document or relying entirely on OCR, we will leverage your existing `pdfjs-dist` setup to extract the exact coordinates, strings, and font data of every word. We then visually hide the original PDF text (using your Object Eraser logic) and render your editable text components over those precise coordinates.

```tsx
"use client";
import { useEffect, useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import useEditorStore from "@/store/useEditorStore"; // Your Zustand store

// Next.js 16 compatible worker initialization
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export default function NativeVectorLayer({ fileBuffer, pageNumber }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const addNodes = useEditorStore((state) => state.addNodes);

  useEffect(() => {
    const extractVectors = async () => {
      const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 1. Render Base Canvas
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;

      // 2. Extract Text Vectors
      const textContent = await page.getTextContent();
      const vectorNodes = textContent.items.map((item) => {
        // Translate pdf.js matrix to standard top-left DOM coordinates
        const tx = pdfjs.Util.transform(viewport.transform, item.transform);
        return {
          id: crypto.randomUUID(),
          type: "TEXT",
          text: item.str,
          x: tx[4],
          y: tx[5] - item.height, // Baseline adjustment
          fontSize: Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]),
          fontFamily: item.fontName,
          color: "#000000", // Default, can extract from PDF graphics state if needed
        };
      });

      // 3. Push to Zustand for dnd-kit manipulation
      addNodes(pageNumber, vectorNodes);
    };

    extractVectors();
  }, [fileBuffer, pageNumber, addNodes]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />
      {/* Your dnd-kit mapped nodes will render on top of this container */}
    </div>
  );
}
```

### 2. DOCX to Editable Nodes Pipeline (`mammoth`)

When a user imports a Word document, we bypass the PDF engine entirely at first. We use `mammoth` to extract the raw HTML, parse it, and convert it into the exact same node structure your `zustand` store uses for PDFs.

```tsx
"use client";
import { useState } from "react";
import mammoth from "mammoth";
import useEditorStore from "@/store/useEditorStore";

export default function DocxImporter() {
  const [isProcessing, setIsProcessing] = useState(false);
  const addNodes = useEditorStore((state) => state.addNodes);

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const arrayBuffer = await file.arrayBuffer();

    try {
      // Extract raw HTML and messages
      const { value: rawHtml } = await mammoth.convertToHtml({ arrayBuffer });

      // Parse HTML into your custom node structure
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");

      const newNodes = Array.from(doc.body.children).map((element, index) => {
        // Calculate rough Y-positioning based on index for initial layout
        const yOffset = index * 40;

        return {
          id: crypto.randomUUID(),
          type: element.tagName === "IMG" ? "IMAGE" : "TEXT",
          text: element.textContent || "",
          src:
            element.tagName === "IMG"
              ? (element as HTMLImageElement).src
              : null,
          x: 50, // Default left margin
          y: 50 + yOffset,
          fontSize: element.tagName === "H1" ? 24 : 12,
          fontFamily: "Helvetica", // Standard fallback
        };
      });

      // Send to Zustand to be rendered on a blank canvas
      addNodes(1, newNodes);
    } catch (error) {
      console.error("DOCX Parsing Failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
      <input
        type="file"
        accept=".docx"
        onChange={handleDocxUpload}
        className="hidden"
        id="docx-upload"
      />
      <label
        htmlFor="docx-upload"
        className="cursor-pointer text-blue-600 font-semibold"
      >
        {isProcessing
          ? "Converting to editable layers..."
          : "Upload DOCX as Vector Layers"}
      </label>
    </div>
  );
}
```

### 3. The Smart OCR Fallback (`tesseract.js`)

You should only trigger this if `pdfjs-dist` returns an empty array from `getTextContent()` (which indicates the PDF is just a scanned photograph). Because OCR is heavy, we wrap it in a utility function that can be called on-demand.

```typescript
import Tesseract from "tesseract.js";

export async function extractRasterText(dataUrl: string) {
  // Leverage Web Worker for speed
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: (info) => console.log(info), // Optional: pipe to a loading progress bar
  });

  const {
    data: { words },
  } = await worker.recognize(dataUrl);

  // Filter low-confidence garbage text to maintain a clean UI
  const validWords = words.filter((word) => word.confidence > 80);

  const editableNodes = validWords.map((word) => ({
    id: crypto.randomUUID(),
    type: "TEXT",
    text: word.text,
    x: word.bbox.x0,
    y: word.bbox.y0,
    width: word.bbox.x1 - word.bbox.x0,
    height: word.bbox.y1 - word.bbox.y0,
    fontSize: word.bbox.y1 - word.bbox.y0, // Approximation
    fontFamily: "Helvetica",
  }));

  await worker.terminate();
  return editableNodes;
}
```

### 4. Integration with Your Existing "Bake" Engine

Because you already have a Comlink Web Worker executing the merging, rotating, and baking, integrating this new Figma-like UI is incredibly streamlined:

1. **State Independence:** The user modifies the text, moves shapes via `dnd-kit`, and applies custom fonts via `fontkit`. All of this happens purely in the `zustand` DOM state.
2. **The Eraser Mask:** When an original PDF text node is edited, use your existing **Object Eraser** logic to silently push a white rectangle over the original PDF text coordinates in the `zustand` store.
3. **The Final Bake:** When the user hits export (or syncs to Google Drive), your main thread sends the original PDF bytes and the updated `zustand` array to the Comlink worker. The worker applies the white-out masks, embeds the TrueType fonts, and draws the new text perfectly in place using `pdf-lib`.

---

This hybrid approach guarantees that you preserve the strict structural integrity of the PDF format while giving the user the fluid, node-based editing experience of a modern design tool.

Since your Google Drive sync and authentication are already in place, would you like me to map out how to construct the **Undo/Redo stack** in Zustand to handle these complex node transformations without causing memory leaks?
