"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  fetchDriveItems,
  downloadDrivePdf,
  type DriveItem,
} from "@/app/actions/drive";
import {
  FileText,
  Folder,
  ChevronRight,
  Home,
  Download,
  Loader2,
  AlertCircle,
  HardDrive,
  Clock,
  Search,
  X,
  Users,
} from "lucide-react";
import { usePDFStore } from "@/app/store/usePDFStore";
import { useRouter } from "next/navigation";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DriveModal({ isOpen, onClose }: DriveModalProps) {
  const router = useRouter();
  const [items, setItems] = useState<DriveItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"my-drive" | "shared">("my-drive");

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);

  const { saveToStorage, loadFromStorage } = usePDFStore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadItems = useCallback(
    async (folderId: string, reset: boolean = true, token?: string | null) => {
      if (reset) {
        setIsLoading(true);
        setItems([]);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const isShared = activeTab === "shared";
        const response = await fetchDriveItems(
          isShared ? "root" : folderId,
          token || undefined,
          searchQuery,
          isShared,
        );

        setItems((prev) =>
          reset ? response.files : [...prev, ...response.files],
        );
        setNextPageToken(response.nextPageToken);
      } catch (err) {
        console.error(err);
        setError("Failed to load files from Google Drive.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [searchQuery, activeTab],
  );

  // Debounce search
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      loadItems("root", true);
      // Reset breadcrumbs when searching and not shared
      if (searchQuery && activeTab === "my-drive") {
        setBreadcrumbs([{ id: "root", name: "Search Results" }]);
      } else if (
        !searchQuery &&
        activeTab === "my-drive" &&
        breadcrumbs.length === 1
      ) {
        setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, activeTab, isOpen]); // removed loadItems to avoid loop, it's wrapped in useCallback

  useEffect(() => {
    if (isOpen && !searchQuery) {
      loadItems(activeTab === "shared" ? "root" : currentFolderId, true);
    }
  }, [isOpen, activeTab, currentFolderId, loadItems]);

  useEffect(() => {
    if (!loadMoreRef.current || !nextPageToken) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore) {
          loadItems(
            activeTab === "shared" ? "root" : currentFolderId,
            false,
            nextPageToken,
          );
        }
      },
      { threshold: 1.0 },
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [
    nextPageToken,
    isLoading,
    isLoadingMore,
    loadItems,
    activeTab,
    currentFolderId,
  ]);

  const navigateToFolder = (folder: DriveItem) => {
    if (activeTab === "shared" || searchQuery) return; // Disable deep nav during search or shared for simplicity
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
  };

  const handleImport = async (file: DriveItem) => {
    setImportingId(file.id);
    setError(null);
    try {
      const dataUrl = await downloadDrivePdf(file.id);
      const base64 = dataUrl.split(",")[1];
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: "application/pdf" });

      await saveToStorage(blob);

      sessionStorage.setItem(
        "drive_origin",
        JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          parentFolderId: activeTab === "shared" ? "root" : currentFolderId,
        }),
      );

      await loadFromStorage();
      onClose();
      // Only push if we're not already on the editor page
      if (!window.location.pathname.includes("/editor")) {
        router.push("/editor?mode=edit");
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(`Failed to import "${file.name}". Please try again.`);
    } finally {
      setImportingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "—";
    const b = parseInt(bytesStr, 10);
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  };

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const folders = items.filter((i) => i.isFolder);
  const pdfs = items.filter((i) => !i.isFolder);

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 sm:p-6 animate-fade-in-up">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                Google Drive
              </h2>
              <p className="text-slate-500 text-xs font-medium">
                Browse documents & import
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="bg-white px-6 py-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-200 shrink-0">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => {
                setActiveTab("my-drive");
                setBreadcrumbs([{ id: "root", name: "My Drive" }]);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "my-drive"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <HardDrive className="w-4 h-4" />
              My Drive
            </button>
            <button
              onClick={() => {
                setActiveTab("shared");
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "shared"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Users className="w-4 h-4" />
              Shared with me
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        {/* Breadcrumbs (only for My Drive, hide if searching) */}
        {!searchQuery && activeTab === "my-drive" && (
          <div className="bg-white flex items-center gap-1 text-sm px-6 py-3 border-b border-slate-100 shrink-0 overflow-x-auto">
            {breadcrumbs.map((crumb, i) => (
              <div
                key={crumb.id + i}
                className="flex items-center gap-1 shrink-0"
              >
                {i > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <button
                  onClick={() => navigateToBreadcrumb(i)}
                  className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 ${
                    i === breadcrumbs.length - 1
                      ? "text-blue-700 bg-blue-50 font-semibold"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {i === 0 ? (
                    <span className="flex items-center gap-1">
                      <Home className="w-3.5 h-3.5" /> My Drive
                    </span>
                  ) : (
                    crumb.name
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File Browser Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
              <div className="col-span-6">Name</div>
              <div className="col-span-3">Modified</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {isLoading && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                <p className="text-sm font-medium">Loading Drive ...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
                <p className="text-sm text-rose-600 font-medium mb-4">
                  {error}
                </p>
                <button
                  onClick={() => loadItems(currentFolderId, true)}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Folder className="w-12 h-12 text-slate-200 mb-3" />
                <p className="font-semibold text-slate-600">
                  {searchQuery ? "No matching files found" : "Folder is empty"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchQuery
                    ? "Try a different search term"
                    : "Upload PDFs to your Google Drive"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Folders */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => navigateToFolder(folder)}
                  >
                    <div className="col-span-1 sm:col-span-6 flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 shrink-0 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                        <Folder className="w-4.5 h-4.5 text-blue-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {folder.name}
                      </span>
                    </div>
                    <div className="hidden sm:flex col-span-3 text-xs text-slate-500 items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(folder.modifiedTime || folder.createdTime)}
                    </div>
                    <div className="hidden sm:block col-span-2 text-xs text-slate-400">
                      —
                    </div>
                    <div className="hidden sm:flex col-span-1 justify-end">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))}

                {/* PDFs */}
                {pdfs.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 px-5 py-3.5 items-center hover:bg-slate-50 transition-colors group"
                  >
                    <div className="col-span-1 sm:col-span-6 flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 shrink-0 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                        <FileText className="w-4.5 h-4.5 text-red-500" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span
                          className="text-sm font-medium text-slate-800 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:flex col-span-3 text-xs text-slate-500 items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(file.modifiedTime || file.createdTime)}
                    </div>
                    <div className="hidden sm:block col-span-2 text-xs text-slate-500 font-medium">
                      {formatSize(file.size)}
                    </div>
                    <div className="hidden sm:flex col-span-1 justify-end">
                      <button
                        onClick={() => handleImport(file)}
                        disabled={importingId === file.id}
                        className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                        title="Import PDF"
                      >
                        {importingId === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                {nextPageToken && (
                  <div ref={loadMoreRef} className="p-4 flex justify-center">
                    {isLoadingMore && (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
