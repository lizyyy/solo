import { create } from 'zustand';
import type {
  AudioFile,
  BeatPoint,
  TempoMark,
  ClassNote,
  DriftAnalysis,
  DriftResult,
  ErrorCause,
  DriftReport,
  AnalysisConfig,
} from '../../shared/types.js';

interface AppState {
  audioFile: AudioFile | null;
  beatPoints: BeatPoint[];
  tempoMarks: TempoMark[];
  classNotes: ClassNote[];
  waveform: number[];
  currentAnalysis: DriftAnalysis | null;
  driftResult: DriftResult | null;
  errorCauses: ErrorCause[];
  reports: DriftReport[];
  voicePart: string;
  zoomLevel: number;
  scrollOffset: number;
  isSidebarOpen: boolean;

  setAudioFile: (file: AudioFile | null) => void;
  setBeatPoints: (points: BeatPoint[]) => void;
  addBeatPoint: (point: BeatPoint) => void;
  updateBeatPoint: (id: string, updates: Partial<BeatPoint>) => void;
  removeBeatPoint: (id: string) => void;
  setTempoMarks: (marks: TempoMark[]) => void;
  addTempoMark: (mark: TempoMark) => void;
  setClassNotes: (notes: ClassNote[]) => void;
  addClassNote: (note: ClassNote) => void;
  setWaveform: (data: number[]) => void;
  setCurrentAnalysis: (analysis: DriftAnalysis | null) => void;
  setDriftResult: (result: DriftResult | null) => void;
  setErrorCauses: (errors: ErrorCause[]) => void;
  updateErrorCause: (id: string, updates: Partial<ErrorCause>) => void;
  setReports: (reports: DriftReport[]) => void;
  addReport: (report: DriftReport) => void;
  updateReport: (id: string, updates: Partial<DriftReport>) => void;
  setVoicePart: (part: string) => void;
  setZoomLevel: (level: number) => void;
  setScrollOffset: (offset: number) => void;
  setIsSidebarOpen: (open: boolean) => void;
  resetAll: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  audioFile: null,
  beatPoints: [],
  tempoMarks: [],
  classNotes: [],
  waveform: [],
  currentAnalysis: null,
  driftResult: null,
  errorCauses: [],
  reports: [],
  voicePart: 'default',
  zoomLevel: 1,
  scrollOffset: 0,
  isSidebarOpen: true,

  setAudioFile: (file) => set({ audioFile: file }),
  setBeatPoints: (points) => set({ beatPoints: points }),
  addBeatPoint: (point) => set((s) => ({ beatPoints: [...s.beatPoints, point] })),
  updateBeatPoint: (id, updates) => set((s) => ({
    beatPoints: s.beatPoints.map((b) => b.id === id ? { ...b, ...updates } : b),
  })),
  removeBeatPoint: (id) => set((s) => ({
    beatPoints: s.beatPoints.filter((b) => b.id !== id),
  })),
  setTempoMarks: (marks) => set({ tempoMarks: marks }),
  addTempoMark: (mark) => set((s) => ({ tempoMarks: [...s.tempoMarks, mark] })),
  setClassNotes: (notes) => set({ classNotes: notes }),
  addClassNote: (note) => set((s) => ({ classNotes: [...s.classNotes, note] })),
  setWaveform: (data) => set({ waveform: data }),
  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  setDriftResult: (result) => set({ driftResult: result }),
  setErrorCauses: (errors) => set({ errorCauses: errors }),
  updateErrorCause: (id, updates) => set((s) => ({
    errorCauses: s.errorCauses.map((e) => e.id === id ? { ...e, ...updates } : e),
  })),
  setReports: (reports) => set({ reports }),
  addReport: (report) => set((s) => ({ reports: [report, ...s.reports] })),
  updateReport: (id, updates) => set((s) => ({
    reports: s.reports.map((r) => r.id === id ? { ...r, ...updates } : r),
  })),
  setVoicePart: (part) => set({ voicePart: part }),
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  resetAll: () => set({
    audioFile: null,
    beatPoints: [],
    tempoMarks: [],
    classNotes: [],
    waveform: [],
    currentAnalysis: null,
    driftResult: null,
    errorCauses: [],
    voicePart: 'default',
    zoomLevel: 1,
    scrollOffset: 0,
  }),
}));

export const defaultAnalysisConfig: AnalysisConfig = {
  referenceBpm: 120,
  driftThreshold: 50.0,
  minSegmentLength: 4.0,
  confidenceThreshold: 0.6,
};
