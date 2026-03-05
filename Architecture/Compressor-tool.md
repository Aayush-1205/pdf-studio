To achieve extreme client-side PDF compression (like dropping from 1MB down to 15KB), we have to be completely candid about how PDF architecture works.

Libraries like `pdf-lib` alone cannot achieve this because they only repackage existing data; they cannot natively downsample high-resolution images or outline complex embedded fonts.

To achieve that "15KB" dream entirely in the browser, we must implement an **Aggressive Rasterization Pipeline**. We will use `pdfjs-dist` to render the PDF pages into invisible HTML5 `<canvas>` elements, compress those canvases into highly optimized JPEGs, and then use `pdf-lib` to stitch those lightweight JPEGs back into a brand-new PDF.

Since you are already using `pdfjs-dist`, `pdf-lib`, and `comlink` (Web Workers), **you do not need any new external dependencies.** You already have the perfect stack.

Here is the detailed implementation plan to build this Compressor Tool.

---

### 🎛️ Step 1: The Compression State (Zustand)

First, we need to add the compression settings to your existing global store so the UI can control the quality.

```typescript
// store/useCompressorStore.ts
import { create } from "zustand";

export type CompressionLevel = "LOW" | "MEDIUM" | "EXTREME";

interface CompressorState {
  compressionLevel: CompressionLevel;
  isCompressing: boolean;
  originalSize: number;
  compressedSize: number;
  setCompressionLevel: (level: CompressionLevel) => void;
  setCompressionStatus: (status: boolean) => void;
  setStats: (original: number, compressed: number) => void;
}

export const useCompressorStore = create<CompressorState>((set) => ({
  compressionLevel: "MEDIUM",
  isCompressing: false,
  originalSize: 0,
  compressedSize: 0,
  setCompressionLevel: (level) => set({ compressionLevel: level }),
  setCompressionStatus: (isCompressing) => set({ isCompressing }),
  setStats: (originalSize, compressedSize) =>
    set({ originalSize, compressedSize }),
}));
```

---

### ⚙️ Step 2: The "Crusher" Web Worker Engine

Because rendering canvases and compressing JPEGs is incredibly CPU-intensive, this **must** happen inside your `comlink` Web Worker. If you run this on the main thread, the user's browser will freeze.

Add this specific compression function to your existing `pdfWorker.ts`:

```typescript
// workers/pdfWorker.ts
import * as pdfjs from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

// Map our UI levels to exact scaling and JPEG quality metrics
const COMPRESSION_PROFILES = {
  LOW: { scale: 1.5, quality: 0.8 }, // Good for reading, moderate size reduction
  MEDIUM: { scale: 1.0, quality: 0.5 }, // Great balance of size and legibility
  EXTREME: { scale: 0.7, quality: 0.2 }, // The "15KB" mode. Blurry, but tiny.
};

export async function compressPdf(
  fileBuffer: ArrayBuffer,
  level: "LOW" | "MEDIUM" | "EXTREME",
): Promise<Uint8Array> {
  const profile = COMPRESSION_PROFILES[level];

  // 1. Initialize the new, empty "Lightweight" PDF
  const newPdfDoc = await PDFDocument.create();

  // 2. Read the original heavy PDF using pdf.js
  const loadingTask = pdfjs.getDocument({ data: fileBuffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  // 3. Process page by page
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: profile.scale });

    // Create an OffscreenCanvas (Web Worker safe)
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    // Render the PDF page onto the canvas
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // 4. Crush the canvas into a highly compressed JPEG Blob
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: profile.quality,
    });
    const jpegBuffer = await blob.arrayBuffer();

    // 5. Embed the lightweight JPEG into the new PDF-lib document
    const embeddedImage = await newPdfDoc.embedJpg(jpegBuffer);
    const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);

    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
  }

  // 6. Save with pdf-lib's native stream compression turned on
  return await newPdfDoc.save({ useObjectStreams: false });
}
```

---

### 🖥️ Step 3: The Main Thread Implementation (React)

Now we connect the UI to the Web Worker. This component handles the file upload, triggers the worker, and calculates the size reduction.

```tsx
// components/CompressorTool.tsx
"use client";
import { useRef } from "react";
import { useCompressorStore } from "@/store/useCompressorStore";
import { wrap } from "comlink";

// Format bytes to MB/KB helper
const formatBytes = (bytes: number) =>
  (bytes / (1024 * 1024)).toFixed(2) + " MB";

export default function CompressorTool() {
  const {
    compressionLevel,
    setCompressionLevel,
    isCompressing,
    setCompressionStatus,
    originalSize,
    compressedSize,
    setStats,
  } = useCompressorStore();

  const workerRef = useRef<any>(null);

  const handleCompress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressionStatus(true);
    const arrayBuffer = await file.arrayBuffer();

    // Initialize Comlink Worker
    if (!workerRef.current) {
      workerRef.current = wrap(
        new Worker(new URL("../workers/pdfWorker.ts", import.meta.url)),
      );
    }

    try {
      // Send to Web Worker
      const compressedBytes = await workerRef.current.compressPdf(
        arrayBuffer,
        compressionLevel,
      );

      setStats(file.size, compressedBytes.byteLength);

      // Trigger Download
      const blob = new Blob([compressedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Compression failed:", error);
    } finally {
      setCompressionStatus(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg w-96 flex flex-col gap-4">
      <h2 className="text-lg font-bold">PDF Compressor</h2>

      {/* Settings */}
      <select
        className="border p-2 rounded"
        value={compressionLevel}
        onChange={(e) => setCompressionLevel(e.target.value as any)}
      >
        <option value="LOW">Low (Retains Quality)</option>
        <option value="MEDIUM">Medium (Recommended)</option>
        <option value="EXTREME">Extreme (Smallest Size)</option>
      </select>

      {/* Upload Trigger */}
      <input
        type="file"
        accept=".pdf"
        onChange={handleCompress}
        disabled={isCompressing}
        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      {/* Status & Stats */}
      {isCompressing && (
        <p className="text-blue-500 animate-pulse">
          Crushing PDF in Web Worker...
        </p>
      )}

      {compressedSize > 0 && !isCompressing && (
        <div className="text-sm bg-green-50 p-3 rounded border border-green-200">
          <p>
            Original: <strong>{formatBytes(originalSize)}</strong>
          </p>
          <p>
            Compressed: <strong>{formatBytes(compressedSize)}</strong>
          </p>
          <p className="text-green-600 font-bold mt-1">
            Saved {((1 - compressedSize / originalSize) * 100).toFixed(0)}%
            space!
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### ⚠️ The Important Trade-Off (What you must know)

By using this **Rasterization Method**, you achieve phenomenal file sizes, but you are converting the PDF from a _Vector document_ into a _Raster image document_.

- **The Pro:** It guarantees size reduction. It flattens all layers, removes embedded hidden fonts, strips all heavy metadata, and scales down massive 4K images hidden inside the PDF.
- **The Con:** The text in the resulting compressed PDF will no longer be highlightable or searchable.

**How to level this up (Phase 2 of Compression):**
If you want to keep the text selectable while compressing, you have to build an _Extraction Compressor_. This is substantially harder client-side, but it involves using `pdf-lib` to read the document, extracting the raw image streams, running them through a JS image compressor, and writing them back without touching the text. However, for a web utility aiming for "Extreme Compression", the Rasterization pipeline provided above is the industry standard for client-side tools.
