import { useCanvasStore } from "../store/useCanvasStore";
import { PDFDocument } from "pdf-lib";
import { hexToRgb01, getSvgPathFromStroke } from "../app/lib/pdfUtils";
import { getStroke } from "perfect-freehand";

/**
 * Robust color conversion that handles hex strings (including shorthand)
 * and ensures values are in the 0-1 range.
 */
function normalizeColor(color: string | any) {
  if (typeof color !== "string" || color === "transparent") {
    return { r: 0, g: 0, b: 0 };
  }

  try {
    return hexToRgb01(color);
  } catch (e) {
    console.warn(`Failed to parse color: ${color}`, e);
    return { r: 0, g: 0, b: 0 };
  }
}

export const generateBakedPDF = async (worker: Worker): Promise<Blob> => {
  const store = useCanvasStore.getState();
  const { layerIds, layers, pdfBytes, pages } = store;

  // Assemble the base PDF accurately based on the current `store.pages`
  // This gracefully handles blank page insertions and reordered original pages.
  const outDoc = await PDFDocument.create();
  const srcDoc = pdfBytes ? await PDFDocument.load(pdfBytes) : null;

  if (pages.length === 0) {
    outDoc.addPage([800, 1131]);
  } else {
    for (const p of pages) {
      if (
        srcDoc &&
        p.pdfPageIndex !== undefined &&
        p.pdfPageIndex >= 0 &&
        p.pdfPageIndex < srcDoc.getPageCount()
      ) {
        const [copiedPage] = await outDoc.copyPages(srcDoc, [p.pdfPageIndex]);
        outDoc.addPage(copiedPage);
      } else {
        outDoc.addPage([p.width, p.height]);
      }
    }
  }

  const basePdfBytes = await outDoc.save();

  // Map local canvas layers to worker expectations
  const overlays: any[] = layerIds
    .map((id: string) => {
      const layer = layers[id];

      if (layer.type === "RECTANGLE") {
        return {
          type: "RECTANGLE",
          pageIndex: layer.pageIndex,
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          fillColor:
            !layer.fill || layer.fill === "transparent" || layer.fill === ""
              ? undefined
              : normalizeColor(layer.fill),
          strokeColor:
            !layer.stroke ||
            layer.stroke === "transparent" ||
            layer.stroke === ""
              ? undefined
              : normalizeColor(layer.stroke),
          opacity: (layer.opacity ?? 100) / 100,
        };
      }

      if (layer.type === "TEXT") {
        if (layer.isOriginal && !layer.isEdited) {
          return null; // Don't export original text that hasn't been touched, the base PDF already has it!
        }
        return {
          type: "TEXT",
          pageIndex: layer.pageIndex,
          x: layer.x,
          y: layer.y,
          text: layer.text || "",
          fontFamily: layer.fontFamily || "Helvetica",
          fontSize: layer.fontSize || 16,
          color: normalizeColor(layer.fill),
          // Background: use sampledBackgroundColor (what the user-set background is stored as)
          // Fall back to stroke if explicitly set (and not transparent)
          bgColor:
            layer.sampledBackgroundColor &&
            layer.sampledBackgroundColor !== "transparent" &&
            layer.sampledBackgroundColor !== ""
              ? normalizeColor(layer.sampledBackgroundColor)
              : layer.stroke &&
                  layer.stroke !== "transparent" &&
                  layer.stroke !== ""
                ? normalizeColor(layer.stroke)
                : undefined,
          width: layer.width,
          height: layer.height,
          alignment: layer.textAlign || "left",
          isBold: layer.isBold,
          isItalic: layer.isItalic,
          isUnderline: layer.isUnderline,
          isStrikethrough: layer.isStrikethrough,
          lineHeight: layer.lineHeight,
          isOriginal: layer.isOriginal,
          originX: layer.originX,
          originY: layer.originY,
          originWidth: layer.originWidth,
          originHeight: layer.originHeight,
          // Pass sampledBackgroundColor separately for the original-text mask rectangle
          sampledBackgroundColor:
            layer.isOriginal &&
            layer.sampledBackgroundColor &&
            layer.sampledBackgroundColor !== "transparent" &&
            layer.sampledBackgroundColor !== ""
              ? normalizeColor(layer.sampledBackgroundColor)
              : undefined,
        };
      }

      if (layer.type === "PATH") {
        const absolutePoints = (layer.points || []).map((p: number[]) => [
          p[0] + layer.x,
          p[1] + layer.y,
        ]);

        const strokePoints = getStroke(absolutePoints, {
          size: 4,
          thinning: 0.5,
          smoothing: 0.5,
          streamline: 0.5,
        });
        const pathData = getSvgPathFromStroke(strokePoints);

        return {
          type: "DRAWING",
          pageIndex: layer.pageIndex,
          svgPath: pathData,
          color: normalizeColor(layer.stroke),
          lineWidth: 2,
        };
      }

      if (layer.type === "LINE" || layer.type === "ARROW") {
        return {
          type: "SHAPE",
          pageIndex: layer.pageIndex,
          shapeType: layer.type === "LINE" ? "line" : "arrow",
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          lineWidth: Math.max(
            2,
            layer.type === "LINE" ? layer.height : layer.height / 2,
          ),
          color: normalizeColor(layer.fill),
        };
      }

      if (layer.type === "ELLIPSE") {
        return {
          type: "SHAPE",
          pageIndex: layer.pageIndex,
          shapeType: "circle",
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          lineWidth: layer.stroke === "transparent" ? 0 : 2,
          color:
            layer.stroke === "transparent"
              ? undefined
              : normalizeColor(layer.stroke),
          fillColor:
            layer.fill === "transparent"
              ? undefined
              : normalizeColor(layer.fill),
        };
      }

      if (layer.type === "IMAGE") {
        if (!layer.src) return null;

        try {
          const base64Data = layer.src.split(",")[1];
          const isPng = layer.src.includes("image/png");
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return {
            type: "IMAGE",
            pageIndex: layer.pageIndex,
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            imageType: isPng ? "png" : "jpg",
            imageBytes: bytes,
            opacity: (layer.opacity ?? 100) / 100,
            // Advanced image features for flattening
            filters: layer.filters,
            crop: layer.crop,
            cornerRadius: layer.cornerRadius,
            originalWidth: layer.originalWidth,
            originalHeight: layer.originalHeight,
          };
        } catch (e) {
          console.error("Failed to parse image for export");
          return null;
        }
      }

      return null;
    })
    .filter(Boolean);

  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substring(2, 9);

    const onMessage = (e: MessageEvent) => {
      if (e.data.id === messageId) {
        worker.removeEventListener("message", onMessage);
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(new Blob([e.data.result], { type: "application/pdf" }));
        }
      }
    };

    worker.addEventListener("message", onMessage);

    worker.postMessage({
      id: messageId,
      method: "bakeEdits",
      // Clone the array to guarantee no detachment side-effects crash subsequent exports
      args: [
        new Uint8Array(basePdfBytes),
        overlays,
        pages.map((p: any) => ({ pdfPageIndex: p.pdfPageIndex })),
      ],
    });
  });
};
