"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore, CanvasMode } from "../../store/useCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Image as KonvaImage,
  Line,
  Text,
} from "react-konva";
import useImage from "use-image";
import LayerComponent from "./LayerComponent";
import SelectionBox from "./SelectionBox";
import BottomToolbar from "./BottomToolbar";
import RightPropertyPanel from "./RightPropertyPanel";
import LeftSidebar from "./LeftSidebar";
import { Layers } from "lucide-react";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "../../app/lib/pdfUtils";

// Helper component for PDF Background Page
function PdfPageImage({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) {
  const [image] = useImage(url);
  if (!image)
    return (
      <Rect
        width={width}
        height={height}
        fill="white"
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.1}
      />
    );
  return (
    <KonvaImage
      image={image}
      width={width}
      height={height}
      shadowColor="black"
      shadowBlur={10}
      shadowOpacity={0.1}
    />
  );
}

const PAGE_GAP = 40;

export default function Canvas() {
  const {
    camera,
    setCamera,
    mode,
    setMode,
    layerType,
    layers,
    layerIds,
    selection,
    hoveredLayerId,
    isAltPressed,
    setAltPressed,
    setSelection,
    insertLayer,
    startDrawing,
    continueDrawing,
    endDrawing,
    pages,
    updateLayer,
    pencilDraft,
    pencilPageIndex,
  } = useCanvasStore(
    useShallow((state) => ({
      camera: state.camera,
      setCamera: state.setCamera,
      mode: state.mode,
      setMode: state.setMode,
      layerType: state.layerType,
      layers: state.layers,
      layerIds: state.layerIds,
      selection: state.selection,
      hoveredLayerId: state.hoveredLayerId,
      isAltPressed: state.isAltPressed,
      setAltPressed: state.setAltPressed,
      setSelection: state.setSelection,
      insertLayer: state.insertLayer,
      startDrawing: state.startDrawing,
      continueDrawing: state.continueDrawing,
      endDrawing: state.endDrawing,
      pages: state.pages,
      updateLayer: state.updateLayer,
      pencilDraft: state.pencilDraft,
      pencilPageIndex: state.pencilPageIndex,
    })),
  );

  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<any>(null);
  // Track which text layer is actively being double-click-edited
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltPressed(true);

      // Don't trigger shortcuts if user is typing in an input/textarea
      const active = document.activeElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        (active as HTMLElement)?.isContentEditable
      )
        return;

      switch (e.key.toLowerCase()) {
        case "v":
          setMode(CanvasMode.None);
          break;
        case "r":
          setMode(CanvasMode.Inserting, "RECTANGLE");
          break;
        case "o":
          setMode(CanvasMode.Inserting, "ELLIPSE");
          break;
        case "l":
          if (e.shiftKey) setMode(CanvasMode.Inserting, "ARROW");
          else setMode(CanvasMode.Inserting, "LINE");
          break;
        case "t":
          setMode(CanvasMode.Inserting, "TEXT");
          break;
        case "p":
          setMode(CanvasMode.Pencil);
          break;
        case "delete":
        case "backspace":
          useCanvasStore.getState().deleteLayers();
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) useCanvasStore.getState().redo();
            else useCanvasStore.getState().undo();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useCanvasStore.getState().redo();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setMode, setAltPressed]);

  const pageOffsets = useMemo(() => {
    let currentY = 0;
    return pages.map((page) => {
      const offset = currentY;
      currentY += page.height + PAGE_GAP;
      return offset;
    });
  }, [pages]);

  const getPageTarget = useCallback(
    (globalY: number) => {
      for (let i = 0; i < pages.length; i++) {
        const pageTop = pageOffsets[i];
        const pageBottom = pageTop + pages[i].height + PAGE_GAP;
        if (globalY >= pageTop && globalY < pageBottom)
          return { pageIndex: i, relativeY: globalY - pageTop };
      }
      return { pageIndex: 0, relativeY: globalY };
    },
    [pages, pageOffsets],
  );

  const onWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();

      // Panning & Zooming logic translated to Konva
      if (e.evt.ctrlKey || e.evt.metaKey) {
        const scaleBy = 1.05;
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale,
        };
        const newScale =
          e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        setCamera({
          ...camera,
          zoom: newScale,
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
      } else {
        setCamera({
          ...camera,
          x: camera.x - e.evt.deltaX,
          y: camera.y - e.evt.deltaY,
        });
      }
    },
    [camera, setCamera],
  );

  const onPointerDown = useCallback(
    (e: any) => {
      const stage = e.target.getStage();
      const isStageOrPage =
        e.target === stage || e.target.hasName("page-background");

      if (isStageOrPage && mode === CanvasMode.None) {
        setSelection([]);
        setEditingTextId(null); // Clicking blank canvas exits text edit
      }

      if (pages.length === 0) return;
      const pointer = stage.getRelativePointerPosition();

      const target = getPageTarget(pointer.y);
      const relativePoint = { x: pointer.x, y: target.relativeY };

      if (mode === CanvasMode.Inserting && layerType) {
        const initialValues =
          layerType === "LINE" || layerType === "ARROW" ? { height: 2 } : {};
        insertLayer(layerType, target.pageIndex, relativePoint, initialValues);
      } else if (mode === CanvasMode.Pencil) {
        startDrawing(relativePoint, target.pageIndex);
      }
    },
    [
      mode,
      layerType,
      pages,
      getPageTarget,
      insertLayer,
      startDrawing,
      setSelection,
    ],
  );

  const onPointerMove = useCallback(
    (e: any) => {
      // Only process if drag is active manually, OR pencil
      if (e.evt.buttons !== 1 || pages.length === 0) return;
      const stage = e.target.getStage();
      const pointer = stage.getRelativePointerPosition();

      if (mode === CanvasMode.Pencil) {
        let targetPageIndex = getPageTarget(pointer.y).pageIndex;
        const pgOffset = pageOffsets[targetPageIndex] || 0;
        continueDrawing({ x: pointer.x, y: pointer.y - pgOffset });
      }
      // We removed manual translating here because Konva's `draggable={isSelected}` + `onDragEnd` handles it efficiently!
    },
    [mode, pages, pageOffsets, getPageTarget, continueDrawing],
  );

  const onPointerUp = useCallback(
    (e: any) => {
      if (pages.length === 0) return;
      if (mode === CanvasMode.Pencil) {
        const stage = e.target.getStage();
        const pointer = stage.getRelativePointerPosition();
        const target = getPageTarget(pointer.y);
        endDrawing(target.pageIndex);
      }
    },
    [mode, pages, getPageTarget, endDrawing],
  );

  // Keep track of layer refs to pass to SelectionBox (Transformer)
  const layerRefs = useRef<Record<string, any>>({});
  const selectedRefs = selection
    .map((id) => layerRefs.current[id])
    .filter(Boolean);

  if (windowSize.width === 0) return null; // Wait for client mount

  return (
    <main 
      className="absolute inset-0 w-full h-full bg-[#FAFAFA] overflow-hidden touch-none select-none flex items-center justify-center -z-10"
      style={{
        backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-400 pointer-events-none z-0 transform -translate-y-8">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mb-6 rotate-3 transform transition-transform hover:rotate-6">
            <Layers size={48} className="text-indigo-400 opacity-80" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 mb-2">
            Workspace is empty
          </h2>
          <p className="text-sm text-slate-500 max-w-sm text-center font-medium">
            Use the Left Sidebar to create a shiny new blank frame or import a PDF from Drive.
          </p>
        </div>
      ) : (
        <Stage
          width={windowSize.width}
          height={windowSize.height}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          scaleX={camera.zoom}
          scaleY={camera.zoom}
          x={camera.x}
          y={camera.y}
          ref={stageRef}
          className="absolute inset-0 z-0"
        >
          <Layer>
            {/* Draw PDF Backgrounds */}
            {pages.map((page, idx) => {
              const offsetY = pageOffsets[idx];
              return (
                <Group key={page.id} y={offsetY} name="page-background">
                  {page.backgroundUrl ? (
                    <PdfPageImage
                      url={page.backgroundUrl}
                      width={page.width}
                      height={page.height}
                    />
                  ) : (
                    <Rect
                      width={page.width}
                      height={page.height}
                      fill="white"
                      shadowColor="black"
                      shadowBlur={10}
                      shadowOpacity={0.1}
                      name="page-background"
                    />
                  )}
                </Group>
              );
            })}

            {/* Draw Layers */}
            {layerIds.map((id) => {
              const layer = layers[id];
              if (!layer) return null;
              const offsetY = pageOffsets[layer.pageIndex] || 0;
              const isSelected = selection.includes(id);

              return (
                <Group key={`group-${id}`} y={offsetY}>
                  <LayerComponent
                    id={id}
                    layer={layer}
                    isSelected={isSelected}
                    ref={(node: any) => {
                      if (node) {
                        // Attach pageOffset to the node so Transformer can compute absolute flush!
                        node.attrs.id = id;
                        node.attrs.pageOffset = offsetY;
                        layerRefs.current[id] = node;
                      }
                    }}
                    onPointerDown={(e: any) => {
                      e.cancelBubble = true;
                      setSelection([id]);
                      // Single-click with TEXT tool = enter edit immediately
                      if (
                        mode === CanvasMode.Inserting &&
                        layer.type === "TEXT"
                      ) {
                        setEditingTextId(id);
                      }
                    }}
                    onDblClick={(e: any) => {
                      // Only allow entering edit mode if the Text tool is active
                      if (
                        layer.type === "TEXT" &&
                        mode === CanvasMode.Inserting &&
                        layerType === "TEXT"
                      ) {
                        e.cancelBubble = true;
                        setEditingTextId(id);
                      }
                    }}
                    onDragEnd={(e: any) => {
                      // Get global Y relative to canvas 0,0
                      const globalY = e.target.y() + offsetY;
                      // Determine which page the layer now belongs to
                      let targetPageIndex = layer.pageIndex;
                      let relativeY = e.target.y();

                      let currentPOffsetY = 0;
                      for (let i = 0; i < pages.length; i++) {
                        const pageTop = currentPOffsetY;
                        const pageBottom = pageTop + pages[i].height + PAGE_GAP;
                        // If center of layer is within this page bounds
                        const centerY = globalY + layer.height / 2;
                        if (centerY >= pageTop && centerY < pageBottom) {
                          targetPageIndex = i;
                          relativeY = globalY - pageTop;
                          break;
                        }
                        currentPOffsetY += pages[i].height + PAGE_GAP;
                      }

                      updateLayer(
                        id,
                        {
                          x: e.target.x(),
                          y: relativeY,
                          pageIndex: targetPageIndex,
                        },
                        true,
                      );
                    }}
                  />
                </Group>
              );
            })}

            {/* Live Pencil Preview — renders the draft path in real-time before committing */}
            {mode === CanvasMode.Pencil &&
              pencilDraft &&
              pencilDraft.length > 1 && (
                <Group y={pageOffsets[pencilPageIndex] || 0} listening={false}>
                  <Line
                    points={pencilDraft.flat()}
                    stroke="#000000"
                    strokeWidth={2}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                    opacity={0.7}
                  />
                </Group>
              )}

            <SelectionBox selectedNodes={selectedRefs} />

            <MeasurementsOverlay />
          </Layer>
        </Stage>
      )}

      {/* Floating HTML Edit Overlay for Text Layers
           Only activates on double-click (Select mode) or when TEXT tool is active */}
      {editingTextId && layers[editingTextId]?.type === "TEXT" && (
        <TextEditingOverlay
          id={editingTextId}
          layer={layers[editingTextId]}
          camera={camera}
          pageOffset={pageOffsets[layers[editingTextId].pageIndex] || 0}
          onBlur={() => setEditingTextId(null)}
        />
      )}

      {/* Overlays / Menus */}
      <div className="z-10 pointer-events-none absolute inset-0">
        <LeftSidebar />
        {pages.length > 0 && <BottomToolbar />}
        {pages.length > 0 && <RightPropertyPanel />}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------
// Native Text Editing Overlay
// Floats perfectly over the Canvas Text bounding box to allow native cursor interactions
// ----------------------------------------------------------------------
function TextEditingOverlay({
  id,
  layer,
  camera,
  pageOffset,
  onBlur,
}: {
  id: string;
  layer: any;
  camera: any;
  pageOffset: number;
  onBlur?: () => void;
}) {
  const absX = layer.x * camera.zoom + camera.x;
  const absY = (layer.y + pageOffset) * camera.zoom + camera.y;

  let fontStyle = "";
  if (layer.isBold) fontStyle += "bold ";
  if (layer.isItalic) fontStyle += "italic ";
  let textDecoration = "";
  if (layer.isUnderline) textDecoration += "underline ";
  if (layer.isStrikethrough) textDecoration += "line-through ";

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: absX,
        top: absY,
        width: Math.max(50, layer.width) * camera.zoom,
        height: Math.max(20, layer.height) * camera.zoom,
      }}
    >
      <textarea
        className="w-full h-full p-0 m-0 bg-transparent resize-none outline-none overflow-hidden"
        style={{
          color: layer.fill,
          fontSize: `${layer.fontSize * camera.zoom}px`,
          fontFamily: layer.fontFamily || "sans-serif",
          textAlign: layer.textAlign || "left",
          lineHeight: layer.lineHeight || 1.2,
          letterSpacing: `${(layer.letterSpacing || 0) * camera.zoom}px`,
          fontStyle: layer.isItalic ? "italic" : "normal",
          fontWeight: layer.isBold ? "bold" : "normal",
          textDecoration: textDecoration.trim(),
        }}
        value={layer.text || ""}
        onChange={(e) => {
          useCanvasStore
            .getState()
            .updateLayer(id, { text: e.target.value, isEdited: true });
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={onBlur} // Exit edit mode when focus leaves
        autoFocus
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Figma-style Measurements Overlay
// Computes and renders distance lines when holding Alt
// ----------------------------------------------------------------------
function MeasurementsOverlay() {
  const { isAltPressed, selection, hoveredLayerId, layers, pages } =
    useCanvasStore();

  if (!isAltPressed || selection.length !== 1 || pages.length === 0)
    return null;

  const activeLayer = layers[selection[0]];
  if (!activeLayer) return null;

  // Pre-calculate page offsets
  let currentY = 0;
  const pageOffsets = pages.map((page) => {
    const offset = currentY;
    currentY += page.height + PAGE_GAP;
    return offset;
  });

  // Calculate absolute active layer bounding box
  const act = {
    top: activeLayer.y + pageOffsets[activeLayer.pageIndex],
    bottom:
      activeLayer.y + pageOffsets[activeLayer.pageIndex] + activeLayer.height,
    left: activeLayer.x,
    right: activeLayer.x + activeLayer.width,
    centerX: activeLayer.x + activeLayer.width / 2,
    centerY:
      activeLayer.y +
      pageOffsets[activeLayer.pageIndex] +
      activeLayer.height / 2,
  };

  let target: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    centerX: number;
    centerY: number;
  };

  if (hoveredLayerId && hoveredLayerId !== selection[0]) {
    const hoverLayer = layers[hoveredLayerId];
    target = {
      top: hoverLayer.y + pageOffsets[hoverLayer.pageIndex],
      bottom:
        hoverLayer.y + pageOffsets[hoverLayer.pageIndex] + hoverLayer.height,
      left: hoverLayer.x,
      right: hoverLayer.x + hoverLayer.width,
      centerX: hoverLayer.x + hoverLayer.width / 2,
      centerY:
        hoverLayer.y +
        pageOffsets[hoverLayer.pageIndex] +
        hoverLayer.height / 2,
    };
  } else {
    // Math to closest page bounds
    const pageObj = pages[activeLayer.pageIndex];
    const pOffset = pageOffsets[activeLayer.pageIndex];
    target = {
      top: pOffset,
      bottom: pOffset + pageObj.height,
      left: 0,
      right: pageObj.width,
      centerX: pageObj.width / 2,
      centerY: pOffset + pageObj.height / 2,
    };
  }

  // Draw lines only if we have positive distance, drawn centrally
  const lines = [];
  const C = "rgba(239, 68, 68, 0.9)"; // Red-500

  // Active is completely inside Target (e.g. on a page, or totally inside another box)
  if (
    act.top >= target.top &&
    act.bottom <= target.bottom &&
    act.left >= target.left &&
    act.right <= target.right
  ) {
    if (act.top - target.top > 0)
      lines.push({
        id: "top",
        x1: act.centerX,
        y1: act.top,
        x2: act.centerX,
        y2: target.top,
        val: Math.round(act.top - target.top),
      });
    if (target.bottom - act.bottom > 0)
      lines.push({
        id: "bot",
        x1: act.centerX,
        y1: act.bottom,
        x2: act.centerX,
        y2: target.bottom,
        val: Math.round(target.bottom - act.bottom),
      });
    if (act.left - target.left > 0)
      lines.push({
        id: "lft",
        x1: act.left,
        y1: act.centerY,
        x2: target.left,
        y2: act.centerY,
        val: Math.round(act.left - target.left),
      });
    if (target.right - act.right > 0)
      lines.push({
        id: "rgt",
        x1: act.right,
        y1: act.centerY,
        x2: target.right,
        y2: act.centerY,
        val: Math.round(target.right - act.right),
      });
  } else {
    // Proximity alignments
    if (act.bottom < target.top)
      lines.push({
        id: "t-b",
        x1: act.centerX,
        y1: act.bottom,
        x2: act.centerX,
        y2: target.top,
        val: Math.round(target.top - act.bottom),
      });
    if (act.top > target.bottom)
      lines.push({
        id: "b-t",
        x1: act.centerX,
        y1: act.top,
        x2: act.centerX,
        y2: target.bottom,
        val: Math.round(act.top - target.bottom),
      });
    if (act.right < target.left)
      lines.push({
        id: "l-r",
        x1: act.right,
        y1: act.centerY,
        x2: target.left,
        y2: act.centerY,
        val: Math.round(target.left - act.right),
      });
    if (act.left > target.right)
      lines.push({
        id: "r-l",
        x1: act.left,
        y1: act.centerY,
        x2: target.right,
        y2: act.centerY,
        val: Math.round(act.left - target.right),
      });
  }

  return (
    <Group listening={false}>
      {lines.map((l) => (
        <Group key={l.id}>
          <Line
            points={[l.x1, l.y1, l.x2, l.y2]}
            stroke={C}
            strokeWidth={1.5}
            dash={[3, 3]}
          />
          <Rect
            x={(l.x1 + l.x2) / 2 - 12}
            y={(l.y1 + l.y2) / 2 - 8}
            width={24}
            height={16}
            fill={C}
            cornerRadius={4}
          />
          <Text
            x={(l.x1 + l.x2) / 2 - 12}
            y={(l.y1 + l.y2) / 2 - 5}
            width={24}
            text={l.val.toString()}
            fontSize={9}
            fill="white"
            align="center"
            fontStyle="bold"
          />
        </Group>
      ))}
      <Rect
        x={target.left}
        y={target.top}
        width={target.right - target.left}
        height={target.bottom - target.top}
        stroke={C}
        strokeWidth={1}
      />
    </Group>
  );
}
