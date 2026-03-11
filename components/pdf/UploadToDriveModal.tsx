"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  uploadToDrive,
  createDriveFolder,
  fetchDriveItems,
  type DriveItem,
} from "@/app/actions/drive";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Upload,
  Loader2,
  FolderPlus,
  Folder,
  ChevronRight,
} from "lucide-react";
import { get } from "idb-keyval";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { generateBakedPDF } from "@/hooks/useExportPDF";

interface UploadToDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileToUpload?: File;
}

type ModalStep = "rename" | "create-folder";

export function UploadToDriveModal({
  isOpen,
  onClose,
  fileToUpload,
}: UploadToDriveModalProps) {
  const [step, setStep] = useState<ModalStep>("rename");
  const [fileName, setFileName] = useState("document.pdf");
  const [folderName, setFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState("root");
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState<string | null>(null);

  // Folder Browsing State
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderHistory, setFolderHistory] = useState<
    { id: string; name: string }[]
  >([{ id: "root", name: "My Drive" }]);

  const worker = usePDFWorker();

  // Fetch folders when current directory changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchFolders = async () => {
      setIsLoadingFolders(true);
      try {
        const response = await fetchDriveItems(parentFolderId);
        if (isMounted) {
          setFolders(response.files.filter((i) => i.isFolder));
        }
      } catch (err) {
        console.error("Failed to load folders", err);
      } finally {
        if (isMounted) setIsLoadingFolders(false);
      }
    };
    fetchFolders();
    return () => {
      isMounted = false;
    };
  }, [isOpen, parentFolderId, step]);

  // On open, read origin info from sessionStorage
  useEffect(() => {
    if (isOpen) {
      setStep("rename");
      setError(null);
      setSuccessMessage(null);
      setNewFolderId(null);
      setFolderName("");

      const originRaw = sessionStorage.getItem("drive_origin");
      if (originRaw) {
        try {
          const origin = JSON.parse(originRaw);
          setFileName(origin.fileName || "document.pdf");
          if (origin.parentFolderId && origin.parentFolderId !== "root") {
            setParentFolderId(origin.parentFolderId);
            setFolderHistory([
              { id: "root", name: "My Drive" },
              { id: origin.parentFolderId, name: "Original Folder" },
            ]);
          } else {
            setParentFolderId("root");
            setFolderHistory([{ id: "root", name: "My Drive" }]);
          }
        } catch {
          setFileName("document.pdf");
          setParentFolderId("root");
          setFolderHistory([{ id: "root", name: "My Drive" }]);
        }
      } else {
        setFileName("document.pdf");
        setParentFolderId("root");
        setFolderHistory([{ id: "root", name: "My Drive" }]);
      }
    }
  }, [isOpen]);

  const handleUpload = async (targetFolderId: string) => {
    setIsUploading(true);
    setError(null);
    try {
      // Generate the final PDF including all overlays and highlights (if no external file provided)
      const blob = fileToUpload || (await generateBakedPDF(worker!));

      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("fileName", fileName);
      formData.append("parentFolderId", targetFolderId);

      const result = await uploadToDrive(formData);

      setSuccessMessage(
        `"${result.name}" uploaded successfully to Google Drive!`,
      );

      // After a brief success display, close the modal
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Failed to upload to Google Drive. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolderAndUpload = async () => {
    if (!folderName.trim()) {
      setError("Please enter a folder name.");
      return;
    }

    setIsCreatingFolder(true);
    setError(null);
    try {
      const folder = await createDriveFolder(folderName.trim(), parentFolderId);
      setNewFolderId(folder.id);
      setIsCreatingFolder(false);

      // Now upload to the newly created folder
      await handleUpload(folder.id);
    } catch (err) {
      console.error("Create folder failed:", err);
      setError("Failed to create folder. Please try again.");
      setIsCreatingFolder(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px] z-10001">
        {/* ── Step 1: Rename & Upload ─────────────────────────── */}
        {step === "rename" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload to Google Drive
              </DialogTitle>
              <DialogDescription>
                Upload the current PDF back to your Google Drive.
              </DialogDescription>
            </DialogHeader>

            {successMessage ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-200">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-emerald-700 text-center">
                  {successMessage}
                </p>
              </div>
            ) : (
              <>
                <div className="py-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      File Name
                    </label>
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. document.pdf"
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUpload(parentFolderId)
                      }
                    />
                  </div>

                  {/* Folder Browser */}
                  <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col h-48">
                    {/* Breadcrumbs */}
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-1 overflow-x-auto whitespace-nowrap custom-scrollbar">
                      {folderHistory.map((hist, idx) => (
                        <div
                          key={hist.id}
                          className="flex items-center text-xs"
                        >
                          <button
                            onClick={() => {
                              const newHistory = folderHistory.slice(
                                0,
                                idx + 1,
                              );
                              setFolderHistory(newHistory);
                              setParentFolderId(hist.id);
                            }}
                            className={`hover:text-indigo-600 transition-colors ${
                              idx === folderHistory.length - 1
                                ? "font-semibold text-slate-800"
                                : "text-slate-500"
                            }`}
                          >
                            {hist.name}
                          </button>
                          {idx < folderHistory.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-slate-400 mx-1 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Folder List */}
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
                      {isLoadingFolders ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                      ) : folders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                          <Folder className="w-6 h-6 mb-1 opacity-20" />
                          No folders here
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {folders.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                setFolderHistory([
                                  ...folderHistory,
                                  { id: f.id, name: f.name },
                                ]);
                                setParentFolderId(f.id);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-md text-left transition-colors group"
                            >
                              <Folder className="w-4 h-4 text-amber-400 shrink-0 group-hover:text-amber-500" />
                              <span className="text-sm text-slate-700 truncate">
                                {f.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* New folder option */}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("create-folder");
                      setError(null);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 text-indigo-500" />
                    Create a new folder instead
                  </button>
                </div>

                <DialogFooter>
                  <button
                    onClick={() => onClose()}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpload(parentFolderId)}
                    disabled={isUploading || !fileName.trim()}
                    className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload
                      </>
                    )}
                  </button>
                </DialogFooter>
              </>
            )}
          </>
        )}

        {/* ── Step 2: Create New Folder ───────────────────────── */}
        {step === "create-folder" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-500" />
                Create New Folder
              </DialogTitle>
              <DialogDescription>
                Create a new folder in your Drive and upload the PDF into it.
              </DialogDescription>
            </DialogHeader>

            {successMessage ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-200">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-emerald-700 text-center">
                  {successMessage}
                </p>
              </div>
            ) : (
              <>
                <div className="py-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Folder Name
                    </label>
                    <Input
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="e.g. My Documents"
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleCreateFolderAndUpload()
                      }
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                      Upload as
                    </label>
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="e.g. document.pdf"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <button
                    onClick={() => {
                      setStep("rename");
                      setError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <button
                    onClick={handleCreateFolderAndUpload}
                    disabled={
                      isCreatingFolder ||
                      isUploading ||
                      !folderName.trim() ||
                      !fileName.trim()
                    }
                    className="px-5 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors shadow-sm flex items-center gap-2"
                  >
                    {isCreatingFolder || isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isCreatingFolder
                          ? "Creating folder..."
                          : "Uploading..."}
                      </>
                    ) : (
                      <>
                        <FolderPlus className="w-4 h-4" />
                        Create & Upload
                      </>
                    )}
                  </button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
