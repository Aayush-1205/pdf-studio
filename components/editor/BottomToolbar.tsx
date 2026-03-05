"use client";

import { useCanvasStore, CanvasMode } from "../../store/useCanvasStore";
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
} from "lucide-react";
import { useState } from "react";
import { usePDFWorker } from "../../hooks/usePDFWorker";
import { generateBakedPDF } from "../../hooks/useExportPDF";
import { RenameExportModal } from "../pdf/RenameExportModal";

export default function BottomToolbar() {
  const { mode, setMode } = useCanvasStore();
  const worker = usePDFWorker();
  const [isExporting, setIsExporting] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

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
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center justify-center p-1.5 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 pointer-events-auto">
      <div className="flex items-center gap-1 px-2">
        <ToolbarButton
          icon={<MousePointer2 size={18} />}
          isActive={isPointer}
          onClick={() => setMode(CanvasMode.None)}
          tooltip="Select (V)"
        />
        <div className="w-px h-6 bg-gray-200 mx-1" />

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

        <div className="w-px h-6 bg-gray-200 mx-1" />

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

      <div className="flex items-center gap-2 pl-4 pr-2 border-l border-gray-200 ml-2">
        <button
          onClick={handleExport}
          disabled={isExporting || !worker}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
        </button>
      </div>

      <RenameExportModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onExport={executeExport}
      />
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
      className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 ${
        isActive
          ? "bg-blue-100 text-blue-600 shadow-inner"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}
    </button>
  );
}
