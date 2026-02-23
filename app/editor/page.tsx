"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { usePDFStore } from "@/app/store/usePDFStore";
import { usePDFWorker } from "@/hooks/usePDFWorker";
import { useExportPDF } from "@/hooks/useExportPDF";
import { get } from "idb-keyval";
import {
  MousePointer2,
  Type,
  ImagePlus,
  Highlighter,
  Pencil,
  Eraser,
  RotateCw,
  FilePlus,
  Trash2,
  Undo2,
  Redo2,
  Search,
  Download,
  Save,
  ZoomIn,
  ZoomOut,
  FileText,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";

const PDFViewer = dynamic(
  () =>
    import("@/components/pdf/PDFViewer").then((m) => ({
      default: m.PDFViewer,
    })),
  { ssr: false },
);
const PropertyInspector = dynamic(
  () =>
    import("@/components/pdf/PropertyInspector").then((m) => ({
      default: m.PropertyInspector,
    })),
  { ssr: false },
);
const ThumbnailSidebar = dynamic(
  () =>
    import("@/components/pdf/ThumbnailSidebar").then((m) => ({
      default: m.ThumbnailSidebar,
    })),
  { ssr: false },
);

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    pdfUrl,
    numPages,
    activePage,
    zoom,
    activeTool,
    setActiveTool,
    setZoom,
    setActivePage,
    setNumPages,
    undoStack,
    redoStack,
    undo,
    redo,
    loadFromStorage,
    saveToStorage,
  } = usePDFStore();

  const worker = usePDFWorker();
  const { exportPDF, isExporting } = useExportPDF();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showToolSwitcher, setShowToolSwitcher] = useState(false);
  const [activeMode, setActiveMode] = useState("edit");
  const isTypingRef = useRef(false);

  // ── Read mode from URL or sessionStorage ────────────────────────
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    const storedMode = sessionStorage.getItem("pdf_studio_mode");
    setActiveMode(urlMode || storedMode || "edit");
  }, [searchParams]);

  // ── File guard: redirect to / if no PDF ─────────────────────────
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    // Give a brief moment for loadFromStorage to complete
    const timer = setTimeout(async () => {
      const storedPdf = await get("active_pdf");
      if (!storedPdf && !pdfUrl) {
        router.replace("/");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [pdfUrl, router]);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));

  // ── Page Operations ─────────────────────────────────────────────

  const getPdfBytes = useCallback(async (): Promise<Uint8Array | null> => {
    const storedPdf = await get("active_pdf");
    if (!(storedPdf instanceof Blob)) return null;
    const buffer = await storedPdf.arrayBuffer();
    return new Uint8Array(buffer);
  }, []);

  const handleRotatePage = useCallback(async () => {
    if (!worker || !pdfUrl || isProcessing) return;
    setIsProcessing(true);
    try {
      const bytes = await getPdfBytes();
      if (!bytes) return;
      const result = await worker.rotatePage(bytes, activePage - 1, 90);
      const blob = new Blob([result as unknown as BlobPart], {
        type: "application/pdf",
      });
      await saveToStorage(blob);
    } catch (e) {
      console.error("Rotate failed:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [worker, pdfUrl, activePage, isProcessing, getPdfBytes, saveToStorage]);

  const handleDeletePage = useCallback(async () => {
    if (!worker || !pdfUrl || isProcessing) return;
    if (numPages <= 1) {
      alert("Cannot delete the only page.");
      return;
    }
    setIsProcessing(true);
    try {
      const bytes = await getPdfBytes();
      if (!bytes) return;
      const result = await worker.deletePage(bytes, activePage - 1);
      const blob = new Blob([result as unknown as BlobPart], {
        type: "application/pdf",
      });
      const newPageCount = numPages - 1;
      const newActivePage = Math.min(activePage, newPageCount);
      await saveToStorage(blob);
      setNumPages(newPageCount);
      setActivePage(newActivePage);
    } catch (e) {
      console.error("Delete page failed:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [
    worker,
    pdfUrl,
    activePage,
    numPages,
    isProcessing,
    getPdfBytes,
    saveToStorage,
    setNumPages,
    setActivePage,
  ]);

  const handleAddBlankPage = useCallback(async () => {
    if (!worker || !pdfUrl || isProcessing) return;
    setIsProcessing(true);
    try {
      const bytes = await getPdfBytes();
      if (!bytes) return;
      const result = await worker.insertBlankPage(bytes, activePage - 1);
      const blob = new Blob([result as unknown as BlobPart], {
        type: "application/pdf",
      });
      await saveToStorage(blob);
      setActivePage(activePage + 1);
    } catch (e) {
      console.error("Add page failed:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [
    worker,
    pdfUrl,
    activePage,
    isProcessing,
    getPdfBytes,
    saveToStorage,
    setActivePage,
  ]);

  // ── Export (now bake-aware) ─────────────────────────────────────
  const handleExport = useCallback(async () => {
    await exportPDF();
  }, [exportPDF]);

  // ── Keyboard Shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && e.shiftKey) {
          e.preventDefault();
          redo();
          return;
        }
        if (e.key === "z") {
          e.preventDefault();
          undo();
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          handleExport();
          return;
        }
        if (e.key === "=") {
          e.preventDefault();
          handleZoomIn();
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          handleZoomOut();
          return;
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "t":
          setActiveTool("addText");
          break;
        case "i":
          setActiveTool("addImage");
          break;
        case "h":
          setActiveTool("highlight");
          break;
        case "d":
          setActiveTool("draw");
          break;
        case "e":
          setActiveTool("eraser");
          break;
        case "escape":
          setActiveTool("select");
          break;
        case "f":
          setShowSearch((p) => !p);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, handleExport, setActiveTool]);

  // ── Tool Config ─────────────────────────────────────────────────
  const editorTools = [
    {
      id: "select" as const,
      label: "Select & Edit",
      icon: <MousePointer2 className="w-5 h-5" />,
      shortcut: "V",
    },
    {
      id: "addText" as const,
      label: "Add Text",
      icon: <Type className="w-5 h-5" />,
      shortcut: "T",
    },
    {
      id: "addImage" as const,
      label: "Add Image",
      icon: <ImagePlus className="w-5 h-5" />,
      shortcut: "I",
    },
    {
      id: "highlight" as const,
      label: "Highlight",
      icon: <Highlighter className="w-5 h-5" />,
      shortcut: "H",
    },
    {
      id: "draw" as const,
      label: "Draw",
      icon: <Pencil className="w-5 h-5" />,
      shortcut: "D",
    },
    {
      id: "eraser" as const,
      label: "Eraser",
      icon: <Eraser className="w-5 h-5" />,
      shortcut: "E",
    },
  ];

  const modeLabels: Record<string, string> = {
    edit: "Edit PDF",
    merge: "Merge PDFs",
    compress: "Compress PDF",
    rotate: "Rotate Pages",
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ── Top Header ──────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-40">
        {/* Left: Logo + Mode Switcher */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-800 hidden sm:block">
              PDF Studio
            </span>
          </Link>

          <div className="w-px h-6 bg-slate-200" />

          {/* Tool Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowToolSwitcher(!showToolSwitcher)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {modeLabels[activeMode] || "Edit PDF"}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showToolSwitcher && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                {Object.entries(modeLabels).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setActiveMode(mode);
                      sessionStorage.setItem("pdf_studio_mode", mode);
                      setShowToolSwitcher(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${mode === activeMode ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2 rounded-lg transition-colors ${showSearch ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-100 text-slate-500"}`}
            title="Find (F)"
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            onClick={handleExport}
            disabled={!pdfUrl || isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Baking...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Export
              </>
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={!pdfUrl || isExporting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-lg shadow-md transition-all disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Search Bar ──────────────────────────────────────────── */}
      {showSearch && (
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 z-30">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search text in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            autoFocus
          />
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery("");
            }}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono">
              ESC
            </span>
            Close
          </button>
        </div>
      )}

      {/* ── Main Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page Manager Sidebar */}
        <aside className="w-fit bg-white border-r border-slate-200 overflow-y-auto shrink-0">
          <ThumbnailSidebar />
        </aside>

        {/* Center: Toolbar + Canvas */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Floating Toolbar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg border border-slate-200 px-2 py-1.5 flex items-center gap-0.5 z-20">
            {editorTools.map((tool) => (
              <div key={tool.id} className="relative group">
                <button
                  onClick={() => setActiveTool(tool.id)}
                  className={`p-2.5 rounded-xl transition-all ${activeTool === tool.id ? "bg-indigo-50 text-indigo-600 shadow-sm" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"}`}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  {tool.icon}
                </button>
              </div>
            ))}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <button
              onClick={handleRotatePage}
              disabled={!pdfUrl || isProcessing}
              className="p-2.5 hover:bg-slate-100 text-slate-500 rounded-xl transition-all hover:text-slate-900 disabled:opacity-30"
              title="Rotate Page"
            >
              <RotateCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleAddBlankPage}
              disabled={!pdfUrl || isProcessing}
              className="p-2.5 hover:bg-slate-100 text-slate-500 rounded-xl transition-all hover:text-slate-900 disabled:opacity-30"
              title="Add Page"
            >
              <FilePlus className="w-5 h-5" />
            </button>
            <button
              onClick={handleDeletePage}
              disabled={!pdfUrl || isProcessing}
              className="p-2.5 hover:bg-slate-100 text-red-400 rounded-xl transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              title="Delete Page"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas Container */}
          <div className="flex-1 w-full h-full p-8 flex justify-center items-start overflow-auto">
            <div className="relative mt-16 mb-20 z-10">
              <PDFViewer
                className="bg-white rounded-sm shadow-[0_0_40px_-10px_rgba(0,0,0,0.15)] ring-1 ring-slate-200"
                searchQuery={searchQuery}
              />
            </div>
          </div>

          {/* Bottom Zoom Controls */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-lg border border-slate-200 px-3 py-1.5 flex items-center gap-2 z-30">
            <button
              onClick={handleZoomOut}
              className="text-slate-500 hover:text-slate-800 transition-colors p-1"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-600 w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="text-slate-500 hover:text-slate-800 transition-colors p-1"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Properties Panel */}
        <aside className="w-[280px] bg-white border-l border-slate-200 overflow-y-auto shrink-0">
          <PropertyInspector />
        </aside>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
