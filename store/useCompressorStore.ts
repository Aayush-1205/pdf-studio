import { create } from "zustand";

export type CompressionLevel = "LOW" | "MEDIUM" | "EXTREME";
export type CompressionPhase = "idle" | "rasterizing" | "assembling" | "done" | "error";

interface CompressorState {
  compressionLevel: CompressionLevel;
  phase: CompressionPhase;
  progress: number; // 0 to 100
  progressMessage: string;
  originalSize: number;
  compressedSize: number;
  pageCount: number;
  fileName: string;
  errorMessage: string | null;

  setCompressionLevel: (level: CompressionLevel) => void;
  beginJob: (fileName: string) => void;
  onProgress: (phase: CompressionPhase, progress: number, message: string) => void;
  onSuccess: (originalSize: number, compressedSize: number, pageCount: number) => void;
  onError: (errorMessage: string) => void;
  reset: () => void;
}

export const useCompressorStore = create<CompressorState>((set) => ({
  compressionLevel: "MEDIUM",
  phase: "idle",
  progress: 0,
  progressMessage: "",
  originalSize: 0,
  compressedSize: 0,
  pageCount: 0,
  fileName: "",
  errorMessage: null,

  setCompressionLevel: (level) => set({ compressionLevel: level }),
  beginJob: (fileName) =>
    set({
      phase: "rasterizing",
      progress: 0,
      progressMessage: "Initializing compression...",
      originalSize: 0,
      compressedSize: 0,
      pageCount: 0,
      fileName,
      errorMessage: null,
    }),
  onProgress: (phase, progress, message) =>
    set({
      phase,
      progress,
      progressMessage: message,
    }),
  onSuccess: (originalSize, compressedSize, pageCount) =>
    set({
      phase: "done",
      progress: 100,
      progressMessage: "Compression successful!",
      originalSize,
      compressedSize,
      pageCount,
    }),
  onError: (errorMessage) =>
    set({
      phase: "error",
      errorMessage,
      progressMessage: "",
    }),
  reset: () =>
    set({
      phase: "idle",
      progress: 0,
      progressMessage: "",
      originalSize: 0,
      compressedSize: 0,
      pageCount: 0,
      fileName: "",
      errorMessage: null,
    }),
}));
