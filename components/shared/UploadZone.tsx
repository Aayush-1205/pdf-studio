"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { set } from "idb-keyval";

interface UploadZoneProps {
  toolName: string;
  toolDescription: string;
  editorMode: string;
  maxFiles?: number;
  accentColor?: string;
}

export function UploadZone({
  toolName,
  toolDescription,
  editorMode,
  maxFiles = 1,
  accentColor = "indigo",
}: UploadZoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      if (!file || !file.type.includes("pdf")) {
        alert("Please select a valid PDF file.");
        return;
      }

      setStatus("loading");
      setFileName(file.name);

      try {
        // Store the PDF in IndexedDB
        await set("active_pdf", file);
        // Store the mode in sessionStorage for persistence
        sessionStorage.setItem("pdf_studio_mode", editorMode);

        setStatus("success");

        // Brief delay for the success animation, then redirect
        setTimeout(() => {
          router.push(`/editor?mode=${editorMode}`);
        }, 600);
      } catch (e) {
        console.error("Failed to store PDF:", e);
        setStatus("idle");
        alert("Failed to process file. Please try again.");
      }
    },
    [editorMode, router],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-scale-in">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => status === "idle" && fileInputRef.current?.click()}
        className={`
          relative overflow-hidden rounded-3xl p-12 text-center cursor-pointer
          transition-all duration-300
          ${
            isDragOver
              ? `border-2 border-${accentColor}-500 bg-${accentColor}-50 shadow-xl scale-[1.01]`
              : status === "success"
                ? "border-2 border-emerald-400 bg-emerald-50"
                : "upload-zone-border hover:shadow-lg"
          }
        `}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, var(--text-muted) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10">
          {/* Icon */}
          <div
            className={`
            w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center
            transition-all duration-300
            ${
              status === "success"
                ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg"
                : status === "loading"
                  ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg"
                  : `bg-gradient-to-br from-${accentColor}-500 to-violet-600 shadow-lg shadow-${accentColor}-500/20`
            }
            ${isDragOver ? "scale-110 animate-float" : ""}
          `}
          >
            {status === "success" ? (
              <CheckCircle2 className="w-10 h-10 text-white" />
            ) : status === "loading" ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : isDragOver ? (
              <FileText className="w-10 h-10 text-white" />
            ) : (
              <Upload className="w-10 h-10 text-white" />
            )}
          </div>

          {/* Text */}
          {status === "success" ? (
            <>
              <h3 className="text-xl font-bold text-emerald-700 mb-1">
                File Ready!
              </h3>
              <p className="text-sm text-emerald-600">Redirecting to editor…</p>
            </>
          ) : status === "loading" ? (
            <>
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                Processing…
              </h3>
              <p className="text-sm text-slate-500 truncate max-w-xs mx-auto">
                {fileName}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {isDragOver
                  ? "Drop your PDF here"
                  : `Upload PDF to ${toolName}`}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                {toolDescription}
              </p>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.97]">
                <Upload className="w-4 h-4" />
                Choose File
              </div>
              <p className="mt-3 text-xs text-slate-400">
                or drag and drop • PDF files only
                {maxFiles > 1 ? ` • up to ${maxFiles} files` : ""}
              </p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple={maxFiles > 1}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
