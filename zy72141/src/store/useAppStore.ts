import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  WeeklyRecord,
  FileItem,
  Track,
  Annotation,
  Conflict,
  Note,
  WeeklyReport,
} from '@/types';
import { generateId } from '@/utils/storage';

interface AppStore extends AppState {
  setCurrentRecord: (id: string | null) => void;
  addRecord: (record: Omit<WeeklyRecord, 'id' | 'createdAt' | 'updatedAt'>) => WeeklyRecord;
  updateRecord: (record: WeeklyRecord) => void;
  addFiles: (files: FileItem[]) => void;
  updateFile: (file: FileItem) => void;
  setTracks: (tracks: Track[]) => void;
  updateTrack: (track: Track) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  setConflicts: (conflicts: Conflict[]) => void;
  updateConflict: (conflict: Conflict) => void;
  resolveConflict: (
    conflictId: string,
    resolution: Conflict['resolution'],
    resolvedBy: string,
    resolutionNote: string
  ) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => Note;
  setReport: (recordId: string, report: WeeklyReport) => void;
  createNewWeek: (weekKey: string, operator: string) => WeeklyRecord;
  getCurrentWeekData: () => {
    record: WeeklyRecord | null;
    files: FileItem[];
    tracks: Track[];
    annotations: Annotation[];
    conflicts: Conflict[];
    notes: Note[];
    report: WeeklyReport | null;
  };
  loadSampleData: () => void;
  resetState: () => void;
}

const initialState: AppState = {
  currentRecordId: null,
  records: [],
  files: [],
  tracks: [],
  annotations: [],
  conflicts: [],
  notes: [],
  reports: {},
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentRecord: (id) => set({ currentRecordId: id }),

      addRecord: (recordData) => {
        const now = new Date().toISOString();
        const newRecord: WeeklyRecord = {
          ...recordData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          records: [...state.records, newRecord],
          currentRecordId: newRecord.id,
        }));
        return newRecord;
      },

      updateRecord: (record) =>
        set((state) => ({
          records: state.records.map((r) =>
            r.id === record.id ? { ...record, updatedAt: new Date().toISOString() } : r
          ),
        })),

      addFiles: (files) =>
        set((state) => ({
          files: [...state.files, ...files],
        })),

      updateFile: (file) =>
        set((state) => ({
          files: state.files.map((f) => (f.id === file.id ? file : f)),
        })),

      setTracks: (tracks) => set({ tracks }),

      updateTrack: (track) =>
        set((state) => ({
          tracks: state.tracks.map((t) => (t.id === track.id ? track : t)),
        })),

      setAnnotations: (annotations) => set({ annotations }),

      addAnnotation: (annotationData) =>
        set((state) => ({
          annotations: [
            ...state.annotations,
            { ...annotationData, id: generateId() },
          ],
        })),

      setConflicts: (conflicts) => set({ conflicts }),

      updateConflict: (conflict) =>
        set((state) => ({
          conflicts: state.conflicts.map((c) => (c.id === conflict.id ? conflict : c)),
        })),

      resolveConflict: (conflictId, resolution, resolvedBy, resolutionNote) =>
        set((state) => ({
          conflicts: state.conflicts.map((c) =>
            c.id === conflictId
              ? {
                  ...c,
                  resolution,
                  resolvedBy,
                  resolutionNote,
                  resolvedAt: new Date().toISOString(),
                }
              : c
          ),
        })),

      addNote: (noteData) => {
        const newNote: Note = {
          ...noteData,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          notes: [...state.notes, newNote],
        }));
        return newNote;
      },

      setReport: (recordId, report) =>
        set((state) => ({
          reports: { ...state.reports, [recordId]: report },
        })),

      createNewWeek: (weekKey, operator) => {
        const { start, end } = getWeekDateRange(weekKey);
        return get().addRecord({
          weekKey,
          title: generateWeekTitle(weekKey),
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          status: 'draft',
          operator,
        });
      },

      getCurrentWeekData: () => {
        const state = get();
        const recordId = state.currentRecordId;
        if (!recordId) {
          return {
            record: null,
            files: [],
            tracks: [],
            annotations: [],
            conflicts: [],
            notes: [],
            report: null,
          };
        }
        return {
          record: state.records.find((r) => r.id === recordId) || null,
          files: state.files.filter((f) => f.recordId === recordId),
          tracks: state.tracks.filter((t) => t.recordId === recordId),
          annotations: state.annotations.filter((a) => a.recordId === recordId),
          conflicts: state.conflicts.filter((c) => c.recordId === recordId),
          notes: state.notes.filter((n) => n.recordId === recordId),
          report: state.reports[recordId] || null,
        };
      },

      loadSampleData: () => {
        const sample = getSampleData();
        set({
          currentRecordId: sample.record.id,
          records: [sample.record],
          files: sample.files,
          tracks: sample.tracks,
          annotations: sample.annotations,
          conflicts: sample.conflicts,
          notes: sample.notes,
          reports: sample.record.id in sample.reports ? sample.reports : {},
        });
      },

      resetState: () => set(initialState),
    }),
    {
      name: 'piano-coach-storage',
      version: 1,
    }
  )
);

import { getWeekDateRange, generateWeekTitle } from '@/utils/dateUtils';
import { getSampleData } from '@/data/sampleData';
