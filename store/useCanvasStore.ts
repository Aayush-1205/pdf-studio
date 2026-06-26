/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDocumentStore, DocumentState } from "./editor/useDocumentStore";
import { useInteractionStore, InteractionState } from "./editor/useInteractionStore";
import { useHistoryStore, HistoryCommand } from "./editor/useHistoryStore";

// --- Types ---
export type Point = { x: number; y: number };
export type Camera = { x: number; y: number; zoom: number };
export type LayerType =
  | "RECTANGLE"
  | "ELLIPSE"
  | "TEXT"
  | "PATH"
  | "IMAGE"
  | "LINE"
  | "ARROW";

export type Page = {
  id: string; // Unique id for the page
  pdfPageIndex?: number; // 0-based index in the raw PDF (undefined if it's a blank page)
  width: number;
  height: number;
  backgroundUrl?: string; // High-res rasterized blob URL of the page
  groupName?: string; // Used to identify subsets (e.g. from File X)
};

export type Layer = {
  type: LayerType;
  pageIndex: number; // Associates this layer with a visual page offset
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  opacity: number;
  // Specifics
  points?: number[][]; // For Path (perfect-freehand)
  text?: string;
  fontSize?: number;
  fontFamily?: string; // For Text
  textAlign?: "left" | "center" | "right" | "justify";
  letterSpacing?: number;
  lineHeight?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  sampledBackgroundColor?: string; // For the context-aware mask

  // Extracted PDF text origin tracking to prevent ghosting/double-rendering
  isOriginal?: boolean;
  isEdited?: boolean;
  originX?: number;
  originY?: number;
  originWidth?: number;
  originHeight?: number;

  rotation?: number; // Added to support Transformer rotation bounds natively

  // ── Image Layer Specifics ──
  src?: string; // Base64 Data URL or Blob URL of the ORIGINAL image
  originalWidth?: number; // Unmodified source image width
  originalHeight?: number; // Unmodified source image height

  // Non-destructive cropping (relative to original image dimensions)
  crop?: { x: number; y: number; width: number; height: number };

  // CSS-style filters (non-destructive, flattened only at export time)
  filters?: {
    brightness?: number; // -100 to 100 (maps to 0-2 multiplier)
    contrast?: number; // -100 to 100
    blurRadius?: number; // 0 to 40px
    grayscale?: boolean;
    saturate?: number; // 0 to 200 (100 = normal)
    hueRotate?: number; // 0 to 360 degrees
    sepia?: boolean;
    invert?: boolean;
  };

  // Rounded corners (Konva `cornerRadius`)
  cornerRadius?: number;

  // Drop shadow for images
  shadow?: {
    color?: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
  };

  isNative?: boolean; // Flag if extracted from the original PDF
};

export enum CanvasMode {
  None, // Pointer tool
  Inserting, // Placing a new shape
  Translating, // Moving a shape
  Resizing, // Dragging handles
  Pencil, // Freehand drawing
  SelectionNet, // Dragging a multi-select box
}

export interface HistoryState {
  past: HistoryCommand[];
  future: HistoryCommand[];
  execute: (cmd: HistoryCommand) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export type CanvasState = DocumentState & InteractionState & HistoryState;

export interface UseCanvasStore {
  (): CanvasState;
  <U>(selector: (state: CanvasState) => U): U;
  getState: () => CanvasState;
  setState: (nextStateOrUpdater: any, shouldReplace?: boolean) => void;
}

// Facade combining all three stores
export const useCanvasStore: UseCanvasStore = ((selector?: any) => {
  const doc = useDocumentStore();
  const ui = useInteractionStore();
  const history = useHistoryStore();
  const merged = { ...doc, ...ui, ...history };
  return selector ? selector(merged) : merged;
}) as any;

useCanvasStore.getState = () => {
  const doc = useDocumentStore.getState();
  const ui = useInteractionStore.getState();
  const history = useHistoryStore.getState();
  return { ...doc, ...ui, ...history };
};

useCanvasStore.setState = (nextStateOrUpdater: any, shouldReplace?: boolean) => {
  const current = useCanvasStore.getState();
  const resolved = typeof nextStateOrUpdater === "function" ? nextStateOrUpdater(current) : nextStateOrUpdater;
  useDocumentStore.setState(resolved, shouldReplace as any);
  useInteractionStore.setState(resolved, shouldReplace as any);
  useHistoryStore.setState(resolved, shouldReplace as any);
};

export type { DocumentState } from "./editor/useDocumentStore";
export type { InteractionState } from "./editor/useInteractionStore";
export type { HistoryCommand } from "./editor/useHistoryStore";
