import { Camera, Point } from "../store/useCanvasStore";

/**
 * Converts screen/pointer coordinates into the infinite canvas coordinate system.
 * Takes the current camera (x, y, zoom) into account to translate where they
 * actually clicked in the SVG context.
 */
export function pointerEventToCanvasPoint(
  e: React.PointerEvent,
  camera: Camera,
): Point {
  // If the user scrolls down the page or uses a complex layout,
  // you often need to subtract the bounding client rect of the SVG wrapper.
  // For a full-screen app, e.clientX / e.clientY is usually close enough.
  return {
    x: Math.round(e.clientX / camera.zoom - camera.x),
    y: Math.round(e.clientY / camera.zoom - camera.y),
  };
}

/**
 * Ensures boundaries or calculates distances if needed.
 */
export function calculateBoundingBox(points: Point[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
