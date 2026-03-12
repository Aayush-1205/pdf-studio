"use client";

import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Upload, 
  X, 
  FileText, 
  Loader2, 
  AlertCircle,
  FileUp,
  Files
} from "lucide-react";
import { useCanvasStore, Layer } from "@/store/useCanvasStore";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { extractPdfPages } from "@/app/lib/pdfRender";

interface LocalUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LocalUploadModal({ isOpen, onClose }: LocalUploadModalProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      const store = useCanvasStore.getState();
      store.setPdfBytes(bytes);

      const { pages, layers: extractedLayers } = await extractPdfPages(
        bytes,
        file.name
      );

      store.setPages(pages);

      // Bulk insert extracted text layers
      const newLayersDict: Record<string, Layer> = {};
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

      onClose();
      
      if (!window.location.pathname.includes("/editor")) {
        router.push("/editor?mode=edit");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to process the PDF. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [onClose, router]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-linear-to-b from-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                Upload File
              </h2>
              <p className="text-slate-500 text-xs font-medium">
                Local PDF documents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative group cursor-pointer
              aspect-square sm:aspect-video rounded-2xl border-2 border-dashed
              flex flex-col items-center justify-center gap-4
              transition-all duration-300
              ${isDragging 
                ? "border-indigo-500 bg-indigo-50/50 scale-[0.99] shadow-inner" 
                : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"}
            `}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf"
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-200 blur-xl rounded-full opacity-50 animate-pulse" />
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Processing PDF...</p>
                <p className="text-xs text-slate-400">Extracting pages and text layers</p>
              </div>
            ) : (
              <>
                <div className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center
                  transition-all duration-500
                  ${isDragging 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-200" 
                    : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500"}
                `}>
                  <FileUp size={32} className={isDragging ? "animate-bounce" : ""} />
                </div>
                
                <div className="text-center px-4">
                  <p className="text-base font-bold text-slate-900 mb-1">
                    Click to browse or drag & drop
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Only PDF files are supported
                  </p>
                </div>

                <div className="flex items-center gap-6 mt-2">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100/50 px-2.5 py-1 rounded-full">
                      <Files size={12} />
                      Multi-page ok
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100/50 px-2.5 py-1 rounded-full">
                      <FileText size={12} />
                      OCR support
                   </div>
                </div>
              </>
            )}

            {/* Premium Corner accents */}
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-200 group-hover:border-indigo-300 transition-colors duration-500 rounded-tl-md" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-200 group-hover:border-indigo-300 transition-colors duration-500 rounded-br-md" />
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-sm font-semibold text-red-600 leading-tight">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Secure Local Processing
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
