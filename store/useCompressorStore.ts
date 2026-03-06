import { create } from "zustand";

export type CompressionLevel = "LOW" | "MEDIUM" | "EXTREME";

interface CompressorState {
  compressionLevel: CompressionLevel;
  isCompressing: boolean;
  progress: number; // 0 to 100
  originalSize: number;
  compressedSize: number;
  setCompressionLevel: (level: CompressionLevel) => void;
  setCompressionStatus: (status: boolean, progress?: number) => void;
  setStats: (original: number, compressed: number) => void;
}

export const useCompressorStore = create<CompressorState>((set) => ({
  compressionLevel: "MEDIUM",
  isCompressing: false,
  progress: 0,
  originalSize: 0,
  compressedSize: 0,
  setCompressionLevel: (level) => set({ compressionLevel: level }),
  setCompressionStatus: (isCompressing, progress = 0) =>
    set({ isCompressing, progress }),
  setStats: (originalSize, compressedSize) =>
    set({ originalSize, compressedSize }),
}));
