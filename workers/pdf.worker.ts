import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// ── Bake Overlay Types (inline — workers can't use @/ aliases) ──────

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
  rotation?: number; // degrees
  opacity?: number;
}

interface BakeRectangleOverlay {
  type: "RECTANGLE";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
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
  color: { r: number; g: number; b: number };
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
  },
) {
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  let finalX = x;
  // Handle alignment
  if (format?.alignment === "center") {
    finalX = x + width / 2 - textWidth / 2;
  } else if (format?.alignment === "right") {
    finalX = x + width - textWidth;
  }

  // Background color
  if (format?.bgColor) {
    page.drawRectangle({
      x: x,
      y: y - fontSize * 0.2, // Cover descenders
      width: width,
      height: height || fontSize * 1.2,
      color: rgb(format.bgColor.r, format.bgColor.g, format.bgColor.b),
      borderWidth: 0,
    });
  }

  const textColor = rgb(color.r, color.g, color.b);
  page.drawText(text, {
    x: finalX,
    y: y,
    size: fontSize,
    font,
    color: textColor,
  });

  // Underline and Strikethrough
  if (format?.isUnderline || format?.isStrikethrough) {
    const thickness = Math.max(1, fontSize * 0.08);
    if (format.isUnderline) {
      page.drawLine({
        start: { x: finalX, y: y - thickness * 2 },
        end: { x: finalX + textWidth, y: y - thickness * 2 },
        color: textColor,
        thickness,
      });
    }
    if (format.isStrikethrough) {
      page.drawLine({
        start: { x: finalX, y: y + fontSize * 0.3 },
        end: { x: finalX + textWidth, y: y + fontSize * 0.3 },
        color: textColor,
        thickness,
      });
    }
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
  const pad = fontSize * 0.35;
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

  const pages = pdf.getPages();

  for (const overlay of overlays) {
    const page = pages[overlay.pageIndex];
    if (!page) continue;

    switch (overlay.type) {
      case "TEXT": {
        const font = await getFont(
          overlay.fontFamily,
          overlay.isBold,
          overlay.isItalic,
        );
        await drawFormattedText(
          page,
          font,
          overlay.text,
          overlay.x,
          overlay.y,
          overlay.width,
          overlay.height,
          overlay.fontSize,
          overlay.color,
          {
            alignment: overlay.alignment,
            bgColor: overlay.bgColor,
            isUnderline: overlay.isUnderline,
            isStrikethrough: overlay.isStrikethrough,
          },
        );
        break;
      }

      case "IMAGE": {
        const embeddedImage =
          overlay.imageType === "png"
            ? await pdf.embedPng(overlay.imageBytes)
            : await pdf.embedJpg(overlay.imageBytes);
        page.drawImage(embeddedImage, {
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          rotate: overlay.rotation ? degrees(overlay.rotation) : degrees(0),
          opacity: typeof overlay.opacity === "number" ? overlay.opacity : 1,
        });
        break;
      }

      case "RECTANGLE": {
        page.drawRectangle({
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          color: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
          opacity: overlay.opacity,
          borderWidth: 0,
        });
        break;
      }

      case "DRAWING": {
        if (overlay.svgPath.trim()) {
          page.drawSvgPath(overlay.svgPath, {
            borderColor: rgb(overlay.color.r, overlay.color.g, overlay.color.b),
            borderWidth: overlay.lineWidth,
            color: undefined, // no fill
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
          lineWidth,
        } = overlay as any; // Type workaround for SHAPE
        const colorRgb = rgb(color.r, color.g, color.b);
        let path = "";

        if (shapeType === "rect") {
          path = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
        } else if (shapeType === "circle") {
          path = `M ${x + w / 2} ${y + h} A ${w / 2} ${h / 2} 0 1 0 ${x + w / 2} ${y} A ${w / 2} ${h / 2} 0 1 0 ${x + w / 2} ${y + h}`;
        } else if (shapeType === "line") {
          path = `M ${x} ${y + h} L ${x + w} ${y}`;
        } else if (shapeType === "arrow") {
          const headlen = 10;
          const ang = Math.atan2(-h, w);
          path = `M ${x} ${y + h} L ${x + w} ${y} `;
          const x1 = x + w - headlen * Math.cos(ang - Math.PI / 6);
          const y1 = y - headlen * Math.sin(ang - Math.PI / 6);
          path += `M ${x + w} ${y} L ${x1} ${y1} `;
          const x2 = x + w - headlen * Math.cos(ang + Math.PI / 6);
          const y2 = y - headlen * Math.sin(ang + Math.PI / 6);
          path += `M ${x + w} ${y} L ${x2} ${y2}`;
        } else if (shapeType === "triangle") {
          path = `M ${x + w / 2} ${y + h} L ${x + w} ${y} L ${x} ${y} Z`;
        } else if (shapeType === "star") {
          const cx = x + w / 2;
          const cy = y + h / 2;
          const outerRad = Math.min(w, h) / 2;
          const innerRad = outerRad / 2.5;
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? outerRad : innerRad;
            const a = -(Math.PI * 2 * i) / 10 + Math.PI / 2;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r;
            path += i === 0 ? `M ${px} ${py} ` : `L ${px} ${py} `;
          }
          path += "Z";
        }

        if (path) {
          page.drawSvgPath(path, {
            borderColor: colorRgb,
            borderWidth: lineWidth,
            color: undefined,
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
  bakeEdits: (a: unknown, b: unknown, c: unknown) =>
    bakeEdits(a as Uint8Array, b as BakeOverlay[], c as Uint8Array | undefined),
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
