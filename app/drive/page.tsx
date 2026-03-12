"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/shared/Navbar";
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
  ArrowLeft,
  HardDrive,
  Clock,
  Search,
  Users,
} from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function DrivePage() {
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
          folderId,
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
    // We only want this to run when searchQuery or activeTab changes significantly to warrant a new search.
    // If not searching, the other useEffect handles standard folder loading.
    if (!searchQuery && activeTab === "my-drive" && breadcrumbs.length === 1) {
      // Just on the root, no need to trigger a new search if it's already empty
      return;
    }

    const timeout = setTimeout(() => {
      loadItems("root", true);
      // Reset breadcrumbs when searching and not shared
      if (searchQuery && activeTab === "my-drive") {
        setBreadcrumbs([{ id: "root", name: "Search Results" }]);
      } else if (
        !searchQuery &&
        activeTab === "my-drive"
        // Don't arbitrarily reset breadcrumbs to length 1 if they navigated deep and just cleared a search.
        // Actually, if they clear a search, we probably DO want them back at the root of My Drive or where they were?
        // Let's just reset to root for simplicity when search is cleared to match DriveModal logic.
      ) {
        setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      }
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab]);

  // Load items when active tab or current folder changes (and we aren't searching)
  useEffect(() => {
    if (!searchQuery) {
      loadItems(currentFolderId, true);
    }
  }, [activeTab, currentFolderId, loadItems]); // removed searchQuery from here to avoid double-firing, the debounce handles search

  useEffect(() => {
    if (!loadMoreRef.current || !nextPageToken) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore) {
          loadItems(currentFolderId, false, nextPageToken);
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
    if (searchQuery) return; // Disable deep nav during search for simplicity
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
      const store = useCanvasStore.getState();
      store.setPdfBytes(array);

      try {
        const { extractPdfPages } = await import("@/app/lib/pdfRender");
        const { pages, layers: extractedLayers } = await extractPdfPages(
          new Uint8Array(array),
          file.name,
        );

        store.setPages(pages);

        // Bulk insert extracted text layers
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
      } catch (e) {
        console.error("Failed to extract pages:", e);
      }

      sessionStorage.setItem(
        "drive_origin",
        JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          parentFolderId: activeTab === "shared" ? "root" : currentFolderId,
          isShared: activeTab === "shared",
        }),
      );

      // Crucial: Use next/navigation to safely push. Wait for transition.
      router.push("/editor");
    } catch (err) {
      console.error("Import error:", err);
      setError(`Failed to import "${file.name}". Please try again.`);
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

  const folders = items.filter((i) => i.isFolder);
  const pdfs = items.filter((i) => !i.isFolder);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      <Navbar />

      <main className="pt-32 pb-20 px-6 animate-fade-in-up">
        <div className="max-w-6xl mx-auto">
          {/* Back + Header */}
          <div className="mb-8 pl-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tools
            </Link>

            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <HardDrive className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                  Google Drive
                </h1>
                <p className="text-slate-500 font-medium mt-1">
                  Browse your Drive and open PDFs in the editor
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col min-h-[60vh]">
            {/* Header / Actions Bar */}
            <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row gap-5 justify-between items-start sm:items-center bg-white/50 backdrop-blur-xl shrink-0">
              {/* Tabs (Segmented Control style) */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl shrink-0 shadow-inner">
                <button
                  onClick={() => {
                    setActiveTab("my-drive");
                    setBreadcrumbs([{ id: "root", name: "My Drive" }]);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === "my-drive"
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  My Drive
                </button>
                <button
                  onClick={() => {
                    setActiveTab("shared");
                    setBreadcrumbs([{ id: "root", name: "Shared with me" }]);
                    setSearchQuery("");
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === "shared"
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-black/5"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Shared with me
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400 shadow-inner font-medium"
                />
              </div>
            </div>

            {/* Breadcrumbs */}
            {!searchQuery && (
              <div className="bg-slate-50/50 flex items-center gap-1 text-sm px-6 py-3.5 border-b border-slate-100 shrink-0 overflow-x-auto">
                {breadcrumbs.map((crumb, i) => (
                  <div
                    key={crumb.id + i}
                    className="flex items-center gap-1 shrink-0"
                  >
                    {i > 0 && (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mx-1" />
                    )}
                    <button
                      onClick={() => navigateToBreadcrumb(i)}
                      className={`px-3 py-1.5 rounded-xl transition-all font-semibold shrink-0 ${
                        i === breadcrumbs.length - 1
                          ? "text-indigo-700 bg-indigo-100/50"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                      }`}
                    >
                      {i === 0 ? (
                        <span className="flex items-center gap-1.5">
                          {activeTab === "my-drive" ? (
                            <Home className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                          {crumb.name}
                        </span>
                      ) : (
                        crumb.name
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File Browser Table */}
            <div className="flex-1 overflow-y-auto bg-white relative flex flex-col">
              {/* Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-8 py-4 border-b border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-400 bg-white sticky top-0 z-10">
                <div className="col-span-6">Name</div>
                <div className="col-span-3">Modified</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* Content */}
              {isLoading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-500 flex-1">
                  <Loader2 className="w-10 h-10 animate-spin mb-5 text-indigo-500" />
                  <p className="font-bold text-slate-600">
                    Loading your Drive...
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6 flex-1">
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
                  <p className="text-base text-rose-600 font-bold mb-6 max-w-md leading-relaxed">
                    {error}
                  </p>
                  <button
                    onClick={() => loadItems(currentFolderId, true)}
                    className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 hover:scale-105 active:scale-95 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-500 flex-1">
                  <Folder className="w-16 h-16 text-slate-200 mb-4" />
                  <p className="font-bold text-lg text-slate-700">
                    {searchQuery ? "No matching files" : "This folder is empty"}
                  </p>
                  <p className="text-slate-400 mt-2 font-medium">
                    {searchQuery
                      ? "Try a different search term."
                      : "Upload PDFs to your Google Drive to see them here."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 flex-1">
                  {/* Folders */}
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 px-8 py-4 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => navigateToFolder(folder)}
                    >
                      <div className="col-span-1 sm:col-span-6 flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 shrink-0 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200/60 shadow-sm">
                          <Folder className="w-5 h-5 text-amber-500" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                          {folder.name}
                        </span>
                      </div>
                      <div className="hidden sm:flex col-span-3 text-xs text-slate-400 items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(folder.modifiedTime || folder.createdTime)}
                      </div>
                      <div className="hidden sm:block col-span-2 text-xs text-slate-300 font-medium">
                        —
                      </div>
                      <div className="hidden sm:flex col-span-1 justify-end">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}

                  {/* PDFs */}
                  {pdfs.map((file) => (
                    <div
                      key={file.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 px-8 py-4 items-center hover:bg-slate-50 transition-colors group"
                    >
                      <div className="col-span-1 sm:col-span-6 flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 shrink-0 bg-rose-50 rounded-xl flex items-center justify-center border border-rose-200/60 shadow-sm">
                          <FileText className="w-5 h-5 text-rose-500" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span
                            className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors"
                            title={file.name}
                          >
                            {file.name}
                          </span>
                        </div>
                      </div>
                      <div className="hidden sm:flex col-span-3 text-xs text-slate-400 items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(file.modifiedTime || file.createdTime)}
                      </div>
                      <div className="hidden sm:block col-span-2 text-xs text-slate-500 font-bold">
                        {formatSize(file.size)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleImport(file)}
                          disabled={importingId === file.id}
                          className="px-4 py-2 text-xs font-bold text-white bg-linear-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 rounded-xl sm:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex items-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                        >
                          {importingId === file.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">Opening</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span className="hidden sm:inline text-nowrap">
                                Open in Editor
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Infinite Scroll Loader */}
                  {nextPageToken && (
                    <div
                      ref={loadMoreRef}
                      className="p-6 flex justify-center border-t border-slate-50"
                    >
                      {isLoadingMore ? (
                        <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Loading more...
                        </div>
                      ) : (
                        <div className="h-6" /> // spacer to observe
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Stats */}
            {!isLoading && !error && items.length > 0 && (
              <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/80 text-xs font-bold text-slate-400 flex items-center justify-between shrink-0 rounded-b-3xl">
                <span>
                  {folders.length} FOLDER{folders.length !== 1 ? "S" : ""} •{" "}
                  {pdfs.length} FILE{pdfs.length !== 1 ? "S" : ""}
                </span>
                <span>
                  {breadcrumbs.length > 1 && !searchQuery
                    ? `LOCATION: ${breadcrumbs[breadcrumbs.length - 1].name.toUpperCase()}`
                    : activeTab === "shared"
                      ? "SHARED FILES"
                      : "ROOT DIRECTORY"}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
