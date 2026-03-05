import { create } from "zustand";

export type PageRangeType = "ALL" | "CURRENT" | "CUSTOM";

interface ResizeState {
  targetWidth: number;
  targetHeight: number;
  pageRange: PageRangeType;
  customPages: string; // comma/range input like "1,3,5-7"
  isResizing: boolean;
  setTargetWidth: (w: number) => void;
  setTargetHeight: (h: number) => void;
  setPageRange: (r: PageRangeType) => void;
  setCustomPages: (p: string) => void;
  setIsResizing: (v: boolean) => void;

  originalState: {
    pdfBytes: Uint8Array | null;
    pages: any[];
    layers: Record<string, any>;
    layerIds: string[];
  } | null;
  setOriginalState: (state: any) => void;
  clearOriginalState: () => void;
}

export const useResizeStore = create<ResizeState>((set) => ({
  targetWidth: 595.28,
  targetHeight: 841.89,
  pageRange: "ALL",
  customPages: "",
  isResizing: false,
  setTargetWidth: (targetWidth) => set({ targetWidth }),
  setTargetHeight: (targetHeight) => set({ targetHeight }),
  setPageRange: (pageRange) => set({ pageRange }),
  setCustomPages: (customPages) => set({ customPages }),
  setIsResizing: (isResizing) => set({ isResizing }),
  originalState: null,
  setOriginalState: (originalState) => set({ originalState }),
  clearOriginalState: () => set({ originalState: null }),
}));

/** Parse a human-readable page range like "1, 3, 5-7" into 0-based indices. */
export function parsePageRange(input: string, totalPages: number): number[] {
  const indices = new Set<number>();
  const parts = input.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) indices.add(i - 1);
      }
    } else {
      const n = Number(part);
      if (n >= 1 && n <= totalPages) indices.add(n - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}
