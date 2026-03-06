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
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { UploadToDriveModal } from "../pdf/UploadToDriveModal";
import { MergePDFModal } from "../pdf/MergePDFModal";
import { CompressorModal } from "../pdf/CompressorModal";
import { PageResizeModal } from "../pdf/PageResizeModal";
import {
  fetchDriveItems,
  downloadDrivePdf,
  type DriveItem,
} from "@/app/actions/drive";
import { getGoogleDriveAuthUrl } from "@/app/actions/googleAuth";
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
  const [activeTab, setActiveTab] = useState<"drive" | "pages" | "layers">(
    "drive",
  );
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isCompressorModalOpen, setIsCompressorModalOpen] = useState(false);
  const [isResizeModalOpen, setIsResizeModalOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | string>("end");
  const [customInterval, setCustomInterval] = useState<number>(1);

  // Drive API State
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadItems = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    setIsAuthError(false);
    try {
      const driveItems = await fetchDriveItems(folderId);
      setItems(driveItems.files);
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Failed to load files from Google Drive.";
      setError(message);
      // Detect auth-specific failures
      if (
        message.toLowerCase().includes("authenticate") ||
        message.toLowerCase().includes("sign in") ||
        message.toLowerCase().includes("permission") ||
        message.toLowerCase().includes("refresh token")
      ) {
        setIsAuthError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when tab switches to Drive
  useEffect(() => {
    if (activeTab === "drive") {
      setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      loadItems("root");
    }
  }, [activeTab, loadItems]);

  const navigateToFolder = (folder: DriveItem) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadItems(folder.id);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    loadItems(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleImport = async (file: DriveItem) => {
    setDownloadingId(file.id);
    setError(null);
    try {
      const dataUrl = await downloadDrivePdf(file.id);
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }

      const store = useCanvasStore.getState();

      store.setPdfBytes(array);

      try {
        const { extractPdfPages } = await import("@/app/lib/pdfRender");
        // We MUST pass a cloned Uint8Array here. pdfjs-dist often transfers the buffer to its worker,
        // effectively detaching it from the main thread and crashing future exports!
        const { pages, layers } = await extractPdfPages(
          new Uint8Array(array),
          file.name,
        );

        store.setPages(pages);

        // Bulk insert extracted text layers
        const newLayersDict: Record<string, any> = {};
        const newLayerIds: string[] = [];
        layers.forEach((l) => {
          const lid = nanoid();
          newLayersDict[lid] = l;
          newLayerIds.push(lid);
        });

        useCanvasStore.setState({
          layers: newLayersDict,
          layerIds: newLayerIds,
          selection: [],
        });
      } catch (e) {
        console.error("Failed to extract pages:", e);
      }

      sessionStorage.setItem(
        "drive_origin",
        JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          parentFolderId: currentFolderId,
        }),
      );
    } catch (err) {
      console.error("Import error:", err);
      setError(`Failed to import "${file.name}". Please try again.`);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(dateStr));
  };

  const folders = items.filter((i) => i.isFolder);
  const pdfs = items.filter((i) => !i.isFolder);

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
      <div className="absolute top-16 left-4 w-72 h-[calc(100vh-120px)] bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-2xl rounded-2xl flex flex-col pointer-events-auto transition-all">
        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab("drive")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "drive" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Google Drive
          </button>
          <button
            onClick={() => setActiveTab("pages")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "pages" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Pages
          </button>
          <button
            onClick={() => setActiveTab("layers")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "layers" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Layers
          </button>
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

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {activeTab === "drive" && (
            <div className="flex flex-col h-full space-y-4">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  <FileUp size={16} /> Upload Edits to Drive
                </button>
              </div>

              {/* Drive Built-In File Explorer */}
              <div className="flex flex-col flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white/50 shadow-inner">
                <div className="bg-gray-50 p-2 border-b text-xs flex items-center gap-1 overflow-x-auto whitespace-nowrap custom-scrollbar shrink-0">
                  {breadcrumbs.map((crumb, i) => (
                    <div
                      key={crumb.id}
                      className="flex items-center gap-1 shrink-0"
                    >
                      {i > 0 && (
                        <ChevronRight size={12} className="text-gray-400" />
                      )}
                      <button
                        onClick={() => navigateToBreadcrumb(i)}
                        className={`px-1.5 py-0.5 rounded transition-colors ${
                          i === breadcrumbs.length - 1
                            ? "text-blue-600 font-semibold bg-blue-50"
                            : "text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {i === 0 && (
                          <Home size={10} className="inline mr-1 mb-[2px]" />
                        )}
                        {crumb.name}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[40vh] custom-scrollbar p-1">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-blue-500 py-8">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center text-center p-4 gap-2">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                      {isAuthError ? (
                        <>
                          <p className="text-[11px] font-semibold text-red-600">
                            Google Drive: Auth Required
                          </p>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            Your Google token has expired or Drive scope was not
                            granted.
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                const url = await getGoogleDriveAuthUrl();
                                window.location.href = url;
                              } catch {
                                alert(
                                  "Could not generate auth URL. Check CLIENT_ID is set.",
                                );
                              }
                            }}
                            className="mt-1 px-3 py-1.5 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            Connect Google Drive
                          </button>
                        </>
                      ) : (
                        <p className="text-[10px] text-red-500">{error}</p>
                      )}
                      <button
                        onClick={() => loadItems(currentFolderId)}
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-gray-400">
                      <Folder className="w-8 h-8 opacity-50 mb-2" />
                      <span className="text-xs">Folder empty</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {folders.map((f) => (
                        <div
                          key={f.id}
                          onClick={() => navigateToFolder(f)}
                          className="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer group transition-colors"
                        >
                          <Folder className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                          <span className="text-xs font-medium text-gray-700 truncate flex-1">
                            {f.name}
                          </span>
                        </div>
                      ))}
                      {pdfs.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg cursor-pointer group transition-colors"
                        >
                          <div
                            className="flex items-center overflow-hidden flex-1"
                            onClick={() => handleImport(f)}
                          >
                            <FileText className="w-4 h-4 text-red-500 mr-2 shrink-0" />
                            <div className="flex flex-col truncate">
                              <span
                                className="text-[11px] font-semibold text-gray-800 truncate"
                                title={f.name}
                              >
                                {f.name}
                              </span>
                              <span className="text-[9px] text-gray-400">
                                {formatDate(f.createdTime)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleImport(f)}
                            disabled={downloadingId === f.id}
                            className="opacity-0 group-hover:opacity-100 p-1.5 bg-white shadow-sm border rounded-md text-blue-600 hover:bg-blue-50 transition-all shrink-0 ml-2 disabled:opacity-100"
                          >
                            {downloadingId === f.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Download size={12} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "pages" && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3 flex items-center gap-2">
                <Layers size={12} /> Document Pages
              </h4>

              <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
                {pagesList.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">
                    No pages yet. Import a PDF or add a blank page.
                  </div>
                ) : (
                  pagesList.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 bg-gray-50 border rounded-lg hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">
                          Page {idx + 1}
                        </span>
                        {p.groupName && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded truncate max-w-[80px]">
                            {p.groupName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            useCanvasStore
                              .getState()
                              .reorderPages(idx, Math.max(0, idx - 1))
                          }
                          className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() =>
                            useCanvasStore
                              .getState()
                              .reorderPages(
                                idx,
                                Math.min(pagesList.length - 1, idx + 1),
                              )
                          }
                          className="p-1 hover:bg-gray-200 rounded text-gray-500"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() =>
                            useCanvasStore.getState().deletePage(idx)
                          }
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          ⨉
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3 flex items-center gap-2 mt-4 pt-4 border-t">
                <LayoutTemplate size={12} /> Add Blank Frame
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

              <div className="grid grid-cols-2 gap-2">
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
                    className={`flex flex-col items-center justify-center p-3 border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center gap-1 ${
                      p.name === "Same as Document"
                        ? "border-blue-300 bg-blue-50/60 col-span-2"
                        : "border-gray-200"
                    }`}
                  >
                    <PlusSquare
                      size={20}
                      className={
                        p.name === "Same as Document"
                          ? "text-blue-500"
                          : "text-gray-400"
                      }
                    />
                    <span
                      className={`text-[10px] font-medium ${
                        p.name === "Same as Document"
                          ? "text-blue-700"
                          : "text-gray-600"
                      }`}
                    >
                      {p.name}
                    </span>
                    {p.name === "Same as Document" && (
                      <span className="text-[9px] text-blue-400">
                        {Math.round(p.width)} × {Math.round(p.height)} px
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="pt-6 border-t mt-4">
                <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
                  Custom Size
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="W"
                    className="flex-1 p-2 w-24 border rounded-lg text-sm focus:outline-blue-500 bg-gray-50"
                    id="custom-w"
                  />
                  <span className="text-gray-400">×</span>
                  <input
                    type="number"
                    placeholder="H"
                    className="flex-1 p-2 w-24 border rounded-lg text-sm focus:outline-blue-500 bg-gray-50"
                    id="custom-h"
                  />
                </div>
                <button
                  className="w-full mt-3 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
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

                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
                    Document Tools
                  </h4>
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 p-2.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors shadow-sm"
                      onClick={() => setIsMergeModalOpen(true)}
                    >
                      <Layers size={16} />
                      Merge Multiple PDFs
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 p-2.5 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors shadow-sm"
                      onClick={() => setIsCompressorModalOpen(true)}
                    >
                      <FileArchive size={16} />
                      Compress PDF Size
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-700 border border-violet-200 p-2.5 rounded-lg text-sm font-medium hover:bg-violet-100 transition-colors shadow-sm"
                      onClick={() => setIsResizeModalOpen(true)}
                    >
                      <Maximize2 size={16} />
                      Resize Pages
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-red-100">
                  <button
                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors shadow-sm"
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
