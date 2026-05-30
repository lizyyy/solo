import { create } from 'zustand';
import type { Track, Conflict, DashboardStats, ImportBatch, TrackDetail, ImportPreview } from '@/../shared/types';

interface AppState {
  dashboardStats: DashboardStats | null;
  tracks: Track[];
  tracksTotal: number;
  conflicts: Conflict[];
  conflictsTotal: number;
  selectedTrack: TrackDetail | null;
  importBatches: ImportBatch[];
  importPreview: ImportPreview | null;
  loading: Record<string, boolean>;
  currentPage: number;
  pageSize: number;
  filters: {
    hasConflict?: boolean;
    status?: string;
    resolved?: boolean;
    conflictType?: string;
  };

  setDashboardStats: (stats: DashboardStats) => void;
  setTracks: (tracks: Track[], total: number) => void;
  setConflicts: (conflicts: Conflict[], total: number) => void;
  setSelectedTrack: (track: TrackDetail | null) => void;
  setImportBatches: (batches: ImportBatch[]) => void;
  setImportPreview: (preview: ImportPreview | null) => void;
  setLoading: (key: string, value: boolean) => void;
  setCurrentPage: (page: number) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  resetFilters: () => void;
  updateTrack: (track: Track) => void;
  updateConflict: (conflict: Conflict) => void;
}

const initialEmotionDistribution = {
  happy: { algorithm: 0, manual: 0 },
  sad: { algorithm: 0, manual: 0 },
  energetic: { algorithm: 0, manual: 0 },
  calm: { algorithm: 0, manual: 0 },
  romantic: { algorithm: 0, manual: 0 },
  angry: { algorithm: 0, manual: 0 },
  nostalgic: { algorithm: 0, manual: 0 },
  hopeful: { algorithm: 0, manual: 0 },
};

export const useAppStore = create<AppState>((set) => ({
  dashboardStats: null,
  tracks: [],
  tracksTotal: 0,
  conflicts: [],
  conflictsTotal: 0,
  selectedTrack: null,
  importBatches: [],
  importPreview: null,
  loading: {},
  currentPage: 1,
  pageSize: 20,
  filters: {},

  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  setTracks: (tracks, total) => set({ tracks, tracksTotal: total }),
  setConflicts: (conflicts, total) => set({ conflicts, conflictsTotal: total }),
  setSelectedTrack: (track) => set({ selectedTrack: track }),
  setImportBatches: (batches) => set({ importBatches: batches }),
  setImportPreview: (preview) => set({ importPreview: preview }),
  setLoading: (key, value) => set((state) => ({ loading: { ...state.loading, [key]: value } })),
  setCurrentPage: (page) => set({ currentPage: page }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: {}, currentPage: 1 }),

  updateTrack: (track) => set((state) => ({
    tracks: state.tracks.map((t) => (t.id === track.id ? track : t)),
  })),

  updateConflict: (conflict) => set((state) => ({
    conflicts: state.conflicts.map((c) => (c.id === conflict.id ? conflict : c)),
    selectedTrack: state.selectedTrack
      ? {
          ...state.selectedTrack,
          conflicts: state.selectedTrack.conflicts.map((c) =>
            c.id === conflict.id ? conflict : c
          ),
        }
      : null,
  })),
}));

export const fetchDashboardStats = async () => {
  const { setLoading, setDashboardStats } = useAppStore.getState();
  setLoading('dashboard', true);
  try {
    const res = await fetch('/api/stats/dashboard');
    const data = await res.json();
    setDashboardStats(data);
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
  } finally {
    setLoading('dashboard', false);
  }
};

export const fetchTracks = async () => {
  const { setLoading, setTracks, currentPage, pageSize, filters } = useAppStore.getState();
  setLoading('tracks', true);
  try {
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(pageSize),
      ...(filters.hasConflict !== undefined && { hasConflict: String(filters.hasConflict) }),
      ...(filters.status && { status: filters.status }),
    });
    const res = await fetch(`/api/tracks?${params}`);
    const data = await res.json();
    setTracks(data.data, data.total);
  } catch (error) {
    console.error('Failed to fetch tracks:', error);
  } finally {
    setLoading('tracks', false);
  }
};

export const fetchTrackDetail = async (id: string) => {
  const { setLoading, setSelectedTrack } = useAppStore.getState();
  setLoading('trackDetail', true);
  try {
    const res = await fetch(`/api/tracks/${id}`);
    const data = await res.json();
    setSelectedTrack(data);
    return data;
  } catch (error) {
    console.error('Failed to fetch track detail:', error);
    return null;
  } finally {
    setLoading('trackDetail', false);
  }
};

export const fetchConflicts = async () => {
  const { setLoading, setConflicts, filters } = useAppStore.getState();
  setLoading('conflicts', true);
  try {
    const params = new URLSearchParams({
      ...(filters.resolved !== undefined && { resolved: String(filters.resolved) }),
      ...(filters.conflictType && { conflictType: filters.conflictType }),
    });
    const res = await fetch(`/api/conflicts?${params}`);
    const data = await res.json();
    setConflicts(data, data.length);
  } catch (error) {
    console.error('Failed to fetch conflicts:', error);
  } finally {
    setLoading('conflicts', false);
  }
};

export const resolveConflict = async (conflictId: string, resolutionNote: string, operator: string) => {
  const { setLoading, updateConflict } = useAppStore.getState();
  setLoading('resolveConflict', true);
  try {
    const res = await fetch(`/api/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNote, operator }),
    });
    const data = await res.json();
    updateConflict(data);
    return data;
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    return null;
  } finally {
    setLoading('resolveConflict', false);
  }
};

export const addManualTag = async (trackId: string, tags: string[], note: string, operator: string) => {
  const { setLoading, updateTrack } = useAppStore.getState();
  setLoading('addManualTag', true);
  try {
    const res = await fetch(`/api/tracks/${trackId}/manual-tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags, note, operator }),
    });
    const data = await res.json();
    updateTrack(data.track);
    return data;
  } catch (error) {
    console.error('Failed to add manual tag:', error);
    return null;
  } finally {
    setLoading('addManualTag', false);
  }
};

export const importData = async (file: File, operator: string) => {
  const { setLoading, setImportPreview } = useAppStore.getState();
  setLoading('import', true);
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('operator', operator);
    const res = await fetch('/api/import', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setImportPreview(data.preview);
    return data;
  } catch (error) {
    console.error('Failed to import data:', error);
    return null;
  } finally {
    setLoading('import', false);
  }
};

export const fetchImportBatches = async () => {
  const { setLoading, setImportBatches } = useAppStore.getState();
  setLoading('importBatches', true);
  try {
    const res = await fetch('/api/import/batches');
    const data = await res.json();
    setImportBatches(data);
  } catch (error) {
    console.error('Failed to fetch import batches:', error);
  } finally {
    setLoading('importBatches', false);
  }
};

export const exportReport = async (format: 'xlsx' | 'csv' | 'pdf', batchIds?: string[]) => {
  const { setLoading } = useAppStore.getState();
  setLoading('export', true);
  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, batchIds }),
    });
    const data = await res.json();
    window.open(data.url, '_blank');
    return data;
  } catch (error) {
    console.error('Failed to export report:', error);
    return null;
  } finally {
    setLoading('export', false);
  }
};
