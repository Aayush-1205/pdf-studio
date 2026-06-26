import { create } from "zustand";
import { nanoid } from "nanoid";
import { Camera, CanvasMode, LayerType, Point, Layer } from "../useCanvasStore";
import { useDocumentStore } from "./useDocumentStore";
import { useHistoryStore } from "./useHistoryStore";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractionState {
  camera: Camera;
  mode: CanvasMode;
  layerType?: LayerType;
  hoveredLayerId: string | null;
  isAltPressed: boolean;
  pencilDraft: number[][] | null;
  pencilPageIndex: number;
  dragOffset: Point | null;
  guides: { type: "horizontal" | "vertical"; position: number }[];
  resizeHandle: string | null;
  resizeInitialBounds: Bounds | null;
  resizeInitialPoint: Point | null;
  translateStartPos: Point | null; // For command-based history tracking

  setCamera: (camera: Camera) => void;
  setMode: (mode: CanvasMode, type?: LayerType) => void;
  setHoveredLayerId: (id: string | null) => void;
  setAltPressed: (pressed: boolean) => void;

  startTranslating: (point: Point) => void;
  continueTranslating: (point: Point) => void;
  endTranslating: () => void;

  startResizing: (handle: string, point: Point) => void;
  continueResizing: (point: Point) => void;
  endResizing: () => void;

  startDrawing: (point: Point, pageIndex: number) => void;
  continueDrawing: (point: Point) => void;
  endDrawing: (pageIndex: number) => void;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  mode: CanvasMode.None,
  hoveredLayerId: null,
  isAltPressed: false,
  pencilDraft: null,
  pencilPageIndex: 0,
  dragOffset: null,
  guides: [],
  resizeHandle: null,
  resizeInitialBounds: null,
  resizeInitialPoint: null,
  translateStartPos: null,

  setCamera: (camera) => set({ camera }),
  setMode: (mode, layerType) => set({ mode, layerType }),
  setHoveredLayerId: (id) => set({ hoveredLayerId: id }),
  setAltPressed: (pressed) => set({ isAltPressed: pressed }),

  startTranslating: (point) => {
    const docState = useDocumentStore.getState();
    const selection = docState.selection;
    if (selection.length === 1) {
      const activeLayer = docState.layers[selection[0]];
      if (activeLayer) {
        set({
          mode: CanvasMode.Translating,
          dragOffset: {
            x: point.x - activeLayer.x,
            y: point.y - activeLayer.y,
          },
          translateStartPos: { x: activeLayer.x, y: activeLayer.y },
          guides: [],
        });
        return;
      }
    }
    set({
      mode: CanvasMode.Translating,
      dragOffset: { x: 0, y: 0 },
      translateStartPos: null,
      guides: [],
    });
  },

  continueTranslating: (point) => {
    const docState = useDocumentStore.getState();
    const state = get();
    if (state.mode !== CanvasMode.Translating || !state.dragOffset) return;

    if (docState.selection.length === 1) {
      const id = docState.selection[0];
      const activeLayer = docState.layers[id];
      if (!activeLayer) return;

      let newX = point.x - state.dragOffset.x;
      let newY = point.y - state.dragOffset.y;

      const activeCenterX = newX + activeLayer.width / 2;
      const activeCenterY = newY + activeLayer.height / 2;
      const newGuides: { type: "horizontal" | "vertical"; position: number }[] = [];
      const SNAP_DISTANCE = 5 / state.camera.zoom;

      for (const targetId of docState.layerIds) {
        if (targetId === id) continue;
        const target = docState.layers[targetId];
        if (!target) continue;
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

      docState.updateLayer(id, { x: newX, y: newY }, false);
      set({ guides: newGuides });
    }
  },

  endTranslating: () => {
    const startPos = get().translateStartPos;
    const docState = useDocumentStore.getState();
    const selection = docState.selection;

    if (startPos && selection.length === 1) {
      const id = selection[0];
      const currentLayer = docState.layers[id];
      if (currentLayer && (currentLayer.x !== startPos.x || currentLayer.y !== startPos.y)) {
        const endPos = { x: currentLayer.x, y: currentLayer.y };
        useHistoryStore.getState().execute({
          label: "Move Layer",
          do: () => docState.updateLayer(id, endPos, false),
          undo: () => docState.updateLayer(id, startPos, false),
        });
      }
    }
    set({ mode: CanvasMode.None, dragOffset: null, translateStartPos: null, guides: [] });
  },

  startResizing: (handle, point) => {
    const docState = useDocumentStore.getState();
    const selection = docState.selection;
    if (selection.length === 1) {
      const activeLayer = docState.layers[selection[0]];
      if (activeLayer) {
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
    }
  },

  continueResizing: (point) => {
    const docState = useDocumentStore.getState();
    const state = get();
    if (
      state.mode !== CanvasMode.Resizing ||
      !state.resizeHandle ||
      !state.resizeInitialBounds ||
      !state.resizeInitialPoint
    )
      return;

    if (docState.selection.length === 1) {
      const id = docState.selection[0];
      const activeLayer = docState.layers[id];
      if (!activeLayer) return;

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

      if (newWidth < 1) {
        newWidth = 1;
        newX = activeLayer.x;
      }
      if (newHeight < 1) {
        newHeight = 1;
        newY = activeLayer.y;
      }

      docState.updateLayer(
        id,
        {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        },
        false
      );
    }
  },

  endResizing: () => {
    const initBounds = get().resizeInitialBounds;
    const docState = useDocumentStore.getState();
    const selection = docState.selection;

    if (initBounds && selection.length === 1) {
      const id = selection[0];
      const currentLayer = docState.layers[id];
      if (
        currentLayer &&
        (currentLayer.x !== initBounds.x ||
          currentLayer.y !== initBounds.y ||
          currentLayer.width !== initBounds.width ||
          currentLayer.height !== initBounds.height)
      ) {
        const endBounds = {
          x: currentLayer.x,
          y: currentLayer.y,
          width: currentLayer.width,
          height: currentLayer.height,
        };

        useHistoryStore.getState().execute({
          label: "Resize Layer",
          do: () => docState.updateLayer(id, endBounds, false),
          undo: () => docState.updateLayer(id, initBounds, false),
        });
      }
    }

    set({
      mode: CanvasMode.None,
      resizeHandle: null,
      resizeInitialBounds: null,
      resizeInitialPoint: null,
    });
  },

  startDrawing: (point, pageIndex) => {
    set({
      pencilDraft: [[point.x, point.y]],
      pencilPageIndex: pageIndex,
      mode: CanvasMode.Pencil,
    });
  },

  continueDrawing: (point) => {
    set((state) => {
      if (state.mode !== CanvasMode.Pencil || !state.pencilDraft) return state;
      return {
        pencilDraft: [...state.pencilDraft, [point.x, point.y]],
      };
    });
  },

  endDrawing: (pageIndex) => {
    const draft = get().pencilDraft;
    if (!draft || draft.length < 2) {
      set({ pencilDraft: null, mode: CanvasMode.None });
      return;
    }

    const id = nanoid();
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    draft.forEach((p) => {
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
      points: draft.map((p) => [p[0] - minX, p[1] - minY]),
    };

    useHistoryStore.getState().execute({
      label: "Draw Path",
      do: () => {
        useDocumentStore.setState((state) => ({
          layers: { ...state.layers, [id]: newLayer },
          layerIds: [...state.layerIds, id],
          selection: [id],
        }));
      },
      undo: () => {
        useDocumentStore.setState((state) => {
          const next = { ...state.layers };
          delete next[id];
          return {
            layers: next,
            layerIds: state.layerIds.filter((x) => x !== id),
            selection: state.selection.filter((x) => x !== id),
          };
        });
      },
    });

    set({ pencilDraft: null, mode: CanvasMode.None });
  },
}));
