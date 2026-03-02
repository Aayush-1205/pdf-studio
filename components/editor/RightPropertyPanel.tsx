"use client";

import { useCanvasStore } from "../../store/useCanvasStore";
import { useEffect } from "react";
import {
  CopyPlus,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GOOGLE_FONTS = [
  "Arial", "Courier New", "Georgia", "Times New Roman", "Verdana",
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald",
  "Source Sans Pro", "Slabo 27px", "Raleway", "PT Sans", "Merriweather",
  "Nunito", "Playfair Display", "Rubik", "Lora", "Work Sans", 
  "Inter", "Poppins", "Ubuntu"
];

export default function RightPropertyPanel() {
  const {
    selection,
    layers,
    updateLayer,
    deleteLayers,
    reorderLayer,
    insertLayer,
  } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        // @ts-ignore
        document.activeElement?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        deleteLayers();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteLayers]);

  if (selection.length !== 1) {
    return (
      <div className="absolute top-16 right-4 w-64 bg-white/90 backdrop-blur-sm border border-gray-200/50 shadow-xl rounded-2xl p-4 text-sm text-gray-400 flex flex-col pointer-events-auto transition-all">
        <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">
          Properties
        </h3>
        <p className="text-xs text-center mt-8 space-y-2">
          <span className="block">
            {selection.length === 0
              ? "Select a layer to edit properties."
              : "Multiple layers selected."}
          </span>
          <span className="block text-gray-300">
            Click and drag shapes to move them. Use corners to resize. Guides
            will snap them into place.
          </span>
        </p>
      </div>
    );
  }

  const activeId = selection[0];
  const activeLayer = layers[activeId];

  if (!activeLayer) return null;

  const handleChange = (key: keyof typeof activeLayer, value: any) => {
    updateLayer(activeId, { [key]: value });
  };

  const handleDuplicate = () => {
    insertLayer(
      activeLayer.type,
      activeLayer.pageIndex,
      { x: activeLayer.x + 20, y: activeLayer.y + 20 },
      activeLayer
    );
  };

  return (
    <div className="absolute top-16 right-4 w-[300px] max-h-[calc(100vh-120px)] bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-2xl rounded-2xl p-5 text-sm pointer-events-auto overflow-y-auto transition-all custom-scrollbar flex flex-col">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-4 border-b pb-3 shrink-0">
        <h3 className="font-semibold text-gray-800 capitalize">
          {activeLayer.type.toLowerCase()}
        </h3>
        <div className="flex items-center gap-1 text-gray-500">
          <button
            onClick={() => reorderLayer(activeId, "up")}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title="Bring Forward"
          >
            <ArrowUpToLine size={14} />
          </button>
          <button
            onClick={() => reorderLayer(activeId, "down")}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title="Send Backward"
          >
            <ArrowDownToLine size={14} />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={handleDuplicate}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title="Duplicate"
          >
            <CopyPlus size={14} />
          </button>
          <button
            onClick={deleteLayers}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 flex-1 pb-4">
        {/* Dimensions Section */}
        <section>
          <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
            Layout bounds
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
              <label className="text-xs text-gray-400 font-medium w-6 text-center">X</label>
              <input
                type="number"
                value={Math.round(activeLayer.x)}
                onChange={(e) => handleChange("x", Number(e.target.value))}
                className="w-full bg-transparent text-gray-700 focus:outline-none text-xs"
              />
            </div>
            <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
              <label className="text-xs text-gray-400 font-medium w-6 text-center">Y</label>
              <input
                type="number"
                value={Math.round(activeLayer.y)}
                onChange={(e) => handleChange("y", Number(e.target.value))}
                className="w-full bg-transparent text-gray-700 focus:outline-none text-xs"
              />
            </div>
            {activeLayer.type !== "PATH" && (
              <>
                <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                  <label className="text-xs text-gray-400 font-medium w-6 text-center">W</label>
                  <input
                    type="number"
                    value={Math.round(activeLayer.width)}
                    onChange={(e) => handleChange("width", Number(e.target.value))}
                    className="w-full bg-transparent text-gray-700 focus:outline-none text-xs"
                  />
                </div>
                <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
                  <label className="text-xs text-gray-400 font-medium w-6 text-center">H</label>
                  <input
                    type="number"
                    value={Math.round(activeLayer.height)}
                    onChange={(e) => handleChange("height", Number(e.target.value))}
                    className="w-full bg-transparent text-gray-700 focus:outline-none text-xs"
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Text Properties */}
        {activeLayer.type === "TEXT" && (
          <section className="pt-2 border-t">
            <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
              Typography
            </h4>
            <div className="flex flex-col gap-3">
              {/* Font Selector via Shadcn */}
              <div className="w-full">
                <Select value={activeLayer.fontFamily || "Inter"} onValueChange={(val) => handleChange("fontFamily", val)}>
                  <SelectTrigger className="w-full h-8 text-xs bg-gray-50 border-gray-100 hover:border-blue-400">
                    <SelectValue placeholder="Select Font" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {GOOGLE_FONTS.map(font => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rich Typography Toggles */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0">
                <button
                  onClick={() => handleChange("isBold", !activeLayer.isBold)}
                  className={`flex-1 p-1.5 flex justify-center hover:bg-gray-100 transition-colors ${activeLayer.isBold ? "bg-gray-200 text-gray-900" : "text-gray-400"}`}
                >
                  <Bold size={14} />
                </button>
                <button
                  onClick={() => handleChange("isItalic", !activeLayer.isItalic)}
                  className={`flex-1 p-1.5 flex justify-center hover:bg-gray-100 transition-colors ${activeLayer.isItalic ? "bg-gray-200 text-gray-900" : "text-gray-400"}`}
                >
                  <Italic size={14} />
                </button>
                <button
                  onClick={() => handleChange("isUnderline", !activeLayer.isUnderline)}
                  className={`flex-1 p-1.5 flex justify-center hover:bg-gray-100 transition-colors ${activeLayer.isUnderline ? "bg-gray-200 text-gray-900" : "text-gray-400"}`}
                >
                  <Underline size={14} />
                </button>
                <button
                  onClick={() => handleChange("isStrikethrough", !activeLayer.isStrikethrough)}
                  className={`flex-1 p-1.5 flex justify-center hover:bg-gray-100 transition-colors ${activeLayer.isStrikethrough ? "bg-gray-200 text-gray-900" : "text-gray-400"}`}
                >
                  <Strikethrough size={14} />
                </button>
              </div>

              {/* Alignment */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden shrink-0">
                {["left", "center", "right", "justify"].map((align) => (
                  <button
                    key={align}
                    onClick={() => handleChange("textAlign", align)}
                    className={`flex-1 p-1.5 flex justify-center hover:bg-gray-100 transition-colors ${activeLayer.textAlign === align ? "bg-gray-200 text-gray-900" : "text-gray-400"}`}
                  >
                    {align === "left" && <AlignLeft size={14} />}
                    {align === "center" && <AlignCenter size={14} />}
                    {align === "right" && <AlignRight size={14} />}
                    {align === "justify" && <AlignJustify size={14} />}
                  </button>
                ))}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-400 font-medium px-1 text-center">Pt Size</label>
                  <input
                    type="number"
                    value={activeLayer.fontSize || 16}
                    onChange={(e) => handleChange("fontSize", Number(e.target.value))}
                    className="w-full bg-gray-50 rounded p-1 border border-gray-100 focus:border-blue-400 focus:outline-none text-xs text-center text-gray-700"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-400 font-medium px-1 text-center">Line Height</label>
                  <input
                    type="number"
                    step="0.1"
                    value={activeLayer.lineHeight || 1.2}
                    onChange={(e) => handleChange("lineHeight", Number(e.target.value))}
                    className="w-full bg-gray-50 rounded p-1 border border-gray-100 focus:border-blue-400 focus:outline-none text-xs text-center text-gray-700"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-gray-400 font-medium px-1 text-center">Spacing</label>
                  <input
                    type="number"
                    step="0.5"
                    value={activeLayer.letterSpacing || 0}
                    onChange={(e) => handleChange("letterSpacing", Number(e.target.value))}
                    className="w-full bg-gray-50 rounded p-1 border border-gray-100 focus:border-blue-400 focus:outline-none text-xs text-center text-gray-700"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Colors */}
        {activeLayer.type !== "PATH" && activeLayer.type !== "IMAGE" && (
          <section className="pt-2 border-t">
            <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
              {activeLayer.type === "TEXT" ? "Text Color Drop" : "Fill"}
            </h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 cursor-pointer relative">
                <input
                  type="color"
                  value={
                    activeLayer.fill !== "transparent"
                      ? activeLayer.fill
                      : "#ffffff"
                  }
                  onChange={(e) => handleChange("fill", e.target.value)}
                  className="absolute inset-[-10px] w-12 h-12 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={activeLayer.fill}
                onChange={(e) => handleChange("fill", e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 rounded-lg px-3 py-1.5 focus:outline-none font-mono text-[11px] uppercase"
              />
              <button
                title="Make transparent"
                onClick={() => handleChange("fill", "transparent")}
                className={`p-1.5 rounded-lg border ${activeLayer.fill === "transparent" ? "border-blue-500 text-blue-500 bg-blue-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
              >
                ✕
              </button>
            </div>
          </section>
        )}

        {/* Stroke Section for anything that's not text/image */}
        {activeLayer.type !== "IMAGE" && activeLayer.type !== "TEXT" && (
          <section className="pt-2 border-t">
            <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
              Stroke
            </h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0 cursor-pointer relative">
                <input
                  type="color"
                  value={
                    activeLayer.stroke !== "transparent"
                      ? activeLayer.stroke
                      : "#000000"
                  }
                  onChange={(e) => handleChange("stroke", e.target.value)}
                  className="absolute inset-[-10px] w-12 h-12 cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={activeLayer.stroke}
                onChange={(e) => handleChange("stroke", e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 rounded-lg px-3 py-1.5 focus:outline-none font-mono text-[11px] uppercase"
              />
              <button
                title="Make transparent"
                onClick={() => handleChange("stroke", "transparent")}
                className={`p-1.5 rounded-lg border ${activeLayer.stroke === "transparent" ? "border-blue-500 text-blue-500 bg-blue-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
              >
                ✕
              </button>
            </div>
          </section>
        )}
        
        {/* Background Color Mask for Text */}
        {activeLayer.type === "TEXT" && (
          <section className="pt-2 border-t">
            <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">
              Text Mask Background
            </h4>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0 cursor-pointer relative bg-checkered">
                <input
                  type="color"
                  value={
                    activeLayer.sampledBackgroundColor && activeLayer.sampledBackgroundColor !== "transparent"
                      ? activeLayer.sampledBackgroundColor
                      : "#ffffff"
                  }
                  onChange={(e) => handleChange("sampledBackgroundColor", e.target.value)}
                  className="absolute inset-[-10px] w-12 h-12 cursor-pointer opacity-0"
                  style={{ opacity: (!activeLayer.sampledBackgroundColor || activeLayer.sampledBackgroundColor === "transparent") ? 0 : 1 }}
                />
                {(!activeLayer.sampledBackgroundColor || activeLayer.sampledBackgroundColor === "transparent") && (
                  <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center text-red-500">✕</div>
                )}
              </div>
              <input
                type="text"
                value={(!activeLayer.sampledBackgroundColor || activeLayer.sampledBackgroundColor === "transparent") ? "None" : activeLayer.sampledBackgroundColor}
                onChange={(e) => handleChange("sampledBackgroundColor", e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 rounded-lg px-3 py-1.5 focus:outline-none font-mono text-[11px] uppercase"
              />
              <button
                title="Remove mask"
                onClick={() => handleChange("sampledBackgroundColor", "transparent")}
                className={`p-1.5 rounded-lg border ${(!activeLayer.sampledBackgroundColor || activeLayer.sampledBackgroundColor === "transparent") ? "border-blue-500 text-blue-500 bg-blue-50" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
              >
                ✕
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-2 leading-tight">
              A solid color drawn exactly behind the text to mask original PDF artifacts.
            </p>
          </section>
        )}

        {/* Opacity */}
        <section className="pt-2 border-t mt-auto">
          <h4 className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3 text-red">
            Opacity
          </h4>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={activeLayer.opacity || 100}
              onChange={(e) => handleChange("opacity", Number(e.target.value))}
              className="w-full cursor-pointer accent-blue-500"
            />
            <span className="text-[11px] font-mono text-gray-600 w-8">
              {Math.round(activeLayer.opacity || 100)}%
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
