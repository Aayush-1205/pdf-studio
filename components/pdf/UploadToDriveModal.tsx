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
import { uploadToDrive, createDriveFolder } from "@/app/actions/drive";
import {
  ArrowLeft,
  Check,
  AlertCircle,
  Upload,
  Loader2,
  FolderPlus,
} from "lucide-react";
import { get } from "idb-keyval";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { generateBakedPDF } from "@/hooks/useExportPDF";

interface UploadToDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalStep = "rename" | "create-folder";

export function UploadToDriveModal({
  isOpen,
  onClose,
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

  const worker = usePDFWorker();

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
          setParentFolderId(origin.parentFolderId || "root");
        } catch {
          setFileName("document.pdf");
          setParentFolderId("root");
        }
      } else {
        setFileName("document.pdf");
        setParentFolderId("root");
      }
    }
  }, [isOpen]);

  const handleUpload = async (targetFolderId: string) => {
    setIsUploading(true);
    setError(null);
    try {
      if (!worker) throw new Error("Worker not ready");

      // Generate the final PDF including all overlays and highlights
      const blob = await generateBakedPDF(worker);

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
      <DialogContent className="sm:max-w-[460px]">
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
                    <p className="text-xs text-slate-400 mt-1.5">
                      Will be uploaded to the original folder on your Drive.
                    </p>
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
