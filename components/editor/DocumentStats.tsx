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
        className="flex items-center gap-2 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-[14px] text-xs font-bold transition-all duration-300 border border-indigo-200/50 shadow-sm group"
      >
        <HardDrive size={14} className="text-indigo-500 group-hover:scale-110 transition-transform duration-300" />
        Open Drive
      </button>

      <div className="flex items-center gap-4 text-xs font-bold text-slate-500 bg-white/50 px-4 py-2 rounded-[14px] border border-slate-200/50 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-500 drop-shadow-sm" />
          <span>{pages.length} Pages</span>
        </div>
        <div className="w-px h-4 bg-slate-300/80"></div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-4 h-4 text-emerald-500 drop-shadow-sm" />
          <span>{getFileSize(estimatedSize)}</span>
        </div>
      </div>

      <DriveModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} />
    </div>
  );
}
