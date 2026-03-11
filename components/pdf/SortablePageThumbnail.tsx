"use client";

import React, { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ZoomIn, Trash2, CheckCircle2 } from "lucide-react";
import { Page } from "../../store/useCanvasStore";

interface SortablePageThumbnailProps {
  id: string;
  page: Page;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onZoom: (page: Page, index: number) => void;
  onDelete: (index: number) => void;
}

export function SortablePageThumbnail({
  id,
  page,
  index,
  isSelected,
  onToggleSelect,
  onZoom,
  onDelete,
}: SortablePageThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex flex-col items-center gap-2 p-2 rounded-xl transition-all duration-200 ${
        isDragging ? "opacity-50 scale-105 shadow-2xl" : "opacity-100"
      }`}
    >
      <div
        className={`relative aspect-[1/1.4] w-full rounded-lg overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing ${
          isSelected
            ? "border-blue-500 shadow-lg ring-4 ring-blue-500/20"
            : "border-slate-200 hover:border-slate-300 shadow-sm"
        }`}
        {...attributes}
        {...listeners}
      >
        {page.backgroundUrl ? (
          <img
            src={page.backgroundUrl}
            alt={`Page ${index + 1}`}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-white flex items-center justify-center font-bold text-slate-300">
            Empty
          </div>
        )}

        {/* Selection Overlay */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(id);
          }}
          className={`absolute inset-0 transition-colors cursor-pointer ${
            isSelected ? "bg-blue-500/5" : "bg-transparent group-hover:bg-black/5"
          }`}
        />

        {/* Page Number Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/80 text-white text-[10px] font-bold rounded-md backdrop-blur-sm z-10">
          {index + 1}
        </div>

        {/* Selection Indicator */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(id);
          }}
          className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-sm cursor-pointer z-10 transition-all ${
            isSelected ? "bg-blue-500 text-white scale-110" : "bg-white/80 text-transparent"
          }`}
        >
          <CheckCircle2 size={14} className={isSelected ? "opacity-100" : "opacity-0"} />
        </div>

        {/* Action Buttons - visible on hover */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onZoom(page, index);
            }}
            className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-sm transition-all hover:scale-110"
            title="Zoom Preview"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            className="p-1.5 bg-white/90 hover:bg-red-50 text-red-500 rounded-lg shadow-sm transition-all hover:scale-110"
            title="Delete Page"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      
      <span className={`text-[11px] font-semibold transition-colors ${isSelected ? "text-blue-600" : "text-slate-500"}`}>
        Page {index + 1}
      </span>
    </div>
  );
}
