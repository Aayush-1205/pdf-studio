import { create } from "zustand";
import { get, set } from "idb-keyval";

// ── Extracted content from existing PDF ─────────────────────────────

export interface ExtractedTextItem {
  id: string;
  pageIndex: number; // 0-indexed
  str: string;
  transform: number[]; // [a,b,c,d,e,f] PDF transform matrix
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
}

export interface ExtractedImage {
  id: string;
  pageIndex: number;
  name: string; // XObject resource name
  x: number;
  y: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
}

// ── New items the user places on the canvas ─────────────────────────

export interface NewTextItem {
  id: string;
  pageIndex: number; // 0-indexed
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
}

export interface NewImageItem {
  id: string;
  pageIndex: number; // 0-indexed
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string; // base64 data URL of the image
}

// ── Tool Modes ──────────────────────────────────────────────────────

export type EditorTool =
  | "select"
  | "addText"
  | "addImage"
  | "highlight"
  | "draw"
  | "shapes"
  | "eraser"
  | "signature";

// ── Highlight / Draw annotations ────────────────────────────────────

export interface HighlightAnnotation {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}

export interface DrawStroke {
  id: string;
  pageIndex: number;
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

export interface ShapeAnnotation {
  id: string;
  pageIndex: number;
  type: "rect" | "circle" | "line" | "arrow";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
}

// ── Undo/Redo ───────────────────────────────────────────────────────

interface HistoryEntry {
  description: string;
  pdfSnapshot?: Blob; // For mutations that modify the PDF bytes
}

// ── The Store ───────────────────────────────────────────────────────

export interface PDFStore {
  // Core state
  pdfUrl: string | null;
  numPages: number;
  activePage: number; // 1-indexed (for pdf.js compatibility)
  zoom: number;
  activeTool: EditorTool;

  // Extracted content (from current page)
  pageTextItems: ExtractedTextItem[];
  pageImages: ExtractedImage[];

  // Selection
  selectedTextItem: ExtractedTextItem | null;
  selectedImage: ExtractedImage | null;
  selectedNewTextId: string | null;
  selectedNewImageId: string | null;

  // New content placed by user
  newTextItems: NewTextItem[];
  newImageItems: NewImageItem[];

  // Annotations
  highlights: HighlightAnnotation[];
  drawStrokes: DrawStroke[];
  shapes: ShapeAnnotation[];

  // History
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // ── Actions ────────────────────────────────────────────────────────

  // Core
  setPdfUrl: (url: string | null) => void;
  setNumPages: (num: number) => void;
  setActivePage: (page: number) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: EditorTool) => void;

  // Extracted content
  setPageTextItems: (items: ExtractedTextItem[]) => void;
  setPageImages: (items: ExtractedImage[]) => void;

  // Selection
  setSelectedTextItem: (item: ExtractedTextItem | null) => void;
  setSelectedImage: (item: ExtractedImage | null) => void;
  setSelectedNewTextId: (id: string | null) => void;
  setSelectedNewImageId: (id: string | null) => void;
  clearSelection: () => void;

  // New content
  addNewTextItem: (item: NewTextItem) => void;
  updateNewTextItem: (id: string, updates: Partial<NewTextItem>) => void;
  removeNewTextItem: (id: string) => void;

  addNewImageItem: (item: NewImageItem) => void;
  updateNewImageItem: (id: string, updates: Partial<NewImageItem>) => void;
  removeNewImageItem: (id: string) => void;

  // Annotations
  addHighlight: (h: HighlightAnnotation) => void;
  removeHighlight: (id: string) => void;

  addDrawStroke: (s: DrawStroke) => void;
  removeDrawStroke: (id: string) => void;

  addShape: (s: ShapeAnnotation) => void;
  updateShape: (id: string, updates: Partial<ShapeAnnotation>) => void;
  removeShape: (id: string) => void;

  // History
  pushUndo: (entry: HistoryEntry) => void;
  undo: () => void;
  redo: () => void;

  // Storage
  loadFromStorage: () => Promise<void>;
  saveToStorage: (file: File | Blob) => Promise<void>;
}

export const usePDFStore = create<PDFStore>((setStore, getStore) => ({
  // ── Initial state ──────────────────────────────────────────────────

  pdfUrl: null,
  numPages: 0,
  activePage: 1,
  zoom: 1,
  activeTool: "select",

  pageTextItems: [],
  pageImages: [],

  selectedTextItem: null,
  selectedImage: null,
  selectedNewTextId: null,
  selectedNewImageId: null,

  newTextItems: [],
  newImageItems: [],

  highlights: [],
  drawStrokes: [],
  shapes: [],

  undoStack: [],
  redoStack: [],

  // ── Core actions ───────────────────────────────────────────────────

  setPdfUrl: (url) => setStore({ pdfUrl: url }),
  setNumPages: (num) => setStore({ numPages: num }),
  setActivePage: (page) => setStore({ activePage: page }),
  setZoom: (zoom) => setStore({ zoom }),
  setActiveTool: (tool) => {
    getStore().clearSelection();
    setStore({ activeTool: tool });
  },

  // ── Extracted content ──────────────────────────────────────────────

  setPageTextItems: (items) => setStore({ pageTextItems: items }),
  setPageImages: (items) => setStore({ pageImages: items }),

  // ── Selection ──────────────────────────────────────────────────────

  setSelectedTextItem: (item) =>
    setStore({
      selectedTextItem: item,
      selectedImage: null,
      selectedNewTextId: null,
      selectedNewImageId: null,
    }),
  setSelectedImage: (item) =>
    setStore({
      selectedTextItem: null,
      selectedImage: item,
      selectedNewTextId: null,
      selectedNewImageId: null,
    }),
  setSelectedNewTextId: (id) =>
    setStore({
      selectedTextItem: null,
      selectedImage: null,
      selectedNewTextId: id,
      selectedNewImageId: null,
    }),
  setSelectedNewImageId: (id) =>
    setStore({
      selectedTextItem: null,
      selectedImage: null,
      selectedNewTextId: null,
      selectedNewImageId: id,
    }),
  clearSelection: () =>
    setStore({
      selectedTextItem: null,
      selectedImage: null,
      selectedNewTextId: null,
      selectedNewImageId: null,
    }),

  // ── New content actions ────────────────────────────────────────────

  addNewTextItem: (item) =>
    setStore((s) => ({ newTextItems: [...s.newTextItems, item] })),
  updateNewTextItem: (id, updates) =>
    setStore((s) => ({
      newTextItems: s.newTextItems.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),
  removeNewTextItem: (id) =>
    setStore((s) => ({
      newTextItems: s.newTextItems.filter((t) => t.id !== id),
      selectedNewTextId:
        s.selectedNewTextId === id ? null : s.selectedNewTextId,
    })),

  addNewImageItem: (item) =>
    setStore((s) => ({ newImageItems: [...s.newImageItems, item] })),
  updateNewImageItem: (id, updates) =>
    setStore((s) => ({
      newImageItems: s.newImageItems.map((i) =>
        i.id === id ? { ...i, ...updates } : i,
      ),
    })),
  removeNewImageItem: (id) =>
    setStore((s) => ({
      newImageItems: s.newImageItems.filter((i) => i.id !== id),
      selectedNewImageId:
        s.selectedNewImageId === id ? null : s.selectedNewImageId,
    })),

  // ── Annotations ────────────────────────────────────────────────────

  addHighlight: (h) => setStore((s) => ({ highlights: [...s.highlights, h] })),
  removeHighlight: (id) =>
    setStore((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),

  addDrawStroke: (stroke) =>
    setStore((s) => ({ drawStrokes: [...s.drawStrokes, stroke] })),
  removeDrawStroke: (id) =>
    setStore((s) => ({
      drawStrokes: s.drawStrokes.filter((d) => d.id !== id),
    })),

  addShape: (shape) => setStore((s) => ({ shapes: [...s.shapes, shape] })),
  updateShape: (id, updates) =>
    setStore((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)),
    })),
  removeShape: (id) =>
    setStore((s) => ({ shapes: s.shapes.filter((sh) => sh.id !== id) })),

  // ── History (undo/redo) ────────────────────────────────────────────

  pushUndo: (entry) =>
    setStore((s) => ({
      undoStack: [...s.undoStack.slice(-19), entry], // Keep last 20
      redoStack: [], // Clear redo on new action
    })),
  undo: () => {
    const state = getStore();
    if (state.undoStack.length === 0) return;
    const last = state.undoStack[state.undoStack.length - 1];
    setStore({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, last],
    });
    // If the entry has a PDF snapshot, reload it
    if (last.pdfSnapshot) {
      getStore().saveToStorage(last.pdfSnapshot);
    }
  },
  redo: () => {
    const state = getStore();
    if (state.redoStack.length === 0) return;
    const last = state.redoStack[state.redoStack.length - 1];
    setStore({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, last],
    });
    if (last.pdfSnapshot) {
      getStore().saveToStorage(last.pdfSnapshot);
    }
  },

  // ── Storage ────────────────────────────────────────────────────────

  loadFromStorage: async () => {
    try {
      const storedPdf = await get("active_pdf");
      if (storedPdf instanceof Blob) {
        const url = URL.createObjectURL(storedPdf);
        setStore({ pdfUrl: url });
      }
    } catch (e) {
      console.error("Failed to load PDF from storage:", e);
    }
  },

  saveToStorage: async (file: File | Blob) => {
    try {
      await set("active_pdf", file);

      // Revoke old URL to prevent memory leak
      const oldUrl = getStore().pdfUrl;
      if (oldUrl) URL.revokeObjectURL(oldUrl);

      const url = URL.createObjectURL(file);
      setStore({
        pdfUrl: url,
        pageTextItems: [],
        pageImages: [],
        selectedTextItem: null,
        selectedImage: null,
      });
    } catch (e) {
      console.error("Failed to save PDF to storage:", e);
    }
  },
}));
