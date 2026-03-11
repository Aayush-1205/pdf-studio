"use client";

import { useCanvasStore, CanvasMode } from "../../store/useCanvasStore";
import { useShallow } from "zustand/react/shallow";
import {
  MousePointer2,
  Square,
  Circle,
  Type,
  Pencil,
  Download,
  Image as ImageIcon,
  Minus,
  ArrowUpRight,
  Loader2,
  CloudUpload,
} from "lucide-react";
import { useState } from "react";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";
import { RenameExportModal } from "../pdf/RenameExportModal";
import { UploadToDriveModal } from "../pdf/UploadToDriveModal";

export default function BottomToolbar() {
  const { mode, setMode } = useCanvasStore(
    useShallow((state) => ({
      mode: state.mode,
      setMode: state.setMode,
    })),
  );
  const worker = usePDFWorker();
  const [isExporting, setIsExporting] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const isPointer =
    mode === CanvasMode.None ||
    mode === CanvasMode.Translating ||
    mode === CanvasMode.SelectionNet ||
    mode === CanvasMode.Resizing;

  const executeExport = async (filename: string) => {
    if (!worker) return;
    setIsExporting(true);
    try {
      const blob = await generateBakedPDF(worker);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error("Export failed", e);
      alert("Export failed: " + e?.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (!worker) return;
    setIsRenameModalOpen(true);
  };

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center justify-center p-2.5 bg-white/80 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 pointer-events-auto transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-20">
      <div className="flex items-center gap-1.5 px-2">
        <ToolbarButton
          icon={<MousePointer2 size={18} />}
          isActive={isPointer}
          onClick={() => setMode(CanvasMode.None)}
          tooltip="Select (V)"
        />
        <div className="w-px h-6 bg-slate-200/80 mx-1.5 rounded-full" />

        {/* Core Shapes */}
        <ToolbarButton
          icon={<Square size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "RECTANGLE"
          }
          onClick={() => setMode(CanvasMode.Inserting, "RECTANGLE")}
          tooltip="Rectangle (R)"
        />
        <ToolbarButton
          icon={<Circle size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "ELLIPSE"
          }
          onClick={() => setMode(CanvasMode.Inserting, "ELLIPSE")}
          tooltip="Ellipse (O)"
        />
        <ToolbarButton
          icon={<Minus size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "LINE"
          }
          onClick={() => setMode(CanvasMode.Inserting, "LINE")}
          tooltip="Line (L)"
        />
        <ToolbarButton
          icon={<ArrowUpRight size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "ARROW"
          }
          onClick={() => setMode(CanvasMode.Inserting, "ARROW")}
          tooltip="Arrow (Shift+L)"
        />
        <ToolbarButton
          icon={<Type size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "TEXT"
          }
          onClick={() => setMode(CanvasMode.Inserting, "TEXT")}
          tooltip="Text (T)"
        />

        <div className="w-px h-6 bg-slate-200/80 mx-1.5 rounded-full" />

        <ToolbarButton
          icon={<ImageIcon size={18} />}
          isActive={
            mode === CanvasMode.Inserting &&
            useCanvasStore.getState().layerType === "IMAGE"
          }
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  useCanvasStore.getState().insertLayer(
                    "IMAGE",
                    0, // Default to first page for floating insert
                    { x: 100, y: 100 },
                    {
                      src: event.target?.result as string,
                      width: 200,
                      height: 200,
                    },
                  );
                };
                reader.readAsDataURL(file);
              }
            };
            input.click();
          }}
          tooltip="Place Image"
        />

        <ToolbarButton
          icon={<Pencil size={18} />}
          isActive={mode === CanvasMode.Pencil}
          onClick={() => setMode(CanvasMode.Pencil)}
          tooltip="Pencil / Draw (P)"
        />
      </div>

      <div className="flex items-center gap-3 pl-5 pr-2 border-l border-slate-200/80 ml-2">
        <button
          onClick={() => setIsUploadModalOpen(true)}
          disabled={!worker}
          className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 border border-slate-200 shadow-sm disabled:opacity-50 hover:shadow-md group text-nowrap"
          title="Upload to Google Drive"
        >
          <CloudUpload
            size={18}
            className="text-emerald-500 group-hover:scale-110 transition-transform duration-300"
          />
          <span className="hidden md:inline">Save to Drive</span>
        </button>

        <button
          onClick={handleExport}
          disabled={isExporting || !worker}
          className="relative overflow-hidden flex items-center gap-2 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 shadow-md shadow-indigo-300/50 hover:shadow-lg hover:shadow-indigo-400/60 disabled:opacity-50 hover:-translate-y-0.5 group"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-full" />
          <div className="relative flex items-center gap-2 text-nowrap">
            {isExporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download
                size={18}
                className="group-hover:-translate-y-0.5 transition-transform duration-300"
              />
            )}
            <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
          </div>
        </button>
      </div>

      <RenameExportModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onExport={executeExport}
      />

      {isUploadModalOpen && (
        <UploadToDriveModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  isActive,
  onClick,
  tooltip,
}: {
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-3 rounded-full flex items-center justify-center transition-all duration-300 group relative ${
        isActive
          ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100/50"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 bg-transparent border border-transparent"
      }`}
    >
      <div
        className={`${!isActive && "group-hover:scale-110"} transition-transform duration-300`}
      >
        {icon}
      </div>
      {isActive && (
        <span className="absolute -bottom-1 w-1 h-1 bg-indigo-500 rounded-full animate-pulse blur-[0.5px]"></span>
      )}
    </button>
  );
}
