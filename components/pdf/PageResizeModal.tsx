"use client";

import React, { useState, useRef } from "react";
import { X, Maximize2, Loader2, FilePen } from "lucide-react";
import { createPortal } from "react-dom";
import { useResizeStore, parsePageRange } from "../../store/useResizeStore";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";
import { useCanvasStore } from "../../store/useCanvasStore";
import { extractPdfPages } from "../../app/lib/pdfRender";
import { nanoid } from "nanoid";

// Standard paper sizes in PDF points (1 pt = 1/72 inch)
const PAPER_SIZES: Record<string, [number, number]> = {
  "A4 Portrait": [595.28, 841.89],
  "A4 Landscape": [841.89, 595.28],
  "A3 Portrait": [841.89, 1190.55],
  "A3 Landscape": [1190.55, 841.89],
  "Letter Portrait": [612, 792],
  "Letter Landscape": [792, 612],
  "Legal Portrait": [612, 1008],
  "Legal Landscape": [1008, 612],
  Custom: [0, 0],
};

function invokeWorker<T = unknown>(
  worker: Worker,
  method: string,
  args: unknown[],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2, 9);
    const onMessage = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", onMessage);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result as T);
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, method, args });
  });
}

export function PageResizeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    targetWidth,
    targetHeight,
    pageRange,
    customPages,
    isResizing,
    setTargetWidth,
    setTargetHeight,
    setPageRange,
    setCustomPages,
    setIsResizing,
    originalState,
    setOriginalState,
    clearOriginalState,
  } = useResizeStore();

  const [selectedPreset, setSelectedPreset] = useState("A4 Portrait");
  const worker = usePDFWorker();

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    if (presetName !== "Custom") {
      const [w, h] = PAPER_SIZES[presetName];
      setTargetWidth(w);
      setTargetHeight(h);
    }
  };

  const handleApplyResize = async () => {
    if (!worker) return;
    setIsResizing(true);

    try {
      // 0. Cache current state so we can revert if this is the first resize operation
      if (!originalState) {
        const currentState = useCanvasStore.getState();
        setOriginalState({
          pdfBytes: currentState.pdfBytes,
          pages: [...currentState.pages],
          layers: JSON.parse(JSON.stringify(currentState.layers)),
          layerIds: [...currentState.layerIds],
        });
      }

      // 1. Generate the current baked PDF bytes
      const blob = await generateBakedPDF(worker);
      const ab = await blob.arrayBuffer();
      const pdfBytes = new Uint8Array(ab);
      const totalPages = useCanvasStore.getState().pages.length || 1;

      // 2. Determine which pages to resize
      let pagesToResize: number[];
      if (pageRange === "ALL") {
        pagesToResize = Array.from({ length: totalPages }, (_, i) => i);
      } else if (pageRange === "CURRENT") {
        const currentPage = 0; // fall back to first page; user can use CUSTOM for specific pages
        pagesToResize = [currentPage];
      } else {
        pagesToResize = parsePageRange(customPages, totalPages);
      }

      // 3. Run resize in the worker
      const resizedBytes = await invokeWorker<Uint8Array>(
        worker,
        "resizePdfPages",
        [pdfBytes, targetWidth, targetHeight, pagesToResize],
      );

      // 4. Reload the resized document into the editor
      const store = useCanvasStore.getState();
      store.setPdfBytes(resizedBytes);

      const { pages: newPages, layers: newLayers } = await extractPdfPages(
        new Uint8Array(resizedBytes),
        "Resized_Document.pdf",
      );
      store.setPages(newPages);

      const newLayersDict: Record<string, any> = {};
      const newLayerIds: string[] = [];
      newLayers.forEach((l) => {
        const lid = nanoid();
        newLayersDict[lid] = l;
        newLayerIds.push(lid);
      });
      useCanvasStore.setState({
        layers: newLayersDict,
        layerIds: newLayerIds,
        selection: [],
      });

      onClose();
    } catch (err: any) {
      console.error("Resize failed:", err);
      alert("Page resize failed: " + err?.message);
    } finally {
      setIsResizing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Maximize2 size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Page Resize Tool
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 bg-slate-50/50">
          {/* Target Size */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Target Paper Size
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-800 focus:ring-2 focus:ring-violet-400 outline-none"
            >
              {Object.keys(PAPER_SIZES).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {selectedPreset === "Custom" && (
              <div className="flex gap-3 mt-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">
                    Width (pts)
                  </label>
                  <input
                    type="number"
                    value={targetWidth}
                    onChange={(e) => setTargetWidth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 mb-1 block">
                    Height (pts)
                  </label>
                  <input
                    type="number"
                    value={targetHeight}
                    onChange={(e) => setTargetHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400 mt-2">
              {targetWidth > 0 && targetHeight > 0
                ? `Target: ${Math.round(targetWidth)} × ${Math.round(targetHeight)} pts`
                : "Set custom dimensions above"}
            </p>
          </div>

          {/* Page Range */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Pages to Resize
            </label>
            <div className="flex flex-col gap-2">
              {(["ALL", "CURRENT", "CUSTOM"] as const).map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="pageRange"
                    value={r}
                    checked={pageRange === r}
                    onChange={() => setPageRange(r)}
                    className="accent-violet-600 w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-violet-700 transition-colors">
                    {r === "ALL"
                      ? "All Pages"
                      : r === "CURRENT"
                        ? "Current Page Only"
                        : "Custom Range"}
                  </span>
                </label>
              ))}
            </div>

            {pageRange === "CUSTOM" && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                  placeholder='e.g. "1, 3, 5-7"'
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter page numbers or ranges separated by commas.
                </p>
              </div>
            )}
          </div>

          {/* Info Banner */}
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex gap-2 text-xs text-violet-700">
            <FilePen size={14} className="shrink-0 mt-0.5" />
            <span>
              Content is mathematically scaled and centered into the new
              dimensions. Vector quality and text crispness are preserved.
              Interactive form elements may be flattened.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3">
          {originalState && (
            <button
              onClick={() => {
                useCanvasStore.setState({
                  pdfBytes: originalState.pdfBytes,
                  pages: [...originalState.pages],
                  layers: JSON.parse(JSON.stringify(originalState.layers)),
                  layerIds: [...originalState.layerIds],
                });
                clearOriginalState();
                onClose();
              }}
              className="px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 bg-white border border-red-200 rounded-xl transition-colors mr-auto"
            >
              Revert to Original
            </button>
          )}

          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyResize}
            disabled={
              isResizing ||
              !worker ||
              (selectedPreset === "Custom" && (!targetWidth || !targetHeight))
            }
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            {isResizing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Maximize2 size={15} />
            )}
            {isResizing ? "Resizing..." : "Apply Resize"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
