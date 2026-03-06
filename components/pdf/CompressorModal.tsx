"use client";

import React, { useRef, useState, useEffect } from "react";
import { X, Upload, FileArchive, Loader2, ArrowRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useCompressorStore } from "../../store/useCompressorStore";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";
import * as pdfjs from "pdfjs-dist";
import { wrap } from "comlink";

// Set up pdf.js worker for the Main Thread
// Using the same version as in package.json/pdf.worker.ts for consistency
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const COMPRESSION_PROFILES = {
  LOW: { scale: 1.5, quality: 0.8 },
  MEDIUM: { scale: 1.0, quality: 0.5 },
  EXTREME: { scale: 0.7, quality: 0.2 },
};

// Helper to yield the main thread so the UI doesn't freeze
const yieldToUI = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));

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
    progress,
    setCompressionStatus,
    originalSize,
    compressedSize,
    setStats,
  } = useCompressorStore();

  const [activeTab, setActiveTab] = useState<"current" | "external">("current");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorWorker = usePDFWorker();
  const assemblerWorkerRef = useRef<any>(null);

  useEffect(() => {
    if (!assemblerWorkerRef.current) {
      const worker = new Worker(
        new URL("../../workers/pdfAssembler.worker.ts", import.meta.url),
        { type: "module" },
      );
      assemblerWorkerRef.current = wrap(worker);
    }
  }, []);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const performCompression = async (
    arrayBuffer: ArrayBuffer,
    fileName: string,
  ) => {
    const profile = COMPRESSION_PROFILES[compressionLevel];
    setCompressionStatus(true, 0);

    try {
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer.slice(0) });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const extractedPages = [];

      // 1. Extract and Compress Pages on the Main Thread page-by-page
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: profile.scale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await page.render({ canvas, viewport }).promise;

          // Crush into optimized JPEG Base64
          const base64 = canvas.toDataURL("image/jpeg", profile.quality);
          extractedPages.push({
            base64,
            width: viewport.width,
            height: viewport.height,
          });
        }

        // Garbage collection for pdf.js page
        page.cleanup();

        // Update progress (50% for rasterization)
        setCompressionStatus(true, Math.round((i / numPages) * 50));

        // Let the browser breathe and update the UI
        await yieldToUI();
      }

      // Garbage collect full PDF document
      pdf.destroy();

      // 2. Offload Assembly to Web Worker (Comlink)
      setCompressionStatus(true, 75); // Indicates "Assembling..."
      const compressedBytes =
        await assemblerWorkerRef.current.buildCompressedPdf(extractedPages);

      setCompressionStatus(true, 100);
      setStats(arrayBuffer.byteLength, compressedBytes.byteLength);

      // 3. Trigger Download
      const blob = new Blob([compressedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compressed_${fileName}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Compression failed:", error);
      alert("Failed to compress PDF. The file might be corrupted.");
    } finally {
      setCompressionStatus(false, 0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCompressCurrent = async () => {
    if (!editorWorker) return;
    try {
      const rawPdfBlob = await generateBakedPDF(editorWorker);
      const arrayBuffer = await rawPdfBlob.arrayBuffer();
      await performCompression(arrayBuffer, "document.pdf");
    } catch (e: any) {
      console.error(e);
      alert("Failed to generate editor PDF.");
    }
  };

  const handleCompressExternal = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    await performCompression(arrayBuffer, file.name);
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileArchive size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Extreme PDF Compressor
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 bg-white">
          {/* Quality Picker */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 block">
              Compression Level
            </label>
            <div className="flex p-1 bg-slate-100 rounded-xl shrink-0">
              {["LOW", "MEDIUM", "EXTREME"].map((level) => (
                <button
                  key={level}
                  onClick={() => setCompressionLevel(level as any)}
                  disabled={isCompressing}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    compressionLevel === level
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  } disabled:opacity-50`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">💡</span>
              {compressionLevel === "LOW" &&
                "Retains good visual quality, moderate file size reduction."}
              {compressionLevel === "MEDIUM" &&
                "Great balance of size and legibility. Recommended."}
              {compressionLevel === "EXTREME" &&
                "Massive file size reduction via aggressive 0.7x scale + 0.2 quality. Perfect for email attachments."}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex border-b border-slate-100">
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
          <div className="min-h-[160px] flex flex-col items-center justify-center text-center">
            {isCompressing ? (
              <div className="w-full space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-indigo-100 flex items-center justify-center">
                      <Loader2
                        size={24}
                        className="text-indigo-600 animate-spin"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      {progress < 75
                        ? "Rasterizing Pages..."
                        : "Assembling PDF..."}
                    </p>
                    <p className="text-xs text-slate-500">
                      {progress < 75
                        ? "Converting pages to optimized images"
                        : "Creating your new compressed file"}
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-[240px] mx-auto space-y-2">
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
            ) : activeTab === "current" ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-slate-600 leading-relaxed px-4">
                  Compress the PDF currently open in your editor, including all
                  unsaved layers and edits.
                </p>
                <button
                  onClick={handleCompressCurrent}
                  disabled={!editorWorker}
                  className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  <FileArchive size={18} />
                  Compress Editor PDF
                </button>
              </div>
            ) : (
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
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                    <Upload
                      size={24}
                      className="text-slate-400 group-hover:text-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">
                      Upload PDF to Compress
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Click to browse or drag and drop
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          {compressedSize > 0 && !isCompressing && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between animate-fade-in-up">
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
                  {Math.round((1 - compressedSize / originalSize) * 100)}%
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
