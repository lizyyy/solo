import { create } from "zustand";
import { SAMPLES, STATIONS, USERS } from "@/data/mock";
import type { AnomalyType, FilterState, RecordKind, Sample } from "@/data/types";

export const ALL_ANOMALY_TYPES: AnomalyType[] = [
  "temperature",
  "salinity",
  "pressure",
  "oxygen",
];
export const ALL_KINDS: RecordKind[] = ["smooth", "supplement", "anomaly"];
export const ALL_STATION_IDS = STATIONS.map((s) => s.id);

const DEFAULT_FILTER: FilterState = {
  anomalyTypes: [...ALL_ANOMALY_TYPES],
  kinds: [...ALL_KINDS],
  stationIds: [...ALL_STATION_IDS],
  depthRange: [1000, 4000],
  onlyAnomaly: false,
};

type ArrayFilterKey = "anomalyTypes" | "kinds" | "stationIds";

interface OceanState {
  samples: Sample[];
  selectedSampleId: string | null;
  timeIndex: number;
  filter: FilterState;
  csvOpen: boolean;
  compareIds: [string, string] | null;
  selectSample: (id: string | null) => void;
  setTimeIndex: (i: number) => void;
  setFilter: (patch: Partial<FilterState>) => void;
  toggleFilterItem: (key: ArrayFilterKey, value: string) => void;
  resetFilter: () => void;
  toggleCsv: () => void;
  setCompare: (ids: [string, string] | null) => void;
}

function passesFilter(s: Sample, f: FilterState): boolean {
  if (!f.anomalyTypes.includes(s.anomalyType)) return false;
  if (!f.kinds.includes(s.kind)) return false;
  if (!f.stationIds.includes(s.stationId)) return false;
  if (s.depth < f.depthRange[0] || s.depth > f.depthRange[1]) return false;
  if (f.onlyAnomaly && s.kind === "smooth") return false;
  return true;
}

export const useOceanStore = create<OceanState>((set) => ({
  samples: SAMPLES,
  selectedSampleId: SAMPLES[1].id,
  timeIndex: 3,
  filter: DEFAULT_FILTER,
  csvOpen: false,
  compareIds: null,
  selectSample: (id) => set({ selectedSampleId: id }),
  setTimeIndex: (i) => set({ timeIndex: i }),
  setFilter: (patch) => set((st) => ({ filter: { ...st.filter, ...patch } })),
  toggleFilterItem: (key, value) =>
    set((st) => {
      const arr = st.filter[key] as string[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { filter: { ...st.filter, [key]: next } };
    }),
  resetFilter: () => set({ filter: { ...DEFAULT_FILTER } }),
  toggleCsv: () => set((st) => ({ csvOpen: !st.csvOpen })),
  setCompare: (ids) => set({ compareIds: ids }),
}));

export function useFilteredSamples(): Sample[] {
  const samples = useOceanStore((s) => s.samples);
  const filter = useOceanStore((s) => s.filter);
  return samples.filter((s) => passesFilter(s, filter));
}

export { USERS, STATIONS };
