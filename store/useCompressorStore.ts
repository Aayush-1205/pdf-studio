import { create } from "zustand";

export type CompressionLevel = "LOW" | "MEDIUM" | "EXTREME";

interface CompressorState {
  compressionLevel: CompressionLevel;
  isCompressing: boolean;
  originalSize: number;
  compressedSize: number;
  setCompressionLevel: (level: CompressionLevel) => void;
  setCompressionStatus: (status: boolean) => void;
  setStats: (original: number, compressed: number) => void;
}

export const useCompressorStore = create<CompressorState>((set) => ({
  compressionLevel: "MEDIUM",
  isCompressing: false,
  originalSize: 0,
  compressedSize: 0,
  setCompressionLevel: (level) => set({ compressionLevel: level }),
  setCompressionStatus: (isCompressing) => set({ isCompressing }),
  setStats: (originalSize, compressedSize) =>
    set({ originalSize, compressedSize }),
}));
