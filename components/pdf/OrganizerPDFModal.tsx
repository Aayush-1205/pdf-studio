"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  LayoutGrid,
  RotateCcw,
  Check,
  Loader2,
  Trash2,
  Maximize2,
  ZoomIn,
} from "lucide-react";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useCanvasStore, Page } from "../../store/useCanvasStore";
import { SortablePageThumbnail } from "./SortablePageThumbnail";

// Reuse ZoomPreview from MergePDFModal if possible, or create a similar one.
// Since MergePDFModal is quite large, I'll define a local one for now 
// but in a real project we should extract this to a shared component.

function ZoomPreview({
  page,
  onClose,
}: {
  page: Page;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-md p-8 animate-in fade-in zoom-in-95 duration-200 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full flex items-center justify-center">
        {page.backgroundUrl ? (
          <img
            src={page.backgroundUrl}
            alt="Page Preview"
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm pointer-events-none"
          />
        ) : (
          <div className="text-white">No preview available</div>
        )}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
}

interface OrganizerPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrganizerPDFModal({ isOpen, onClose }: OrganizerPDFModalProps) {
  const { pages: initialPages, setPages } = useCanvasStore();
  const [localPages, setLocalPages] = useState<Page[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoomPage, setZoomPage] = useState<Page | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLocalPages([...initialPages]);
      setSelectedIds(new Set());
    }
  }, [isOpen, initialPages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalPages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const reverseOrder = () => {
    setLocalPages((prev) => [...prev].reverse());
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} page(s)?`)) {
      setLocalPages((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    }
  };

  const deleteSingle = (index: number) => {
    setLocalPages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleApply = () => {
    setPages(localPages);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <LayoutGrid size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Document Organizer</h2>
              <p className="text-sm text-slate-500">
                Drag pages to reorder or use multi-select for batch actions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={reverseOrder}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
            >
              <RotateCcw size={14} className="-scale-x-100" />
              Reverse Order
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 disabled:opacity-50 disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 transition-all shadow-xs"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedIds.size})
            </button>
          </div>
          
          <div className="text-xs font-medium text-slate-500">
            {localPages.length} Pages Total
          </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 custom-scrollbar">
          {localPages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
              <LayoutGrid size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">No pages in document</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localPages.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {localPages.map((page, index) => (
                    <SortablePageThumbnail
                      key={page.id}
                      id={page.id}
                      page={page}
                      index={index}
                      isSelected={selectedIds.has(page.id)}
                      onToggleSelect={toggleSelect}
                      onZoom={(p) => setZoomPage(p)}
                      onDelete={deleteSingle}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-white">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Selected: {selectedIds.size}
            </div>
            {localPages.length !== initialPages.length && (
              <div className="text-amber-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Changes Pending
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <Check size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {zoomPage && (
        <ZoomPreview page={zoomPage} onClose={() => setZoomPage(null)} />
      )}
    </div>,
    document.body
  );
}
