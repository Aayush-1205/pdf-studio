import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import * as pdfjsLib from "pdfjs-dist";

// CRITICAL FIX: To prevent "No GlobalWorkerOptions.workerSrc" and avoid
// spawning sub-workers from inside a Web Worker, we natively import the worker
// script. This evaluates it inline and automatically sets up the fake worker.
import "pdfjs-dist/build/pdf.worker.min.mjs";

interface BakeTextOverlay {
  type: "TEXT";
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: { r: number; g: number; b: number };
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  alignment?: "left" | "center" | "right" | "justify";
  bgColor?: { r: number; g: number; b: number };
  width: number;
  height: number;
  lineHeight?: number;
  isOriginal?: boolean;
  originX?: number;
  originY?: number;
  originWidth?: number;
  originHeight?: number;
  sampledBackgroundColor?: { r: number; g: number; b: number };
}

interface BakeImageOverlay {
  type: "IMAGE";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageBytes: Uint8Array;
  imageType: "png" | "jpg";
  rotation?: number;
  opacity?: number;
  // Advanced image features
  filters?: {
    brightness?: number;
    contrast?: number;
    blurRadius?: number;
    grayscale?: boolean;
    saturate?: number;
    hueRotate?: number;
    sepia?: boolean;
    invert?: boolean;
  };
  crop?: { x: number; y: number; width: number; height: number };
  cornerRadius?: number;
  originalWidth?: number;
  originalHeight?: number;
}

interface BakeRectangleOverlay {
  type: "RECTANGLE";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: { r: number; g: number; b: number };
  strokeColor?: { r: number; g: number; b: number };
  lineWidth?: number;
  opacity: number;
}

interface BakeDrawingOverlay {
  type: "DRAWING";
  pageIndex: number;
  svgPath: string;
  color: { r: number; g: number; b: number };
  lineWidth: number;
}

interface BakeShapeOverlay {
  type: "SHAPE";
  pageIndex: number;
  shapeType: "rect" | "circle" | "line" | "arrow" | "triangle" | "star";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: { r: number; g: number; b: number };
  fillColor?: { r: number; g: number; b: number };
  lineWidth: number;
}

type BakeOverlay =
  | BakeTextOverlay
  | BakeImageOverlay
  | BakeRectangleOverlay
  | BakeDrawingOverlay
  | BakeShapeOverlay;

// ── Font Matching Helper ────────────────────────────────────────────

const FONT_MAP: Record<string, keyof typeof StandardFonts> = {
  helvetica: "Helvetica",
  "helvetica-bold": "HelveticaBold",
  "helvetica-oblique": "HelveticaOblique",
  "helvetica-boldoblique": "HelveticaBoldOblique",
  times: "TimesRoman",
  timesnewroman: "TimesRoman",
  "times-roman": "TimesRoman",
  "times-bold": "TimesRomanBold",
  "times-italic": "TimesRomanItalic",
  "times-bolditalic": "TimesRomanBoldItalic",
  courier: "Courier",
  "courier-bold": "CourierBold",
  "courier-oblique": "CourierOblique",
  "courier-boldoblique": "CourierBoldOblique",
  arial: "Helvetica",
  "arial-bold": "HelveticaBold",
  "arial-italic": "HelveticaOblique",
  verdana: "Helvetica",
  georgia: "TimesRoman",
  tahoma: "Helvetica",
  calibri: "Helvetica",
  cambria: "TimesRoman",
  garamond: "TimesRoman",
  palatino: "TimesRoman",
  symbol: "Symbol",
  zapfdingbats: "ZapfDingbats",
};

function normalizeFontName(pdfFontName: string): string {
  let name = pdfFontName.replace(/^[A-Z]{6}\+/, "");
  name = name.replace(/[-,]?(MT|PS|Regular|Reg)$/i, "");
  return name
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .trim();
}

function matchStandardFont(fontName: string): keyof typeof StandardFonts {
  const f = fontName.toLowerCase();

  if (f.includes("times")) {
    if (f.includes("bold") && f.includes("italic"))
      return "TimesRomanBoldItalic";
    if (f.includes("bold")) return "TimesRomanBold";
    if (f.includes("italic") || f.includes("oblique"))
      return "TimesRomanItalic";
    return "TimesRoman";
  }

  if (f.includes("courier")) {
    if (f.includes("bold") && f.includes("oblique"))
      return "CourierBoldOblique";
    if (f.includes("bold")) return "CourierBold";
    if (f.includes("oblique") || f.includes("italic")) return "CourierOblique";
    return "Courier";
  }

  // Default to Helvetica variants
  if (f.includes("bold") && f.includes("oblique"))
    return "HelveticaBoldOblique";
  if (f.includes("bold")) return "HelveticaBold";
  if (f.includes("oblique") || f.includes("italic")) return "HelveticaOblique";
  return "Helvetica";
}

function getFormattedFontKey(
  baseFont: string,
  isBold?: boolean,
  isItalic?: boolean,
): keyof typeof StandardFonts {
  let name = baseFont;
  if (isBold && !name.toLowerCase().includes("bold")) name += "-Bold";
  if (
    isItalic &&
    !name.toLowerCase().includes("italic") &&
    !name.toLowerCase().includes("oblique")
  )
    name += "-Oblique";
  return matchStandardFont(name);
}

// ── Worker methods (plain functions) ────────────────────────────────

async function mergePDFs(
  pdfBytesA: Uint8Array,
  pdfBytesB: Uint8Array,
): Promise<Uint8Array> {
  const pdfA = await PDFDocument.load(pdfBytesA);
  const pdfB = await PDFDocument.load(pdfBytesB);
  const mergedPdf = await PDFDocument.create();
  const copiedPagesA = await mergedPdf.copyPages(pdfA, pdfA.getPageIndices());
  copiedPagesA.forEach((page) => mergedPdf.addPage(page));
  const copiedPagesB = await mergedPdf.copyPages(pdfB, pdfB.getPageIndices());
  copiedPagesB.forEach((page) => mergedPdf.addPage(page));
  return mergedPdf.save();
}

async function reorderPages(
  pdfBytes: Uint8Array,
  newOrder: number[],
): Promise<Uint8Array> {
  const originalPdf = await PDFDocument.load(pdfBytes);
  const newPdf = await PDFDocument.create();
  const pageIndices = newOrder.map((num) => num - 1);
  const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  return newPdf.save();
}

async function insertBlankPage(
  pdfBytes: Uint8Array,
  afterPageIndex: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const count = pdf.getPageCount();
  let width = 595.28,
    height = 841.89;
  if (count > 0 && afterPageIndex >= 0 && afterPageIndex < count) {
    const ref = pdf.getPage(afterPageIndex);
    const size = ref.getSize();
    width = size.width;
    height = size.height;
  }
  const insertAt = Math.min(afterPageIndex + 1, count);
  pdf.insertPage(insertAt, [width, height]);
  return pdf.save();
}

async function deletePage(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  if (pdf.getPageCount() <= 1) {
    throw new Error("Cannot delete the only page in the document.");
  }
  pdf.removePage(pageIndex);
  return pdf.save();
}

async function rotatePage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  angle: number,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);
  const currentRotation = page.getRotation().angle;
  const newAngle = (currentRotation + angle) % 360;
  page.setRotation(degrees(newAngle));
  return pdf.save();
}

// ── Shared Text Drawing Helper ────────────────────────────────────────

async function drawFormattedText(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  color: { r: number; g: number; b: number },
  format?: {
    isUnderline?: boolean;
    isStrikethrough?: boolean;
    alignment?: "left" | "center" | "right" | "justify";
    bgColor?: { r: number; g: number; b: number };
    lineHeight?: number;
  },
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? currentLine + " " + words[i] : words[i];
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > width && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const lineHeightMetrics = fontSize * (format?.lineHeight || 1.2);
  let currentY = y; // Starts at baseline for first line
  const textColor = rgb(color.r, color.g, color.b);

  // Draw Background Mask (if bgColor provided — already normalized to 0-1)
  if (format?.bgColor) {
    const totalHeight = Math.max(height, lines.length * lineHeightMetrics);
    page.drawRectangle({
      x: x,
      y: y + fontSize * 0.85 - totalHeight,
      width: width,
      height: totalHeight,
      color: rgb(
        Math.min(1, Math.max(0, format.bgColor.r)),
        Math.min(1, Math.max(0, format.bgColor.g)),
        Math.min(1, Math.max(0, format.bgColor.b)),
      ),
      borderWidth: 0,
    });
  }

  for (const line of lines) {
    const textWidth = font.widthOfTextAtSize(line, fontSize);
    let finalX = x;

    // Alignment Offsets
    if (format?.alignment === "center") {
      finalX = x + width / 2 - textWidth / 2;
    } else if (format?.alignment === "right") {
      finalX = x + width - textWidth;
    }

    page.drawText(line, {
      x: finalX,
      y: currentY,
      size: fontSize,
      font,
      color: textColor,
    });

    // Rich Typography Lines
    if (format?.isUnderline || format?.isStrikethrough) {
      const thickness = Math.max(1, fontSize * 0.08);
      if (format.isUnderline) {
        page.drawLine({
          start: { x: finalX, y: currentY - fontSize * 0.1 },
          end: { x: finalX + textWidth, y: currentY - fontSize * 0.1 },
          color: textColor,
          thickness,
        });
      }
      if (format.isStrikethrough) {
        page.drawLine({
          start: { x: finalX, y: currentY + fontSize * 0.3 },
          end: { x: finalX + textWidth, y: currentY + fontSize * 0.3 },
          color: textColor,
          thickness,
        });
      }
    }

    currentY -= lineHeightMetrics;
  }
}

async function replaceText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
  newText: string,
  fontName: string,
  fontSize: number,
  color: { r: number; g: number; b: number },
  format?: {
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrikethrough?: boolean;
    alignment?: "left" | "center" | "right" | "justify";
    bgColor?: { r: number; g: number; b: number };
  },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  // Generous padding for the white-out rect to cover bullets, glyphs, descenders
  const pad = fontSize * 0.15;
  page.drawRectangle({
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  // Only draw new text if it's not empty (allows erasing by submitting empty text)
  if (newText.trim().length > 0) {
    const fontKey = getFormattedFontKey(
      fontName,
      format?.isBold,
      format?.isItalic,
    );
    const font = await pdf.embedFont(StandardFonts[fontKey]);

    // Position text at the baseline (bottom of rect + descent offset)
    const baselineY = rect.y + fontSize * 0.15;

    await drawFormattedText(
      page,
      font,
      newText,
      rect.x,
      baselineY,
      rect.width,
      rect.height,
      fontSize,
      { r: color.r / 255, g: color.g / 255, b: color.b / 255 },
      format,
    );
  }

  return pdf.save();
}

// Erase any arbitrary rectangular area (for removing lines, bullets, graphics, etc.)
async function eraseArea(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
  color?: { r: number; g: number; b: number },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(
      (color?.r ?? 255) / 255,
      (color?.g ?? 255) / 255,
      (color?.b ?? 255) / 255,
    ),
    borderWidth: 0,
  });

  return pdf.save();
}

async function addText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  x: number,
  y: number,
  text: string,
  fontFamily: string,
  fontSize: number,
  color: { r: number; g: number; b: number },
  format?: {
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrikethrough?: boolean;
    alignment?: "left" | "center" | "right" | "justify";
    bgColor?: { r: number; g: number; b: number };
  },
  width: number = 200,
  height: number = 50,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  const fontKey = getFormattedFontKey(
    fontFamily,
    format?.isBold,
    format?.isItalic,
  );
  const font = await pdf.embedFont(StandardFonts[fontKey]);

  await drawFormattedText(
    page,
    font,
    text,
    x,
    y,
    width,
    height,
    fontSize,
    { r: color.r / 255, g: color.g / 255, b: color.b / 255 },
    format,
  );

  return pdf.save();
}

async function replaceImage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
  newImageBytes: Uint8Array,
  imageType: "png" | "jpg",
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  const embeddedImage =
    imageType === "png"
      ? await pdf.embedPng(newImageBytes)
      : await pdf.embedJpg(newImageBytes);

  page.drawImage(embeddedImage, {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });

  return pdf.save();
}

async function deleteImage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  return pdf.save();
}

async function addImage(
  pdfBytes: Uint8Array,
  pageIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  imageBytes: Uint8Array,
  imageType: "png" | "jpg",
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  const embeddedImage =
    imageType === "png"
      ? await pdf.embedPng(imageBytes)
      : await pdf.embedJpg(imageBytes);

  page.drawImage(embeddedImage, { x, y, width, height });

  return pdf.save();
}

// ── Unified Bake Function ───────────────────────────────────────────

async function bakeEdits(
  pdfBytes: Uint8Array,
  overlays: BakeOverlay[],
  pagesSeq?: Array<{ pdfPageIndex: number }>,
  customFontBytes?: Uint8Array,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  pdf.registerFontkit(fontkit);

  // Embed the custom font if provided, otherwise fall back to Helvetica
  let customFont: Awaited<ReturnType<typeof pdf.embedFont>> | undefined;
  if (customFontBytes && customFontBytes.length > 0) {
    customFont = await pdf.embedFont(customFontBytes);
  }

  // Cache standard fonts to avoid re-embedding
  const fontCache = new Map<
    string,
    Awaited<ReturnType<typeof pdf.embedFont>>
  >();

  async function getFont(
    fontFamily: string,
    isBold?: boolean,
    isItalic?: boolean,
  ) {
    if (customFont) return customFont;

    const key = getFormattedFontKey(fontFamily, isBold, isItalic);
    if (fontCache.has(key)) return fontCache.get(key)!;

    const font = await pdf.embedFont(StandardFonts[key]);
    fontCache.set(key, font);
    return font;
  }

  // ── Flatten image with filters/crop/cornerRadius into raw PNG bytes ──
  async function flattenImageForPdf(
    overlay: BakeImageOverlay,
  ): Promise<Uint8Array> {
    const w = Math.max(1, Math.round(overlay.width));
    const h = Math.max(1, Math.round(overlay.height));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context not available");

    // Load the original image bytes into a bitmap
    const imgCopy = new Uint8Array(overlay.imageBytes);
    const blob = new Blob([imgCopy.buffer as ArrayBuffer], {
      type: overlay.imageType === "png" ? "image/png" : "image/jpeg",
    });
    const imgBitmap = await createImageBitmap(blob);

    // Apply CSS-style filter string
    let filterStr = "";
    if (overlay.filters) {
      if (overlay.filters.blurRadius && overlay.filters.blurRadius > 0)
        filterStr += `blur(${overlay.filters.blurRadius}px) `;
      if (overlay.filters.brightness && overlay.filters.brightness !== 0)
        filterStr += `brightness(${100 + overlay.filters.brightness}%) `;
      if (overlay.filters.contrast && overlay.filters.contrast !== 0)
        filterStr += `contrast(${100 + overlay.filters.contrast}%) `;
      if (overlay.filters.grayscale) filterStr += `grayscale(100%) `;
      if (
        overlay.filters.saturate !== undefined &&
        overlay.filters.saturate !== 100
      )
        filterStr += `saturate(${overlay.filters.saturate}%) `;
      if (overlay.filters.hueRotate)
        filterStr += `hue-rotate(${overlay.filters.hueRotate}deg) `;
      if (overlay.filters.sepia) filterStr += `sepia(100%) `;
      if (overlay.filters.invert) filterStr += `invert(100%) `;
    }
    if (filterStr) {
      (ctx as any).filter = filterStr.trim();
    }

    // Apply corner radius clipping
    if (overlay.cornerRadius && overlay.cornerRadius > 0) {
      const r = Math.min(overlay.cornerRadius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(w - r, 0);
      ctx.quadraticCurveTo(w, 0, w, r);
      ctx.lineTo(w, h - r);
      ctx.quadraticCurveTo(w, h, w - r, h);
      ctx.lineTo(r, h);
      ctx.quadraticCurveTo(0, h, 0, h - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
    }

    // Draw the image (cropped or full)
    if (overlay.crop) {
      ctx.drawImage(
        imgBitmap,
        overlay.crop.x,
        overlay.crop.y,
        overlay.crop.width,
        overlay.crop.height,
        0,
        0,
        w,
        h,
      );
    } else {
      ctx.drawImage(imgBitmap, 0, 0, w, h);
    }

    // Convert to PNG bytes
    const finalBlob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await finalBlob.arrayBuffer());
  }

  // Note: we NO LONGER manually remove pages from `pdf` here.
  // `useExportPDF.ts` already perfectly constructs `basePdfBytes`
  // with correct reordering, deletions, and newly inserted blank pages.

  const pages = pdf.getPages();

  for (const overlay of overlays) {
    const page = pages[overlay.pageIndex];
    if (!page) continue;

    switch (overlay.type) {
      case "TEXT": {
        // 1. Erase the original baked text completely before trying to draw new editable text
        if (
          overlay.isOriginal &&
          overlay.originX !== undefined &&
          overlay.originY !== undefined
        ) {
          const oHeight = overlay.originHeight || 20;
          const pdfOriginY = page.getHeight() - overlay.originY - oHeight;
          // sampledBackgroundColor is ALREADY in 0-1 range from normalizeColor()
          // Do NOT divide by 255 again or you get near-black masks!
          const maskColor = overlay.sampledBackgroundColor || {
            r: 1,
            g: 1,
            b: 1,
          };

          page.drawRectangle({
            x: overlay.originX,
            y: pdfOriginY,
            width: overlay.originWidth || 100,
            height: oHeight,
            color: rgb(
              Math.min(1, Math.max(0, maskColor.r)),
              Math.min(1, Math.max(0, maskColor.g)),
              Math.min(1, Math.max(0, maskColor.b)),
            ),
            borderWidth: 0,
          });
        }

        const font = await getFont(
          overlay.fontFamily,
          overlay.isBold,
          overlay.isItalic,
        );
        const pdfY = page.getHeight() - overlay.y - overlay.fontSize * 0.85; // baseline approximation
        await drawFormattedText(
          page,
          font,
          overlay.text,
          overlay.x,
          pdfY,
          overlay.width,
          overlay.height,
          overlay.fontSize,
          overlay.color,
          {
            alignment: overlay.alignment,
            bgColor: overlay.bgColor,
            isUnderline: overlay.isUnderline,
            isStrikethrough: overlay.isStrikethrough,
            lineHeight: overlay.lineHeight,
          },
        );
        break;
      }

      case "IMAGE": {
        let finalImageBytes: Uint8Array = overlay.imageBytes;
        let finalImageType = overlay.imageType;

        // If filters, crop, or cornerRadius are set, we must flatten the image
        const hasFilters =
          overlay.filters &&
          ((overlay.filters.brightness && overlay.filters.brightness !== 0) ||
            (overlay.filters.contrast && overlay.filters.contrast !== 0) ||
            (overlay.filters.blurRadius && overlay.filters.blurRadius > 0) ||
            overlay.filters.grayscale ||
            (overlay.filters.saturate !== undefined &&
              overlay.filters.saturate !== 100) ||
            overlay.filters.sepia ||
            overlay.filters.invert);
        const hasCrop = !!overlay.crop;
        const hasCornerRadius = (overlay.cornerRadius || 0) > 0;

        if (hasFilters || hasCrop || hasCornerRadius) {
          try {
            finalImageBytes = await flattenImageForPdf(overlay);
            finalImageType = "png"; // flattened images are always PNG
          } catch (err) {
            console.warn("Image flattening failed, using raw image", err);
          }
        }

        const embeddedImage =
          finalImageType === "png"
            ? await pdf.embedPng(finalImageBytes)
            : await pdf.embedJpg(finalImageBytes);
        const pdfY = page.getHeight() - overlay.y - overlay.height;
        page.drawImage(embeddedImage, {
          x: overlay.x,
          y: pdfY,
          width: overlay.width,
          height: overlay.height,
          rotate: overlay.rotation ? degrees(overlay.rotation) : degrees(0),
          opacity: typeof overlay.opacity === "number" ? overlay.opacity : 1,
        });
        break;
      }

      case "RECTANGLE": {
        const pdfY = page.getHeight() - overlay.y - overlay.height;
        const o = overlay as BakeRectangleOverlay;
        page.drawRectangle({
          x: o.x,
          y: pdfY,
          width: o.width,
          height: o.height,
          color: o.fillColor
            ? rgb(o.fillColor.r, o.fillColor.g, o.fillColor.b)
            : undefined,
          borderColor: o.strokeColor
            ? rgb(o.strokeColor.r, o.strokeColor.g, o.strokeColor.b)
            : undefined,
          borderWidth: o.strokeColor ? o.lineWidth || 2 : 0,
          opacity: o.opacity,
        });
        break;
      }

      case "DRAWING": {
        if (overlay.svgPath.trim()) {
          // pdfjs paths use DOM top-left, PDF uses bottom-left origin.
          // We must mirror every Y value: pdfY = pageHeight - domY
          const ph = page.getHeight();

          let rawPath = overlay.svgPath;
          const tokens = rawPath.trim().split(/\s+/);
          const flippedTokens = [];
          for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t === "M" || t === "Q" || t === "Z") {
              flippedTokens.push(t);
            } else {
              // x
              flippedTokens.push(t);
              // y
              if (i + 1 < tokens.length) {
                flippedTokens.push(String(ph - parseFloat(tokens[i + 1])));
                i++;
              }
            }
          }
          const flippedPath = flippedTokens.join(" ");

          page.drawSvgPath(flippedPath, {
            borderColor: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
            borderWidth: overlay.lineWidth || 2,
            color: undefined,
          });
        }
        break;
      }

      case "SHAPE": {
        const {
          shapeType,
          x,
          y,
          width: w,
          height: h,
          color,
          fillColor,
          lineWidth,
        } = overlay as any;
        const colorRgb = color ? rgb(color.r, color.g, color.b) : undefined;
        const fillRgb = fillColor
          ? rgb(fillColor.r, fillColor.g, fillColor.b)
          : undefined;

        const ph = page.getHeight();
        // PDF origin is bottom-left. DOM origin is top-left.
        // For a rectangle: pdfY = pageHeight - domY - elementHeight
        const pdfY = ph - y - h;

        if (shapeType === "circle") {
          // drawEllipse takes the CENTER x,y (in PDF coords), plus xScale and yScale
          const cx = x + w / 2;
          const cy = pdfY + h / 2;
          page.drawEllipse({
            x: cx,
            y: cy,
            xScale: w / 2,
            yScale: h / 2,
            color: fillRgb,
            borderColor: colorRgb,
            borderWidth: lineWidth ?? 1,
            opacity: 1,
          });
        } else if (shapeType === "rect") {
          page.drawRectangle({
            x,
            y: pdfY,
            width: w,
            height: h,
            color: fillRgb,
            borderColor: colorRgb,
            borderWidth: colorRgb ? (lineWidth ?? 1) : 0,
            opacity: 1,
          });
        } else if (shapeType === "line") {
          const startX = x;
          const startY = ph - y;
          const endX = x + w;
          const endY = ph - (y + h);
          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            color: colorRgb || fillRgb,
            thickness: lineWidth ?? 2,
          });
        } else if (shapeType === "arrow") {
          // Draw shaft
          const startX = x;
          const startY = ph - y;
          const endX = x + w;
          const endY = ph - (y + h);
          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
            color: colorRgb || fillRgb,
            thickness: lineWidth ?? 2,
          });
          // Arrowhead
          const headlen = Math.max(10, (lineWidth ?? 2) * 4);
          const ang = Math.atan2(endY - startY, endX - startX);
          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headlen * Math.cos(ang - Math.PI / 6),
              y: endY - headlen * Math.sin(ang - Math.PI / 6),
            },
            color: colorRgb || fillRgb,
            thickness: lineWidth ?? 2,
          });
          page.drawLine({
            start: { x: endX, y: endY },
            end: {
              x: endX - headlen * Math.cos(ang + Math.PI / 6),
              y: endY - headlen * Math.sin(ang + Math.PI / 6),
            },
            color: colorRgb || fillRgb,
            thickness: lineWidth ?? 2,
          });
        }
        break;
      }
    }
  }

  return pdf.save();
}

async function bakeHighlights(
  pdfBytes: Uint8Array,
  highlights: Array<{
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: { r: number; g: number; b: number };
    opacity: number;
  }>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);

  for (const h of highlights) {
    const page = pdf.getPage(h.pageIndex);
    page.drawRectangle({
      x: h.x,
      y: h.y,
      width: h.width,
      height: h.height,
      color: rgb(h.color.r / 255, h.color.g / 255, h.color.b / 255),
      opacity: h.opacity,
      borderWidth: 0,
    });
  }

  return pdf.save();
}

// ── Page Resize Engine ─────────────────────────────────────────────────────

function calculateScaleAndPosition(
  origWidth: number,
  origHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scaleX = targetWidth / origWidth;
  const scaleY = targetHeight / origHeight;
  const scale = Math.min(scaleX, scaleY);
  const scaledWidth = origWidth * scale;
  const scaledHeight = origHeight * scale;
  const x = (targetWidth - scaledWidth) / 2;
  const y = (targetHeight - scaledHeight) / 2;
  return { scale, x, y };
}

async function resizePdfPages(
  fileBuffer: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  pagesToResize: number[], // 0-based indices; pass [] for none, full array for all
): Promise<Uint8Array> {
  const originalPdf = await PDFDocument.load(fileBuffer.slice(0));
  const newPdf = await PDFDocument.create();
  const originalPages = originalPdf.getPages();

  for (let i = 0; i < originalPages.length; i++) {
    if (pagesToResize.includes(i)) {
      // Attempt 1: embed-and-scale the original page content
      let embedded = false;
      try {
        const newPage = newPdf.addPage([targetWidth, targetHeight]);
        const embeddedPage = await newPdf.embedPage(originalPages[i]);
        const origDims = embeddedPage.size();
        const { scale, x, y } = calculateScaleAndPosition(
          origDims.width,
          origDims.height,
          targetWidth,
          targetHeight,
        );
        newPage.drawPage(embeddedPage, { x, y, xScale: scale, yScale: scale });
        embedded = true;
      } catch (embedErr) {
        // pdf-lib throws "Can't embed page with missing Contents" for blank/empty pages.
        // In this case we simply create a blank page at the target dimensions — the
        // original page had no visual content anyway.
        console.warn(
          `[resizePdfPages] Page ${i} has no content stream, inserting blank page at target size.`,
          embedErr,
        );
      }

      // Fallback: blank page at target size (already added above on success)
      if (!embedded) {
        newPdf.addPage([targetWidth, targetHeight]);
      }
    } else {
      // Non-resized page: copy as-is
      try {
        const [copied] = await newPdf.copyPages(originalPdf, [i]);
        newPdf.addPage(copied);
      } catch {
        // If copying also fails (very corrupt pages), add blank with original dimensions
        const orig = originalPages[i];
        const { width, height } = orig.getSize();
        newPdf.addPage([width, height]);
      }
    }
  }

  return newPdf.save();
}

// ── Method dispatch map ─────────────────────────────────────────────

const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  mergePDFs: (a: unknown, b: unknown) =>
    mergePDFs(a as Uint8Array, b as Uint8Array),
  reorderPages: (a: unknown, b: unknown) =>
    reorderPages(a as Uint8Array, b as number[]),
  insertBlankPage: (a: unknown, b: unknown) =>
    insertBlankPage(a as Uint8Array, b as number),
  deletePage: (a: unknown, b: unknown) =>
    deletePage(a as Uint8Array, b as number),
  rotatePage: (a: unknown, b: unknown, c: unknown) =>
    rotatePage(a as Uint8Array, b as number, c as number),
  replaceText: (
    a: unknown,
    b: unknown,
    c: unknown,
    d: unknown,
    e: unknown,
    f: unknown,
    g: unknown,
    h: unknown,
  ) =>
    replaceText(
      a as Uint8Array,
      b as number,
      c as { x: number; y: number; width: number; height: number },
      d as string,
      e as string,
      f as number,
      g as { r: number; g: number; b: number },
      h as {
        isBold?: boolean;
        isItalic?: boolean;
        isUnderline?: boolean;
        isStrikethrough?: boolean;
        alignment?: "left" | "center" | "right" | "justify";
        bgColor?: { r: number; g: number; b: number };
      },
    ),
  addText: (
    a: unknown,
    b: unknown,
    c: unknown,
    d: unknown,
    e: unknown,
    f: unknown,
    g: unknown,
    h: unknown,
    i: unknown,
    j: unknown,
    k: unknown,
  ) =>
    addText(
      a as Uint8Array,
      b as number,
      c as number,
      d as number,
      e as string,
      f as string,
      g as number,
      h as { r: number; g: number; b: number },
      i as {
        isBold?: boolean;
        isItalic?: boolean;
        isUnderline?: boolean;
        isStrikethrough?: boolean;
        alignment?: "left" | "center" | "right" | "justify";
        bgColor?: { r: number; g: number; b: number };
      },
      j as number,
      k as number,
    ),
  replaceImage: (a: unknown, b: unknown, c: unknown, d: unknown, e: unknown) =>
    replaceImage(
      a as Uint8Array,
      b as number,
      c as { x: number; y: number; width: number; height: number },
      d as Uint8Array,
      e as "png" | "jpg",
    ),
  deleteImage: (a: unknown, b: unknown, c: unknown) =>
    deleteImage(
      a as Uint8Array,
      b as number,
      c as { x: number; y: number; width: number; height: number },
    ),
  addImage: (
    a: unknown,
    b: unknown,
    c: unknown,
    d: unknown,
    e: unknown,
    f: unknown,
    g: unknown,
    h: unknown,
  ) =>
    addImage(
      a as Uint8Array,
      b as number,
      c as number,
      d as number,
      e as number,
      f as number,
      g as Uint8Array,
      h as "png" | "jpg",
    ),
  bakeHighlights: (a: unknown, b: unknown) =>
    bakeHighlights(
      a as Uint8Array,
      b as Array<{
        pageIndex: number;
        x: number;
        y: number;
        width: number;
        height: number;
        color: { r: number; g: number; b: number };
        opacity: number;
      }>,
    ),
  eraseArea: (a: unknown, b: unknown, c: unknown) =>
    eraseArea(
      a as Uint8Array,
      b as number,
      c as { x: number; y: number; width: number; height: number },
    ),
  bakeEdits: (a: unknown, b: unknown, c: unknown, d: unknown) =>
    bakeEdits(
      a as Uint8Array,
      b as BakeOverlay[],
      c as Array<{ pdfPageIndex: number }> | undefined,
      d as Uint8Array | undefined,
    ),
  resizePdfPages: (a: unknown, b: unknown, c: unknown, d: unknown) =>
    resizePdfPages(a as Uint8Array, b as number, c as number, d as number[]),
};

// ── Message handler ─────────────────────────────────────────────────

self.onmessage = async (
  event: MessageEvent<{ id: string; method: string; args: unknown[] }>,
) => {
  const { id, method, args } = event.data;

  try {
    const fn = methods[method];
    if (!fn) throw new Error(`Unknown method: ${method}`);
    const result = await fn(...args);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
