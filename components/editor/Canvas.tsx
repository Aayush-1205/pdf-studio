"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCanvasStore, CanvasMode } from "../../store/useCanvasStore";
import { Stage, Layer, Group, Rect, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import LayerComponent from "./LayerComponent";
import SelectionBox from "./SelectionBox";
import BottomToolbar from "./BottomToolbar";
import RightPropertyPanel from "./RightPropertyPanel";
import LeftSidebar from "./LeftSidebar";
import { Layers } from "lucide-react";

// Helper component for PDF Background Page
function PdfPageImage({ url, width, height }: { url: string; width: number; height: number }) {
  const [image] = useImage(url);
  if (!image) return <Rect width={width} height={height} fill="white" shadowColor="black" shadowBlur={10} shadowOpacity={0.1} />;
  return <KonvaImage image={image} width={width} height={height} shadowColor="black" shadowBlur={10} shadowOpacity={0.1} />;
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
    setSelection,
    insertLayer,
    startDrawing,
    continueDrawing,
    endDrawing,
    pages,
    updateLayer,
  } = useCanvasStore();

  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<any>(null);

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const active = document.activeElement;
      if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active as HTMLElement)?.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setMode(CanvasMode.None);
          break;
        case 'r':
          setMode(CanvasMode.Inserting, 'RECTANGLE');
          break;
        case 'o':
          setMode(CanvasMode.Inserting, 'ELLIPSE');
          break;
        case 'l':
          if (e.shiftKey) setMode(CanvasMode.Inserting, 'ARROW');
          else setMode(CanvasMode.Inserting, 'LINE');
          break;
        case 't':
          setMode(CanvasMode.Inserting, 'TEXT');
          break;
        case 'p':
          setMode(CanvasMode.Pencil);
          break;
        case 'delete':
        case 'backspace':
          useCanvasStore.getState().deleteLayers();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode]);

  const pageOffsets = useMemo(() => {
    let currentY = 0;
    return pages.map((page) => {
      const offset = currentY;
      currentY += page.height + PAGE_GAP;
      return offset;
    });
  }, [pages]);

  const getPageTarget = useCallback((globalY: number) => {
    for (let i = 0; i < pages.length; i++) {
      const pageTop = pageOffsets[i];
      const pageBottom = pageTop + pages[i].height + PAGE_GAP;
      if (globalY >= pageTop && globalY < pageBottom) return { pageIndex: i, relativeY: globalY - pageTop };
    }
    return { pageIndex: 0, relativeY: globalY };
  }, [pages, pageOffsets]);

  const onWheel = useCallback((e: any) => {
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
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
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
  }, [camera, setCamera]);

  const onPointerDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    // Only clear selection if we clicked the stage background itself, not a layer
    const isStageOrPage = e.target === stage || e.target.hasName("page-background");

    if (isStageOrPage && mode === CanvasMode.None) {
      setSelection([]);
    }

    if (pages.length === 0) return;
    const pointer = stage.getRelativePointerPosition(); // This accounts for camera zoom and pan!

    const target = getPageTarget(pointer.y);
    const relativePoint = { x: pointer.x, y: target.relativeY };

    if (mode === CanvasMode.Inserting && layerType) {
      const initialValues = layerType === "LINE" || layerType === "ARROW" ? { height: 2 } : {};
      insertLayer(layerType, target.pageIndex, relativePoint, initialValues);
    } else if (mode === CanvasMode.Pencil) {
      startDrawing(relativePoint, target.pageIndex);
    }
  }, [mode, layerType, pages, getPageTarget, insertLayer, startDrawing, setSelection]);

  const onPointerMove = useCallback((e: any) => {
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
  }, [mode, pages, pageOffsets, getPageTarget, continueDrawing]);

  const onPointerUp = useCallback((e: any) => {
    if (pages.length === 0) return;
    if (mode === CanvasMode.Pencil) {
      const stage = e.target.getStage();
      const pointer = stage.getRelativePointerPosition();
      const target = getPageTarget(pointer.y);
      endDrawing(target.pageIndex);
    }
  }, [mode, pages, getPageTarget, endDrawing]);

  // Keep track of layer refs to pass to SelectionBox (Transformer)
  const layerRefs = useRef<Record<string, any>>({});
  const selectedRefs = selection.map(id => layerRefs.current[id]).filter(Boolean);

  if (windowSize.width === 0) return null; // Wait for client mount

  return (
    <main className="fixed inset-0 w-full h-full bg-[#E5E5E5] overflow-hidden touch-none select-none flex items-center justify-center">
      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 pointer-events-none z-0">
          <Layers size={48} className="mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-500 mb-2">No Canvas Open</h2>
          <p className="text-sm">Use the Left Sidebar to create a blank frame or import a PDF from Drive.</p>
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
                    <PdfPageImage url={page.backgroundUrl} width={page.width} height={page.height} />
                  ) : (
                    <Rect width={page.width} height={page.height} fill="white" shadowColor="black" shadowBlur={10} shadowOpacity={0.1} name="page-background" />
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
                      e.cancelBubble = true; // Stop bubbling to stage
                      setSelection([id]);
                    }}
                    onDragEnd={(e: any) => {
                       // Update store after Konva native drag finishes
                       const node = e.target;
                       useCanvasStore.getState().updateLayer(id, {
                          x: node.x(),
                          y: node.y(),
                       });
                    }}
                  />
                </Group>
              );
            })}
            
            <SelectionBox selectedNodes={selectedRefs} />
          </Layer>
        </Stage>
      )}

      {/* Floating HTML Edit Overlay for Text Layers */}
      {selection.length === 1 && layers[selection[0]]?.type === "TEXT" && (
        <TextEditingOverlay 
          id={selection[0]} 
          layer={layers[selection[0]]} 
          camera={camera} 
          pageOffset={pageOffsets[layers[selection[0]].pageIndex] || 0} 
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
function TextEditingOverlay({ id, layer, camera, pageOffset }: { id: string, layer: any, camera: any, pageOffset: number }) {
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
          useCanvasStore.getState().updateLayer(id, { text: e.target.value });
        }}
        onPointerDown={(e) => e.stopPropagation()} // Don't let Canvas catch the click
      />
    </div>
  );
}
