import { useCallback } from "react";
import { useCanvasStore, CanvasMode, CanvasState } from "../../../store/useCanvasStore";
import { getPageAtCanvasY, toPageRelativePoint } from "../../../lib/editor/pageLayout";

export function useCanvasPointerController(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stageRef: React.RefObject<any>,
  setEditingTextId: (id: string | null) => void
) {
  const mode = useCanvasStore((s: CanvasState) => s.mode);
  const layerType = useCanvasStore((s: CanvasState) => s.layerType);
  const pages = useCanvasStore((s: CanvasState) => s.pages);
  const setSelection = useCanvasStore((s: CanvasState) => s.setSelection);
  const insertLayer = useCanvasStore((s: CanvasState) => s.insertLayer);
  const startDrawing = useCanvasStore((s: CanvasState) => s.startDrawing);
  const continueDrawing = useCanvasStore((s: CanvasState) => s.continueDrawing);
  const endDrawing = useCanvasStore((s: CanvasState) => s.endDrawing);

  const onPointerDown = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const stage = e.target.getStage();
      const isStageOrPage = e.target === stage || e.target.hasName("page-background");

      if (isStageOrPage && mode === CanvasMode.None) {
        setSelection([]);
        setEditingTextId(null);
      }

      if (pages.length === 0) return;
      const pointer = stage.getRelativePointerPosition();
      if (!pointer) return;

      const pageIndex = getPageAtCanvasY(pointer.y, pages) ?? 0;
      const relativePoint = toPageRelativePoint(pointer, pageIndex, pages);

      if (mode === CanvasMode.Inserting && layerType) {
        const initialValues = layerType === "LINE" || layerType === "ARROW" ? { height: 2 } : {};
        insertLayer(layerType, pageIndex, relativePoint, initialValues);
      } else if (mode === CanvasMode.Pencil) {
        startDrawing(relativePoint, pageIndex);
      }
    },
    [mode, layerType, pages, setSelection, setEditingTextId, insertLayer, startDrawing]
  );

  const onPointerMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (e.evt.buttons !== 1 || pages.length === 0) return;
      const stage = e.target.getStage();
      const pointer = stage.getRelativePointerPosition();
      if (!pointer) return;

      if (mode === CanvasMode.Pencil) {
        const pageIndex = getPageAtCanvasY(pointer.y, pages) ?? 0;
        const relativePoint = toPageRelativePoint(pointer, pageIndex, pages);
        continueDrawing(relativePoint);
      }
    },
    [mode, pages, continueDrawing]
  );

  const onPointerUp = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (pages.length === 0) return;
      if (mode === CanvasMode.Pencil) {
        const stage = e.target.getStage();
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        const pageIndex = getPageAtCanvasY(pointer.y, pages) ?? 0;
        endDrawing(pageIndex);
      }
    },
    [mode, pages, endDrawing]
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
