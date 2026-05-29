import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SamplePack,
  Credential,
  Track,
  PlatformLink,
  HistoryRecord,
  RiskAlert,
  LicenseStatus,
} from '@/types';
import {
  initialSamplePacks,
  initialCredentials,
  initialTracks,
  initialPlatformLinks,
  generateInitialHistory,
  generateId,
} from '@/data/mockData';
import { createHistoryRecord } from '@/services/historyService';
import {
  detectAllRisks,
  calculateSamplePackStatus,
} from '@/services/riskDetectionService';

interface AppState {
  samplePacks: SamplePack[];
  credentials: Credential[];
  tracks: Track[];
  platformLinks: PlatformLink[];
  history: HistoryRecord[];
  risks: RiskAlert[];

  addSamplePack: (pack: Omit<SamplePack, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  updateSamplePack: (id: string, updates: Partial<SamplePack>, notes?: string) => void;
  deleteSamplePack: (id: string) => void;

  addCredential: (cred: Omit<Credential, 'id' | 'uploadedAt'>) => void;
  deleteCredential: (id: string) => void;

  addTrack: (track: Omit<Track, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTrack: (id: string, updates: Partial<Track>, notes?: string) => void;
  deleteTrack: (id: string) => void;

  addPlatformLink: (link: Omit<PlatformLink, 'id'>) => void;
  deletePlatformLink: (id: string) => void;

  linkTrackToSamplePack: (trackId: string, samplePackId: string) => void;
  unlinkTrackFromSamplePack: (trackId: string, samplePackId: string) => void;

  recalculateAllStatuses: () => void;
  resetToDemoData: () => void;
  getTracksForSamplePack: (samplePackId: string) => Track[];
  getSamplePacksForTrack: (trackId: string) => SamplePack[];
  getCredentialsForSamplePack: (samplePackId: string) => Credential[];
  getPlatformLinksForTrack: (trackId: string) => PlatformLink[];
}

const recalculateStatuses = (
  samplePacks: SamplePack[],
  credentials: Credential[],
  tracks: Track[]
): { samplePacks: SamplePack[]; risks: RiskAlert[] } => {
  const updatedPacks = samplePacks.map((pack) => ({
    ...pack,
    status: calculateSamplePackStatus(pack, credentials, tracks) as LicenseStatus,
  }));
  const risks = detectAllRisks(updatedPacks, credentials, tracks);
  return { samplePacks: updatedPacks, risks };
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      const initialHistory = generateInitialHistory();
      const initialData = recalculateStatuses(
        initialSamplePacks,
        initialCredentials,
        initialTracks
      );

      return {
        samplePacks: initialData.samplePacks,
        credentials: initialCredentials,
        tracks: initialTracks,
        platformLinks: initialPlatformLinks,
        history: initialHistory,
        risks: initialData.risks,

        addSamplePack: (pack) => {
          const now = new Date().toISOString();
          const newPack: SamplePack = {
            ...pack,
            id: generateId('sp'),
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'samplePack',
            newPack.id,
            'create',
            newPack,
            undefined,
            '新建采样包'
          );

          set((state) => {
            const newPacks = [...state.samplePacks, newPack];
            const { samplePacks, risks } = recalculateStatuses(
              newPacks,
              state.credentials,
              state.tracks
            );
            return {
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        updateSamplePack: (id, updates, notes) => {
          const now = new Date().toISOString();
          const oldPack = get().samplePacks.find((p) => p.id === id);
          if (!oldPack) return;

          const updatedPack: SamplePack = {
            ...oldPack,
            ...updates,
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'samplePack',
            id,
            'update',
            updatedPack,
            oldPack,
            notes
          );

          set((state) => {
            const newPacks = state.samplePacks.map((p) =>
              p.id === id ? updatedPack : p
            );
            const { samplePacks, risks } = recalculateStatuses(
              newPacks,
              state.credentials,
              state.tracks
            );
            return {
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        deleteSamplePack: (id) => {
          const oldPack = get().samplePacks.find((p) => p.id === id);
          if (!oldPack) return;

          const historyRecord = createHistoryRecord(
            'samplePack',
            id,
            'delete',
            { deleted: true, pack: oldPack },
            oldPack,
            '删除采样包'
          );

          set((state) => {
            const newPacks = state.samplePacks.filter((p) => p.id !== id);
            const newCredentials = state.credentials.filter((c) => c.samplePackId !== id);
            const newTracks = state.tracks.map((t) => ({
              ...t,
              samplePackIds: t.samplePackIds.filter((pid) => pid !== id),
            }));
            const { samplePacks, risks } = recalculateStatuses(
              newPacks,
              newCredentials,
              newTracks
            );
            return {
              samplePacks,
              credentials: newCredentials,
              tracks: newTracks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        addCredential: (cred) => {
          const now = new Date().toISOString();
          const newCred: Credential = {
            ...cred,
            id: generateId('cred'),
            uploadedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'credential',
            newCred.id,
            'create',
            newCred,
            undefined,
            '添加授权凭证'
          );

          set((state) => {
            const newCredentials = [...state.credentials, newCred];
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              newCredentials,
              state.tracks
            );
            return {
              credentials: newCredentials,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        deleteCredential: (id) => {
          const oldCred = get().credentials.find((c) => c.id === id);
          if (!oldCred) return;

          const historyRecord = createHistoryRecord(
            'credential',
            id,
            'delete',
            { deleted: true, credential: oldCred },
            oldCred,
            '删除授权凭证'
          );

          set((state) => {
            const newCredentials = state.credentials.filter((c) => c.id !== id);
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              newCredentials,
              state.tracks
            );
            return {
              credentials: newCredentials,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        addTrack: (track) => {
          const now = new Date().toISOString();
          const newTrack: Track = {
            ...track,
            id: generateId('trk'),
            createdAt: now,
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'track',
            newTrack.id,
            'create',
            newTrack,
            undefined,
            '新建曲目'
          );

          set((state) => {
            const newTracks = [...state.tracks, newTrack];
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              newTracks
            );
            return {
              tracks: newTracks,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        updateTrack: (id, updates, notes) => {
          const now = new Date().toISOString();
          const oldTrack = get().tracks.find((t) => t.id === id);
          if (!oldTrack) return;

          const updatedTrack: Track = {
            ...oldTrack,
            ...updates,
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'track',
            id,
            'update',
            updatedTrack,
            oldTrack,
            notes
          );

          set((state) => {
            const newTracks = state.tracks.map((t) => (t.id === id ? updatedTrack : t));
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              newTracks
            );
            return {
              tracks: newTracks,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        deleteTrack: (id) => {
          const oldTrack = get().tracks.find((t) => t.id === id);
          if (!oldTrack) return;

          const historyRecord = createHistoryRecord(
            'track',
            id,
            'delete',
            { deleted: true, track: oldTrack },
            oldTrack,
            '删除曲目'
          );

          set((state) => {
            const newTracks = state.tracks.filter((t) => t.id !== id);
            const newLinks = state.platformLinks.filter((l) => l.trackId !== id);
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              newTracks
            );
            return {
              tracks: newTracks,
              platformLinks: newLinks,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        addPlatformLink: (link) => {
          const newLink: PlatformLink = {
            ...link,
            id: generateId('pl'),
          };

          set((state) => ({
            platformLinks: [...state.platformLinks, newLink],
          }));
        },

        deletePlatformLink: (id) => {
          set((state) => ({
            platformLinks: state.platformLinks.filter((l) => l.id !== id),
          }));
        },

        linkTrackToSamplePack: (trackId, samplePackId) => {
          const track = get().tracks.find((t) => t.id === trackId);
          const pack = get().samplePacks.find((p) => p.id === samplePackId);
          if (!track || !pack) return;
          if (track.samplePackIds.includes(samplePackId)) return;

          const now = new Date().toISOString();
          const updatedTrack: Track = {
            ...track,
            samplePackIds: [...track.samplePackIds, samplePackId],
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'samplePack',
            samplePackId,
            'link',
            { samplePackId, trackId, samplePackName: pack.name, trackName: track.title },
            undefined,
            `关联曲目《${track.title}》到采样包「${pack.name}」`
          );

          set((state) => {
            const newTracks = state.tracks.map((t) =>
              t.id === trackId ? updatedTrack : t
            );
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              newTracks
            );
            return {
              tracks: newTracks,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        unlinkTrackFromSamplePack: (trackId, samplePackId) => {
          const track = get().tracks.find((t) => t.id === trackId);
          const pack = get().samplePacks.find((p) => p.id === samplePackId);
          if (!track || !pack) return;

          const now = new Date().toISOString();
          const updatedTrack: Track = {
            ...track,
            samplePackIds: track.samplePackIds.filter((id) => id !== samplePackId),
            updatedAt: now,
          };

          const historyRecord = createHistoryRecord(
            'samplePack',
            samplePackId,
            'unlink',
            { samplePackId, trackId, samplePackName: pack.name, trackName: track.title },
            undefined,
            `取消曲目《${track.title}》与采样包「${pack.name}」的关联`
          );

          set((state) => {
            const newTracks = state.tracks.map((t) =>
              t.id === trackId ? updatedTrack : t
            );
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              newTracks
            );
            return {
              tracks: newTracks,
              samplePacks,
              risks,
              history: [...state.history, historyRecord],
            };
          });
        },

        recalculateAllStatuses: () => {
          set((state) => {
            const { samplePacks, risks } = recalculateStatuses(
              state.samplePacks,
              state.credentials,
              state.tracks
            );
            return { samplePacks, risks };
          });
        },

        resetToDemoData: () => {
          const initialHistory = generateInitialHistory();
          const initialData = recalculateStatuses(
            initialSamplePacks,
            initialCredentials,
            initialTracks
          );
          set({
            samplePacks: initialData.samplePacks,
            credentials: initialCredentials,
            tracks: initialTracks,
            platformLinks: initialPlatformLinks,
            history: initialHistory,
            risks: initialData.risks,
          });
        },

        getTracksForSamplePack: (samplePackId) => {
          return get().tracks.filter((t) => t.samplePackIds.includes(samplePackId));
        },

        getSamplePacksForTrack: (trackId) => {
          const track = get().tracks.find((t) => t.id === trackId);
          if (!track) return [];
          return get().samplePacks.filter((p) => track.samplePackIds.includes(p.id));
        },

        getCredentialsForSamplePack: (samplePackId) => {
          return get().credentials.filter((c) => c.samplePackId === samplePackId);
        },

        getPlatformLinksForTrack: (trackId) => {
          return get().platformLinks.filter((l) => l.trackId === trackId);
        },
      };
    },
    {
      name: 'sample-pack-license-store',
      version: 1,
    }
  )
);
