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
  pdfPageIndex: number; // 0-based index in the raw PDF (if imported)
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

  rotation?: number; // Added to support Transformer rotation bounds natively

  src?: string; // For Image Layer
};

export enum CanvasMode {
  None, // Pointer tool
  Inserting, // Placing a new shape
  Translating, // Moving a shape
  Resizing, // Dragging handles
  Pencil, // Freehand drawing
  SelectionNet, // Dragging a multi-select box
}

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
  pencilDraft: number[][] | null; // Intermediate drawing state

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
  addBlankPage: (width: number, height: number, groupName?: string) => void;
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
  updateLayer: (id: string, data: Partial<Layer>) => void;
  setSelection: (ids: string[]) => void;
  deleteLayers: () => void;
  clearCanvas: () => void; // Reset entire workspace

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
  pencilDraft: null,
  dragOffset: null,
  guides: [],
  resizeHandle: null,
  resizeInitialBounds: null,
  resizeInitialPoint: null,

  setPdfBytes: (bytes) => set({ pdfBytes: bytes }),
  setPages: (pages) => set({ pages }),
  addBlankPage: (width, height, groupName) =>
    set((state) => {
      const newPage: Page = {
        id: nanoid(),
        pdfPageIndex: state.pages.length,
        width,
        height,
        groupName: groupName || "Custom",
      };
      return { pages: [...state.pages, newPage] };
    }),
  reorderPages: (oldIndex, newIndex) =>
    set((state) => {
      const newPages = [...state.pages];
      const [moved] = newPages.splice(oldIndex, 1);
      newPages.splice(newIndex, 0, moved);
      return { pages: newPages };
    }),
  deletePage: (pageIndex) =>
    set((state) => {
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
    set({
      pdfBytes: null,
      pages: [],
      layers: {},
      layerIds: [],
      selection: [],
      camera: { x: 0, y: 0, zoom: 1 },
    }),

  setCamera: (camera) => set({ camera }),
  setMode: (mode, layerType) => set({ mode, layerType }),

  insertLayer: (type, pageIndex, point, initialValues = {}) => {
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

  updateLayer: (id, data) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], ...data },
      },
    })),

  setSelection: (ids) => set({ selection: ids }),

  deleteLayers: () =>
    set((state) => {
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
    set({ pencilDraft: [[point.x, point.y]], mode: CanvasMode.Pencil });
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
