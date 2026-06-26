"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  X,
  Upload,
  FileArchive,
  Loader2,
  ArrowRight,
  Download,
  HardDrive,
  Users,
  Search,
  Check,
  AlertCircle,
  Folder,
  ChevronRight,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCompressorStore, CompressionLevel } from "../../store/useCompressorStore";
import { usePDFCompressor } from "../../hooks/usePDFCompressor";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";
import {
  fetchDriveItems,
  downloadDrivePdf,
  uploadToDrive,
  DriveItem,
} from "@/app/actions/drive";

// Format bytes helper
const formatBytes = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

export function CompressorModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    compressionLevel,
    setCompressionLevel,
    phase,
    progress,
    progressMessage,
    originalSize,
    compressedSize,
    errorMessage,
    reset,
  } = useCompressorStore();

  const { compress, cancel, lastBlob } = usePDFCompressor();
  const editorWorker = usePDFWorker();

  const [activeTab, setActiveTab] = useState<"current" | "external" | "drive">("current");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive Browsing State (For Source File selection)
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveLoadingMore, setDriveLoadingMore] = useState(false);
  const [driveActiveTab, setDriveActiveTab] = useState<"my-drive" | "shared">("my-drive");
  const [driveSearch, setDriveSearch] = useState("");
  const [driveNextPageToken, setDriveNextPageToken] = useState<string | null>(null);
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState([{ id: "root", name: "My Drive" }]);

  const driveObserverRef = useRef<IntersectionObserver | null>(null);
  const driveLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const currentFolderId = driveBreadcrumbs[driveBreadcrumbs.length - 1].id;

  // Drive Save / Upload Confirm state
  const [showDriveUpload, setShowDriveUpload] = useState(false);
  const [uploadingName, setUploadingName] = useState("compressed_document.pdf");
  const [uploadParentId, setUploadParentId] = useState("root");
  const [uploadBreadcrumbs, setUploadBreadcrumbs] = useState([{ id: "root", name: "My Drive" }]);
  const [uploadFolders, setUploadFolders] = useState<DriveItem[]>([]);
  const [uploadFoldersLoading, setUploadFoldersLoading] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSaveSuccess, setDriveSaveSuccess] = useState(false);
  const [driveSaveError, setDriveSaveError] = useState<string | null>(null);

  // Close and reset
  const handleClose = () => {
    cancel();
    setShowDriveUpload(false);
    setDriveSaveSuccess(false);
    setDriveSaveError(null);
    onClose();
  };

  // Load items from Google Drive (source selection)
  const loadDriveItems = useCallback(
    async (folderId: string, resetList: boolean = true, token?: string | null) => {
      if (resetList) {
        setDriveLoading(true);
        setDriveItems([]);
      } else {
        setDriveLoadingMore(true);
      }

      try {
        const isShared = driveActiveTab === "shared";
        const response = await fetchDriveItems(
          folderId,
          token || undefined,
          driveSearch || undefined,
          isShared
        );

        setDriveItems((prev) => (resetList ? response.files : [...prev, ...response.files]));
        setDriveNextPageToken(response.nextPageToken);
      } catch (err) {
        console.error("Failed to load Google Drive items:", err);
      } finally {
        setDriveLoading(false);
        setDriveLoadingMore(false);
      }
    },
    [driveActiveTab, driveSearch]
  );

  // Debounced search for drive items
  useEffect(() => {
    if (!isOpen || activeTab !== "drive") return;
    const delayDebounceFn = setTimeout(() => {
      loadDriveItems(currentFolderId, true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [driveSearch, driveActiveTab, currentFolderId, activeTab, isOpen, loadDriveItems]);

  // Load initial drive items when tab or folder changes
  useEffect(() => {
    if (activeTab === "drive" && isOpen && !driveSearch) {
      loadDriveItems(currentFolderId, true);
    }
  }, [activeTab, isOpen, currentFolderId, driveActiveTab, driveSearch, loadDriveItems]);

  // Infinite scroll observer for drive items
  useEffect(() => {
    if (!driveLoadMoreRef.current || !driveNextPageToken) return;

    driveObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !driveLoading && !driveLoadingMore) {
          loadDriveItems(currentFolderId, false, driveNextPageToken);
        }
      },
      { threshold: 1.0 }
    );

    driveObserverRef.current.observe(driveLoadMoreRef.current);

    return () => {
      if (driveObserverRef.current) driveObserverRef.current.disconnect();
    };
  }, [driveNextPageToken, driveLoading, driveLoadingMore, currentFolderId, loadDriveItems]);

  // Handle uploading/saving to Drive
  const loadUploadFolders = useCallback(async (folderId: string) => {
    setUploadFoldersLoading(true);
    try {
      const isShared = driveActiveTab === "shared"; // reuse tab context for folder picker
      const response = await fetchDriveItems(folderId, undefined, undefined, isShared);
      setUploadFolders(response.files.filter((f) => f.isFolder));
    } catch (err) {
      console.error("Failed to load folders for upload:", err);
    } finally {
      setUploadFoldersLoading(false);
    }
  }, [driveActiveTab]);

  useEffect(() => {
    if (showDriveUpload) {
      loadUploadFolders(uploadParentId);
    }
  }, [showDriveUpload, uploadParentId, loadUploadFolders]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  // Compression triggers
  const handleCompressCurrent = async () => {
    if (!editorWorker) return;
    try {
      const rawPdfBlob = await generateBakedPDF(editorWorker);
      const arrayBuffer = await rawPdfBlob.arrayBuffer();
      await compress(arrayBuffer, compressionLevel, "document.pdf");
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to generate editor PDF.");
    }
  };

  const handleCompressExternal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    await compress(arrayBuffer, compressionLevel, file.name);
  };

  const handleCompressDriveFile = async (item: DriveItem) => {
    try {
      useCompressorStore.getState().beginJob(item.name);
      const dataUrl = await downloadDrivePdf(item.id);
      await compress(dataUrl, compressionLevel, item.name);
    } catch (e: unknown) {
      console.error(e);
      useCompressorStore.getState().onError("Failed to download or prepare Google Drive file.");
    }
  };

  // Google Drive Save Action
  const handleSaveToDriveSubmit = async () => {
    if (!lastBlob) return;
    setIsSavingToDrive(true);
    setDriveSaveError(null);
    try {
      const formData = new FormData();
      formData.append("file", lastBlob, uploadingName);
      formData.append("fileName", uploadingName);
      formData.append("parentFolderId", uploadParentId);

      await uploadToDrive(formData);
      setDriveSaveSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setDriveSaveError("Failed to save the file to Google Drive. Please try again.");
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const getLevelExplanation = (level: CompressionLevel) => {
    switch (level) {
      case "LOW":
        return (
          <div className="text-xs text-slate-600 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-2">
            <p className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>✨</span> Keep Text Searchable & Sharper Quality
            </p>
            <p className="leading-relaxed">
              <strong>What it does:</strong> Reduces document metadata sizes and compresses visual features safely using lossless PNG. Most importantly, it keeps the original text layer underneath.
            </p>
            <div className="flex flex-col gap-1 mt-2 text-[11px]">
              <span className="text-emerald-700 font-semibold">✔ Select this if: You want to copy/paste text, search for words, or need contracts to stay pristine.</span>
              <span className="text-amber-700 font-semibold">⚠ Note: The final file size reduction will be modest.</span>
            </div>
          </div>
        );
      case "MEDIUM":
        return (
          <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200/50 space-y-2">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>💡</span> Balanced Quality & File Size (Recommended)
            </p>
            <p className="leading-relaxed">
              <strong>What it does:</strong> Converts all PDF pages into standard-resolution JPEG images. This drops complex drawing coordinates and shrinks the size.
            </p>
            <div className="flex flex-col gap-1 mt-2 text-[11px]">
              <span className="text-emerald-700 font-semibold">✔ Select this if: You want a highly optimized, easy-to-share file that reads perfectly on any screen.</span>
              <span className="text-red-700 font-semibold">✖ Warning: The document text will NOT be searchable or selectable anymore.</span>
            </div>
          </div>
        );
      case "EXTREME":
        return (
          <div className="text-xs text-slate-600 bg-red-50/30 p-4 rounded-xl border border-red-100/40 space-y-2">
            <p className="font-bold text-red-900 flex items-center gap-1.5">
              <span>🚀</span> Maximum Size Reduction (Aggressive)
            </p>
            <p className="leading-relaxed">
              <strong>What it does:</strong> Rescales the pages to 60% of their actual physical dimensions and uses low-quality JPEG compression.
            </p>
            <div className="flex flex-col gap-1 mt-2 text-[11px]">
              <span className="text-emerald-700 font-semibold">✔ Select this if: You have tight email attachment limits or very slow internet connections.</span>
              <span className="text-red-700 font-semibold">✖ Warning: Images/text will look blurry/pixelated, and text is not searchable.</span>
            </div>
          </div>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileArchive size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              PDF Compression Studio
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={phase === "rasterizing" || phase === "assembling"}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body based on phase */}
        <div className="p-6 flex flex-col gap-6 bg-white min-h-[350px] justify-center">
          
          {(phase === "rasterizing" || phase === "assembling") && (
            <div className="w-full space-y-6 py-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-indigo-100 flex items-center justify-center">
                    <Loader2 size={28} className="text-indigo-600 animate-spin" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-800">
                    {phase === "rasterizing" ? "Processing Pages..." : "Assembling PDF..."}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    {progressMessage || "Converting document content..."}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-[280px] mx-auto space-y-2">
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {progress}% Complete
                </p>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="w-full text-center space-y-4 py-8">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Compression Failed</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {errorMessage || "An unexpected error occurred during processing."}
                </p>
              </div>
              <button
                onClick={reset}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {phase === "done" && !showDriveUpload && (
            <div className="flex flex-col gap-5 animate-fade-in-up py-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <Check size={20} className="stroke-[3]" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Compression Success!</h3>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex flex-col gap-1 items-start">
                  <span className="text-[10px] uppercase font-black text-emerald-600/60 tracking-widest">
                    Original
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-600">
                    {formatBytes(originalSize)}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                  <ArrowRight size={16} className="text-emerald-500" />
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[10px] uppercase font-black text-emerald-600/60 tracking-widest text-right">
                    Compressed
                  </span>
                  <span className="text-sm font-mono font-black text-emerald-600">
                    {formatBytes(compressedSize)}
                  </span>
                </div>
                <div className="h-8 w-px bg-emerald-200/50 mx-2" />
                <div className="flex flex-col gap-0 items-center bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
                  <span className="text-[9px] uppercase font-black text-emerald-500">
                    Saved
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    {originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => {
                    if (!lastBlob) return;
                    const url = URL.createObjectURL(lastBlob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `compressed_document.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm shadow-sm"
                >
                  <Download size={18} />
                  Download File
                </button>
                <button
                  onClick={() => setShowDriveUpload(true)}
                  className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm"
                >
                  <HardDrive size={18} />
                  Save to Drive
                </button>
              </div>

              <button
                onClick={reset}
                className="text-xs text-slate-400 hover:text-slate-600 underline font-medium self-center mt-2"
              >
                Compress Another File
              </button>
            </div>
          )}

          {/* Drive Upload Confirmation Panel */}
          {phase === "done" && showDriveUpload && (
            <div className="flex flex-col gap-4 animate-fade-in-up py-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  onClick={() => {
                    setShowDriveUpload(false);
                    setDriveSaveError(null);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <ArrowRight size={14} className="rotate-180" /> Back to Results
                </button>
              </div>

              {driveSaveSuccess ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                    <Check size={20} className="stroke-[3]" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">Saved to Google Drive</h3>
                  <p className="text-xs text-slate-400">Closing window...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">File Name</label>
                    <input
                      type="text"
                      value={uploadingName}
                      onChange={(e) => setUploadingName(e.target.value)}
                      placeholder="Enter file name..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Select Destination Folder</label>
                    
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase overflow-x-auto whitespace-nowrap pb-1">
                      {uploadBreadcrumbs.map((crumb, i) => (
                        <React.Fragment key={crumb.id + i}>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadParentId(crumb.id);
                              setUploadBreadcrumbs(uploadBreadcrumbs.slice(0, i + 1));
                            }}
                            className={`hover:text-indigo-600 transition-colors ${i === uploadBreadcrumbs.length - 1 ? "text-indigo-600" : ""}`}
                          >
                            {crumb.name}
                          </button>
                          {i < uploadBreadcrumbs.length - 1 && <span>/</span>}
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="border border-slate-200 rounded-xl max-h-[160px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                      {uploadFoldersLoading ? (
                        <div className="py-8 flex justify-center">
                          <Loader2 className="animate-spin text-indigo-500" size={18} />
                        </div>
                      ) : uploadFolders.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No subfolders found. Upload to this directory.
                        </div>
                      ) : (
                        uploadFolders.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              setUploadParentId(folder.id);
                              setUploadBreadcrumbs([...uploadBreadcrumbs, { id: folder.id, name: folder.name }]);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left text-xs font-medium text-slate-700 transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Folder size={14} className="text-indigo-400 shrink-0" />
                              {folder.name}
                            </span>
                            <ChevronRight size={12} className="text-slate-300" />
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {driveSaveError && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                      <AlertCircle size={14} /> {driveSaveError}
                    </p>
                  )}

                  <button
                    onClick={handleSaveToDriveSubmit}
                    disabled={isSavingToDrive}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {isSavingToDrive ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Here"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === "idle" && (
            <div className="flex flex-col gap-6 animate-fade-in-up">
              {/* Compression Levels */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">
                  Compression Level
                </label>
                <div className="flex p-1 bg-slate-100 rounded-xl shrink-0">
                  {(["LOW", "MEDIUM", "EXTREME"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setCompressionLevel(level)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        compressionLevel === level
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {level === "LOW" ? "LOW (Searchable)" : level}
                    </button>
                  ))}
                </div>

                {/* Plain-English Non-tech Explanation */}
                {getLevelExplanation(compressionLevel)}
              </div>

              {/* Mode Selection Tabs */}
              <div className="flex border-b border-slate-100">
                {(["current", "external", "drive"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-semibold border-b-2 capitalize transition-colors ${
                      activeTab === tab
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab === "current" ? "Active Editor" : tab === "external" ? "Local File" : "Google Drive"}
                  </button>
                ))}
              </div>

              {/* Tab views */}
              <div className="min-h-[160px] flex flex-col justify-center">
                {activeTab === "current" && (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <p className="text-sm text-slate-600 leading-relaxed px-4">
                      Compress the PDF document currently open in your editor canvas, baking all updates and overlays.
                    </p>
                    <button
                      onClick={handleCompressCurrent}
                      disabled={!editorWorker}
                      className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                    >
                      <FileArchive size={18} />
                      Compress Active Editor
                    </button>
                  </div>
                )}

                {activeTab === "external" && (
                  <div
                    className="w-full border-2 border-dashed border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl p-8 cursor-pointer group transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleCompressExternal}
                    />
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                        <Upload
                          size={24}
                          className="text-slate-400 group-hover:text-indigo-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700">Upload PDF to Compress</p>
                        <p className="text-[11px] text-slate-500">Click to browse or drag and drop</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "drive" && (
                  <div className="w-full flex flex-col gap-4">
                    {/* Drive Header / Navigation */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button
                          onClick={() => {
                            setDriveActiveTab("my-drive");
                            setDriveBreadcrumbs([{ id: "root", name: "My Drive" }]);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            driveActiveTab === "my-drive"
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <HardDrive className="w-3.5 h-3.5" />
                          My Drive
                        </button>
                        <button
                          onClick={() => {
                            setDriveActiveTab("shared");
                            setDriveBreadcrumbs([{ id: "root", name: "Shared with me" }]);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            driveActiveTab === "shared"
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          Shared
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search Drive..."
                          value={driveSearch}
                          onChange={(e) => setDriveSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase overflow-x-auto whitespace-nowrap pb-1">
                      {driveBreadcrumbs.map((crumb, i) => (
                        <React.Fragment key={crumb.id + i}>
                          <button
                            onClick={() => {
                              setDriveSearch("");
                              setDriveBreadcrumbs(driveBreadcrumbs.slice(0, i + 1));
                            }}
                            className={`hover:text-indigo-600 transition-colors ${i === driveBreadcrumbs.length - 1 ? "text-indigo-600" : ""}`}
                          >
                            {crumb.name}
                          </button>
                          {i < driveBreadcrumbs.length - 1 && <span>/</span>}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Drive Files List */}
                    <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto p-1 custom-scrollbar">
                      {driveLoading ? (
                        <div className="col-span-2 py-8 flex justify-center">
                          <Loader2 className="animate-spin text-indigo-500" size={20} />
                        </div>
                      ) : driveItems.length === 0 ? (
                        <div className="col-span-2 py-8 text-slate-400 text-xs text-center border border-dashed border-slate-100 rounded-xl">
                          No PDF files or folders found.
                        </div>
                      ) : (
                        <>
                          {driveItems.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (item.isFolder) {
                                  setDriveSearch("");
                                  setDriveBreadcrumbs([...driveBreadcrumbs, { id: item.id, name: item.name }]);
                                } else {
                                  handleCompressDriveFile(item);
                                }
                              }}
                              className="flex items-center gap-2.5 p-2 border rounded-xl hover:bg-slate-50 text-left transition-all overflow-hidden group border-slate-200/80 hover:border-indigo-200"
                            >
                              <div className="shrink-0 w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                {item.isFolder ? (
                                  <Folder size={13} className="text-slate-400 group-hover:text-indigo-500" />
                                ) : (
                                  <FileArchive size={13} className="text-red-400 group-hover:text-red-500" />
                                )}
                              </div>
                              <span className="text-xs font-semibold text-slate-600 truncate group-hover:text-slate-800">
                                {item.name}
                              </span>
                            </button>
                          ))}
                          {driveNextPageToken && (
                            <div ref={driveLoadMoreRef} className="col-span-2 py-3 flex justify-center">
                              <Loader2 className="animate-spin text-slate-300" size={16} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
