"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { usePDFStore } from "@/app/store/usePDFStore";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { get } from "idb-keyval";
import type { ExtractedTextItem } from "@/app/store/usePDFStore";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  className?: string;
  searchQuery?: string;
}

export function PDFViewer({
  className = "",
  searchQuery = "",
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const {
    pdfUrl,
    setNumPages,
    activePage,
    zoom,
    activeTool,
    setPageTextItems,
    setSelectedTextItem,
    setSelectedImage,
    setSelectedNewTextId,
    setSelectedNewImageId,
    clearSelection,
    newTextItems,
    newImageItems,
    selectedNewTextId,
    selectedNewImageId,
    highlights,
    drawStrokes,
    addNewTextItem,
    addNewImageItem,
    updateNewTextItem,
    updateNewImageItem,
    addHighlight,
    addDrawStroke,
    selectedTextItem,
    saveToStorage,
    drawColor,
    drawSize,
    highlightColor,
    highlightOpacity,
    drawMode,
    shapes,
    addShape,
    removeShape,
    removeDrawStroke,
    removeHighlight,
    eraserErasesText,
    eraserErasesImages,
    eraserErasesObjectEraser,
    removeNewTextItem,
    removeNewImageItem,
    pushUndo,
  } = usePDFStore();

  const worker = usePDFWorker();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [textItems, setTextItems] = useState<ExtractedTextItem[]>([]);
  const [pageHeight, setPageHeight] = useState(0);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<
    { x: number; y: number }[]
  >([]);
  // Selection drag (highlight / eraser)
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionCurrent, setSelectionCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Load PDF ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!pdfUrl) return;
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPdf();
  }, [pdfUrl, setNumPages]);

  // ── Render Page & Extract Text (DPR-aware, zoom handled here) ─────

  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any in-flight render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(activePage);
        const dpr = window.devicePixelRatio || 1;

        // Viewport at logical zoom level (CSS pixels)
        const viewport = page.getViewport({ scale: zoom });

        // Canvas rendered at DPR for sharpness
        const canvas = canvasRef.current!;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        setPageHeight(viewport.height / zoom); // PDF height in points

        const ctx = canvas.getContext("2d")!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        } as never);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        // Extract text
        const textContent = await page.getTextContent();
        const extracted: ExtractedTextItem[] = [];

        for (let i = 0; i < textContent.items.length; i++) {
          const item = textContent.items[i] as {
            str: string;
            transform: number[];
            width: number;
            height: number;
            fontName: string;
          };

          if (!item.str || item.str.trim() === "") continue;

          const tx = item.transform;
          const fontSize =
            Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]) || Math.abs(tx[3]) || 12;

          extracted.push({
            id: `text-${activePage}-${i}`,
            pageIndex: activePage - 1,
            str: item.str,
            transform: tx,
            width: item.width,
            height: item.height || fontSize,
            fontName: item.fontName || "Helvetica",
            fontSize,
          });
        }

        setTextItems(extracted);
        setPageTextItems(extracted);
      } catch (error) {
        console.error("Error rendering page:", error);
      }
    };

    renderPage();
  }, [pdfDoc, activePage, zoom, setPageTextItems]);

  // ── Convert PDF coords to screen coords (zoom already in CSS) ─────

  const pdfToScreen = useCallback(
    (pdfX: number, pdfY: number) => ({
      x: pdfX * zoom,
      y: (pageHeight - pdfY) * zoom,
    }),
    [zoom, pageHeight],
  );

  // ── Canvas click — place new items or select ──────────────────────

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        activeTool === "draw" ||
        activeTool === "highlight" ||
        activeTool === "eraser" ||
        activeTool === "objectEraser"
      )
        return;

      const rect = e.currentTarget.getBoundingClientRect();
      // Convert screen coords to PDF coords (no parent CSS zoom to undo)
      const clickX = (e.clientX - rect.left) / zoom;
      const pdfY = pageHeight - (e.clientY - rect.top) / zoom;

      if (activeTool === "addText") {
        const id = crypto.randomUUID();
        addNewTextItem({
          id,
          pageIndex: activePage - 1,
          x: clickX,
          y: pdfY,
          text: "New Text",
          fontFamily: "Helvetica",
          fontSize: 16,
          color: "#000000",
        });
        setSelectedNewTextId(id);
        return;
      }

      if (activeTool === "addImage") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg";
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const id = crypto.randomUUID();
            addNewImageItem({
              id,
              pageIndex: activePage - 1,
              x: clickX,
              y: pdfY,
              width: 200,
              height: 150,
              dataUrl: reader.result as string,
            });
            setSelectedNewImageId(id);
          };
          reader.readAsDataURL(file);
        };
        input.click();
        return;
      }

      if (activeTool === "select") clearSelection();
    },
    [
      activeTool,
      activePage,
      zoom,
      pageHeight,
      addNewTextItem,
      addNewImageItem,
      setSelectedNewTextId,
      setSelectedNewImageId,
      clearSelection,
    ],
  );

  // ── Mouse handlers for drawing / highlight / eraser ────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const cRect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - cRect.left;
      const y = e.clientY - cRect.top;
      if (activeTool === "draw") {
        if (drawMode === "freehand") {
          setIsDrawing(true);
          setCurrentStrokePoints([{ x, y }]);
        } else {
          setSelectionStart({ x, y });
          setSelectionCurrent({ x, y });
        }
      }
      if (
        activeTool === "highlight" ||
        activeTool === "eraser" ||
        activeTool === "objectEraser"
      ) {
        setSelectionStart({ x, y });
        setSelectionCurrent({ x, y });
      }
    },
    [activeTool, drawMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool === "draw") {
        if (drawMode === "freehand" && isDrawing) {
          const cRect = e.currentTarget.getBoundingClientRect();
          setCurrentStrokePoints((prev) => [
            ...prev,
            { x: e.clientX - cRect.left, y: e.clientY - cRect.top },
          ]);
        } else if (drawMode !== "freehand" && selectionStart) {
          const cRect = e.currentTarget.getBoundingClientRect();
          setSelectionCurrent({
            x: e.clientX - cRect.left,
            y: e.clientY - cRect.top,
          });
        }
      }
      if (
        (activeTool === "highlight" ||
          activeTool === "eraser" ||
          activeTool === "objectEraser") &&
        selectionStart
      ) {
        const cRect = e.currentTarget.getBoundingClientRect();
        setSelectionCurrent({
          x: e.clientX - cRect.left,
          y: e.clientY - cRect.top,
        });
      }
    },
    [activeTool, isDrawing, selectionStart, drawMode],
  );

  const handleMouseUp = useCallback(async () => {
    if (activeTool === "draw") {
      if (
        drawMode === "freehand" &&
        isDrawing &&
        currentStrokePoints.length > 1
      ) {
        pushUndo({ description: "Freehand Draw" });
        addDrawStroke({
          id: crypto.randomUUID(),
          pageIndex: activePage - 1,
          points: currentStrokePoints,
          color: drawColor,
          lineWidth: drawSize,
        });
        setIsDrawing(false);
        setCurrentStrokePoints([]);
      } else if (
        drawMode !== "freehand" &&
        selectionStart &&
        selectionCurrent
      ) {
        const w = Math.abs(selectionCurrent.x - selectionStart.x);
        const h = Math.abs(selectionCurrent.y - selectionStart.y);
        if (w > 5 || h > 5) {
          pushUndo({ description: `Draw Shape` });
          // Note: for shapes, we might need true x, y, width, height instead of normalized
          const shX = Math.min(selectionStart.x, selectionCurrent.x);
          const shY = Math.min(selectionStart.y, selectionCurrent.y);
          addShape({
            id: crypto.randomUUID(),
            pageIndex: activePage - 1,
            type: drawMode as any,
            x: shX,
            y: shY,
            width: w,
            height: h,
            strokeColor: drawColor,
            fillColor: "transparent",
            lineWidth: drawSize,
          });
        }
        setSelectionStart(null);
        setSelectionCurrent(null);
      }
    }

    if (activeTool !== "draw" && selectionStart && selectionCurrent) {
      const x = Math.min(selectionStart.x, selectionCurrent.x);
      const y = Math.min(selectionStart.y, selectionCurrent.y);
      const w = Math.abs(selectionCurrent.x - selectionStart.x);
      const h = Math.abs(selectionCurrent.y - selectionStart.y);

      if (w > 5 && h > 5) {
        if (activeTool === "highlight") {
          pushUndo({ description: "Highlight" });
          addHighlight({
            id: crypto.randomUUID(),
            pageIndex: activePage - 1,
            x,
            y,
            width: w,
            height: h,
            color: highlightColor,
            opacity: highlightOpacity,
          });
        }

        if (activeTool === "eraser") {
          pushUndo({ description: "Eraser" });
          const r1 = { left: x, right: x + w, top: y, bottom: y + h };
          const intersects = (r2: {
            left: number;
            right: number;
            top: number;
            bottom: number;
          }) => {
            return !(
              r2.left > r1.right ||
              r2.right < r1.left ||
              r2.top > r1.bottom ||
              r2.bottom < r1.top
            );
          };

          highlights.forEach((hItem) => {
            if (hItem.pageIndex === activePage - 1) {
              if (
                intersects({
                  left: hItem.x,
                  right: hItem.x + hItem.width,
                  top: hItem.y,
                  bottom: hItem.y + hItem.height,
                })
              ) {
                removeHighlight(hItem.id);
              }
            }
          });

          drawStrokes.forEach((stroke) => {
            if (stroke.pageIndex === activePage - 1) {
              const minX = Math.min(...stroke.points.map((p) => p.x));
              const maxX = Math.max(...stroke.points.map((p) => p.x));
              const minY = Math.min(...stroke.points.map((p) => p.y));
              const maxY = Math.max(...stroke.points.map((p) => p.y));
              if (
                intersects({
                  left: minX,
                  right: maxX,
                  top: minY,
                  bottom: maxY,
                })
              ) {
                removeDrawStroke(stroke.id);
              }
            }
          });

          shapes.forEach((shape) => {
            if (shape.pageIndex === activePage - 1) {
              if (
                intersects({
                  left: shape.x,
                  right: shape.x + shape.width,
                  top: shape.y,
                  bottom: shape.y + shape.height,
                })
              ) {
                removeShape(shape.id);
              }
            }
          });

          if (eraserErasesText) {
            newTextItems.forEach((item) => {
              if (item.pageIndex === activePage - 1) {
                const screen = pdfToScreen(item.x, item.y);
                if (
                  intersects({
                    left: screen.x,
                    right: screen.x + 100, // rough
                    top: screen.y - 20, // rough
                    bottom: screen.y + 20, // rough
                  })
                ) {
                  removeNewTextItem(item.id);
                }
              }
            });
          }

          if (eraserErasesImages) {
            newImageItems.forEach((item) => {
              if (item.pageIndex === activePage - 1) {
                const screen = pdfToScreen(item.x, item.y);
                if (
                  intersects({
                    left: screen.x,
                    right: screen.x + item.width * zoom,
                    top: screen.y,
                    bottom: screen.y + item.height * zoom,
                  })
                ) {
                  removeNewImageItem(item.id);
                }
              }
            });
          }
        }

        if (activeTool === "objectEraser" && worker) {
          const pdfX = x / zoom;
          const pdfY2 = pageHeight - (y + h) / zoom;
          try {
            const storedPdf = await get("active_pdf");
            if (storedPdf instanceof Blob) {
              pushUndo({
                description: "Object Eraser",
                pdfSnapshot: storedPdf,
              });
              const buffer = await storedPdf.arrayBuffer();
              const result = await worker.eraseArea(
                new Uint8Array(buffer),
                activePage - 1,
                { x: pdfX, y: pdfY2, width: w / zoom, height: h / zoom },
              );
              const blob = new Blob([result as unknown as BlobPart], {
                type: "application/pdf",
              });
              await saveToStorage(blob);
            }
          } catch (e) {
            console.error("Erase failed:", e);
          }
        }
      }
      setSelectionStart(null);
      setSelectionCurrent(null);
    }
  }, [
    activeTool,
    isDrawing,
    currentStrokePoints,
    selectionStart,
    selectionCurrent,
    activePage,
    zoom,
    pageHeight,
    worker,
    saveToStorage,
    addDrawStroke,
    addHighlight,
    drawMode,
    drawColor,
    drawSize,
    addShape,
    highlightColor,
    highlightOpacity,
    highlights,
    drawStrokes,
    shapes,
    newTextItems,
    newImageItems,
    removeHighlight,
    removeDrawStroke,
    removeShape,
    removeNewTextItem,
    removeNewImageItem,
    eraserErasesText,
    eraserErasesImages,
    eraserErasesObjectEraser,
    pushUndo,
    pdfToScreen,
  ]);

  // ── Smooth dragging for new items ─────────────────────────────────

  const dragRef = useRef<{
    id: string;
    type: "text" | "image";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    el: HTMLElement | null;
    pendingX?: number;
    pendingY?: number;
  } | null>(null);
  const rafRef = useRef<number>(0);

  const handleItemMouseDown = useCallback(
    (
      e: React.MouseEvent,
      id: string,
      type: "text" | "image",
      origX: number,
      origY: number,
    ) => {
      e.stopPropagation();
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.style.transition = "none";
      el.style.zIndex = "999";
      el.style.cursor = "grabbing";
      dragRef.current = {
        id,
        type,
        startX: e.clientX,
        startY: e.clientY,
        origX,
        origY,
        el,
      };

      const handleDragMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          if (!dragRef.current) return;
          const dx = (ev.clientX - dragRef.current.startX) / zoom;
          const dy = (ev.clientY - dragRef.current.startY) / zoom;
          const newX = dragRef.current.origX + dx;
          const newY = dragRef.current.origY - dy;
          if (dragRef.current.el) {
            const screen = pdfToScreen(newX, newY);
            dragRef.current.el.style.left = `${screen.x}px`;
            dragRef.current.el.style.top = `${screen.y}px`;
          }
          dragRef.current.pendingX = newX;
          dragRef.current.pendingY = newY;
        });
      };

      const handleDragEnd = () => {
        cancelAnimationFrame(rafRef.current);
        if (dragRef.current) {
          const finalX = dragRef.current.pendingX ?? dragRef.current.origX;
          const finalY = dragRef.current.pendingY ?? dragRef.current.origY;
          if (dragRef.current.type === "text")
            updateNewTextItem(dragRef.current.id, { x: finalX, y: finalY });
          else updateNewImageItem(dragRef.current.id, { x: finalX, y: finalY });
          if (dragRef.current.el) {
            dragRef.current.el.style.transition = "";
            dragRef.current.el.style.zIndex = "";
            dragRef.current.el.style.cursor = "grab";
          }
        }
        dragRef.current = null;
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };

      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
    },
    [zoom, pdfToScreen, updateNewTextItem, updateNewImageItem],
  );

  // ── Empty state ───────────────────────────────────────────────────

  if (!pdfUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-300 rounded-2xl ${className}`}
      >
        <div className="text-center p-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            No PDF Loaded
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-[240px]">
            Upload a PDF document to start editing text, images, and more.
          </p>
          <label className="cursor-pointer inline-flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/25 active:scale-95">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Upload PDF
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) usePDFStore.getState().saveToStorage(file);
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  // ── Cursor ────────────────────────────────────────────────────────
  const toolCursors: Record<string, string> = {
    select: "default",
    addText: "crosshair",
    addImage: "crosshair",
    highlight: "crosshair",
    draw: "crosshair",
    eraser: "crosshair",
    shapes: "crosshair",
    signature: "crosshair",
  };
  const cursor = toolCursors[activeTool] || "default";

  // ── Filter items for current page ─────────────────────────────────
  const pi = activePage - 1;
  const currentPageNewTexts = newTextItems.filter((t) => t.pageIndex === pi);
  const currentPageNewImages = newImageItems.filter((i) => i.pageIndex === pi);
  const currentPageHighlights = highlights.filter((h) => h.pageIndex === pi);
  const currentPageStrokes = drawStrokes.filter((d) => d.pageIndex === pi);
  const currentPageShapes = shapes.filter((sh) => sh.pageIndex === pi);

  // ── Search highlighting ───────────────────────────────────────────
  const query = searchQuery.trim().toLowerCase();
  const searchMatches =
    query.length > 1
      ? textItems.filter((item) => item.str.toLowerCase().includes(query))
      : [];

  // ── Selection rect ────────────────────────────────────────────────
  const selRect =
    selectionStart && selectionCurrent
      ? {
          x: Math.min(selectionStart.x, selectionCurrent.x),
          y: Math.min(selectionStart.y, selectionCurrent.y),
          w: Math.abs(selectionCurrent.x - selectionStart.x),
          h: Math.abs(selectionCurrent.y - selectionStart.y),
        }
      : null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="relative"
        style={{ cursor }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} className="block" />

        {/* Interactive Overlay — same size as canvas CSS dimensions */}
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ pointerEvents: activeTool === "select" ? "none" : "auto" }}
        >
          {/* ── Extracted Text Regions ─── */}
          {activeTool === "select" &&
            textItems.map((item) => {
              const tx = item.transform;
              const screenX = tx[4] * zoom;
              const screenY = (pageHeight - tx[5]) * zoom - item.height * zoom;
              const isSelected = selectedTextItem?.id === item.id;
              const isSearchMatch = searchMatches.some((m) => m.id === item.id);

              return (
                <div
                  key={item.id}
                  className={`absolute transition-colors ${isSelected ? "ring-2 ring-blue-500 bg-blue-50/30" : isSearchMatch ? "bg-yellow-300/40 ring-1 ring-yellow-500" : "hover:bg-blue-50/20 hover:ring-1 hover:ring-blue-300"}`}
                  style={{
                    left: screenX,
                    top: screenY,
                    width: item.width * zoom,
                    height: item.height * zoom,
                    pointerEvents: "auto",
                    cursor: "text",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTextItem(item);
                  }}
                  title={`Click to edit: "${item.str.substring(0, 40)}${item.str.length > 40 ? "..." : ""}"`}
                />
              );
            })}

          {/* ── Search highlight (also visible when NOT in select mode) ─── */}
          {query &&
            searchMatches.map((item) => {
              const tx = item.transform;
              const screenX = tx[4] * zoom;
              const screenY = (pageHeight - tx[5]) * zoom - item.height * zoom;

              // Precise search highlight calculation
              const lowerStr = item.str.toLowerCase();
              const matchIndex = lowerStr.indexOf(query);
              let exactX = screenX;
              let exactWidth = item.width * zoom;

              if (matchIndex !== -1 && item.str.length > 0) {
                const charWidth = item.width / item.str.length;
                exactX = screenX + matchIndex * charWidth * zoom;
                exactWidth = query.length * charWidth * zoom;
              }

              return (
                <div
                  key={`search-${item.id}`}
                  className="absolute bg-yellow-300/50 ring-1 ring-yellow-500 pointer-events-none rounded-sm transition-all"
                  style={{
                    left: exactX,
                    top: screenY,
                    width: exactWidth,
                    height: item.height * zoom,
                  }}
                />
              );
            })}

          {/* ── Highlights ──── */}
          {currentPageHighlights.map((h) => (
            <div
              key={h.id}
              className="absolute pointer-events-none"
              style={{
                left: h.x,
                top: h.y,
                width: h.width,
                height: h.height,
                backgroundColor: h.color,
                opacity: h.opacity,
                borderRadius: "2px",
              }}
            />
          ))}

          {/* ── Selection preview ─── */}
          {selRect && selRect.w > 2 && selRect.h > 2 && (
            <div
              className={`absolute pointer-events-none ${activeTool === "eraser" ? "border-2 border-red-400 bg-red-100/40" : ""}`}
              style={
                activeTool === "highlight"
                  ? {
                      left: selRect.x,
                      top: selRect.y,
                      width: selRect.w,
                      height: selRect.h,
                      backgroundColor: highlightColor,
                      opacity: highlightOpacity,
                      borderRadius: "2px",
                    }
                  : {
                      left: selRect.x,
                      top: selRect.y,
                      width: selRect.w,
                      height: selRect.h,
                      borderRadius: "2px",
                    }
              }
            >
              {activeTool === "eraser" && (
                <div className="absolute -top-6 left-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                  Erase this area
                </div>
              )}
            </div>
          )}

          {/* ── Draw strokes & Shapes ─── */}
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ overflow: "visible" }}
          >
            {currentPageStrokes.map((stroke) => (
              <polyline
                key={stroke.id}
                points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {isDrawing &&
              drawMode === "freehand" &&
              currentStrokePoints.length > 1 && (
                <polyline
                  points={currentStrokePoints
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                  fill="none"
                  stroke={drawColor}
                  strokeWidth={drawSize}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.6}
                />
              )}

            {/* Saved Shapes */}
            {currentPageShapes.map((shape) => {
              const {
                x,
                y,
                width: w,
                height: h,
                strokeColor,
                lineWidth,
                type,
                id,
              } = shape;
              if (type === "rect") {
                return (
                  <rect
                    key={id}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={lineWidth}
                  />
                );
              }
              if (type === "circle") {
                return (
                  <ellipse
                    key={id}
                    cx={x + w / 2}
                    cy={y + h / 2}
                    rx={w / 2}
                    ry={h / 2}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={lineWidth}
                  />
                );
              }
              if (type === "line") {
                // To keep it simple, we draw from top-left to bottom-right of the bounding box.
                // In a perfect world, we'd store the actual start and end coordinates, but this works for basic shapes.
                return (
                  <line
                    key={id}
                    x1={x}
                    y1={y}
                    x2={x + w}
                    y2={y + h}
                    stroke={strokeColor}
                    strokeWidth={lineWidth}
                  />
                );
              }
              if (type === "arrow") {
                const headlen = 10;
                const angle = Math.atan2(h, w);
                return (
                  <g key={id}>
                    <line
                      x1={x}
                      y1={y}
                      x2={x + w}
                      y2={y + h}
                      stroke={strokeColor}
                      strokeWidth={lineWidth}
                    />
                    <line
                      x1={x + w}
                      y1={y + h}
                      x2={x + w - headlen * Math.cos(angle - Math.PI / 6)}
                      y2={y + h - headlen * Math.sin(angle - Math.PI / 6)}
                      stroke={strokeColor}
                      strokeWidth={lineWidth}
                    />
                    <line
                      x1={x + w}
                      y1={y + h}
                      x2={x + w - headlen * Math.cos(angle + Math.PI / 6)}
                      y2={y + h - headlen * Math.sin(angle + Math.PI / 6)}
                      stroke={strokeColor}
                      strokeWidth={lineWidth}
                    />
                  </g>
                );
              }
              if (type === "triangle") {
                return (
                  <polygon
                    key={id}
                    points={`${x + w / 2},${y} ${x},${y + h} ${x + w},${y + h}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={lineWidth}
                    strokeLinejoin="round"
                  />
                );
              }
              if (type === "star") {
                // simple 5 point star
                const cx = x + w / 2;
                const cy = y + h / 2;
                const outerRad = Math.min(w, h) / 2;
                const innerRad = outerRad / 2.5;
                let pts = "";
                for (let i = 0; i < 10; i++) {
                  const r = i % 2 === 0 ? outerRad : innerRad;
                  const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
                  pts += `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} `;
                }
                return (
                  <polygon
                    key={id}
                    points={pts}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={lineWidth}
                    strokeLinejoin="round"
                  />
                );
              }
              return null;
            })}

            {/* Live Shape Preview */}
            {activeTool === "draw" &&
              drawMode !== "freehand" &&
              selectionStart &&
              selectionCurrent &&
              (() => {
                const sx = Math.min(selectionStart.x, selectionCurrent.x);
                const sy = Math.min(selectionStart.y, selectionCurrent.y);
                const sw = Math.abs(selectionCurrent.x - selectionStart.x);
                const sh = Math.abs(selectionCurrent.y - selectionStart.y);
                const t = drawMode;
                const strokeProps = {
                  fill: "none",
                  stroke: drawColor,
                  strokeWidth: drawSize,
                  opacity: 0.6,
                };

                if (t === "rect")
                  return (
                    <rect
                      x={sx}
                      y={sy}
                      width={sw}
                      height={sh}
                      {...strokeProps}
                    />
                  );
                if (t === "circle")
                  return (
                    <ellipse
                      cx={sx + sw / 2}
                      cy={sy + sh / 2}
                      rx={sw / 2}
                      ry={sh / 2}
                      {...strokeProps}
                    />
                  );
                if (t === "line")
                  return (
                    <line
                      x1={sx}
                      y1={sy}
                      x2={sx + sw}
                      y2={sy + sh}
                      {...strokeProps}
                    />
                  );
                if (t === "arrow") {
                  const headlen = 10;
                  const angle = Math.atan2(sh, sw);
                  return (
                    <g opacity={0.6}>
                      <line
                        x1={sx}
                        y1={sy}
                        x2={sx + sw}
                        y2={sy + sh}
                        stroke={drawColor}
                        strokeWidth={drawSize}
                      />
                      <line
                        x1={sx + sw}
                        y1={sy + sh}
                        x2={sx + sw - headlen * Math.cos(angle - Math.PI / 6)}
                        y2={sy + sh - headlen * Math.sin(angle - Math.PI / 6)}
                        stroke={drawColor}
                        strokeWidth={drawSize}
                      />
                      <line
                        x1={sx + sw}
                        y1={sy + sh}
                        x2={sx + sw - headlen * Math.cos(angle + Math.PI / 6)}
                        y2={sy + sh - headlen * Math.sin(angle + Math.PI / 6)}
                        stroke={drawColor}
                        strokeWidth={drawSize}
                      />
                    </g>
                  );
                }
                if (t === "triangle")
                  return (
                    <polygon
                      points={`${sx + sw / 2},${sy} ${sx},${sy + sh} ${sx + sw},${sy + sh}`}
                      strokeLinejoin="round"
                      {...strokeProps}
                    />
                  );
                if (t === "star") {
                  const cx = sx + sw / 2;
                  const cy = sy + sh / 2;
                  const outerRad = Math.min(sw, sh) / 2;
                  const innerRad = outerRad / 2.5;
                  let pts = "";
                  for (let i = 0; i < 10; i++) {
                    const r = i % 2 === 0 ? outerRad : innerRad;
                    const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
                    pts += `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} `;
                  }
                  return (
                    <polygon
                      points={pts}
                      strokeLinejoin="round"
                      {...strokeProps}
                    />
                  );
                }
                return null;
              })()}
          </svg>

          {/* ── New Text Items (draggable) ─── */}
          {currentPageNewTexts.map((item) => {
            const screen = pdfToScreen(item.x, item.y);
            const isSelected = selectedNewTextId === item.id;
            return (
              <div
                key={item.id}
                className={`absolute px-2 py-1 rounded select-none will-change-transform ${isSelected ? "ring-2 ring-blue-500 bg-white/90 shadow-lg" : "hover:ring-1 hover:ring-slate-400 bg-white/60"}`}
                style={{
                  left: screen.x,
                  top: screen.y - item.fontSize * zoom * 0.2, // Adjust baseline visually
                  color: item.color,
                  fontFamily: item.fontFamily,
                  fontSize: item.fontSize * zoom,
                  backgroundColor: item.bgColor,
                  fontWeight: item.isBold ? 700 : 400,
                  fontStyle: item.isItalic ? "italic" : "normal",
                  textDecoration:
                    [
                      item.isUnderline ? "underline" : "",
                      item.isStrikethrough ? "line-through" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || "none",
                  textAlign: item.alignment || "left",
                  cursor: "grab",
                  pointerEvents: "auto",
                  whiteSpace: "pre-wrap",
                  minWidth: `${item.text.length > 0 ? item.text.split("\n").reduce((a, b) => (a.length > b.length ? a : b)).length * item.fontSize * zoom * 0.6 : 50}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNewTextId(item.id);
                }}
                onMouseDown={(e) =>
                  handleItemMouseDown(e, item.id, "text", item.x, item.y)
                }
              >
                {item.text}
              </div>
            );
          })}

          {/* ── New Image Items (draggable) ─── */}
          {currentPageNewImages.map((item) => {
            const screen = pdfToScreen(item.x, item.y);
            const isSelected = selectedNewImageId === item.id;
            return (
              <div
                key={item.id}
                className={`absolute will-change-transform ${isSelected ? "ring-2 ring-blue-500 shadow-lg" : "hover:ring-1 hover:ring-slate-400"}`}
                style={{
                  left: screen.x,
                  top: screen.y,
                  width: item.width * zoom,
                  height: item.height * zoom,
                  cursor: "grab",
                  pointerEvents: "auto",
                  transform: `rotate(${item.rotation || 0}deg)`,
                  opacity: item.opacity ?? 1,
                  transformOrigin: "center center",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNewImageId(item.id);
                }}
                onMouseDown={(e) =>
                  handleItemMouseDown(e, item.id, "image", item.x, item.y)
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.dataUrl}
                  alt="Placed image"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
