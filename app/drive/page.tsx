"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { usePDFStore } from "@/app/store/usePDFStore";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function DrivePage() {
  const router = useRouter();
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);

  const { saveToStorage, loadFromStorage } = usePDFStore();

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadItems = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const driveItems = await fetchDriveItems(folderId);
      setItems(driveItems);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to load files from Google Drive. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems("root");
  }, [loadItems]);

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
          parentFolderId: currentFolderId,
        }),
      );

      await loadFromStorage();
      router.push("/editor?mode=edit");
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

  // Filter items by search query
  const filteredItems = searchQuery
    ? items.filter((i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : items;

  const folders = filteredItems.filter((i) => i.isFolder);
  const pdfs = filteredItems.filter((i) => !i.isFolder);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navbar />

      <main className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Back + Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tools
            </Link>

            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                  Google Drive
                </h1>
                <p className="text-slate-500 text-sm">
                  Browse your Drive and open PDFs in the editor
                </p>
              </div>
            </div>
          </div>

          {/* Search + Breadcrumbs Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
            {/* Search */}
            <div className="px-5 pt-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 text-sm px-5 pb-3 overflow-x-auto">
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
                        ? "text-indigo-700 bg-indigo-50 font-semibold"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
          </div>

          {/* File Browser */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <div className="col-span-6">Name</div>
              <div className="col-span-2">Modified</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p className="text-sm">Loading your Drive...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
                <p className="text-sm text-rose-600 font-medium mb-4">
                  {error}
                </p>
                <button
                  onClick={() => loadItems(currentFolderId)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Folder className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-medium">
                  {searchQuery ? "No matching files" : "This folder is empty"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {searchQuery
                    ? "Try a different search term."
                    : "No PDFs or subfolders found here."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {/* Folders */}
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                    onClick={() => navigateToFolder(folder)}
                  >
                    <div className="col-span-6 flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 shrink-0 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-200">
                        <Folder className="w-4.5 h-4.5 text-amber-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {folder.name}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-slate-400">
                      {formatDate(folder.modifiedTime || folder.createdTime)}
                    </div>
                    <div className="col-span-2 text-xs text-slate-400">—</div>
                    <div className="col-span-2 flex justify-end">
                      <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}

                {/* PDFs */}
                {pdfs.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-slate-50 transition-colors group"
                  >
                    <div className="col-span-6 flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 shrink-0 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
                        <FileText className="w-4.5 h-4.5 text-red-500" />
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span
                          className="text-sm font-semibold text-slate-800 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(file.modifiedTime || file.createdTime)}
                    </div>
                    <div className="col-span-2 text-xs text-slate-500 font-medium">
                      {formatSize(file.size)}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button
                        onClick={() => handleImport(file)}
                        disabled={importingId === file.id}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex items-center gap-1.5 disabled:opacity-100 shadow-sm"
                      >
                        {importingId === file.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Opening...
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            Open in Editor
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Stats */}
            {!isLoading && !error && filteredItems.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  {folders.length} folder{folders.length !== 1 ? "s" : ""},{" "}
                  {pdfs.length} file{pdfs.length !== 1 ? "s" : ""}
                </span>
                <span>
                  {breadcrumbs.length > 1
                    ? `Viewing: ${breadcrumbs[breadcrumbs.length - 1].name}`
                    : "Root directory"}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
