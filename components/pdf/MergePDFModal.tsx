"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, CheckCircle2, FileUp, Loader2, ZoomIn } from "lucide-react";
// NOTE: pdfjs-dist is NOT statically imported here — doing so crashes Next.js SSR
// because pdfjs-dist's canvas.js calls `new DOMMatrix()` at module evaluation time,
// which does not exist in Node.js. We use dynamic imports inside async functions instead.
import { PDFDocument } from "pdf-lib";
import { useCanvasStore } from "../../store/useCanvasStore";
import {
  fetchDriveItems,
  downloadDrivePdf,
  DriveItem,
} from "../../app/actions/drive";
import { extractPdfPages } from "../../app/lib/pdfRender";
import { nanoid } from "nanoid";
import { createPortal } from "react-dom";

function ZoomPreview({
  file,
  pageIndex,
  onClose,
}: {
  file: File;
  pageIndex: number;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Dynamic import keeps pdfjs-dist out of SSR (avoids DOMMatrix crash)
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext: any = { canvasContext: ctx, viewport };
        await page.render(renderContext).promise;
        if (active) {
          setDataUrl(canvas.toDataURL("image/jpeg", 0.9));
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      active = false;
    };
  }, [file, pageIndex]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in-up cursor-zoom-out"
      onClick={onClose}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt="High Resolution Preview"
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm pointer-events-none"
        />
      ) : (
        <Loader2 size={48} className="text-white animate-spin" />
      )}
    </div>
  );
}

interface PreviewPage {
  id: string;
  fileId: string;
  originalIndex: number;
  dataUrl: string;
  selected: boolean;
}

interface SelectedFile {
  id: string;
  file: File;
  name: string;
}

interface MergePDFModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MergePDFModal({ isOpen, onClose }: MergePDFModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [zoomPage, setZoomPage] = useState<{
    file: File;
    pageIndex: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive Picker State
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState([
    { id: "root", name: "My Drive" },
  ]);

  const loadDriveItems = async (folderId: string) => {
    setDriveLoading(true);
    try {
      const items = await fetchDriveItems(folderId);
      setDriveItems(items);
    } catch (e) {
      console.error(e);
    }
    setDriveLoading(false);
  };

  useEffect(() => {
    setMounted(true);
    // Pre-load drive root on mount in background just in case
    loadDriveItems("root");
  }, []);

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined") return null;

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    await addFilesToMerge(newFiles);
  };

  const addFilesToMerge = async (newFiles: File[]) => {
    setIsProcessing(true);

    try {
      // Dynamic import keeps pdfjs-dist out of SSR
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }

      const parsedPages: PreviewPage[] = [];
      const newSelectedFiles: SelectedFile[] = [];

      for (const file of newFiles) {
        const fileId = nanoid();
        newSelectedFiles.push({ id: fileId, file, name: file.name });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 }); // Low-res for preview thumbnail

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await (page as any).render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

          parsedPages.push({
            id: nanoid(),
            fileId,
            originalIndex: i - 1,
            dataUrl,
            selected: true, // Default to keeping all pages
          });
        }
      }

      setSelectedFiles((prev) => [...prev, ...newSelectedFiles]);
      setPages((prev) => [...prev, ...parsedPages]);
    } catch (err) {
      console.error("Error generating previews:", err);
      alert("Failed to parse one or more PDF files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDriveFileSelected = async (file: DriveItem) => {
    if (file.isFolder) {
      setDriveBreadcrumbs([
        ...driveBreadcrumbs,
        { id: file.id, name: file.name },
      ]);
      loadDriveItems(file.id);
      return;
    }

    setIsDrivePickerOpen(false);
    setIsProcessing(true);
    try {
      const dataUrl = await downloadDrivePdf(file.id);
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });
      const fileObj = new File([blob], file.name, { type: "application/pdf" });

      await addFilesToMerge([fileObj]);
    } catch (err) {
      console.error("Error fetching from Drive:", err);
      alert("Failed to download file from Google Drive.");
      setIsProcessing(false);
    }
  };

  const togglePageSelection = (pageId: string) => {
    setPages(
      pages.map((p) => (p.id === pageId ? { ...p, selected: !p.selected } : p)),
    );
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(selectedFiles.filter((f) => f.id !== fileId));
    setPages(pages.filter((p) => p.fileId !== fileId));
  };

  const executeMerge = async () => {
    if (selectedFiles.length < 2) {
      alert("Please select at least 2 files to merge.");
      return;
    }
    if (pages.filter((p) => p.selected).length === 0) {
      alert("Please select at least one page to merge.");
      return;
    }

    setIsMerging(true);
    try {
      const finalDoc = await PDFDocument.create();

      // We must load each file's PDFDocument to copy pages from it
      for (const fileObj of selectedFiles) {
        // Find selected pages belonging to this file, in order
        const filePages = pages.filter(
          (p) => p.fileId === fileObj.id && p.selected,
        );
        if (filePages.length === 0) continue;

        const originalArrayBuffer = await fileObj.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(originalArrayBuffer);

        const indicesToCopy = filePages.map((p) => p.originalIndex);
        const copiedPages = await finalDoc.copyPages(srcDoc, indicesToCopy);

        copiedPages.forEach((p) => finalDoc.addPage(p));
      }

      const mergedBytes = await finalDoc.save();

      // Push merged document to canvas store
      const store = useCanvasStore.getState();
      store.setPdfBytes(mergedBytes);

      // Re-extract data using a clone of mergedBytes so PDF.js doesn't detach the ArrayBuffer!
      const clonedBytes = new Uint8Array(mergedBytes);
      const { pages: extractedPages, layers: extractedLayers } =
        await extractPdfPages(clonedBytes, "Merged_Document.pdf");
      store.setPages(extractedPages);

      const newLayersDict: Record<string, any> = {};
      const newLayerIds: string[] = [];
      extractedLayers.forEach((l) => {
        const lid = nanoid();
        newLayersDict[lid] = l;
        newLayerIds.push(lid);
      });

      useCanvasStore.setState({
        layers: newLayersDict,
        layerIds: newLayerIds,
        selection: [],
      });

      onClose(); // Successfully done!
    } catch (err) {
      console.error("Merge execution failed:", err);
      alert("Failed to merge documents.");
    } finally {
      setIsMerging(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Merge PDFs</h2>
            <p className="text-sm text-slate-500">
              Combine multiple files and choose specific pages to keep.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/50">
          {/* File Upload Zone */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/80 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFilesSelected}
              />
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-3">
                <Upload size={24} />
              </div>
              <p className="text-sm font-semibold text-indigo-900">
                Upload Local Files
              </p>
              <p className="text-xs text-indigo-500 mt-1">From your computer</p>
            </div>

            <div
              className="border-2 border-slate-200 bg-white rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              onClick={() => setIsDrivePickerOpen(true)}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16 11L6 28.5L16 46H36L46 28.5L36 11H16Z"
                    fill="#FFC107"
                  />
                  <path d="M37 11H16L6 28.5H27L37 11Z" fill="#1976D2" />
                  <path d="M6 28.5L16 46H36L26 28.5H6Z" fill="#4CAF50" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-blue-900">
                Google Drive
              </p>
              <p className="text-xs text-blue-500 mt-1">Pick from cloud</p>
            </div>
          </div>

          {isProcessing && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-indigo-900">
                Generating preview thumbnails...
              </p>
            </div>
          )}

          {/* Files List & Previews */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-col gap-8">
              {selectedFiles.map((fileObj) => {
                const filePages = pages.filter((p) => p.fileId === fileObj.id);
                const selectedCount = filePages.filter(
                  (p) => p.selected,
                ).length;

                return (
                  <div key={fileObj.id} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <FileUp size={18} className="text-slate-400" />
                        <h3 className="font-semibold text-slate-800">
                          {fileObj.name}
                        </h3>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {selectedCount} / {filePages.length} pages
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove File
                      </button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x">
                      {filePages.map((page) => (
                        <div
                          key={page.id}
                          onClick={() => togglePageSelection(page.id)}
                          className={`group relative shrink-0 cursor-pointer snap-start rounded-lg overflow-hidden border-2 transition-all ${
                            page.selected
                              ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                              : "border-transparent opacity-50 grayscale hover:grayscale-0"
                          }`}
                        >
                          <img
                            src={page.dataUrl}
                            alt={`Page ${page.originalIndex + 1}`}
                            className="h-48 w-auto object-contain bg-white block pointer-events-none"
                          />

                          {/* Selection Badge */}
                          <div
                            className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                              page.selected
                                ? "bg-indigo-500 text-white"
                                : "bg-white/80 text-transparent"
                            }`}
                          >
                            <CheckCircle2
                              size={16}
                              className={
                                page.selected ? "opacity-100" : "opacity-0"
                              }
                            />
                          </div>

                          {/* Preview Expand Badge */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              const fileObj = selectedFiles.find(
                                (f) => f.id === page.fileId,
                              );
                              if (fileObj) {
                                setZoomPage({
                                  file: fileObj.file,
                                  pageIndex: page.originalIndex,
                                });
                              }
                            }}
                            className="absolute top-2 left-2 w-6 h-6 bg-white/80 text-slate-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white transition-all shadow-sm"
                          >
                            <ZoomIn size={14} />
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
                            <span className="text-white text-[10px] font-bold">
                              Page {page.originalIndex + 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/80">
          <div className="flex flex-col">
            <span className="text-sm text-slate-500 font-medium">
              Total selected: {pages.filter((p) => p.selected).length} pages
            </span>
            {selectedFiles.length < 2 && selectedFiles.length > 0 && (
              <span className="text-xs text-red-500 font-medium">
                * You must select at least 2 files to merge.
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeMerge}
              disabled={
                isMerging ||
                pages.filter((p) => p.selected).length === 0 ||
                selectedFiles.length < 2
              }
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {isMerging && <Loader2 size={16} className="animate-spin" />}
              {isMerging ? "Merging Documents..." : "Merge & Open"}
            </button>
          </div>
        </div>
      </div>

      {/* Mini Google Drive Picker Overlay */}
      {isDrivePickerOpen && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16 11L6 28.5L16 46H36L46 28.5L36 11H16Z"
                    fill="#FFC107"
                  />
                  <path d="M37 11H16L6 28.5H27L37 11Z" fill="#1976D2" />
                  <path d="M6 28.5L16 46H36L26 28.5H6Z" fill="#4CAF50" />
                </svg>
                Select from Google Drive
              </h3>
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                {driveBreadcrumbs.map((crumb, i) => (
                  <div key={crumb.id} className="flex items-center">
                    <button
                      onClick={() => {
                        const newCrumbs = driveBreadcrumbs.slice(0, i + 1);
                        setDriveBreadcrumbs(newCrumbs);
                        loadDriveItems(crumb.id);
                      }}
                      className="hover:text-blue-600 font-medium transition-colors"
                    >
                      {crumb.name}
                    </button>
                    {i < driveBreadcrumbs.length - 1 && (
                      <span className="mx-1">/</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => setIsDrivePickerOpen(false)}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {driveLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : driveItems.length === 0 ? (
              <div className="flex justify-center items-center h-full text-slate-400 text-sm">
                Folder empty
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {driveItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleDriveFileSelected(item)}
                    className="flex items-center gap-3 p-3 text-left border rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {item.isFolder ? (
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <svg
                          className="w-5 h-5 text-indigo-500"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      </div>
                    ) : item.thumbnailLink ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border shrink-0 bg-slate-100">
                        <img
                          src={item.thumbnailLink}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <FileUp size={20} className="text-red-500" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {zoomPage && (
        <ZoomPreview
          file={zoomPage.file}
          pageIndex={zoomPage.pageIndex}
          onClose={() => setZoomPage(null)}
        />
      )}
    </div>,
    document.body,
  );
}
