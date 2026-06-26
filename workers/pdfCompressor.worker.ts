import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { expose } from "comlink";

// Pre-load pdf.worker to evaluate inline and set up the fake worker
import "pdfjs-dist/build/pdf.worker.min.mjs";

export interface CompressionProgress {
  phase: "rasterizing" | "assembling" | "done" | "error";
  percent: number;
  message: string;
}

const COMPRESSION_PROFILES = {
  LOW: { scale: 1.5, format: "image/png", quality: undefined },
  MEDIUM: { scale: 1.0, format: "image/jpeg", quality: 0.65 },
  EXTREME: { scale: 0.6, format: "image/jpeg", quality: 0.18 },
} as const;

export type CompressionLevel = keyof typeof COMPRESSION_PROFILES;

const compressor = {
  async compress(
    pdfBytes: Uint8Array,
    level: CompressionLevel,
    onProgress: (progress: CompressionProgress) => void
  ): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
    const profile = COMPRESSION_PROFILES[level];

    // Phase 1: Load PDF Documents
    onProgress({
      phase: "rasterizing",
      percent: 0,
      message: "Parsing PDF content...",
    });

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const outPdfDoc = await PDFDocument.create();
    let srcPdfDoc: PDFDocument | null = null;

    if (level === "LOW") {
      srcPdfDoc = await PDFDocument.load(pdfBytes);
    }

    // Phase 2: Page by page processing
    for (let i = 1; i <= numPages; i++) {
      onProgress({
        phase: "rasterizing",
        percent: Math.round(((i - 1) / numPages) * 90),
        message: `Rasterizing page ${i} of ${numPages}...`,
      });

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: profile.scale });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D context for OffscreenCanvas");
      }

      // Fill canvas background with white
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderContext: any = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert to blob
      const blob = await canvas.convertToBlob({
        type: profile.format,
        quality: profile.quality,
      });

      const imageBytes = new Uint8Array(await blob.arrayBuffer());

      // Assemble to new PDF
      const newPage = outPdfDoc.addPage([viewport.width, viewport.height]);

      let embeddedImage;
      if (profile.format === "image/png") {
        embeddedImage = await outPdfDoc.embedPng(imageBytes);
      } else {
        embeddedImage = await outPdfDoc.embedJpg(imageBytes);
      }

      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      });

      if (level === "LOW" && srcPdfDoc) {
        const [embeddedPage] = await outPdfDoc.embedPages([srcPdfDoc.getPage(i - 1)]);
        newPage.drawPage(embeddedPage, {
          x: 0,
          y: 0,
          xScale: profile.scale,
          yScale: profile.scale,
          opacity: 0,
        });
      }

      page.cleanup();
    }

    pdf.destroy();

    // Phase 3: Final assembly save
    onProgress({
      phase: "assembling",
      percent: 90,
      message: "Saving compressed document...",
    });

    const compressedBytes = await outPdfDoc.save({ useObjectStreams: true });

    onProgress({
      phase: "done",
      percent: 100,
      message: "Compression complete!",
    });

    return {
      pdfBytes: compressedBytes,
      pageCount: numPages,
    };
  },
};

expose(compressor);
export type { CompressionLevel as CompLevel };
export type { CompressionProgress as CompProgress };
