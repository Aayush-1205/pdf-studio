"use client";

import { useState, useCallback } from "react";
import { usePDFStore } from "@/app/store/usePDFStore";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { get } from "idb-keyval";
import type { BakeOverlay } from "@/app/lib/overlayTypes";
import {
  hexToRgb01,
  domYtoPdfY,
  pointsToSvgPath,
  flipSvgPathY,
  dataUrlToUint8Array,
} from "@/app/lib/pdfUtils";

/**
 * Hook that orchestrates the full "bake & export" pipeline:
 *
 * 1. Reads the raw PDF bytes from IndexedDB
 * 2. Gathers all overlay layers from the Zustand store
 * 3. Converts each overlay to the BakeOverlay format (coordinate & color translation)
 * 4. Dispatches to the Web Worker's `bakeEdits()` function
 * 5. Triggers a browser download of the baked PDF
 */
export function useExportPDF() {
  const worker = usePDFWorker();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPDF = useCallback(
    async (fileName = "edited-document.pdf") => {
      if (!worker) {
        setError("PDF worker not ready");
        return;
      }

      setIsExporting(true);
      setError(null);

      try {
        // ── 1. Get raw PDF bytes from IndexedDB ───────────────────
        const storedPdf = await get("active_pdf");
        if (!storedPdf) throw new Error("No PDF found in storage");

        let buffer: ArrayBuffer;
        if (storedPdf instanceof Blob) {
          buffer = await storedPdf.arrayBuffer();
        } else if (storedPdf instanceof ArrayBuffer) {
          buffer = storedPdf;
        } else if (ArrayBuffer.isView(storedPdf)) {
          const view = storedPdf as Uint8Array;
          buffer =
            view.buffer instanceof ArrayBuffer
              ? view.buffer.slice(
                  view.byteOffset,
                  view.byteOffset + view.byteLength,
                )
              : new ArrayBuffer(0);
        } else {
          throw new Error("Invalid PDF data in storage");
        }

        const pdfBytes = new Uint8Array(buffer);

        // ── 2. Read overlay state ─────────────────────────────────
        const state = usePDFStore.getState();
        const {
          newTextItems,
          newImageItems,
          highlights,
          drawStrokes,
          customFont,
        } = state;

        // We need page heights for coordinate conversion.
        // Load the PDF via pdf-lib to query page dimensions.
        const { PDFDocument } = await import("pdf-lib");
        const tempDoc = await PDFDocument.load(pdfBytes, {
          updateMetadata: false,
        });
        const pageHeights = tempDoc.getPages().map((p) => p.getHeight());

        // ── 3. Build BakeOverlay array ────────────────────────────
        const overlays: BakeOverlay[] = [];

        // Text items
        for (const t of newTextItems) {
          const ph = pageHeights[t.pageIndex] ?? 842; // A4 fallback
          const color = hexToRgb01(t.color);
          overlays.push({
            type: "TEXT",
            pageIndex: t.pageIndex,
            x: t.x,
            y: t.y, // Already in PDF coords (stored that way in store)
            text: t.text,
            fontFamily: t.fontFamily,
            fontSize: t.fontSize,
            color,
          });
        }

        // Image items
        for (const img of newImageItems) {
          const { bytes, imageType } = dataUrlToUint8Array(img.dataUrl);
          overlays.push({
            type: "IMAGE",
            pageIndex: img.pageIndex,
            x: img.x,
            y: img.y, // Already in PDF coords
            width: img.width,
            height: img.height,
            imageBytes: bytes,
            imageType,
          });
        }

        // Highlights (stored as screen-space pixel coords)
        for (const h of highlights) {
          const ph = pageHeights[h.pageIndex] ?? 842;
          const zoom = state.zoom;
          // Convert screen→PDF coords
          const pdfX = h.x / zoom;
          const pdfY = domYtoPdfY(h.y / zoom, ph, h.height / zoom);
          const color = hexToRgb01(h.color);
          overlays.push({
            type: "RECTANGLE",
            pageIndex: h.pageIndex,
            x: pdfX,
            y: pdfY,
            width: h.width / zoom,
            height: h.height / zoom,
            color,
            opacity: h.opacity,
          });
        }

        // Draw strokes (stored as screen-space pixel coords)
        for (const stroke of drawStrokes) {
          const ph = pageHeights[stroke.pageIndex] ?? 842;
          const zoom = state.zoom;
          // Scale screen coords → PDF coords
          const scaledPoints = stroke.points.map((p) => ({
            x: p.x / zoom,
            y: p.y / zoom,
          }));
          const rawPath = pointsToSvgPath(scaledPoints);
          const pdfPath = flipSvgPathY(rawPath, ph);
          const color = hexToRgb01(stroke.color);
          overlays.push({
            type: "DRAWING",
            pageIndex: stroke.pageIndex,
            svgPath: pdfPath,
            color,
            lineWidth: stroke.lineWidth,
          });
        }

        // ── 4. Get custom font bytes if any ───────────────────────
        let customFontBytes: Uint8Array | undefined;
        if (customFont) {
          customFontBytes = new Uint8Array(customFont.buffer);
        }

        // ── 5. Dispatch to worker ─────────────────────────────────
        const processedBytes = await worker.bakeEdits(
          pdfBytes,
          overlays,
          customFontBytes,
        );

        // ── 6. Trigger download ───────────────────────────────────
        const blob = new Blob([processedBytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.type = "application/pdf";
        link.style.display = "none";
        document.body.appendChild(link);
        requestAnimationFrame(() => {
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 60000);
        });
      } catch (err) {
        console.error("Export failed:", err);
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    [worker],
  );

  return { exportPDF, isExporting, error };
}
