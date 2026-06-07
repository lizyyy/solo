import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DataRecord,
  FilterState,
  ViewScheme,
  CameraState,
  FieldMapping,
  SourceInfo,
} from '@/types';
import { buildDataRecord, generateId, computeRanges } from '@/utils/data';

interface AppState {
  data: DataRecord[]
  selectedId: string | null
  filters: FilterState
  schemes: ViewScheme[]
  camera: CameraState
  axisMapping: { x: 'delta'; y: 'gamma'; z: 'vega' }
  lastLoadedSchemeId: string | null
  supplementalDiff: Record<string, { beforeNoteCount: number; modifiedAt: string }>
  baselineMarked: boolean
  baselineTime: string | null
  canvasDataUrl: string | null

  importData: (raw: Record<string, unknown>[], mapping: FieldMapping, sourceInfo: SourceInfo) => void
  addNote: (recordId: string, content: string, author?: string) => void
  setSelected: (id: string | null) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFiltersToFullRange: () => void
  saveScheme: (name: string) => void
  deleteScheme: (id: string) => void
  loadScheme: (id: string) => void
  setCamera: (camera: CameraState) => void
  clearData: () => void
  markBaseline: () => void
  setCanvasDataUrl: (url: string | null) => void
}

const defaultFilters: FilterState = {
  deltaRange: [-1, 1],
  gammaRange: [-1, 1],
  thetaRange: [-100, 100],
  vegaRange: [-100, 100],
  sourceTypes: ['gis', 'inspection', 'excel', 'manual'],
  anomalyOnly: false,
};

const defaultCamera: CameraState = {
  position: [8, 6, 8],
  target: [0, 0, 0],
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: [],
      selectedId: null,
      filters: defaultFilters,
      schemes: [],
      camera: defaultCamera,
      axisMapping: { x: 'delta', y: 'gamma', z: 'vega' },
      lastLoadedSchemeId: null,
      supplementalDiff: {},
      baselineMarked: false,
      baselineTime: null,
      canvasDataUrl: null,

      importData: (raw, mapping, sourceInfo) => {
        const records = raw.map(r => buildDataRecord(r, mapping, sourceInfo));
        const ranges = computeRanges(records);
        set({
          data: records,
          filters: {
            ...defaultFilters,
            deltaRange: ranges.delta,
            gammaRange: ranges.gamma,
            thetaRange: ranges.theta,
            vegaRange: ranges.vega,
          },
          baselineMarked: false,
          baselineTime: null,
          supplementalDiff: {},
        });
      },

      addNote: (recordId, content, author = '阿乔') => {
        const now = new Date().toISOString();
        const record = get().data.find(r => r.id === recordId);
        if (!record) return;
        const beforeNoteCount = record.notes.length;

        set({
          data: get().data.map(r =>
            r.id === recordId
              ? {
                  ...r,
                  notes: [
                    ...r.notes,
                    {
                      id: generateId(),
                      content,
                      author,
                      createdAt: now,
                      isSupplemental: true,
                    },
                  ],
                }
              : r
          ),
          supplementalDiff: {
            ...get().supplementalDiff,
            [recordId]: {
              beforeNoteCount,
              modifiedAt: now,
            },
          },
        });
      },

      setSelected: (id) => set({ selectedId: id }),

      setFilters: (filters) => {
        set({ filters: { ...get().filters, ...filters } });
      },

      resetFiltersToFullRange: () => {
        const ranges = computeRanges(get().data);
        set({
          filters: {
            ...defaultFilters,
            deltaRange: ranges.delta,
            gammaRange: ranges.gamma,
            thetaRange: ranges.theta,
            vegaRange: ranges.vega,
          },
        });
      },

      saveScheme: (name) => {
        const state = get();
        const snapshot: Record<string, string> = {};
        for (const rec of state.data) {
          if (rec.notes.length > 0) {
            snapshot[rec.id] = rec.notes.map(n => n.content).join(' | ');
          }
        }

        const scheme: ViewScheme = {
          id: generateId(),
          name,
          createdAt: new Date().toISOString(),
          camera: state.camera,
          filters: state.filters,
          annotationSnapshot: snapshot,
        };

        set({ schemes: [...state.schemes, scheme] });
      },

      deleteScheme: (id) => {
        set({ schemes: get().schemes.filter(s => s.id !== id) });
      },

      loadScheme: (id) => {
        const scheme = get().schemes.find(s => s.id === id);
        if (!scheme) return;
        set({
          camera: scheme.camera,
          filters: scheme.filters,
          lastLoadedSchemeId: id,
        });
      },

      setCamera: (camera) => set({ camera }),

      clearData: () => {
        set({
          data: [],
          selectedId: null,
          filters: defaultFilters,
          camera: defaultCamera,
          supplementalDiff: {},
          baselineMarked: false,
          baselineTime: null,
          canvasDataUrl: null,
        });
      },

      markBaseline: () => {
        const now = new Date().toISOString();
        const diffSnapshot: Record<string, { beforeNoteCount: number; modifiedAt: string }> = {};
        for (const rec of get().data) {
          diffSnapshot[rec.id] = {
            beforeNoteCount: rec.notes.length,
            modifiedAt: now,
          };
        }
        set({
          baselineMarked: true,
          baselineTime: now,
          supplementalDiff: diffSnapshot,
        });
      },

      setCanvasDataUrl: (url) => set({ canvasDataUrl: url }),
    }),
    {
      name: 'greek-cloud-store',
      partialize: (state) => ({
        data: state.data,
        schemes: state.schemes,
        filters: state.filters,
        supplementalDiff: state.supplementalDiff,
        baselineMarked: state.baselineMarked,
        baselineTime: state.baselineTime,
        canvasDataUrl: state.canvasDataUrl,
      }),
    }
  )
);

export function useFilteredData(): DataRecord[] {
  const { data, filters } = useAppStore();
  return data.filter(rec => {
    const dm = rec.mapped;
    if (dm.delta !== undefined && (dm.delta < filters.deltaRange[0] || dm.delta > filters.deltaRange[1])) return false;
    if (dm.gamma !== undefined && (dm.gamma < filters.gammaRange[0] || dm.gamma > filters.gammaRange[1])) return false;
    if (dm.theta !== undefined && (dm.theta < filters.thetaRange[0] || dm.theta > filters.thetaRange[1])) return false;
    if (dm.vega !== undefined && (dm.vega < filters.vegaRange[0] || dm.vega > filters.vegaRange[1])) return false;
    if (!filters.sourceTypes.includes(rec.source.type)) return false;
    if (filters.anomalyOnly && !rec.anomaly.isAnomaly) return false;
    return true;
  });
}
