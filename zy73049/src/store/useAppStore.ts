import { create } from "zustand";
import type { AlgoResult } from "@/data/types";
import { SAMPLE_PACKS, DETECTION_RECORDS_BY_PACK } from "@/data/mockData";
import { runAnomalyAlgo } from "@/utils/anomalyAlgo";

export type SummaryFilter = "all" | "anomalous" | "boundary" | "strong";

interface AppState {
  packId: string;
  thresholdMm: number;
  selectedWindow: string | null;
  selectedRecordId: string | null;
  filterKind: SummaryFilter;
  lastAlgoResult: AlgoResult | null;
  pulseKey: number;
  setPackId: (id: string) => void;
  setThreshold: (v: number) => void;
  selectWindow: (w: string | null) => void;
  selectRecord: (id: string | null) => void;
  setFilterKind: (k: SummaryFilter) => void;
  recompute: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  packId: "pilot-small",
  thresholdMm: 0.8,
  selectedWindow: null,
  selectedRecordId: null,
  filterKind: "all",
  lastAlgoResult: null,
  pulseKey: 0,
  setPackId: (id) => {
    const recs = DETECTION_RECORDS_BY_PACK[id] ?? [];
    const res = runAnomalyAlgo({
      rawRecords: recs,
      thresholdMm: get().thresholdMm,
    });
    set({
      packId: id,
      lastAlgoResult: res,
      selectedWindow: null,
      selectedRecordId: null,
      pulseKey: get().pulseKey + 1,
    });
  },
  setThreshold: (v) => {
    const recs = DETECTION_RECORDS_BY_PACK[get().packId] ?? [];
    const res = runAnomalyAlgo({ rawRecords: recs, thresholdMm: v });
    set({
      thresholdMm: v,
      lastAlgoResult: res,
      pulseKey: get().pulseKey + 1,
    });
  },
  selectWindow: (w) => set({ selectedWindow: w }),
  selectRecord: (id) => set({ selectedRecordId: id }),
  setFilterKind: (k) => set({ filterKind: k }),
  recompute: () => {
    const recs = DETECTION_RECORDS_BY_PACK[get().packId] ?? [];
    const res = runAnomalyAlgo({
      rawRecords: recs,
      thresholdMm: get().thresholdMm,
    });
    set({ lastAlgoResult: res, pulseKey: get().pulseKey + 1 });
  },
}));

export function initStore() {
  const state = useAppStore.getState();
  const recs = DETECTION_RECORDS_BY_PACK[state.packId] ?? [];
  const res = runAnomalyAlgo({
    rawRecords: recs,
    thresholdMm: state.thresholdMm,
  });
  useAppStore.setState({ lastAlgoResult: res });
}

export { SAMPLE_PACKS };
