"use client";

import { useState, useCallback, useRef } from "react";
import { Navbar } from "@/components/shared/Navbar";
import {
  ArrowLeft,
  Merge,
  Upload,
  FileText,
  X,
  Download,
  Loader2,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";

interface PDFFile {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
}

export default function MergePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [status, setStatus] = useState<"idle" | "merging" | "done">("idle");
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);

  const addFiles = useCallback(async (fileList: FileList) => {
    const newFiles: PDFFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.includes("pdf")) continue;
      const data = await file.arrayBuffer();
      newFiles.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        data,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setMergedBlob(null);
    setStatus("idle");
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setMergedBlob(null);
    setStatus("idle");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleMerge = useCallback(async () => {
    if (files.length < 2) return;
    setStatus("merging");

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const sourcePdf = await PDFDocument.load(file.data);
        const pages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob(
        [
          mergedBytes.buffer.slice(
            mergedBytes.byteOffset,
            mergedBytes.byteOffset + mergedBytes.byteLength,
          ) as ArrayBuffer,
        ],
        { type: "application/pdf" },
      );
      setMergedBlob(blob);
      setStatus("done");
    } catch (e) {
      console.error("Merge failed:", e);
      alert("Failed to merge PDFs. Please check your files and try again.");
      setStatus("idle");
    }
  }, [files]);

  const handleDownload = () => {
    if (!mergedBlob) return;
    const url = URL.createObjectURL(mergedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "merged-document.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

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
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-5">
            <Merge className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
            Merge PDFs
          </h1>
          <p className="text-slate-500 text-lg max-w-md mx-auto">
            Combine multiple PDF files into a single document
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6 animate-scale-in">
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="upload-zone-border rounded-3xl p-10 text-center cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              Add PDF Files
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Drag and drop PDFs here, or click to browse
            </p>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md">
              <Upload className="w-4 h-4" /> Choose Files
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => e.target.files && addFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">
                  {files.length} file{files.length !== 1 && "s"} added
                </h3>
                <span className="text-xs text-slate-400">
                  Files will be merged in order shown
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {files.map((file, i) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatSize(file.size)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
                      className="p-1 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          {files.length >= 2 && status !== "done" && (
            <button
              onClick={handleMerge}
              disabled={status === "merging"}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {status === "merging" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Merging...
                </>
              ) : (
                <>
                  <Merge className="w-5 h-5" /> Merge {files.length} Files
                </>
              )}
            </button>
          )}

          {files.length === 1 && (
            <p className="text-center text-sm text-amber-600 font-medium">
              Add at least one more PDF to merge.
            </p>
          )}

          {/* Done */}
          {status === "done" && mergedBlob && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-scale-in">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-emerald-800 mb-1">
                Merge Complete!
              </h3>
              <p className="text-sm text-emerald-600 mb-4">
                {files.length} files merged • {formatSize(mergedBlob.size)}
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-base font-semibold px-8 py-3 rounded-xl shadow-lg transition-all"
              >
                <Download className="w-5 h-5" /> Download Merged PDF
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
