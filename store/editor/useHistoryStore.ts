import { create } from "zustand";

export interface HistoryCommand {
  label: string;
  do: () => void;
  undo: () => void;
}

interface HistoryState {
  past: HistoryCommand[];
  future: HistoryCommand[];
  execute: (cmd: HistoryCommand) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  execute: (cmd) => {
    cmd.do();
    set((state) => ({
      past: [...state.past, cmd].slice(-100),
      future: [],
    }));
  },
  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return;
    const cmd = past[past.length - 1];
    cmd.undo();
    set({
      past: past.slice(0, -1),
      future: [cmd, ...future],
    });
  },
  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return;
    const cmd = future[0];
    cmd.do();
    set({
      past: [...past, cmd],
      future: future.slice(1),
    });
  },
  clear: () => set({ past: [], future: [] }),
}));
