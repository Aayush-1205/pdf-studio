"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  fetchDriveItems,
  downloadDrivePdf,
  type DriveItem,
} from "@/app/actions/drive";
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Folder,
  ChevronRight,
  Home,
} from "lucide-react";
import { usePDFStore } from "@/app/store/usePDFStore";

interface DriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function DriveModal({ isOpen, onClose }: DriveModalProps) {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);

  const { loadFromStorage, saveToStorage } = usePDFStore();

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadItems = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const driveItems = await fetchDriveItems(folderId);
      setItems(driveItems);
    } catch (err) {
      console.error(err);
      setError("Failed to load files from Google Drive.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      loadItems("root");
    }
  }, [isOpen, loadItems]);

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
      const blob = new Blob([array], { type: "application/pdf" });

      await saveToStorage(blob);

      // Store origin info in sessionStorage so the Upload modal knows where this came from
      sessionStorage.setItem(
        "drive_origin",
        JSON.stringify({
          fileId: file.id,
          fileName: file.name,
          parentFolderId: currentFolderId,
        }),
      );

      await loadFromStorage();
      onClose();
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
      year: "numeric",
    }).format(new Date(dateStr));
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "";
    const b = parseInt(bytesStr, 10);
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  };

  const folders = items.filter((i) => i.isFolder);
  const pdfs = items.filter((i) => !i.isFolder);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <svg viewBox="0 0 48 48" className="w-6 h-6">
              <path fill="#FFC107" d="M17 5.8l-8.5 14.7h17L34 5.8z" />
              <path
                fill="#1976D2"
                d="M34 5.8l8.5 14.7-8.5 14.7h-17L25.5 20.5z"
              />
              <path fill="#4CAF50" d="M8.5 20.5L0 35.2h17l8.5-14.7z" />
            </svg>
            Import from Google Drive
          </DialogTitle>
          <DialogDescription>
            Browse folders and select a PDF to import into the editor.
          </DialogDescription>
        </DialogHeader>

        {/* ── Breadcrumb Navigation ──────────────────────────────── */}
        <div className="flex items-center gap-1 text-sm mt-2 overflow-x-auto pb-1 shrink-0">
          {breadcrumbs.map((crumb, i) => (
            <div key={crumb.id} className="flex items-center gap-1 shrink-0">
              {i > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`px-2 py-1 rounded-md transition-colors shrink-0 ${
                  i === breadcrumbs.length - 1
                    ? "text-indigo-700 bg-indigo-50 font-semibold"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {i === 0 ? <Home className="w-4 h-4 inline mr-1" /> : null}
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* ── File List ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto mt-2 min-h-[280px] border rounded-lg bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
              <p>Loading files...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
              <p className="text-sm text-rose-600 font-medium mb-4">{error}</p>
              <button
                onClick={() => loadItems(currentFolderId)}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
              <Folder className="w-12 h-12 text-slate-300 mb-3" />
              <p className="font-medium">This folder is empty</p>
              <p className="text-sm text-slate-400 mt-1">
                No PDFs or subfolders found here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Folders first */}
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center gap-4 p-3.5 hover:bg-white transition-colors group cursor-pointer"
                  onClick={() => navigateToFolder(folder)}
                >
                  <div className="w-10 h-10 shrink-0 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-200">
                    <Folder className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 truncate flex-1">
                    {folder.name}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}

              {/* Then PDF files */}
              {pdfs.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3.5 hover:bg-white transition-colors group cursor-pointer"
                  onClick={() => handleImport(file)}
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
                      <FileText className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span
                        className="text-sm font-semibold text-slate-800 truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {file.createdTime && (
                          <span>{formatDate(file.createdTime)}</span>
                        )}
                        {file.createdTime && file.size && <span>&bull;</span>}
                        {file.size && <span>{formatSize(file.size)}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={downloadingId === file.id}
                    className="shrink-0 ml-4 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex items-center gap-1.5 disabled:opacity-100"
                  >
                    {downloadingId === file.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Import
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
