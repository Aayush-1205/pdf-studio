import { create } from "zustand";
import { nanoid } from "nanoid";

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

export type HistorySnapshot = {
  layers: Record<string, Layer>;
  layerIds: string[];
  pages: Page[];
};

type CanvasState = {
  // Config
  pdfBytes: Uint8Array | null;
  pages: Page[];

  camera: Camera;
  mode: CanvasMode;
  layerType?: LayerType; // What are we currently inserting?
  layers: Record<string, Layer>; // The actual data
  layerIds: string[]; // Z-Index order (bottom to top)
  selection: string[]; // Currently selected layer IDs
  hoveredLayerId: string | null; // Id of layer currently hovered by mouse
  isAltPressed: boolean; // Alt/Option key tracker for Figma-like measurements
  pencilDraft: number[][] | null; // Intermediate drawing state
  pencilPageIndex: number; // Page being drawn on

  // Dragging State
  dragOffset: Point | null; // Offset from mouse to shape top-left when dragging starts
  guides: { type: "horizontal" | "vertical"; position: number }[];

  // Resizing State
  resizeHandle: string | null;
  resizeInitialBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  resizeInitialPoint: Point | null;

  // Actions
  setPdfBytes: (bytes: Uint8Array | null) => void;
  setPages: (pages: Page[]) => void;
  addBlankPage: (
    width: number,
    height: number,
    groupName?: string,
    insertIndex?: number | string,
  ) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  deletePage: (pageIndex: number) => void;

  setCamera: (camera: Camera) => void;
  setMode: (mode: CanvasMode, type?: LayerType) => void;

  insertLayer: (
    type: LayerType,
    pageIndex: number,
    point: Point,
    initialValues?: Partial<Layer>,
  ) => void;
  updateLayer: (
    id: string,
    data: Partial<Layer>,
    saveHistoryAction?: boolean,
  ) => void;
  setSelection: (ids: string[]) => void;
  setHoveredLayerId: (id: string | null) => void;
  setAltPressed: (pressed: boolean) => void;
  deleteLayers: () => void;
  clearCanvas: () => void; // Reset entire workspace

  // History Actions
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  saveHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Interaction Actions
  startTranslating: (point: Point) => void;
  continueTranslating: (point: Point) => void;
  endTranslating: () => void;

  startResizing: (handle: string, point: Point) => void;
  continueResizing: (point: Point) => void;
  endResizing: () => void;

  // Pencil Actions
  startDrawing: (point: Point, pageIndex: number) => void;
  continueDrawing: (point: Point) => void;
  endDrawing: (pageIndex: number) => void;

  // Bring to front/back etc.
  reorderLayer: (id: string, direction: "up" | "down") => void;
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  pdfBytes: null,
  pages: [],
  camera: { x: 0, y: 0, zoom: 1 },
  mode: CanvasMode.None,
  layers: {},
  layerIds: [],
  selection: [],
  hoveredLayerId: null,
  isAltPressed: false,
  pencilDraft: null,
  pencilPageIndex: 0,
  dragOffset: null,
  guides: [],
  resizeHandle: null,
  resizeInitialBounds: null,
  resizeInitialPoint: null,

  past: [],
  future: [],

  saveHistory: () =>
    set((state) => {
      const MAX_HISTORY = 30;
      const snapshot: HistorySnapshot = {
        layers: JSON.parse(JSON.stringify(state.layers)),
        layerIds: [...state.layerIds],
        pages: [...state.pages],
      };
      const newPast = [...state.past, snapshot].slice(-MAX_HISTORY);
      return { past: newPast, future: [] };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      const current: HistorySnapshot = {
        layers: JSON.parse(JSON.stringify(state.layers)),
        layerIds: [...state.layerIds],
        pages: [...state.pages],
      };
      return {
        past: newPast,
        future: [current, ...state.future],
        layers: previous.layers,
        layerIds: previous.layerIds,
        pages: previous.pages,
        selection: [],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const current: HistorySnapshot = {
        layers: JSON.parse(JSON.stringify(state.layers)),
        layerIds: [...state.layerIds],
        pages: [...state.pages],
      };
      return {
        past: [...state.past, current],
        future: newFuture,
        layers: next.layers,
        layerIds: next.layerIds,
        pages: next.pages,
        selection: [],
      };
    }),

  setPdfBytes: (bytes) => set({ pdfBytes: bytes }),
  setPages: (pages) =>
    set((state) => {
      get().saveHistory();
      return { pages };
    }),
  addBlankPage: (width, height, groupName, insertIndex) =>
    set((state) => {
      get().saveHistory();
      const createBlankPage = (): Page => ({
        id: nanoid(),
        width,
        height,
        groupName: groupName || "Blank Page",
      });

      let newPages: Page[] = [];
      const indexMap = new Map<number, number>();
      let newIndex = 0;

      // 1. Single insertion inside document
      if (typeof insertIndex === "number") {
        for (let i = 0; i < state.pages.length; i++) {
          if (insertIndex === i) {
            newPages.push(createBlankPage());
            newIndex++;
          }
          newPages.push(state.pages[i]);
          indexMap.set(i, newIndex);
          newIndex++;
        }
        if (insertIndex >= state.pages.length) {
          newPages.push(createBlankPage());
        }
      }
      // 2. Multi-insertion logic (odd, even, every_N patterns)
      else if (typeof insertIndex === "string" && insertIndex !== "end") {
        // Parse N from "every_N" patterns (e.g. "every_3", "every_5", etc.)
        const everyNMatch = insertIndex.match(/^every_(\d+)$/);
        const everyN = everyNMatch ? parseInt(everyNMatch[1], 10) : null;

        for (let i = 0; i < state.pages.length; i++) {
          newPages.push(state.pages[i]);
          indexMap.set(i, newIndex);
          newIndex++;

          let shouldInsert = false;
          const pageNum = i + 1; // 1-based original page number
          if (insertIndex === "odd" && pageNum % 2 !== 0) shouldInsert = true;
          if (insertIndex === "even" && pageNum % 2 === 0) shouldInsert = true;
          if (everyN !== null && pageNum % everyN === 0) shouldInsert = true;

          if (shouldInsert) {
            newPages.push(createBlankPage());
            newIndex++;
          }
        }
      }
      // 3. Default (At End/Undefined)
      else {
        newPages = [...state.pages];
        for (let i = 0; i < state.pages.length; i++) {
          indexMap.set(i, i);
        }
        newPages.push(createBlankPage());
      }

      // Remap all layers to their new page indices to prevent ghosting
      const newLayers = JSON.parse(JSON.stringify(state.layers));
      Object.keys(newLayers).forEach((id) => {
        const oldIdx = newLayers[id].pageIndex;
        if (indexMap.has(oldIdx)) {
          newLayers[id].pageIndex = indexMap.get(oldIdx)!;
        }
      });

      return { pages: newPages, layers: newLayers };
    }),
  reorderPages: (oldIndex, newIndex) =>
    set((state) => {
      get().saveHistory();
      const newPages = [...state.pages];
      const [moved] = newPages.splice(oldIndex, 1);
      newPages.splice(newIndex, 0, moved);
      return { pages: newPages };
    }),
  deletePage: (pageIndex) =>
    set((state) => {
      get().saveHistory();
      // Also delete any layers on this page
      const layersToDelete = Object.entries(state.layers)
        .filter(([_, l]) => l.pageIndex === pageIndex)
        .map(([id]) => id);
      const newLayers = { ...state.layers };
      layersToDelete.forEach((id) => delete newLayers[id]);

      // Shift page indexes down for layers on subsequent pages
      Object.keys(newLayers).forEach((id) => {
        if (newLayers[id].pageIndex > pageIndex) {
          newLayers[id].pageIndex -= 1;
        }
      });

      const newLayerIds = state.layerIds.filter(
        (id) => !layersToDelete.includes(id),
      );
      const newSelection = state.selection.filter(
        (id) => !layersToDelete.includes(id),
      );

      const newPages = state.pages.filter((_, idx) => idx !== pageIndex);
      return {
        pages: newPages,
        layers: newLayers,
        layerIds: newLayerIds,
        selection: newSelection,
      };
    }),

  clearCanvas: () =>
    set((state) => {
      get().saveHistory();
      return {
        pdfBytes: null,
        pages: [],
        layers: {},
        layerIds: [],
        selection: [],
        past: [],
        future: [],
        camera: { x: 0, y: 0, zoom: 1 },
      };
    }),

  setCamera: (camera) => set({ camera }),
  setMode: (mode, layerType) => set({ mode, layerType }),

  insertLayer: (type, pageIndex, point, initialValues = {}) => {
    get().saveHistory();
    const id = nanoid();
    const newLayer: Layer = {
      type,
      pageIndex,
      x: point.x,
      y: point.y,
      width: initialValues.width || 100,
      height: initialValues?.height ?? 100,
      fill: initialValues?.fill ?? "#D9D9D9",
      stroke: initialValues?.stroke ?? "#000000",
      opacity: initialValues?.opacity ?? 100,
      text: type === "TEXT" ? "Double click to edit" : undefined,
      fontSize: type === "TEXT" ? 16 : undefined,
      textAlign: type === "TEXT" ? "left" : undefined,
      fontFamily: type === "TEXT" ? "sans-serif" : undefined,
      lineHeight: type === "TEXT" ? 1.5 : undefined,
      ...initialValues,
    };

    set((state) => ({
      layers: { ...state.layers, [id]: newLayer },
      layerIds: [...state.layerIds, id],
      selection: [id], // Auto-select new item
      mode: CanvasMode.None, // Switch back to pointer after insert
    }));
  },

  updateLayer: (id, data, saveHistoryAction) =>
    set((state) => {
      if (saveHistoryAction) {
        get().saveHistory();
      }

      const layer = state.layers[id];
      if (!layer) return state;
      const newLayer = { ...layer, ...data };

      // Auto-flag original extracted layers as edited if they are mutated
      if (layer.isOriginal && layer.type === "TEXT") {
        const isMovedOrResized =
          data.x !== undefined ||
          data.y !== undefined ||
          data.text !== undefined ||
          data.fontSize !== undefined ||
          data.width !== undefined;

        if (isMovedOrResized) {
          newLayer.isEdited = true;
        }
      }

      return {
        layers: {
          ...state.layers,
          [id]: newLayer,
        },
      };
    }),

  setSelection: (ids) => set({ selection: ids }),
  setHoveredLayerId: (id) => set({ hoveredLayerId: id }),
  setAltPressed: (pressed) => set({ isAltPressed: pressed }),

  deleteLayers: () =>
    set((state) => {
      get().saveHistory();
      const newLayers = { ...state.layers };
      state.selection.forEach((id) => delete newLayers[id]);
      return {
        layers: newLayers,
        layerIds: state.layerIds.filter((id) => !state.selection.includes(id)),
        selection: [],
      };
    }),

  // --- Translation Logic ---
  startTranslating: (point) => {
    const state = get();
    if (state.selection.length === 1) {
      const activeLayer = state.layers[state.selection[0]];
      set({
        mode: CanvasMode.Translating,
        dragOffset: {
          x: point.x - activeLayer.x,
          y: point.y - activeLayer.y,
        },
        guides: [],
      });
    } else {
      set({
        mode: CanvasMode.Translating,
        dragOffset: { x: 0, y: 0 },
        guides: [],
      });
    }
  },

  continueTranslating: (point) => {
    const state = get();
    if (state.mode !== CanvasMode.Translating || !state.dragOffset) return;

    if (state.selection.length === 1) {
      const id = state.selection[0];
      const activeLayer = state.layers[id];

      let newX = point.x - state.dragOffset.x;
      let newY = point.y - state.dragOffset.y;

      // --- Snapping Logic ---
      const activeCenterX = newX + activeLayer.width / 2;
      const activeCenterY = newY + activeLayer.height / 2;
      const newGuides: { type: "horizontal" | "vertical"; position: number }[] =
        [];
      const SNAP_DISTANCE = 5 / state.camera.zoom;

      for (const targetId of state.layerIds) {
        if (targetId === id) continue;
        const target = state.layers[targetId];
        const targetCenterX = target.x + target.width / 2;
        const targetCenterY = target.y + target.height / 2;

        if (Math.abs(newX - target.x) < SNAP_DISTANCE) {
          newX = target.x;
          newGuides.push({ type: "vertical", position: target.x });
        } else if (Math.abs(activeCenterX - targetCenterX) < SNAP_DISTANCE) {
          newX = targetCenterX - activeLayer.width / 2;
          newGuides.push({ type: "vertical", position: targetCenterX });
        }

        if (Math.abs(newY - target.y) < SNAP_DISTANCE) {
          newY = target.y;
          newGuides.push({ type: "horizontal", position: target.y });
        } else if (Math.abs(activeCenterY - targetCenterY) < SNAP_DISTANCE) {
          newY = targetCenterY - activeLayer.height / 2;
          newGuides.push({ type: "horizontal", position: targetCenterY });
        }
      }

      set((state) => ({
        layers: {
          ...state.layers,
          [id]: { ...activeLayer, x: newX, y: newY },
        },
        guides: newGuides,
      }));
    }
  },

  endTranslating: () => {
    set({ mode: CanvasMode.None, dragOffset: null, guides: [] });
  },

  // --- Resizing Logic ---
  startResizing: (handle, point) => {
    const state = get();
    if (state.selection.length === 1) {
      const activeLayer = state.layers[state.selection[0]];
      set({
        mode: CanvasMode.Resizing,
        resizeHandle: handle,
        resizeInitialBounds: {
          x: activeLayer.x,
          y: activeLayer.y,
          width: activeLayer.width,
          height: activeLayer.height,
        },
        resizeInitialPoint: point,
      });
    }
  },

  continueResizing: (point) => {
    const state = get();
    if (
      state.mode !== CanvasMode.Resizing ||
      !state.resizeHandle ||
      !state.resizeInitialBounds ||
      !state.resizeInitialPoint
    )
      return;

    if (state.selection.length === 1) {
      const id = state.selection[0];
      const activeLayer = state.layers[id];
      const { x, y, width, height } = state.resizeInitialBounds;

      const dx = point.x - state.resizeInitialPoint.x;
      const dy = point.y - state.resizeInitialPoint.y;

      let newX = x;
      let newY = y;
      let newWidth = width;
      let newHeight = height;

      if (state.resizeHandle.includes("left")) {
        newX = x + dx;
        newWidth = width - dx;
      }
      if (state.resizeHandle.includes("right")) {
        newWidth = width + dx;
      }
      if (state.resizeHandle.includes("top")) {
        newY = y + dy;
        newHeight = height - dy;
      }
      if (state.resizeHandle.includes("bottom")) {
        newHeight = height + dy;
      }

      // Prevent negative width/height
      if (newWidth < 1) {
        newWidth = 1;
        newX = activeLayer.x;
      }
      if (newHeight < 1) {
        newHeight = 1;
        newY = activeLayer.y;
      }

      set((state) => ({
        layers: {
          ...state.layers,
          [id]: {
            ...activeLayer,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          },
        },
      }));
    }
  },

  endResizing: () => {
    set({
      mode: CanvasMode.None,
      resizeHandle: null,
      resizeInitialBounds: null,
      resizeInitialPoint: null,
    });
  },

  // --- Drawing Logic ---
  startDrawing: (point, pageIndex) => {
    set({
      pencilDraft: [[point.x, point.y]],
      pencilPageIndex: pageIndex,
      mode: CanvasMode.Pencil,
    });
  },

  continueDrawing: (point) =>
    set((state) => {
      if (state.mode !== CanvasMode.Pencil || !state.pencilDraft) return state;
      return {
        pencilDraft: [...state.pencilDraft, [point.x, point.y]],
      };
    }),

  endDrawing: (pageIndex) =>
    set((state) => {
      if (!state.pencilDraft || state.pencilDraft.length < 2) {
        return { pencilDraft: null, mode: CanvasMode.None };
      }

      const id = nanoid();
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      state.pencilDraft.forEach((p) => {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      });

      const newLayer: Layer = {
        type: "PATH",
        pageIndex,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        fill: "transparent",
        stroke: "#000000",
        opacity: 100,
        points: state.pencilDraft.map((p) => [p[0] - minX, p[1] - minY]),
      };

      return {
        pencilDraft: null,
        mode: CanvasMode.None,
        layers: { ...state.layers, [id]: newLayer },
        layerIds: [...state.layerIds, id],
        selection: [id],
      };
    }),

  reorderLayer: (id, direction) =>
    set((state) => {
      const index = state.layerIds.indexOf(id);
      if (index === -1) return state;

      const newIds = [...state.layerIds];
      if (direction === "up" && index < newIds.length - 1) {
        [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
      } else if (direction === "down" && index > 0) {
        [newIds[index], newIds[index - 1]] = [newIds[index - 1], newIds[index]];
      }

      return { layerIds: newIds };
    }),
}));
