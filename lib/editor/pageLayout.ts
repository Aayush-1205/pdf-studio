import { Page, Point } from "../../store/useCanvasStore";

export const PAGE_GAP = 40;

export function getPageTopOffset(pageIndex: number, pages: Page[]): number {
  let y = 0;
  for (let i = 0; i < pageIndex; i++) {
    y += pages[i].height + PAGE_GAP;
  }
  return y;
}

export function getPageAtCanvasY(y: number, pages: Page[]): number | null {
  let cursor = 0;
  for (let i = 0; i < pages.length; i++) {
    const top = cursor;
    const bottom = cursor + pages[i].height;
    if (y >= top && y <= bottom) return i;
    cursor = bottom + PAGE_GAP;
  }
  return null;
}

export function toPageRelativePoint(
  point: Point,
  pageIndex: number,
  pages: Page[]
): Point {
  return {
    x: point.x,
    y: point.y - getPageTopOffset(pageIndex, pages),
  };
}
