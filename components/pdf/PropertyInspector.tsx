"use client";

import { useState, useCallback, useRef } from "react";
import { usePDFStore } from "@/app/store/usePDFStore";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { get } from "idb-keyval";
import {
  Settings2,
  Type,
  Image as ImageIcon,
  Trash2,
  Upload,
  Check,
  X,
  Move,
  Palette,
} from "lucide-react";

export function PropertyInspector() {
  const {
    pdfUrl,
    selectedTextItem,
    selectedImage,
    selectedNewTextId,
    selectedNewImageId,
    newTextItems,
    newImageItems,
    updateNewTextItem,
    updateNewImageItem,
    removeNewTextItem,
    removeNewImageItem,
    clearSelection,
    setSelectedTextItem,
    saveToStorage,
    activePage,
    customFont,
    setCustomFont,
  } = usePDFStore();

  const worker = usePDFWorker();
  const [editingText, setEditingText] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [textInitialized, setTextInitialized] = useState<string | null>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Handle custom font upload
  const handleFontUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      setCustomFont({ name: file.name, buffer });
    },
    [setCustomFont],
  );

  // Initialize text editor when a text item is selected
  if (selectedTextItem && textInitialized !== selectedTextItem.id) {
    setEditingText(selectedTextItem.str);
    setTextInitialized(selectedTextItem.id);
  }

  // ── Helper: get PDF bytes ──────────────────────────────────────

  const getPdfBytes = useCallback(async (): Promise<Uint8Array | null> => {
    const storedPdf = await get("active_pdf");
    if (!(storedPdf instanceof Blob)) return null;
    const buffer = await storedPdf.arrayBuffer();
    return new Uint8Array(buffer);
  }, []);

  // ── Apply text replacement ─────────────────────────────────────

  const handleApplyTextEdit = useCallback(async () => {
    if (!selectedTextItem || !worker || isApplying) return;
    setIsApplying(true);

    try {
      const bytes = await getPdfBytes();
      if (!bytes) return;

      const tx = selectedTextItem.transform;
      const pdfX = tx[4];
      const pdfY = tx[5];
      const fontSize = selectedTextItem.fontSize;

      // Tight white-out rect: just enough to cover this text item
      const leftPad = 3; // minimal left extension
      const rightPad = 4;
      const topPad = fontSize * 0.15; // slight ascender coverage
      const bottomPad = fontSize * 0.2; // slight descender coverage

      const result = await worker.replaceText(
        bytes,
        selectedTextItem.pageIndex,
        {
          x: pdfX - leftPad,
          y: pdfY - bottomPad,
          width: selectedTextItem.width + leftPad + rightPad,
          height: fontSize + topPad + bottomPad,
        },
        editingText,
        selectedTextItem.fontName,
        fontSize,
        { r: 0, g: 0, b: 0 },
      );

      const blob = new Blob([result as unknown as BlobPart], {
        type: "application/pdf",
      });
      await saveToStorage(blob);
      setSelectedTextItem(null);
      setTextInitialized(null);
    } catch (e) {
      console.error("Text replacement failed:", e);
    } finally {
      setIsApplying(false);
    }
  }, [
    selectedTextItem,
    worker,
    editingText,
    isApplying,
    getPdfBytes,
    saveToStorage,
    setSelectedTextItem,
  ]);

  // ── Delete Image ───────────────────────────────────────────────

  const handleDeleteImage = useCallback(async () => {
    if (!selectedImage || !worker || isApplying) return;
    setIsApplying(true);
    try {
      const bytes = await getPdfBytes();
      if (!bytes) return;

      const newBytes = await worker.deleteImage(
        bytes,
        selectedImage.pageIndex,
        {
          x: selectedImage.x,
          y: selectedImage.y,
          width: selectedImage.width,
          height: selectedImage.height,
        },
      );

      const blob = new Blob([newBytes as unknown as BlobPart], {
        type: "application/pdf",
      });
      await saveToStorage(blob);
      clearSelection();
    } catch (e) {
      console.error("Image delete failed:", e);
    } finally {
      setIsApplying(false);
    }
  }, [
    selectedImage,
    worker,
    isApplying,
    getPdfBytes,
    saveToStorage,
    clearSelection,
  ]);

  // ── Replace Image ──────────────────────────────────────────────

  const handleReplaceImage = useCallback(async () => {
    if (!selectedImage || !worker || isApplying) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg";
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsApplying(true);
      try {
        const bytes = await getPdfBytes();
        if (!bytes) return;

        const imageBuffer = await file.arrayBuffer();
        const imageBytes = new Uint8Array(imageBuffer);
        const imageType = file.type.includes("png")
          ? ("png" as const)
          : ("jpg" as const);

        const newBytes = await worker.replaceImage(
          bytes,
          selectedImage.pageIndex,
          {
            x: selectedImage.x,
            y: selectedImage.y,
            width: selectedImage.width,
            height: selectedImage.height,
          },
          imageBytes,
          imageType,
        );

        const blob = new Blob([newBytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        await saveToStorage(blob);
        clearSelection();
      } catch (e) {
        console.error("Image replace failed:", e);
      } finally {
        setIsApplying(false);
      }
    };
    input.click();
  }, [
    selectedImage,
    worker,
    isApplying,
    getPdfBytes,
    saveToStorage,
    clearSelection,
  ]);

  // ── Get selected new items ─────────────────────────────────────

  const selectedNewText = newTextItems.find((t) => t.id === selectedNewTextId);
  const selectedNewImage = newImageItems.find(
    (i) => i.id === selectedNewImageId,
  );

  // ── Empty state ────────────────────────────────────────────────

  if (!pdfUrl) {
    return (
      <aside className="w-80 border-l border-slate-200 bg-white/50 backdrop-blur-md hidden lg:flex flex-col shrink-0 overflow-y-auto z-10">
        <div className="p-5 border-b border-slate-100 bg-white">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" /> Properties
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Settings2 className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 max-w-[200px] leading-relaxed">
            Upload a PDF to start editing
          </p>
        </div>
      </aside>
    );
  }

  // Determine what panel to show
  const hasSelection =
    selectedTextItem || selectedImage || selectedNewText || selectedNewImage;

  return (
    <aside className="w-fit border-l border-slate-200 bg-white hidden lg:flex flex-col shrink-0 h-full z-10 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="p-5 border-b border-slate-100 bg-white shrink-0 flex justify-between items-center">
        <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-500" /> Properties
        </h2>
        {hasSelection && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
            {selectedTextItem
              ? "Text"
              : selectedImage
                ? "Image"
                : selectedNewText
                  ? "New Text"
                  : "New Image"}
          </span>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="p-5 overflow-y-auto flex-1 h-full">
        {/* ── Editing Existing Text ─────────────────────────────── */}
        {selectedTextItem && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> Edit Text
              </label>
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[120px] shadow-sm transition-all font-mono"
                placeholder="Edit text content..."
              />
            </div>

            <div className="h-px bg-slate-100" />

            {/* Font Info (read-only) */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Detected Font
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Font</span>
                  <span className="font-medium text-slate-700 truncate max-w-[160px]">
                    {selectedTextItem.fontName}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Size</span>
                  <span className="font-medium text-slate-700">
                    {Math.round(selectedTextItem.fontSize)}px
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                The replacement text will use the closest matching standard font
                to preserve the document&apos;s appearance.
              </p>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Apply / Cancel */}
            <div className="flex gap-2">
              <button
                onClick={handleApplyTextEdit}
                disabled={isApplying || editingText === selectedTextItem.str}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Apply Changes
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  clearSelection();
                  setTextInitialized(null);
                }}
                className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Editing Existing Image ────────────────────────────── */}
        {selectedImage && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Image
              </label>
              {selectedImage.thumbnailDataUrl ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedImage.thumbnailDataUrl}
                    alt="Selected image"
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Width</span>
                <span className="font-medium text-slate-700">
                  {Math.round(selectedImage.width)}px
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Height</span>
                <span className="font-medium text-slate-700">
                  {Math.round(selectedImage.height)}px
                </span>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div className="space-y-2">
              <button
                onClick={handleReplaceImage}
                disabled={isApplying}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-40"
              >
                <Upload className="w-4 h-4" /> Replace Image
              </button>
              <button
                onClick={handleDeleteImage}
                disabled={isApplying}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> Delete Image
              </button>
            </div>
          </div>
        )}

        {/* ── Editing New Text Item ─────────────────────────────── */}
        {selectedNewText && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> New Text
              </label>
              <textarea
                value={selectedNewText.text}
                onChange={(e) =>
                  updateNewTextItem(selectedNewText.id, {
                    text: e.target.value,
                  })
                }
                className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none min-h-[100px] shadow-sm transition-all"
                placeholder="Enter text..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Typography
              </label>
              <select
                value={selectedNewText.fontFamily}
                onChange={(e) =>
                  updateNewTextItem(selectedNewText.id, {
                    fontFamily: e.target.value,
                  })
                }
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 shadow-sm cursor-pointer"
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier">Courier</option>
                <option value="Arial">Arial</option>
                {customFont && (
                  <option value={customFont.name}>✨ {customFont.name}</option>
                )}
              </select>

              {/* Custom Font Upload */}
              <div className="space-y-1.5">
                <input
                  ref={fontInputRef}
                  type="file"
                  accept=".ttf,.otf"
                  className="hidden"
                  onChange={handleFontUpload}
                />
                <button
                  onClick={() => fontInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {customFont
                    ? `Font: ${customFont.name}`
                    : "Upload Custom Font (.ttf)"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">
                    Size
                  </label>
                  <input
                    type="number"
                    value={selectedNewText.fontSize}
                    onChange={(e) =>
                      updateNewTextItem(selectedNewText.id, {
                        fontSize: Number(e.target.value) || 12,
                      })
                    }
                    className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">
                    Color
                  </label>
                  <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 pr-3 shadow-sm">
                    <div className="relative w-6 h-6 rounded-md overflow-hidden ring-1 ring-slate-200 shrink-0">
                      <input
                        type="color"
                        value={selectedNewText.color}
                        onChange={(e) =>
                          updateNewTextItem(selectedNewText.id, {
                            color: e.target.value,
                          })
                        }
                        className="absolute inset-[-10px] w-[50px] h-[50px] cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 uppercase">
                      {selectedNewText.color}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
              <Move className="w-4 h-4 shrink-0" />
              <span>Drag this element on the canvas to reposition</span>
            </div>

            <div className="h-px bg-slate-100" />

            <button
              onClick={() => {
                removeNewTextItem(selectedNewText.id);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-semibold hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Remove Text
            </button>
          </div>
        )}

        {/* ── Editing New Image Item ────────────────────────────── */}
        {selectedNewImage && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Placed Image
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedNewImage.dataUrl}
                  alt="New image"
                  className="w-full h-auto rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Width
                </label>
                <input
                  type="number"
                  value={selectedNewImage.width}
                  onChange={(e) =>
                    updateNewImageItem(selectedNewImage.id, {
                      width: Number(e.target.value) || 100,
                    })
                  }
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">
                  Height
                </label>
                <input
                  type="number"
                  value={selectedNewImage.height}
                  onChange={(e) =>
                    updateNewImageItem(selectedNewImage.id, {
                      height: Number(e.target.value) || 100,
                    })
                  }
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
              <Move className="w-4 h-4 shrink-0" />
              <span>Drag this element on the canvas to reposition</span>
            </div>

            <div className="h-px bg-slate-100" />

            <button
              onClick={() => removeNewImageItem(selectedNewImage.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-semibold hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Remove Image
            </button>
          </div>
        )}

        {/* ── Nothing selected ──────────────────────────────────── */}
        {!hasSelection && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Palette className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-2">
              No Element Selected
            </p>
            <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
              Click on text or images in the PDF to edit them, or use the
              toolbar to add new content.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
