import { create } from "zustand";

interface PDFStore {
  loadFromStorage: () => Promise<void>;
  saveToStorage: (blob: Blob) => Promise<void>;
}

export const usePDFStore = create<PDFStore>((set) => ({
  loadFromStorage: async () => {},
  saveToStorage: async (blob: Blob) => {},
}));
