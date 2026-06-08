import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChannelTableEntry,
  Track,
  Annotation,
  Conflict,
  ImportRecord,
  AppState,
  ConflictResolution,
} from '@/types';
import { generateMockData } from '@/utils/mockData';

const initialState = {
  channelTable: [] as ChannelTableEntry[],
  tracks: [] as Track[],
  annotations: [] as Annotation[],
  conflicts: [] as Conflict[],
  importRecords: [] as ImportRecord[],
  currentPage: 'import',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      addChannelEntry: (entry: ChannelTableEntry) =>
        set((state) => ({
          channelTable: [...state.channelTable, entry],
        })),

      addChannelEntries: (entries: ChannelTableEntry[]) =>
        set((state) => ({
          channelTable: [...state.channelTable, ...entries],
        })),

      updateChannelEntry: (id: string, updates: Partial<ChannelTableEntry>) =>
        set((state) => ({
          channelTable: state.channelTable.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteChannelEntry: (id: string) =>
        set((state) => ({
          channelTable: state.channelTable.filter((e) => e.id !== id),
        })),

      addTrack: (track: Track) =>
        set((state) => ({
          tracks: [...state.tracks, track],
        })),

      updateTrack: (id: string, updates: Partial<Track>) =>
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })),

      deleteTrack: (id: string) =>
        set((state) => ({
          tracks: state.tracks.filter((t) => t.id !== id),
          annotations: state.annotations.filter((a) => a.trackId !== id),
          conflicts: state.conflicts.filter((c) => c.trackId !== id),
          importRecords: state.importRecords.filter((r) => r.trackId !== id),
        })),

      addAnnotation: (annotation: Annotation) =>
        set((state) => ({
          annotations: [...state.annotations, annotation],
        })),

      addConflict: (conflict: Conflict) =>
        set((state) => ({
          conflicts: [...state.conflicts, conflict],
        })),

      resolveConflict: (id: string, resolution: ConflictResolution, manualValue?: any) =>
        set((state) => {
          const conflict = state.conflicts.find((c) => c.id === id);
          if (!conflict) return state;

          const resolvedValue =
            resolution === 'A'
              ? conflict.valueA
              : resolution === 'B'
              ? conflict.valueB
              : manualValue;

          const updatedTracks = state.tracks.map((t) => {
            if (t.id === conflict.trackId) {
              return {
                ...t,
                [conflict.field]: resolvedValue,
                status: 'normal' as const,
                updatedAt: new Date().toISOString(),
              };
            }
            return t;
          });

          const pendingConflicts = state.conflicts.filter(
            (c) => c.trackId === conflict.trackId && c.id !== id && c.status === 'pending'
          );

          if (pendingConflicts.length === 0) {
            const trackIdx = updatedTracks.findIndex((t) => t.id === conflict.trackId);
            if (trackIdx !== -1) {
              updatedTracks[trackIdx].status = 'normal';
            }
          }

          return {
            conflicts: state.conflicts.map((c) =>
              c.id === id
                ? {
                    ...c,
                    status: 'resolved' as const,
                    resolution,
                    manualValue,
                    resolvedAt: new Date().toISOString(),
                  }
                : c
            ),
            tracks: updatedTracks,
          };
        }),

      addImportRecord: (record: ImportRecord) =>
        set((state) => ({
          importRecords: [...state.importRecords, record],
        })),

      updateImportRecord: (id: string, updates: Partial<ImportRecord>) =>
        set((state) => ({
          importRecords: state.importRecords.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      setCurrentPage: (page: string) => set({ currentPage: page }),

      clearAll: () => set(initialState),

      loadMockData: () => {
        const mock = generateMockData();
        set({
          channelTable: mock.channelTable,
          tracks: mock.tracks,
          annotations: mock.annotations,
          conflicts: mock.conflicts,
          importRecords: mock.importRecords,
        });
      },
    }),
    {
      name: 'music-royalty-tracker-storage',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          return { ...persisted, channelTable: [] };
        }
        return persisted;
      },
    }
  )
);

export const getTrackWithDetails = (trackId: string) => {
  const state = useAppStore.getState();
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return null;

  return {
    ...track,
    annotations: state.annotations.filter((a) => a.trackId === trackId),
    conflicts: state.conflicts.filter((c) => c.trackId === trackId),
    importRecord: state.importRecords.find((r) => r.trackId === trackId),
    channelEntry: track.channelTableId
      ? state.channelTable.find((e) => e.id === track.channelTableId)
      : undefined,
  };
};
