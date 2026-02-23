import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

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

function matchStandardFont(pdfFontName: string): keyof typeof StandardFonts {
  // Try direct match first
  const normalized = normalizeFontName(pdfFontName);
  if (FONT_MAP[normalized]) return FONT_MAP[normalized];
  for (const [key, value] of Object.entries(FONT_MAP)) {
    if (normalized.includes(key)) return value;
  }

  // For generated/subset names (g_d0_f2, ABCDEF+Font, etc.) — detect style hints
  const lower = pdfFontName.toLowerCase();
  const isBold = /bold|heavy|black|demi/i.test(lower);
  const isItalic = /italic|oblique|slant/i.test(lower);
  const isSerif = /serif|times|georgia|garamond|palatino|cambria/i.test(lower);
  const isMono = /courier|mono|consolas|menlo|code/i.test(lower);

  if (isMono) {
    if (isBold && isItalic) return "CourierBoldOblique";
    if (isBold) return "CourierBold";
    if (isItalic) return "CourierOblique";
    return "Courier";
  }
  if (isSerif) {
    if (isBold && isItalic) return "TimesRomanBoldItalic";
    if (isBold) return "TimesRomanBold";
    if (isItalic) return "TimesRomanItalic";
    return "TimesRoman";
  }
  // Default sans-serif
  if (isBold && isItalic) return "HelveticaBoldOblique";
  if (isBold) return "HelveticaBold";
  if (isItalic) return "HelveticaOblique";
  return "Helvetica";
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

async function replaceText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; width: number; height: number },
  newText: string,
  fontName: string,
  fontSize: number,
  color: { r: number; g: number; b: number },
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
    const fontKey = matchStandardFont(fontName);
    const font = await pdf.embedFont(StandardFonts[fontKey]);

    // Position text at the baseline (bottom of rect + descent offset)
    const baselineY = rect.y + fontSize * 0.15;

    page.drawText(newText, {
      x: rect.x,
      y: baselineY,
      size: fontSize,
      font,
      color: rgb(color.r / 255, color.g / 255, color.b / 255),
    });
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
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(pageIndex);

  const fontKey = matchStandardFont(fontFamily);
  const font = await pdf.embedFont(StandardFonts[fontKey]);

  page.drawText(text, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(color.r / 255, color.g / 255, color.b / 255),
  });

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
  ) =>
    replaceText(
      a as Uint8Array,
      b as number,
      c as { x: number; y: number; width: number; height: number },
      d as string,
      e as string,
      f as number,
      g as { r: number; g: number; b: number },
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
