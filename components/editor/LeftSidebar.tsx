"use client";

import { useCanvasStore } from "../../store/useCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  FolderPlus,
  FileUp,
  PlusSquare,
  LayoutTemplate,
  Loader2,
  AlertCircle,
  Folder,
  ChevronRight,
  Home,
  FileText,
  Download,
  Layers,
  FileArchive,
  Maximize2,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { UploadToDriveModal } from "../pdf/UploadToDriveModal";
import { MergePDFModal } from "../pdf/MergePDFModal";
import { CompressorModal } from "../pdf/CompressorModal";
import { PageResizeModal } from "../pdf/PageResizeModal";
import { OrganizerPDFModal } from "../pdf/OrganizerPDFModal";
import { nanoid } from "nanoid";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function LeftSidebar() {
  const {
    pages: pagesList,
    layers,
    layerIds,
    selection,
    setSelection,
    deleteLayers,
  } = useCanvasStore(
    useShallow((state) => ({
      pages: state.pages,
      layers: state.layers,
      layerIds: state.layerIds,
      selection: state.selection,
      setSelection: state.setSelection,
      deleteLayers: state.deleteLayers,
    })),
  );
  const [activeTab, setActiveTab] = useState<"preview" | "pages" | "layers">(
    "preview",
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isCompressorModalOpen, setIsCompressorModalOpen] = useState(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState(false);
  const [isOrganizerModalOpen, setIsOrganizerModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | string>("end");
  const [customInterval, setCustomInterval] = useState<number>(1);

  // Dynamically build page presets — prepend "Same as Document" if pages exist
  const firstPage = pagesList[0];
  const dynamicPresets = [
    ...(firstPage
      ? [
          {
            name: "Same as Document",
            width: firstPage.width,
            height: firstPage.height,
          },
        ]
      : []),
    { name: "A4 (Portrait)", width: 595, height: 842 },
    { name: "A4 (Landscape)", width: 842, height: 595 },
    { name: "Letter (Portrait)", width: 612, height: 792 },
    { name: "Square Post", width: 794, height: 794 },
  ];

  return (
    <>
      <div className="absolute top-24 left-6 w-[320px] max-h-[calc(100vh-140px)] bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-3xl flex flex-col pointer-events-auto transition-all shrink-0 z-10 overflow-hidden">
        {/* Modern Segmented Control Tabs */}
        <div className="p-3 border-b border-slate-100/50 shrink-0 bg-white/40">
          <div className="flex bg-slate-100/80 p-1.5 rounded-[18px] relative shadow-inner gap-1">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex-1 py-2 text-xs font-bold transition-all duration-300 rounded-xl z-10 ${
                activeTab === "preview"
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab("pages")}
              className={`flex-1 py-2 text-xs font-bold transition-all duration-300 rounded-xl z-10 ${
                activeTab === "pages"
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              Pages
            </button>
            <button
              onClick={() => setActiveTab("layers")}
              className={`flex-1 py-2 text-xs font-bold transition-all duration-300 rounded-xl z-10 ${
                activeTab === "layers"
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              Layers
            </button>
          </div>
        </div>

        {isMergeModalOpen && (
          <MergePDFModal
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
          />
        )}
        {isCompressorModalOpen && (
          <CompressorModal
            isOpen={isCompressorModalOpen}
            onClose={() => setIsCompressorModalOpen(false)}
          />
        )}
        {isResizeModalOpen && (
          <PageResizeModal
            isOpen={isResizeModalOpen}
            onClose={() => setIsResizeModalOpen(false)}
          />
        )}
        {isOrganizerModalOpen && (
          <OrganizerPDFModal
            isOpen={isOrganizerModalOpen}
            onClose={() => setIsOrganizerModalOpen(false)}
          />
        )}

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {activeTab === "preview" && <PagePreviewTab pages={pagesList} />}

          {activeTab === "pages" && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
                <LayoutTemplate size={14} className="text-indigo-400" /> Add Blank Frame
              </h4>
              <div className="flex items-center gap-2 mb-3 bg-white border border-gray-200 p-1.5 rounded-lg">
                <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap pl-1">
                  Insert Position:
                </span>
                <select
                  className="flex-1 text-xs p-1 bg-transparent border-none outline-none cursor-pointer focus:ring-0 text-gray-700 w-full font-medium"
                  value={insertIndex.toString()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (
                      [
                        "end",
                        "odd",
                        "even",
                        "every_3",
                        "custom_interval",
                      ].includes(val)
                    ) {
                      setInsertIndex(val);
                    } else {
                      setInsertIndex(Number(val));
                    }
                  }}
                >
                  <option value="end">At End of Document</option>
                  <option value="0">At Beginning</option>
                  <optgroup label="Advanced Patterns">
                    <option value="odd">After Every Odd Page</option>
                    <option value="even">After Every Even Page</option>
                    <option value="every_3">After Every 3rd Page</option>
                    <option value="custom_interval">Custom Interval...</option>
                  </optgroup>
                  <optgroup label="Specific Page">
                    {pagesList.map((p, i) => (
                      <option key={p.id} value={i + 1}>
                        After Page {i + 1}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Custom interval field — show when user selects "Custom Interval..." */}
              {insertIndex === "custom_interval" && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 p-2 rounded-lg">
                  <span className="text-[10px] text-yellow-700 font-medium whitespace-nowrap">
                    Insert blank after every
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={customInterval}
                    onChange={(e) =>
                      setCustomInterval(Math.max(1, Number(e.target.value)))
                    }
                    className="w-12 text-sm text-center p-1 bg-white border border-yellow-300 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <span className="text-[10px] text-yellow-700 font-medium whitespace-nowrap">
                    pages
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {dynamicPresets.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => {
                      useCanvasStore
                        .getState()
                        .addBlankPage(
                          p.width,
                          p.height,
                          p.name,
                          insertIndex === "end"
                            ? undefined
                            : insertIndex === "custom_interval"
                              ? (`every_${customInterval}` as string)
                              : insertIndex,
                        );
                    }}
                    className={`group flex flex-col items-center justify-center p-3.5 border rounded-[18px] transition-all duration-300 text-center gap-1.5 ${
                      p.name === "Same as Document"
                        ? "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50/80 hover:border-indigo-300 hover:shadow-sm col-span-2"
                        : "border-slate-200/60 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:shadow-sm"
                    }`}
                  >
                    <PlusSquare
                      size={20}
                      className={`transition-transform duration-300 group-hover:scale-110 ${
                        p.name === "Same as Document"
                          ? "text-indigo-500"
                          : "text-slate-400 group-hover:text-indigo-400"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-wide ${
                        p.name === "Same as Document"
                          ? "text-indigo-700"
                          : "text-slate-600 group-hover:text-indigo-600"
                      }`}
                    >
                      {p.name}
                    </span>
                    {p.name === "Same as Document" && (
                      <span className="text-[9px] font-semibold text-indigo-400/80 tracking-wider">
                        {Math.round(p.width)} × {Math.round(p.height)} px
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-6 border-t border-slate-100 mt-4 px-1">
                <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                  Custom Size
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="W"
                    className="flex-1 p-2 w-24 border rounded-[10px] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 transition-all shadow-inner"
                    id="custom-w"
                  />
                  <span className="text-slate-400 font-bold">×</span>
                  <input
                    type="number"
                    placeholder="H"
                    className="flex-1 p-2 w-24 border rounded-[10px] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 transition-all shadow-inner"
                    id="custom-h"
                  />
                </div>
                <button
                  className="w-full mt-4 bg-slate-800 text-white py-2.5 rounded-[12px] text-sm font-bold hover:bg-slate-900 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                  onClick={() => {
                    const w = Number(
                      (document.getElementById("custom-w") as HTMLInputElement)
                        .value,
                    );
                    const h = Number(
                      (document.getElementById("custom-h") as HTMLInputElement)
                        .value,
                    );
                    if (w && h) {
                      useCanvasStore
                        .getState()
                        .addBlankPage(
                          w,
                          h,
                          "Custom",
                          insertIndex === "end" ? undefined : insertIndex,
                        );
                    }
                  }}
                >
                  Create Custom Canvas
                </button>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-3">
                    Document Tools
                  </h4>
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-indigo-50/50 text-indigo-700 border border-indigo-200/50 p-2.5 rounded-[12px] text-sm font-bold hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      onClick={() => setIsMergeModalOpen(true)}
                    >
                      <Layers size={16} />
                      Merge Multiple PDFs
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-sky-50/50 text-sky-700 border border-sky-200/50 p-2.5 rounded-[12px] text-sm font-bold hover:bg-sky-100 hover:border-sky-300 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      onClick={() => setIsOrganizerModalOpen(true)}
                    >
                      <LayoutGrid size={16} />
                      Organize PDF Pages
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-emerald-50/50 text-emerald-700 border border-emerald-200/50 p-2.5 rounded-[12px] text-sm font-bold hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      onClick={() => setIsCompressorModalOpen(true)}
                    >
                      <FileArchive size={16} />
                      Compress PDF Size
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-violet-50/50 text-violet-700 border border-violet-200/50 p-2.5 rounded-[12px] text-sm font-bold hover:bg-violet-100 hover:border-violet-300 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                      onClick={() => setIsResizeModalOpen(true)}
                    >
                      <Maximize2 size={16} />
                      Resize Pages
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-red-50/80">
                  <button
                    className="w-full bg-red-50/50 text-red-600 border border-red-200/50 p-2.5 rounded-[12px] text-sm font-bold hover:bg-red-100 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to clear all local changes? This cannot be undone.",
                        )
                      ) {
                        useCanvasStore.getState().clearCanvas();
                      }
                    }}
                  >
                    Clear all local changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "layers" && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3 flex items-center gap-2">
                <Layers size={12} /> Canvas Layers
              </h4>
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {layerIds.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">
                    No layers on canvas.
                  </div>
                ) : (
                  [...layerIds].reverse().map((id) => {
                    const layer = layers[id];
                    if (!layer) return null;
                    const isSelected = selection.includes(id);

                    return (
                      <div
                        key={id}
                        onClick={() => setSelection([id])}
                        className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-blue-400"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">
                            {layer.type}
                          </span>
                          <span className="text-xs text-gray-600 truncate">
                            {layer.type === "TEXT"
                              ? layer.text || "Empty Text"
                              : layer.type === "IMAGE"
                                ? "Image Layer"
                                : "Shape"}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelection([id]);
                            deleteLayers();
                          }}
                          className="p-1 hover:bg-red-100 text-red-500 rounded transition-colors shrink-0"
                          title="Delete Layer"
                        >
                          ⨉
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadToDriveModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// PagePreviewTab
// Renders thumbnail previews of each PDF page and scrolls the Konva canvas
// to that page when clicked, by updating the camera.y state.
// ---------------------------------------------------------------------------
const PAGE_GAP = 40; // must stay in sync with Canvas.tsx

function PagePreviewTab({ pages }: { pages: Array<any> }) {
  const { camera, setCamera } = useCanvasStore(
    useShallow((s) => ({ camera: s.camera, setCamera: s.setCamera })),
  );

  const pageOffsets = useMemo(() => {
    let y = 0;
    return pages.map((p) => {
      const offset = y;
      y += p.height + PAGE_GAP;
      return offset;
    });
  }, [pages]);

  const scrollToPage = (pageIndex: number) => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const page = pages[pageIndex];
    const offsetY = pageOffsets[pageIndex];
    const targetY =
      viewportHeight / 2 - (offsetY + page.height / 2) * camera.zoom;
    const targetX = viewportWidth / 2 - (page.width / 2) * camera.zoom;
    setCamera({ ...camera, x: targetX, y: targetY });
  };

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 py-12 text-gray-400">
        <FileText size={40} className="text-gray-200" />
        <p className="text-xs font-medium">No pages</p>
        <p className="text-[11px] text-center text-gray-300 leading-snug">
          Import a PDF or add a blank page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-1">
      {pages.map((page, idx) => (
        <div key={page.id} className="group flex flex-col items-center gap-2">
          {/* Thumbnail card */}
          <div
            className="relative w-full rounded-xl overflow-hidden border-2 border-transparent group-hover:border-blue-400 transition-all duration-150 shadow-md group-hover:shadow-lg cursor-pointer"
            style={{ aspectRatio: `${page.width} / ${page.height}` }}
            onClick={() => scrollToPage(idx)}
          >
            {page.backgroundUrl ? (
              <img
                src={page.backgroundUrl}
                alt={`Page ${idx + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center">
                <FileText size={32} className="text-gray-200" />
              </div>
            )}

            {/* Hover overlay - scroll hint */}
            <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Page action buttons - top-right corner, visible on hover */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useCanvasStore
                    .getState()
                    .reorderPages(idx, Math.max(0, idx - 1));
                }}
                disabled={idx === 0}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white text-slate-600 hover:text-indigo-600 rounded-lg shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useCanvasStore
                    .getState()
                    .reorderPages(idx, Math.min(pages.length - 1, idx + 1));
                }}
                disabled={idx === pages.length - 1}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white text-slate-600 hover:text-indigo-600 rounded-lg shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold"
                title="Move down"
              >
                ▼
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  useCanvasStore.getState().deletePage(idx);
                }}
                className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg shadow-sm transition-colors text-xs font-bold"
                title="Delete page"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Page number */}
          <span className="text-sm font-bold text-blue-600 tabular-nums group-hover:text-blue-700 transition-colors">
            {idx + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
