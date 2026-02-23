// ── PDF Coordinate & Color Utilities ────────────────────────────────
//
// pdf-lib uses a bottom-left origin (0,0 = bottom-left, Y goes UP).
// The browser DOM uses a top-left origin (0,0 = top-left, Y goes DOWN).
// These helpers bridge the two systems.

/**
 * Convert a DOM Y coordinate (top-left origin) to a PDF Y coordinate
 * (bottom-left origin) given the page height in PDF points.
 */
export function domYtoPdfY(
  domY: number,
  pageHeight: number,
  elementHeight = 0,
): number {
  return pageHeight - domY - elementHeight;
}

/**
 * Convert a hex color string (#rrggbb or #rgb) to an { r, g, b } object
 * with values normalized to the 0–1 range that pdf-lib expects.
 */
export function hexToRgb01(hex: string): {
  r: number;
  g: number;
  b: number;
} {
  let h = hex.replace(/^#/, "");

  // Expand shorthand (#rgb → #rrggbb)
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const num = parseInt(h, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Convert an array of { x, y } screen-coordinate points into an SVG path
 * string (e.g. "M 10 20 L 15 25 L 20 30").
 */
export function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return (
    `M ${first.x} ${first.y}` + rest.map((p) => ` L ${p.x} ${p.y}`).join("")
  );
}

/**
 * Take an SVG path string whose Y values are in DOM (top-left) coordinates
 * and flip every Y value to PDF (bottom-left) coordinates.
 *
 * Handles M, L, and other single-coordinate commands.
 * The regex finds number-pairs and flips the second value in each pair.
 */
export function flipSvgPathY(svgPath: string, pageHeight: number): string {
  // Match command letter followed by x y number pairs
  return svgPath.replace(
    /([ML])\s*([\d.eE+-]+)\s+([\d.eE+-]+)/gi,
    (_match, cmd: string, x: string, y: string) => {
      const flippedY = pageHeight - parseFloat(y);
      return `${cmd} ${x} ${flippedY}`;
    },
  );
}

/**
 * Decode a base64 data-URL (e.g. "data:image/png;base64,...") into a
 * Uint8Array and its detected image type.
 */
export function dataUrlToUint8Array(dataUrl: string): {
  bytes: Uint8Array;
  imageType: "png" | "jpg";
} {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");

  const imageType = match[1] === "png" ? "png" : "jpg";
  const raw = atob(match[2]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return { bytes, imageType };
}
