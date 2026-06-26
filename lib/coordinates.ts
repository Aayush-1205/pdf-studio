import { Camera, Point } from "../store/useCanvasStore";

/**
 * Converts screen/pointer coordinates into the infinite canvas coordinate system.
 * Takes the current camera (x, y, zoom) into account to translate where they
 * actually clicked in the SVG context.
 */
export function pointerEventToCanvasPoint(
  e: React.PointerEvent,
  container: HTMLElement,
  camera: Camera,
): Point {
  const rect = container.getBoundingClientRect();
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;

  return {
    x: Math.round(localX / camera.zoom - camera.x),
    y: Math.round(localY / camera.zoom - camera.y),
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
