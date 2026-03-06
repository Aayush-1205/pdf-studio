"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "../../store/useCanvasStore";
import { useShallow } from "zustand/react/shallow";
import { Layers, HardDrive } from "lucide-react";
import { DriveModal } from "../pdf/DriveModal";

export function DocumentStats() {
  const { pages, pdfBytes } = useCanvasStore(
    useShallow((state) => ({
      pages: state.pages,
      pdfBytes: state.pdfBytes,
    })),
  );

  const [mounted, setMounted] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const getFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const estimatedSize = pdfBytes ? pdfBytes.length : 0;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setIsDriveOpen(true)}
        className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border border-blue-200 shadow-sm"
      >
        <HardDrive size={14} className="text-blue-500" />
        Open Drive
      </button>

      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 bg-slate-100/80 px-4 py-1.5 rounded-full border border-slate-200/60 shadow-inner">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span>{pages.length} Pages</span>
        </div>
        <div className="w-[1px] h-4 bg-slate-300"></div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
          <span>{getFileSize(estimatedSize)}</span>
        </div>
      </div>

      <DriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} />
    </div>
  );
}
