import { create } from "zustand";
import { nanoid } from "nanoid";
import { Page, Layer, LayerType, Point } from "../useCanvasStore";
import { useHistoryStore } from "./useHistoryStore";

export interface DocumentState {
  pdfBytes: Uint8Array | null;
  pages: Page[];
  layers: Record<string, Layer>;
  layerIds: string[];
  selection: string[];

  setPdfBytes: (bytes: Uint8Array | null) => void;
  setPages: (pages: Page[]) => void;
  addBlankPage: (
    width: number,
    height: number,
    groupName?: string,
    insertIndex?: number | string
  ) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  deletePage: (pageIndex: number) => void;
  clearCanvas: () => void;

  insertLayer: (
    type: LayerType,
    pageIndex: number,
    point: Point,
    initialValues?: Partial<Layer>
  ) => void;
  updateLayer: (
    id: string,
    data: Partial<Layer>,
    saveHistoryAction?: boolean
  ) => void;
  setSelection: (ids: string[]) => void;
  deleteLayers: () => void;
  reorderLayer: (id: string, direction: "up" | "down") => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  pdfBytes: null,
  pages: [],
  layers: {},
  layerIds: [],
  selection: [],

  setPdfBytes: (pdfBytes) => set({ pdfBytes }),
  setPages: (pages) => set({ pages }),
  setSelection: (selection) => set({ selection }),

  addBlankPage: (width, height, groupName, insertIndex) => {
    const oldPages = get().pages;
    const oldLayers = get().layers;

    const createBlankPage = (): Page => ({
      id: nanoid(),
      width,
      height,
      groupName: groupName || "Blank Page",
    });

    const runAdd = () => {
      set((state) => {
        let newPages: Page[] = [];
        const indexMap = new Map<number, number>();
        let newIndex = 0;

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
        } else if (typeof insertIndex === "string" && insertIndex !== "end") {
          const everyNMatch = insertIndex.match(/^every_(\d+)$/);
          const everyN = everyNMatch ? parseInt(everyNMatch[1], 10) : null;

          for (let i = 0; i < state.pages.length; i++) {
            newPages.push(state.pages[i]);
            indexMap.set(i, newIndex);
            newIndex++;

            let shouldInsert = false;
            const pageNum = i + 1;
            if (insertIndex === "odd" && pageNum % 2 !== 0) shouldInsert = true;
            if (insertIndex === "even" && pageNum % 2 === 0) shouldInsert = true;
            if (everyN !== null && pageNum % everyN === 0) shouldInsert = true;

            if (shouldInsert) {
              newPages.push(createBlankPage());
              newIndex++;
            }
          }
        } else {
          newPages = [...state.pages];
          for (let i = 0; i < state.pages.length; i++) {
            indexMap.set(i, i);
          }
          newPages.push(createBlankPage());
        }

        const newLayers = JSON.parse(JSON.stringify(state.layers));
        Object.keys(newLayers).forEach((id) => {
          const oldIdx = newLayers[id].pageIndex;
          if (indexMap.has(oldIdx)) {
            newLayers[id].pageIndex = indexMap.get(oldIdx)!;
          }
        });

        return { pages: newPages, layers: newLayers };
      });
    };

    useHistoryStore.getState().execute({
      label: "Add Blank Page",
      do: () => runAdd(),
      undo: () => set({ pages: oldPages, layers: oldLayers }),
    });
  },

  reorderPages: (oldIndex, newIndex) => {
    const oldPages = get().pages;
    const runReorder = () => {
      set((state) => {
        const newPages = [...state.pages];
        const [moved] = newPages.splice(oldIndex, 1);
        newPages.splice(newIndex, 0, moved);
        return { pages: newPages };
      });
    };

    useHistoryStore.getState().execute({
      label: "Reorder Pages",
      do: () => runReorder(),
      undo: () => set({ pages: oldPages }),
    });
  },

  deletePage: (pageIndex) => {
    const oldPages = get().pages;
    const oldLayers = get().layers;
    const oldLayerIds = get().layerIds;
    const oldSelection = get().selection;

    const runDelete = () => {
      set((state) => {
        const layersToDelete = Object.entries(state.layers)
          .filter(([, l]) => l.pageIndex === pageIndex)
          .map(([id]) => id);
        const newLayers = { ...state.layers };
        layersToDelete.forEach((id) => delete newLayers[id]);

        Object.keys(newLayers).forEach((id) => {
          if (newLayers[id].pageIndex > pageIndex) {
            newLayers[id].pageIndex -= 1;
          }
        });

        const newLayerIds = state.layerIds.filter((id) => !layersToDelete.includes(id));
        const newSelection = state.selection.filter((id) => !layersToDelete.includes(id));
        const newPages = state.pages.filter((_, idx) => idx !== pageIndex);

        return {
          pages: newPages,
          layers: newLayers,
          layerIds: newLayerIds,
          selection: newSelection,
        };
      });
    };

    useHistoryStore.getState().execute({
      label: "Delete Page",
      do: () => runDelete(),
      undo: () =>
        set({
          pages: oldPages,
          layers: oldLayers,
          layerIds: oldLayerIds,
          selection: oldSelection,
        }),
    });
  },

  clearCanvas: () => {
    const oldState = {
      pdfBytes: get().pdfBytes,
      pages: get().pages,
      layers: get().layers,
      layerIds: get().layerIds,
      selection: get().selection,
    };

    useHistoryStore.getState().execute({
      label: "Clear Canvas",
      do: () =>
        set({
          pdfBytes: null,
          pages: [],
          layers: {},
          layerIds: [],
          selection: [],
        }),
      undo: () => set(oldState),
    });
  },

  insertLayer: (type, pageIndex, point, initialValues = {}) => {
    const id = nanoid();
    const newLayer: Layer = {
      type,
      pageIndex,
      x: point.x,
      y: point.y,
      width: initialValues.width || 100,
      height: initialValues?.height ?? 100,
      fill: initialValues?.fill ?? (type === "TEXT" ? "#000000" : "#D9D9D9"),
      stroke: initialValues?.stroke ?? (type === "TEXT" ? "transparent" : "#000000"),
      opacity: initialValues?.opacity ?? 100,
      text: type === "TEXT" ? "Double click to edit" : undefined,
      fontSize: type === "TEXT" ? 16 : undefined,
      textAlign: type === "TEXT" ? "left" : undefined,
      fontFamily: type === "TEXT" ? "sans-serif" : undefined,
      lineHeight: type === "TEXT" ? 1.5 : undefined,
      ...initialValues,
    };

    const cmd = {
      label: `Insert ${type}`,
      do: () => {
        set((state) => ({
          layers: { ...state.layers, [id]: newLayer },
          layerIds: [...state.layerIds, id],
          selection: [id],
        }));
      },
      undo: () => {
        set((state) => {
          const next = { ...state.layers };
          delete next[id];
          return {
            layers: next,
            layerIds: state.layerIds.filter((x) => x !== id),
            selection: state.selection.filter((x) => x !== id),
          };
        });
      },
    };
    useHistoryStore.getState().execute(cmd);
  },

  updateLayer: (id, data, saveHistoryAction) => {
    const prevLayer = get().layers[id];
    if (!prevLayer) return;

    const doUpdate = (patch: Partial<Layer>) => {
      set((state) => {
        const layer = state.layers[id];
        if (!layer) return state;
        const newLayer = { ...layer, ...patch };
        if (layer.isOriginal && layer.type === "TEXT") {
          const isMovedOrResized =
            patch.x !== undefined ||
            patch.y !== undefined ||
            patch.text !== undefined ||
            patch.fontSize !== undefined ||
            patch.width !== undefined;
          if (isMovedOrResized) {
            newLayer.isEdited = true;
          }
        }
        return {
          layers: { ...state.layers, [id]: newLayer },
        };
      });
    };

    if (saveHistoryAction) {
      const beforePatch = Object.keys(data).reduce((acc, key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        acc[key] = (prevLayer as any)[key];
        return acc;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {} as any);

      useHistoryStore.getState().execute({
        label: "Update Layer",
        do: () => doUpdate(data),
        undo: () => doUpdate(beforePatch),
      });
    } else {
      doUpdate(data);
    }
  },

  deleteLayers: () => {
    const selection = get().selection;
    if (selection.length === 0) return;
    const layers = get().layers;
    const layerIds = get().layerIds;

    const deletedLayers = selection.reduce((acc, id) => {
      acc[id] = layers[id];
      return acc;
    }, {} as Record<string, Layer>);

    const cmd = {
      label: "Delete Layers",
      do: () => {
        set((state) => {
          const next = { ...state.layers };
          selection.forEach((id) => delete next[id]);
          return {
            layers: next,
            layerIds: state.layerIds.filter((id) => !selection.includes(id)),
            selection: [],
          };
        });
      },
      undo: () => {
        set((state) => ({
          layers: { ...state.layers, ...deletedLayers },
          layerIds: [...layerIds],
          selection: [...selection],
        }));
      },
    };
    useHistoryStore.getState().execute(cmd);
  },

  reorderLayer: (id, direction) => {
    const oldLayerIds = get().layerIds;
    const runReorder = () => {
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
      });
    };

    useHistoryStore.getState().execute({
      label: "Reorder Layer",
      do: () => runReorder(),
      undo: () => set({ layerIds: oldLayerIds }),
    });
  },
}));
