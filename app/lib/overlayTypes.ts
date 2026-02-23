// ── Bake Overlay Types ──────────────────────────────────────────────
//
// Discriminated union describing every kind of user edit that
// the Web Worker's `bakeEdits()` function can burn into a PDF.
// All coordinates are already in PDF space (bottom-left origin, 0-1 RGB).

export interface BakeTextOverlay {
  type: "TEXT";
  pageIndex: number;
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: { r: number; g: number; b: number }; // 0–1 range
}

export interface BakeImageOverlay {
  type: "IMAGE";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageBytes: Uint8Array;
  imageType: "png" | "jpg";
}

export interface BakeRectangleOverlay {
  type: "RECTANGLE";
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number }; // 0–1 range
  opacity: number;
}

export interface BakeDrawingOverlay {
  type: "DRAWING";
  pageIndex: number;
  svgPath: string; // Already Y-flipped for PDF coords
  color: { r: number; g: number; b: number }; // 0–1 range
  lineWidth: number;
}

export type BakeOverlay =
  | BakeTextOverlay
  | BakeImageOverlay
  | BakeRectangleOverlay
  | BakeDrawingOverlay;
