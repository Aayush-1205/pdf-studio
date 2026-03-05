Building a Page Resize Tool that mathematically scales content to fit new dimensions without overflowing or distorting is a fantastic addition. It transforms your app from a basic editor into a true document standardization suite.

In the PDF ecosystem, changing the size of a page (e.g., from US Letter to A4) isn't as simple as changing an HTML container. PDF content has absolute X/Y coordinates. If you shrink the page boundaries (the `MediaBox`), the content will be clipped.

To solve this flawlessly, we will use an **Embedded Page Scaling Architecture**. Instead of altering the original page, we generate a brand-new blank page at the target size, convert the _entire original page_ into a scalable vector object (an XObject), and draw it perfectly centered onto the new page.

Here is the detailed implementation plan for the **Smart Page Resizer**.

---

### 📦 1. Required Packages & Libraries

The brilliant part of your current architecture is that **you do not need to install any new libraries**.

- **`pdf-lib`**: Has a native `.embedPage()` API that is specifically designed for this exact requirement. It allows you to treat a full PDF page like an image, scaling and centering it without losing vector quality or text crispness.
- **`zustand`**: Will handle the UI state (which pages to resize, target dimensions).
- **`comlink`**: Will offload the heavy calculations and PDF rebuilding to your Web Worker.

_(Optional)_ If you want a nice UI dropdown for standard paper sizes, you don't need a library; just use a static constant dictionary:

```typescript
const PAPER_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
};
```

---

### 🧠 2. The Implementation Plan

#### Step 1: The UI & State Management (Zustand)

You need to allow the user to select the target size and the target pages.

Update your store to track the resize tool's state:

```typescript
// store/useResizeStore.ts
type PageRange = "ALL" | "CURRENT" | "CUSTOM";

interface ResizeState {
  targetSize: [number, number]; // [width, height]
  pageRange: PageRange;
  customRange: number[]; // e.g., [1, 3, 5]
  setTargetSize: (size: [number, number]) => void;
  setPageRange: (range: PageRange) => void;
  setCustomRange: (pages: number[]) => void;
}
```

**UI Component:** Build a right-hand sidebar panel when the "Resize Tool" is active. It should contain a dropdown for standard sizes (A4, Letter), input fields for Custom Width/Height, and a radio button group for "All Pages", "Current Page", or "Specific Pages".

#### Step 2: The Mathematical "Fit" Logic (Web Worker)

Inside your `pdfWorker.ts`, you need a helper function that calculates how to scale the embedded page so it fits inside the new dimensions _without_ stretching or distorting.

```typescript
// workers/pdfWorker.ts
function calculateScaleAndPosition(
  origWidth: number,
  origHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  // Calculate the scale factors for both dimensions
  const scaleX = targetWidth / origWidth;
  const scaleY = targetHeight / origHeight;

  // Use the smaller scale factor to ensure it fits without overflow (preserve aspect ratio)
  const scale = Math.min(scaleX, scaleY);

  // Calculate new dimensions
  const scaledWidth = origWidth * scale;
  const scaledHeight = origHeight * scale;

  // Calculate X and Y offsets to center the content perfectly
  const x = (targetWidth - scaledWidth) / 2;
  const y = (targetHeight - scaledHeight) / 2;

  return { scale, x, y };
}
```

#### Step 3: The `pdf-lib` Embedding Pipeline (Web Worker)

This is the core engine of the tool. You pass the original PDF bytes and the user's resize parameters to the Web Worker. The worker builds a fresh PDF.

```typescript
// workers/pdfWorker.ts
import { PDFDocument } from "pdf-lib";

export async function resizePdfPages(
  fileBuffer: ArrayBuffer,
  targetDimensions: [number, number],
  pagesToResize: number[], // Array of 0-based page indexes, pass a full array for 'ALL'
): Promise<Uint8Array> {
  const originalPdf = await PDFDocument.load(fileBuffer);
  const newPdf = await PDFDocument.create();

  const originalPages = originalPdf.getPages();
  const targetWidth = targetDimensions[0];
  const targetHeight = targetDimensions[1];

  for (let i = 0; i < originalPages.length; i++) {
    if (pagesToResize.includes(i)) {
      // 1. Create a blank page at the target size
      const newPage = newPdf.addPage([targetWidth, targetHeight]);

      // 2. Embed the original page as an object
      const embeddedPage = await newPdf.embedPage(originalPages[i]);
      const origDims = embeddedPage.size();

      // 3. Calculate scaling and centering
      const { scale, x, y } = calculateScaleAndPosition(
        origDims.width,
        origDims.height,
        targetWidth,
        targetHeight,
      );

      // 4. Draw the embedded page onto the new blank page
      newPage.drawPage(embeddedPage, {
        x: x,
        y: y,
        xScale: scale,
        yScale: scale,
      });
    } else {
      // If page is not selected for resize, simply copy it over as-is
      const [copiedPage] = await newPdf.copyPages(originalPdf, [i]);
      newPdf.addPage(copiedPage);
    }
  }

  return await newPdf.save();
}
```

#### Step 4: Updating the Konva Canvas (UI Reflection)

If the user resizes the _current_ page while editing, your Konva Canvas must immediately reflect this change visually.

1. Await the Web Worker to finish returning the new `Uint8Array`.
2. Reload `pdfjs-dist` with this new buffer to extract the new background image.
3. Update your Zustand `camera` or `background` dimensions to match the new `targetSize`.
4. (Crucial) Because the content was scaled down mathematically in the PDF, any user-added layers currently in Zustand (text, rectangles) will now be misaligned. You must loop through your Zustand `layers` array and apply the exact same `scale`, `x`, and `y` offsets to them so they match the newly resized background.

---

### ⚖️ Advantages vs. Disadvantages of this Architecture

#### **Advantages:**

1. **Flawless Quality:** Because we are embedding pages (not rasterizing them to images), all text remains selectable, and all vector paths remain infinitely sharp.
2. **Zero Distortion:** The `Math.min(scaleX, scaleY)` logic guarantees the page will never stretch or squash unnaturally. It perfectly maintains the aspect ratio.
3. **Centering Automation:** The math automatically calculates the margins required to keep the content perfectly centered, effectively acting as an automated "White Space Padding" tool.
4. **Selective Processing:** The `pagesToResize` array easily handles "Single Page", "Custom Range", or "All Pages" natively.

#### **Disadvantages & Edge Cases:**

1. **Interactive Elements Flattening:** When you use `embedPage()`, `pdf-lib` turns the visual layer of the page into an object. If the original page had interactive elements (like Fillable Text Forms, Checkboxes, or clickable Hyperlinks), those interactions **will be lost** on the resized page (they will become static graphics).

- _Mitigation:_ You would need to write a complex script to extract the annotations from the original page and mathematically translate their bounding boxes to the new page. For most editors, losing links on resize is an acceptable trade-off.

2. **Increased File Size (Slightly):** Creating a new document and embedding pages _can_ marginally increase the file size compared to mutating a document directly, as PDF dictionaries are rebuilt.
3. **Blank Margins (Letterboxing):** If a user resizes a tall, thin page (like a receipt) to a wide landscape page (like A3 Landscape), the algorithm will fit the receipt in the middle and leave massive white margins on the left and right.

- _Mitigation:_ In the UI, add an advanced option called "Stretch to Fill" (ignoring aspect ratio) or "Crop to Fill", so the user has control over these extreme cases.
