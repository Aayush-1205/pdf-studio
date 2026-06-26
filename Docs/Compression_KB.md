# 📚 PDF Compression Module — Knowledge Base (KB)

**Module:** PDF Compression  
**Last Updated:** June 27, 2026  
**KB Type:** Module-Level Knowledge Base  
**Status:** Implemented and Verified  

---

## 🧭 Overview & Goal

The **PDF Compression Module** reduces PDF file size for easier sharing, uploading, or sending via email. It is designed to run completely off the main thread to ensure the browser remains responsive even when compressing large documents (e.g., 50+ pages).

Key goals:
1. **Responsive UI:** Never block the main execution thread. Offload all rendering, canvas serialization, and PDF building to a background Web Worker.
2. **True Progress Tracking:** Provide page-by-page progress increments and explicit state phase updates.
3. **Text Searchability Preservation:** Keep text searchable and copy-pasteable in `LOW` mode by copying the original text layer.
4. **Drive Browser Enhancements:** Enable infinite scroll, pagination, breadcrumb navigation, and debounced searching for Google Drive imports.

---

## 🏗️ Architecture

```
CompressorModal.tsx (UI Modal)
       │
       │  calls
       ▼
usePDFCompressor (Hook Bridge)
       │
       │  instantiates and communicates via Comlink
       ▼
pdfCompressor.worker.ts (Background Web Worker)
       │
       │  Phase 1: pdfjsLib.getDocument()
       │  Phase 2: OffscreenCanvas → rasterize page-by-page
       │           (canvas.convertToBlob() yields JPG/PNG)
       │  Phase 3: pdf-lib → assemble output PDF
       │           (LOW: + hidden transparent Form XObject)
       │  Phase 4: outDoc.save() with useObjectStreams: true
       ▼
useCompressorStore (Zustand State Store)
       │
       ▼
Triggers React re-renders (ProgressBar, ResultCard, etc.)
```

---

## 🗂️ Module File Map

| File Path | Role |
|---|---|
| [store/useCompressorStore.ts](file:///c:/Users/Aayush/Webs/pdf/store/useCompressorStore.ts) | **Zustand Store:** Manages active compression level, phase, progress, stats, and error states. |
| [workers/pdfCompressor.worker.ts](file:///c:/Users/Aayush/Webs/pdf/workers/pdfCompressor.worker.ts) | **Background Worker:** Runs `pdfjs-dist` to rasterize pages sequentially using `OffscreenCanvas`, embeds transparent original page layer for `LOW` level, and saves PDF bytes. |
| [hooks/usePDFCompressor.ts](file:///c:/Users/Aayush/Webs/pdf/hooks/usePDFCompressor.ts) | **React Hook:** Owns Web Worker lifecycle, normalises input buffers, registers Comlink callbacks, and controls task abort cycles. |
| [components/pdf/CompressorModal.tsx](file:///c:/Users/Aayush/Webs/pdf/components/pdf/CompressorModal.tsx) | **React Modal Component:** Implements phase-based rendering, provides user-friendly text descriptions for non-tech users, renders the Drive file selector, and contains the `DriveUploadConfirm` sub-panel. |

---

## ⚙️ Compression Level Profiles

| Level | Scale | Format | Quality | Searchable text | Target Use Case / Non-Tech Description |
|---|---|---|---|---|---|
| **`LOW`** | 1.5× | PNG | — | ✅ Yes | Keep your document's text selectable and searchable with zero visual sharpness loss. Ideal for books, text-heavy PDFs, and legal contracts. |
| **`MEDIUM`** | 1.0× | JPEG | 0.65 | ❌ No | Recommended balance of size and quality for everyday sharing. Converts pages to standard JPEGs. Text is readable but not copyable. |
| **`EXTREME`**| 0.6× | JPEG | 0.18 | ❌ No | Aggressively scales pages down to 60% with low quality. Perfect for email attachments with strict file size limits. Graphics and text look pixelated. |

---

## 💡 Important Design Patterns & Technical Details

### 1. `OffscreenCanvas` & Worker Setup
Web Workers do not have access to the browser DOM (`document` or `window`). We instantiate `OffscreenCanvas(width, height)` inside the worker. 
- Calling `canvas.convertToBlob({ type, quality })` returns a binary `Blob` object natively.
- To use `pdfjs-dist` inside the worker without triggering runtime crashes related to worker paths, we evaluate the worker inline using:
  ```ts
  import "pdfjs-dist/build/pdf.worker.min.mjs";
  ```

### 2. Form XObject Text Layer Preservation (LOW Mode)
To keep text searchable in `LOW` mode:
- Draw the rasterized lossless image on the page.
- Load the original document byte array into a secondary `pdf-lib` document context (`srcPdfDoc`).
- Embed the original page as a Form XObject and draw it over the rasterized page at `opacity: 0`:
  ```ts
  const [embeddedPage] = await outPdfDoc.embedPages([srcPdfDoc.getPage(pageIndex)]);
  newPage.drawPage(embeddedPage, {
    x: 0,
    y: 0,
    xScale: scale,
    yScale: scale,
    opacity: 0,
  });
  ```
- PDF viewers index the transparent text of the Form XObject, enabling text copy-pasting and searchability without visual text double-rendering.

### 3. Sequential Page Processing (Memory Efficiency)
Holding all rasterized image blobs in RAM simultaneously can crash the browser on large documents. 
The worker processes pages **sequentially**:
1. Get and render PDF page $i$.
2. Convert canvas to blob, convert to `Uint8Array`.
3. Add a page to `outPdfDoc` and embed the image.
4. Draw the image (and transparent text if `LOW`).
5. Call `page.cleanup()` to release GPU canvas context.
6. Trigger the progress callback and loop to page $i+1$.

This approach ensures stable memory usage even on 100+ page documents.

### 4. Drive Integration & Safe Uploads
- **Debounced Search:** Uses a 400ms timeout on the input string to query items from `fetchDriveItems` without spamming API requests.
- **Infinite Scroll:** An `IntersectionObserver` tracks a loading sentinel at the bottom of the grid and loads next page results via `nextPageToken`.
- **In-place Save:** Clicking "Save to Drive" replaces the view with the folder selector and name input (`DriveUploadConfirm`) to avoid using `sessionStorage` side-effects.

---

## 🛠️ Contributor Guidelines

1. **Do not use `"use client"` in Web Workers:** Workers are loaded client-side but should not have React RSC boundary headers.
2. **TypeScript & Linter Compliance:**
   - Avoid generic `any` types. If you must use `any` (e.g., when passing typed `canvasContext` objects to `page.render()` which expect `RenderParameters`), use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` explicitly on that line.
   - Prefer catching errors as `unknown` and casting them safely:
     ```ts
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : String(err);
       onError(msg);
     }
     ```
3. **Keep `workers/pdfAssembler.worker.ts` untouched:** Do not delete it, as it is still used by the Page Organizer and Merge modules.
