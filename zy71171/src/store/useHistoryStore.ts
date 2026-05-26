import { create } from "zustand";
import type { HistoryRecord } from "@/types";
import { loadHistory } from "@/utils/storage";

interface HistoryState {
  records: HistoryRecord[];
  refresh: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  records: loadHistory(),
  refresh: () => set({ records: loadHistory() }),
}));
