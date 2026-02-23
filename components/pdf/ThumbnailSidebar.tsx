"use client";

import { useEffect, useState } from "react";
import { usePDFStore } from "@/app/store/usePDFStore";
import * as pdfjsLib from "pdfjs-dist";

// Initialize PDF.js worker using relative path instead of CDN to avoid Next.js Turbopack fetch errors
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, PlusCircle, GripVertical } from "lucide-react";

interface SortableThumbnailProps {
  id: string;
  thumbUrl: string;
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}

function SortableThumbnail({
  id,
  thumbUrl,
  pageNum,
  isActive,
  onClick,
}: SortableThumbnailProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center p-3 rounded-xl transition-all cursor-default ${
        isActive
          ? "bg-blue-50/80 ring-1 ring-blue-500/30 shadow-sm"
          : "hover:bg-slate-100/80"
      }`}
    >
      <div
        className="mr-3 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors p-1"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div
        className={`relative w-[90px] aspect-[1/1.4] bg-white shadow-sm border rounded-md overflow-hidden flex items-center justify-center cursor-pointer shrink-0 transition-colors ${isActive ? "border-blue-400 shadow-md shadow-blue-500/10" : "border-slate-200 group-hover:border-slate-300"}`}
        onClick={onClick}
      >
        <img
          src={thumbUrl}
          alt={`Page ${pageNum}`}
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
      </div>
      <div
        className="flex flex-col ml-3 flex-1 h-full justify-center"
        onClick={onClick}
      >
        <span
          className={`text-[13px] font-semibold ${isActive ? "text-blue-700" : "text-slate-600 group-hover:text-slate-900"}`}
        >
          Page {pageNum}
        </span>
      </div>
    </div>
  );
}

export function ThumbnailSidebar() {
  const { pdfUrl, numPages, activePage, setActivePage } = usePDFStore();
  const [thumbnails, setThumbnails] = useState<{ id: string; url: string }[]>(
    [],
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!pdfUrl || numPages === 0) return;

    let isMounted = true;
    setIsGenerating(true);

    const generateThumbnails = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (isMounted) {
          setThumbnails([]); // Clear existing first
        }

        const BATCH_SIZE = 3;
        let currentBatch: { id: string; url: string }[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (!isMounted) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;

          currentBatch.push({
            id: `page-${i}`,
            url: canvas.toDataURL("image/jpeg", 0.8),
          });

          // Process in batches to prevent UI thread blocking
          if (currentBatch.length >= BATCH_SIZE || i === numPages) {
            if (isMounted) {
              // Capture the current batch so it can be safely used in the setState callback
              const batchToUpdate = [...currentBatch];
              setThumbnails((prev) => [...prev, ...batchToUpdate]);
              currentBatch = [];

              // Yield to event loop to allow React to render and UI to stay responsive
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }
      } catch (error: unknown) {
        // Silently ignore render cancellations (expected during re-renders)
        const errName = (error as { name?: string })?.name;
        if (errName === "RenderingCancelledException") return;
        console.error("Error generating thumbnails:", error);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    generateThumbnails();

    return () => {
      isMounted = false;
    };
  }, [pdfUrl, numPages]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setThumbnails((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // TODO: Propagate this order change to PDFStore / PDF-Lib worker logic
    }
  };

  if (!pdfUrl) {
    return (
      <aside className="w-72 border-r border-slate-200 bg-white/50 backdrop-blur-md hidden md:flex shrink-0 overflow-y-auto flex-col z-10">
        <div className="p-5 border-b border-slate-100 bg-white">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" /> Page Manager
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
          <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            No Document
          </p>
          <p className="text-[13px] text-slate-500 leading-relaxed max-w-[200px]">
            Upload a PDF file to view and manage its pages here.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-r border-slate-200 bg-white hidden md:flex shrink-0 flex-col h-full z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="p-5 border-b border-slate-100 bg-white shrink-0 flex justify-between items-center">
        <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> Pages{" "}
          <span className="text-slate-400 font-medium">({numPages})</span>
        </h2>
      </div>

      <div className="p-4 overflow-y-auto flex-1 h-full scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {isGenerating && thumbnails.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={thumbnails.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 pb-6">
                {thumbnails.map((thumb) => {
                  const originalPageNum = parseInt(thumb.id.split("-")[1]);
                  const isActive = activePage === originalPageNum;

                  return (
                    <SortableThumbnail
                      key={thumb.id}
                      id={thumb.id}
                      thumbUrl={thumb.url}
                      pageNum={originalPageNum}
                      isActive={isActive}
                      onClick={() => setActivePage(originalPageNum)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Page count */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 shrink-0 text-center">
        <span className="text-xs font-medium text-slate-500">
          {numPages} {numPages === 1 ? "page" : "pages"}
        </span>
      </div>
    </aside>
  );
}
