import * as pdfjsLib from "pdfjs-dist";
import { nanoid } from "nanoid";
import { Page, Layer } from "../../store/useCanvasStore";

// Initialize the worker globally via CDN to avoid Next.js build issues with binary workers
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export type ExtractedPdfData = {
  pages: Page[];
  layers: Layer[]; // Native text blocks converted into editable layers
};

/**
 * Extracts all pages from a PDF as high-DPI rasterized PNG Data URLs,
 * and extracts text strings as selectable editable layers.
 */
export async function extractPdfPages(
  pdfBytes: Uint8Array,
  fileName: string = "Document",
): Promise<ExtractedPdfData> {
  const loadingTask = pdfjsLib.getDocument(pdfBytes);
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pages: Page[] = [];
  const layers: Layer[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharp editing resolution

    // Rasterize the page into an offscreen canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext: any = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Convert to highly compact Data URL (JPEG for size since PDFs can be massive, or PNG if transparent)
    // We use PNG because PDFs often have white backgrounds anyways, but JPEG at 0.9 is much smaller.
    const backgroundUrl = canvas.toDataURL("image/jpeg", 0.9);

    const standardWidth = viewport.width / 2.0;
    const standardHeight = viewport.height / 2.0;

    pages.push({
      id: nanoid(),
      pdfPageIndex: i - 1, // 0-indexed for our system
      width: standardWidth, // Store in standard 1x scale for CSS positioning
      height: standardHeight,
      backgroundUrl,
      groupName: fileName,
    });

    // --- Text Extraction ---
    // Here we'll map pdf text items into our Zustand engine
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!("str" in item)) continue; // ignore TextMarkedContent

      const str = item.str.trim();
      if (!str) continue; // ignore pure whitespace

      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, tx, ty]
      // In PDF, Y is measured from bottom-left. We must flip it to Top-Left
      const x = transform[4];
      const bottomY = transform[5];
      const fontSize = transform[0]; // roughly scaleX

      const y = standardHeight - bottomY - fontSize; // approximate top-left Y
      const width = item.width;

      // Context-aware color sampling to replace ghosting white-boxes!
      // Since our canvas is rendered at 2.0x scale, we multiply coordinates by 2 to find the exact pixel.
      // We sample 4 pixels to the top-left of the bounding box to grab the true background, avoiding the text stroke itself.
      const sampleX = Math.max(0, x * 2.0 - 4);
      const sampleY = Math.max(0, y * 2.0 - 4);

      let sampledColor = "transparent";
      try {
        const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
        if (pixel[3] > 0) {
          // If not fully transparent
          sampledColor = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
        }
      } catch (err) {
        // Cross-origin or out of bounds fail-safe
      }

      layers.push({
        type: "TEXT",
        pageIndex: i - 1,
        x,
        y,
        width: Math.max(width, 50),
        height: fontSize * 1.5,
        fill: "#000000",
        stroke: "transparent",
        opacity: 100,
        text: str,
        fontSize: Math.max(fontSize, 8),
        fontFamily: item.fontName || "Helvetica",
        textAlign: "left",
        lineHeight: 1.2,
        sampledBackgroundColor: sampledColor,
      });
    }
  }

  return { pages, layers };
}
