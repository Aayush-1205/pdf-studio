"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { useCanvasStore } from "../../store/useCanvasStore";
import { extractPdfPages } from "../../app/lib/pdfRender";
import { nanoid } from "nanoid";
import { createPortal } from "react-dom";

interface PreviewPage {
  id: string;
  fileId: string;
  originalIndex: number;
  dataUrl: string;
  selected: boolean;
}

interface SelectedFile {
  id: string;
  file: File;
  name: string;
}

interface MergePDFModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MergePDFModal({ isOpen, onClose }: MergePDFModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;
  if (typeof document === "undefined") return null;

  const handleFilesSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsProcessing(true);
    const newFiles = Array.from(e.target.files);

    try {
      const parsedPages: PreviewPage[] = [];
      const newSelectedFiles: SelectedFile[] = [];

      for (const file of newFiles) {
        const fileId = nanoid();
        newSelectedFiles.push({ id: fileId, file, name: file.name });

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 }); // Low-res for preview thumbnail

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await (page as any).render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

          parsedPages.push({
            id: nanoid(),
            fileId,
            originalIndex: i - 1,
            dataUrl,
            selected: true, // Default to keeping all pages
          });
        }
      }

      setSelectedFiles((prev) => [...prev, ...newSelectedFiles]);
      setPages((prev) => [...prev, ...parsedPages]);
    } catch (err) {
      console.error("Error generating previews:", err);
      alert("Failed to parse one or more PDF files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePageSelection = (pageId: string) => {
    setPages(
      pages.map((p) => (p.id === pageId ? { ...p, selected: !p.selected } : p)),
    );
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(selectedFiles.filter((f) => f.id !== fileId));
    setPages(pages.filter((p) => p.fileId !== fileId));
  };

  const executeMerge = async () => {
    if (pages.filter((p) => p.selected).length === 0) {
      alert("Please select at least one page to merge.");
      return;
    }

    setIsMerging(true);
    try {
      const finalDoc = await PDFDocument.create();

      // We must load each file's PDFDocument to copy pages from it
      for (const fileObj of selectedFiles) {
        // Find selected pages belonging to this file, in order
        const filePages = pages.filter(
          (p) => p.fileId === fileObj.id && p.selected,
        );
        if (filePages.length === 0) continue;

        const originalArrayBuffer = await fileObj.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(originalArrayBuffer);

        const indicesToCopy = filePages.map((p) => p.originalIndex);
        const copiedPages = await finalDoc.copyPages(srcDoc, indicesToCopy);

        copiedPages.forEach((p) => finalDoc.addPage(p));
      }

      const mergedBytes = await finalDoc.save();

      // Push merged document to canvas store
      const store = useCanvasStore.getState();
      store.setPdfBytes(mergedBytes);

      // Re-extract data using a clone of mergedBytes so PDF.js doesn't detach the ArrayBuffer!
      const clonedBytes = new Uint8Array(mergedBytes);
      const { pages: extractedPages, layers: extractedLayers } =
        await extractPdfPages(clonedBytes, "Merged_Document.pdf");
      store.setPages(extractedPages);

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

      onClose(); // Successfully done!
    } catch (err) {
      console.error("Merge execution failed:", err);
      alert("Failed to merge documents.");
    } finally {
      setIsMerging(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Merge PDFs</h2>
            <p className="text-sm text-slate-500">
              Combine multiple files and choose specific pages to keep.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/50">
          {/* File Upload Zone */}
          <div
            className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              accept="application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFilesSelected}
            />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-indigo-600 animate-spin" />
                <p className="text-sm font-semibold text-indigo-900">
                  Generating previews...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900">
                    Click to add PDF files
                  </p>
                  <p className="text-xs text-indigo-500 mt-1">
                    Select one or multiple files from your device
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Files List & Previews */}
          {selectedFiles.length > 0 && (
            <div className="flex flex-col gap-8">
              {selectedFiles.map((fileObj) => {
                const filePages = pages.filter((p) => p.fileId === fileObj.id);
                const selectedCount = filePages.filter(
                  (p) => p.selected,
                ).length;

                return (
                  <div key={fileObj.id} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <div className="flex items-center gap-2">
                        <FileUp size={18} className="text-slate-400" />
                        <h3 className="font-semibold text-slate-800">
                          {fileObj.name}
                        </h3>
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {selectedCount} / {filePages.length} pages
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove File
                      </button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x">
                      {filePages.map((page) => (
                        <div
                          key={page.id}
                          onClick={() => togglePageSelection(page.id)}
                          className={`relative shrink-0 cursor-pointer snap-start rounded-lg overflow-hidden border-2 transition-all ${
                            page.selected
                              ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                              : "border-transparent opacity-50 grayscale hover:grayscale-0"
                          }`}
                        >
                          <img
                            src={page.dataUrl}
                            alt={`Page ${page.originalIndex + 1}`}
                            className="h-48 w-auto object-contain bg-white block pointer-events-none"
                          />

                          {/* Selection Badge */}
                          <div
                            className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                              page.selected
                                ? "bg-indigo-500 text-white"
                                : "bg-white/80 text-transparent"
                            }`}
                          >
                            <CheckCircle2
                              size={16}
                              className={
                                page.selected ? "opacity-100" : "opacity-0"
                              }
                            />
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
                            <span className="text-white text-[10px] font-bold">
                              Page {page.originalIndex + 1}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50/80">
          <span className="text-sm text-slate-500 font-medium">
            Total selected: {pages.filter((p) => p.selected).length} pages
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeMerge}
              disabled={
                isMerging || pages.filter((p) => p.selected).length === 0
              }
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-[0.98]"
            >
              {isMerging && <Loader2 size={16} className="animate-spin" />}
              {isMerging ? "Merging Documents..." : "Merge & Open"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
