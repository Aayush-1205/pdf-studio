"use client";

import { useState, useCallback, useRef } from "react";
import { Navbar } from "@/components/shared/Navbar";
import {
  ArrowLeft,
  FileDown,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  FileText,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";

export default function CompressPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "compressing" | "done"
  >("idle");
  const [fileName, setFileName] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file || !file.type.includes("pdf")) {
      alert("Please select a valid PDF file.");
      return;
    }

    setFileName(file.name);
    setOriginalSize(file.size);
    setStatus("compressing");

    try {
      const buffer = await file.arrayBuffer();

      // Load and re-save the PDF — pdf-lib strips unused objects,
      // normalizes streams, and removes redundant data
      const pdf = await PDFDocument.load(buffer);

      // Remove metadata to reduce size
      pdf.setTitle("");
      pdf.setAuthor("");
      pdf.setSubject("");
      pdf.setKeywords([]);
      pdf.setProducer("PDF Studio");
      pdf.setCreator("PDF Studio");

      const compressedBytes = await pdf.save({
        useObjectStreams: true, // compress internal objects
      });

      const blob = new Blob(
        [
          compressedBytes.buffer.slice(
            compressedBytes.byteOffset,
            compressedBytes.byteOffset + compressedBytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: "application/pdf" },
      );
      setCompressedBlob(blob);
      setStatus("done");
    } catch (e) {
      console.error("Compress failed:", e);
      alert("Failed to compress PDF. Please try again.");
      setStatus("idle");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownload = () => {
    if (!compressedBlob) return;
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `compressed-${fileName}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleReset = () => {
    setStatus("idle");
    setFileName("");
    setOriginalSize(0);
    setCompressedBlob(null);
  };

  const savingsPercent = compressedBlob
    ? Math.max(0, Math.round((1 - compressedBlob.size / originalSize) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <Navbar />
      <main className="pt-28 pb-20 px-6">
        <div className="max-w-2xl mx-auto mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Tools
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
            <FileDown className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
            Compress PDF
          </h1>
          <p className="text-slate-500 text-lg max-w-md mx-auto">
            Reduce file size while maintaining quality
          </p>
        </div>

        <div className="max-w-2xl mx-auto animate-scale-in">
          {status === "idle" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`upload-zone-border rounded-3xl p-12 text-center cursor-pointer transition-all ${isDragOver ? "border-emerald-500 bg-emerald-50 shadow-xl scale-[1.01]" : "hover:shadow-lg"}`}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {isDragOver ? "Drop your PDF here" : "Upload PDF to Compress"}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                We'll optimize your PDF to reduce file size
              </p>
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-md">
                <Upload className="w-4 h-4" /> Choose File
              </div>
              <p className="mt-3 text-xs text-slate-400">
                or drag and drop • PDF files only
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
                className="hidden"
              />
            </div>
          )}

          {status === "compressing" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-md">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                Compressing…
              </h3>
              <p className="text-sm text-slate-500 truncate max-w-xs mx-auto">
                {fileName}
              </p>
            </div>
          )}

          {status === "done" && compressedBlob && (
            <div className="space-y-6">
              {/* Result Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-8 text-center animate-scale-in">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-emerald-800 mb-3">
                  Compression Complete!
                </h3>

                {/* Size comparison */}
                <div className="flex items-center justify-center gap-4 mb-5">
                  <div className="text-center">
                    <div className="flex items-center gap-1.5 justify-center text-slate-500 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-medium">Original</span>
                    </div>
                    <span className="text-lg font-bold text-slate-700">
                      {formatSize(originalSize)}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-500" />
                  <div className="text-center">
                    <div className="flex items-center gap-1.5 justify-center text-emerald-600 mb-1">
                      <FileDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Compressed</span>
                    </div>
                    <span className="text-lg font-bold text-emerald-700">
                      {formatSize(compressedBlob.size)}
                    </span>
                  </div>
                </div>

                {savingsPercent > 0 ? (
                  <div className="inline-block bg-emerald-100 text-emerald-700 text-sm font-bold px-4 py-1.5 rounded-full mb-5">
                    {savingsPercent}% smaller
                  </div>
                ) : (
                  <div className="inline-block bg-amber-100 text-amber-700 text-sm font-bold px-4 py-1.5 rounded-full mb-5">
                    File is already optimized
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-base font-semibold px-8 py-3 rounded-xl shadow-lg transition-all"
                  >
                    <Download className="w-5 h-5" /> Download
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    Compress Another
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
