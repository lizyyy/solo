import { create } from 'zustand';
import type {
  Hall,
  ReflectSurface,
  SoundSource,
  SeatZone,
  ReflectPath,
  FrequencyPoint,
  FrequencyCoverage,
  AnomalyRecord,
  AnomalyStatus,
  ImpactAssessment,
  PreviewReport,
  Scheme,
  Selection,
} from '@/utils/types';
import { mockNormal } from '@/data/mockNormal';
import { mockErrorProne } from '@/data/mockErrorProne';
import { computeAllPaths } from '@/utils/reflectCalc';
import { detectAllAnomalies } from '@/utils/anomalyDetect';

interface MockData {
  hall: Hall;
  surfaces: ReflectSurface[];
  sources: SoundSource[];
  zones: SeatZone[];
  frequencyPoints: FrequencyPoint[];
  frequencyCoverages: FrequencyCoverage[];
  anomalies: AnomalyRecord[];
  impacts: ImpactAssessment[];
  schemes: Scheme[];
}

interface HallState {
  hall: Hall | null;
  surfaces: ReflectSurface[];
  sources: SoundSource[];
  zones: SeatZone[];
  paths: ReflectPath[];
  frequencyPoints: FrequencyPoint[];
  frequencyCoverages: FrequencyCoverage[];
  anomalies: AnomalyRecord[];
  impacts: ImpactAssessment[];
  reports: PreviewReport[];
  schemes: Scheme[];
  currentSchemeId: string;
  compareSchemeIds: [string, string];
  selection: Selection;
  focusTarget: { type: string; id: string } | null;
  showPaths: boolean;
  showHeatmap: boolean;
  activeFrequency: number;
  useErrorProneData: boolean;
}

interface HallActions extends HallState {
  loadData: (errorProne: boolean) => void;
  setSurfaceAngle: (surfaceId: string, angle: number) => void;
  setSourcePosition: (sourceId: string, pos: [number, number, number]) => void;
  setSelection: (selection: Selection) => void;
  setFocusTarget: (target: { type: string; id: string } | null) => void;
  togglePaths: () => void;
  toggleHeatmap: () => void;
  setActiveFrequency: (freq: number) => void;
  setAnomalyStatus: (id: string, status: AnomalyStatus) => void;
  generateReport: () => void;
  setCompareSchemes: (ids: [string, string]) => void;
  setUseErrorProneData: (val: boolean) => void;
}

export const useHallStore = create<HallActions>((set, get) => ({
  hall: null,
  surfaces: [],
  sources: [],
  zones: [],
  paths: [],
  frequencyPoints: [],
  frequencyCoverages: [],
  anomalies: [],
  impacts: [],
  reports: [],
  schemes: [],
  currentSchemeId: '',
  compareSchemeIds: ['', ''],
  selection: { type: null, id: null },
  focusTarget: null,
  showPaths: false,
  showHeatmap: false,
  activeFrequency: 1000,
  useErrorProneData: false,

  loadData(errorProne) {
    const data = (errorProne ? mockErrorProne : mockNormal) as MockData;
    const paths = computeAllPaths(data.sources, data.surfaces, data.zones, data.hall);

    let anomalies: AnomalyRecord[];
    let impacts: ImpactAssessment[];

    if (errorProne) {
      anomalies = data.anomalies;
      impacts = data.impacts;
    } else {
      anomalies = detectAllAnomalies(data.hall, data.surfaces, data.zones, paths, data.frequencyPoints);
      impacts = [];
    }

    set({
      hall: data.hall,
      surfaces: data.surfaces,
      sources: data.sources,
      zones: data.zones,
      frequencyPoints: data.frequencyPoints,
      frequencyCoverages: data.frequencyCoverages,
      paths,
      anomalies,
      impacts,
      useErrorProneData: errorProne,
    });
  },

  setSurfaceAngle(surfaceId, angle) {
    const { hall, surfaces, sources, zones, frequencyPoints, useErrorProneData } = get();
    const nextSurfaces = surfaces.map((s) => (s.id === surfaceId ? { ...s, angle } : s));
    const paths = computeAllPaths(sources, nextSurfaces, zones, hall!);
    const anomalies = useErrorProneData
      ? get().anomalies
      : detectAllAnomalies(hall!, nextSurfaces, zones, paths, frequencyPoints);
    set({ surfaces: nextSurfaces, paths, anomalies });
  },

  setSourcePosition(sourceId, pos) {
    const { hall, surfaces, sources, zones } = get();
    const nextSources = sources.map((s) => (s.id === sourceId ? { ...s, position: pos } : s));
    const paths = computeAllPaths(nextSources, surfaces, zones, hall!);
    set({ sources: nextSources, paths });
  },

  setSelection(selection) {
    set({ selection });
  },

  setFocusTarget(target) {
    set({ focusTarget: target });
  },

  togglePaths() {
    set((s) => ({ showPaths: !s.showPaths }));
  },

  toggleHeatmap() {
    set((s) => ({ showHeatmap: !s.showHeatmap }));
  },

  setActiveFrequency(freq) {
    set({ activeFrequency: freq });
  },

  setAnomalyStatus(id, status) {
    set((s) => ({
      anomalies: s.anomalies.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  },

  generateReport() {
    const { hall, anomalies, frequencyCoverages, reports } = get();
    const report: PreviewReport = {
      id: `report-${Date.now()}`,
      hallId: hall?.id ?? '',
      createdAt: new Date().toISOString(),
      status: 'draft',
      anomalyIds: anomalies.map((a) => a.id),
      coverageIds: frequencyCoverages.map((c) => c.id),
    };
    set({ reports: [...reports, report] });
  },

  setCompareSchemes(ids) {
    set({ compareSchemeIds: ids });
  },

  setUseErrorProneData(val) {
    get().loadData(val);
  },
}));
