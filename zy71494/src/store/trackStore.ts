import { create } from 'zustand';
import { getDB, saveAudioBlob, getAudioBlob, deleteAudioBlob } from '@/utils/db';
import type { Track, Beat, Segment, BPMHistory, TransitionScore, OperationLog } from '@/types';
import { generateId } from '@/types';

interface TrackState {
  tracks: Track[];
  currentTrack: Track | null;
  audioUrl: string | null;
  loading: boolean;
  error: string | null;
  loadTracks: () => Promise<void>;
  addTrack: (file: File) => Promise<Track>;
  updateTrack: (id: string, updates: Partial<Track>) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  selectTrack: (id: string | null) => Promise<void>;
  loadAudio: (trackId: string) => Promise<string | null>;
}

const getOperator = (): string => {
  return localStorage.getItem('dj-operator') || 'DJ';
};

export const useTrackStore = create<TrackState>((set, get) => ({
  tracks: [],
  currentTrack: null,
  audioUrl: null,
  loading: false,
  error: null,

  loadTracks: async () => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const tracks = await db.getAllFromIndex('tracks', 'createdAt');
      set({ tracks: tracks.reverse(), loading: false });
    } catch (error) {
      set({ error: '加载歌曲列表失败', loading: false });
    }
  },

  addTrack: async (file: File): Promise<Track> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const audioBlobId = generateId();
      
      await saveAudioBlob(audioBlobId, file);

      const audio = new Audio();
      const url = URL.createObjectURL(file);
      audio.src = url;
      
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error('无法读取音频文件'));
      });

      const duration = audio.duration;
      URL.revokeObjectURL(url);

      const track: Track = {
        id: generateId(),
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        duration,
        audioBlobId,
        currentBPM: 0,
        bpmConfidence: 'low',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.add('tracks', track);

      const log: OperationLog = {
        id: generateId(),
        trackId: track.id,
        operationType: 'import',
        fieldName: 'track',
        oldValue: '',
        newValue: track.name,
        reason: '导入新音频文件',
        operator: getOperator(),
        timestamp: new Date(),
      };
      await db.add('operationLogs', log);

      const tracks = await db.getAllFromIndex('tracks', 'createdAt');
      set({ tracks: tracks.reverse(), loading: false });
      
      return track;
    } catch (error) {
      set({ error: '添加歌曲失败', loading: false });
      throw error;
    }
  },

  updateTrack: async (id: string, updates: Partial<Track>): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const track = await db.get('tracks', id);
      if (!track) throw new Error('歌曲不存在');

      const updatedTrack: Track = {
        ...track,
        ...updates,
        updatedAt: new Date(),
      };

      await db.put('tracks', updatedTrack);

      for (const [key, value] of Object.entries(updates)) {
        const oldVal = track[key as keyof Track];
        if (oldVal !== value) {
          const log: OperationLog = {
            id: generateId(),
            trackId: id,
            operationType: key === 'currentBPM' ? 'bpm' : key === 'bestInPoint' ? 'inpoint' : key === 'bestOutPoint' ? 'outpoint' : 'bpm',
            fieldName: key,
            oldValue: String(oldVal ?? ''),
            newValue: String(value ?? ''),
            reason: '更新歌曲信息',
            operator: getOperator(),
            timestamp: new Date(),
          };
          await db.add('operationLogs', log);
        }
      }

      const tracks = await db.getAllFromIndex('tracks', 'createdAt');
      set({ 
        tracks: tracks.reverse(),
        currentTrack: get().currentTrack?.id === id ? updatedTrack : get().currentTrack,
        loading: false 
      });
    } catch (error) {
      set({ error: '更新歌曲失败', loading: false });
    }
  },

  deleteTrack: async (id: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const db = await getDB();
      const track = await db.get('tracks', id);
      if (!track) throw new Error('歌曲不存在');

      const tx = db.transaction(['tracks', 'beats', 'segments', 'bpmHistory', 'transitionScores', 'operationLogs', 'audioBlobs'], 'readwrite');
      
      await tx.objectStore('tracks').delete(id);
      
      const beats = await tx.objectStore('beats').index('trackId').getAll(id);
      for (const beat of beats) {
        await tx.objectStore('beats').delete(beat.id);
      }
      
      const segments = await tx.objectStore('segments').index('trackId').getAll(id);
      for (const segment of segments) {
        await tx.objectStore('segments').delete(segment.id);
      }
      
      const bpmHistory = await tx.objectStore('bpmHistory').index('trackId').getAll(id);
      for (const bpm of bpmHistory) {
        await tx.objectStore('bpmHistory').delete(bpm.id);
      }
      
      const scores = await tx.objectStore('transitionScores').index('trackId').getAll(id);
      for (const score of scores) {
        await tx.objectStore('transitionScores').delete(score.id);
      }
      
      const logs = await tx.objectStore('operationLogs').index('trackId').getAll(id);
      for (const log of logs) {
        await tx.objectStore('operationLogs').delete(log.id);
      }
      
      await tx.objectStore('audioBlobs').delete(track.audioBlobId);
      
      await tx.done;

      if (get().audioUrl) {
        URL.revokeObjectURL(get().audioUrl!);
      }

      const tracks = await db.getAllFromIndex('tracks', 'createdAt');
      set({ 
        tracks: tracks.reverse(),
        currentTrack: get().currentTrack?.id === id ? null : get().currentTrack,
        audioUrl: null,
        loading: false 
      });
    } catch (error) {
      set({ error: '删除歌曲失败', loading: false });
    }
  },

  selectTrack: async (id: string | null): Promise<void> => {
    if (!id) {
      if (get().audioUrl) {
        URL.revokeObjectURL(get().audioUrl!);
      }
      set({ currentTrack: null, audioUrl: null });
      return;
    }

    const db = await getDB();
    const track = await db.get('tracks', id);
    if (track) {
      set({ currentTrack: track });
    }
  },

  loadAudio: async (trackId: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const track = await db.get('tracks', trackId);
      if (!track) return null;

      if (get().audioUrl) {
        URL.revokeObjectURL(get().audioUrl!);
      }

      const blob = await getAudioBlob(track.audioBlobId);
      if (!blob) return null;

      const url = URL.createObjectURL(blob);
      set({ audioUrl: url });
      return url;
    } catch (error) {
      set({ error: '加载音频失败' });
      return null;
    }
  },
}));
