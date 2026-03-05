"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

interface RenameExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (filename: string) => void;
}

export function RenameExportModal({
  isOpen,
  onClose,
  onExport,
}: RenameExportModalProps) {
  const [filename, setFilename] = useState("edited_document.pdf");

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-900">Name Your Export</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-500 mb-3 block">
            Please provide a name for your finished PDF.
          </p>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-sm text-slate-800 transition-all shadow-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && filename.trim()) {
                onExport(
                  filename.endsWith(".pdf") ? filename : filename + ".pdf",
                );
                onClose();
              }
            }}
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!filename.trim()) return;
              onExport(
                filename.endsWith(".pdf") ? filename : filename + ".pdf",
              );
              onClose();
            }}
            disabled={!filename.trim()}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-all active:scale-[0.98]"
          >
            Export File
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
