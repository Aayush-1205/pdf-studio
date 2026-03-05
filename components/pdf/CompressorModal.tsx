"use client";

import React, { useRef, useState } from "react";
import { X, Upload, FileArchive, Loader2, ArrowRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useCompressorStore } from "../../store/useCompressorStore";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";

/** Route a method call through the worker's postMessage dispatch protocol. */
function invokeWorker<T = unknown>(
  worker: Worker,
  method: string,
  args: unknown[],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2, 9);
    const onMessage = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", onMessage);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.result as T);
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ id, method, args });
  });
}

// Format bytes to MB/KB helper
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
    isCompressing,
    setCompressionStatus,
    originalSize,
    compressedSize,
    setStats,
  } = useCompressorStore();

  const [activeTab, setActiveTab] = useState<"current" | "external">("current");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const worker = usePDFWorker();

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const triggerDownload = (bytes: Uint8Array, name: string) => {
    const blob = new Blob([bytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCompressCurrent = async () => {
    if (!worker) return;
    setCompressionStatus(true);
    try {
      // 1. Generate the latest PDF buffer of the active editor
      const rawPdfBlob = await generateBakedPDF(worker);
      const originalLen = rawPdfBlob.size;

      const arrayBuffer = await rawPdfBlob.arrayBuffer();
      const rawPdfBytes = new Uint8Array(arrayBuffer);

      // Route through postMessage dispatch (worker is NOT a Comlink proxy)
      const compressedBytes = await invokeWorker<Uint8Array>(
        worker,
        "compressPdf",
        [rawPdfBytes, compressionLevel],
      );
      setStats(originalLen, compressedBytes.byteLength);

      // 3. Download
      triggerDownload(compressedBytes, "compressed_document.pdf");
    } catch (e: any) {
      console.error(e);
      alert("Failed to compress document.");
    } finally {
      setCompressionStatus(false);
    }
  };

  const handleCompressExternal = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !worker) return;
    setCompressionStatus(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Route through postMessage dispatch (worker is NOT a Comlink proxy)
      const compressedBytes = await invokeWorker<Uint8Array>(
        worker,
        "compressPdf",
        [bytes, compressionLevel],
      );
      setStats(file.size, compressedBytes.byteLength);

      triggerDownload(compressedBytes, `compressed_${file.name}`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to compress document.");
    } finally {
      setCompressionStatus(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileArchive size={20} className="text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Extreme PDF Compressor
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 bg-slate-50/50">
          {/* Quality Picker */}
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Compression Level
            </label>
            <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0 bg-white">
              {["LOW", "MEDIUM", "EXTREME"].map((level) => (
                <button
                  key={level}
                  onClick={() => setCompressionLevel(level as any)}
                  className={`flex-1 py-2 text-xs font-bold transition-colors ${
                    compressionLevel === level
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {compressionLevel === "LOW" &&
                "Retains good visual quality, moderate file size reduction."}
              {compressionLevel === "MEDIUM" &&
                "Great balance of size and legibility. Recommended."}
              {compressionLevel === "EXTREME" &&
                "Massive file size reduction via aggressive 0.2x rasterization. Will look blurry."}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("current")}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "current"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Current Document
            </button>
            <button
              onClick={() => setActiveTab("external")}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "external"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              External File
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[140px] flex flex-col items-center justify-center text-center">
            {activeTab === "current" ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-slate-600">
                  Compress the PDF currently open in your editor, including all
                  unsaved layers and edits.
                </p>
                <button
                  onClick={handleCompressCurrent}
                  disabled={isCompressing || !worker}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 rounded-xl shadow-md transition-all"
                >
                  {isCompressing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileArchive size={16} />
                  )}
                  {isCompressing
                    ? "Crushing PDF..."
                    : "Compress Active Editor PDF"}
                </button>
              </div>
            ) : (
              <div
                className="w-full border-2 border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl p-8 cursor-pointer transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleCompressExternal}
                  disabled={isCompressing}
                />
                <div className="flex flex-col items-center gap-3">
                  {isCompressing ? (
                    <Loader2
                      size={32}
                      className="text-indigo-600 animate-spin"
                    />
                  ) : (
                    <Upload size={32} className="text-slate-400" />
                  )}
                  <p className="text-sm font-bold text-slate-700">
                    {isCompressing
                      ? "Compressing File..."
                      : "Upload PDF to Compress"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Will instantly compress and download.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          {compressedSize > 0 && !isCompressing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between animate-fade-in-up">
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Original
                </span>
                <span className="text-sm font-mono text-slate-700">
                  {formatBytes(originalSize)}
                </span>
              </div>
              <ArrowRight size={16} className="text-green-500" />
              <div className="flex flex-col gap-1 items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Compressed
                </span>
                <span className="text-lg font-black font-mono text-green-600">
                  {formatBytes(compressedSize)}
                </span>
              </div>
              <div className="h-10 w-px bg-green-200 mx-2" />
              <div className="flex flex-col gap-1 items-center text-green-700">
                <span className="text-[10px] uppercase font-bold">Saved</span>
                <span className="text-sm font-black">
                  {((1 - compressedSize / originalSize) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
