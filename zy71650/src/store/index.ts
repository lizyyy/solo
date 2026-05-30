import { create } from 'zustand';
import type {
  ADSRParams,
  AudioFileInfo,
  FittingRecord,
  CompareResponse,
  AnomalyType,
} from '../types';

interface AppState {
  audioFile: AudioFileInfo | null;
  onsetSample: number;
  waveformData: number[];

  currentRecord: FittingRecord | null;
  allRecords: FittingRecord[];
  isFitting: boolean;

  selectedRecordIds: string[];
  compareResult: CompareResponse | null;

  activeTab: 'workstation' | 'detail' | 'compare';
  anomalyFilter: AnomalyType | 'all';

  uploadAudio: (file: File) => Promise<void>;
  setOnsetSample: (sample: number) => void;
  fitADSR: (instrumentLabel: string, notes: string) => Promise<void>;
  updateCorrected: (recordId: string, corrected: ADSRParams, judgment: string) => Promise<void>;
  updateNotes: (recordId: string, content: string) => Promise<void>;
  fetchRecords: () => Promise<void>;
  fetchRecord: (id: string) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  compareRecords: (recordIds: string[]) => Promise<void>;
  setSelectedRecordIds: (ids: string[]) => void;
  setActiveTab: (tab: 'workstation' | 'detail' | 'compare') => void;
  setAnomalyFilter: (filter: AnomalyType | 'all') => void;
}

function downsample(data: Float32Array, targetLength: number): number[] {
  if (data.length <= targetLength) {
    return Array.from(data);
  }
  const step = data.length / targetLength;
  const result: number[] = [];
  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += data[j];
    }
    result.push(sum / (end - start));
  }
  return result;
}

function mapRecordToFE(r: any): FittingRecord {
  const raw = { attack: r.raw_attack, decay: r.raw_decay, sustain: r.raw_sustain, release: r.raw_release };
  const corrected = r.corrected_attack != null
    ? { attack: r.corrected_attack, decay: r.corrected_decay, sustain: r.corrected_sustain, release: r.corrected_release }
    : null;
  const conclusion = { attack: r.conclusion_attack, decay: r.conclusion_decay, sustain: r.conclusion_sustain, release: r.conclusion_release };
  return {
    id: r.id,
    fileId: r.file_id,
    instrumentLabel: r.instrument_label,
    bpm: r.bpm ?? null,
    raw,
    corrected,
    conclusion,
    anomalies: r.anomalies ?? [],
    notes: r.notes ?? [],
    auditEntries: r.audit_entries ?? [],
    supersededBy: r.superseded_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  audioFile: null,
  onsetSample: 0,
  waveformData: [],

  currentRecord: null,
  allRecords: [],
  isFitting: false,

  selectedRecordIds: [],
  compareResult: null,

  activeTab: 'workstation',
  anomalyFilter: 'all',

  uploadAudio: async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const waveform = downsample(channelData, 2000);
    const sampleRate = audioBuffer.sampleRate;

    const res = await fetch('/api/audio/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        samples: Array.from(channelData),
        sampleRate,
      }),
    });
    const json = await res.json();
    const audioFile: AudioFileInfo = json.data;

    set({
      audioFile,
      waveformData: waveform,
      onsetSample: 0,
    });

    audioContext.close();
  },

  setOnsetSample: (sample: number) => {
    set({ onsetSample: sample });
  },

  fitADSR: async (instrumentLabel: string, notes: string) => {
    const { audioFile, onsetSample } = get();
    if (!audioFile) return;

    set({ isFitting: true });

    try {
      const res = await fetch('/api/fitting/fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: audioFile.fileId,
          onsetSample,
          instrumentLabel,
          notes,
        }),
      });
      const json = await res.json();
      const record = mapRecordToFE(json.data);
      set((state) => ({
        currentRecord: record,
        allRecords: [record, ...state.allRecords],
      }));
    } finally {
      set({ isFitting: false });
    }
  },

  updateCorrected: async (recordId: string, corrected: ADSRParams, judgment: string) => {
    const res = await fetch(`/api/fitting/${recordId}/corrected`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corrected, judgment }),
    });
    const json = await res.json();
    const updated = mapRecordToFE(json.data);
    set((state) => ({
      currentRecord: state.currentRecord?.id === recordId ? updated : state.currentRecord,
      allRecords: state.allRecords.map((r) => (r.id === recordId ? updated : r)),
    }));
  },

  updateNotes: async (recordId: string, content: string) => {
    const res = await fetch(`/api/fitting/${recordId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    if (json.success && json.data) {
      const newNotes = json.data.map((n: any) => ({
        id: n.id,
        recordId: n.record_id,
        content: n.content,
        version: n.version,
        createdAt: n.created_at,
        isCurrent: !!n.is_current,
      }));
      set((state) => ({
        currentRecord: state.currentRecord?.id === recordId
          ? { ...state.currentRecord, notes: newNotes }
          : state.currentRecord,
        allRecords: state.allRecords.map((r) =>
          r.id === recordId ? { ...r, notes: newNotes } : r
        ),
      }));
    }
  },

  fetchRecords: async () => {
    const res = await fetch('/api/records');
    const json = await res.json();
    const records: FittingRecord[] = (json.data ?? []).map(mapRecordToFE);
    set({ allRecords: records });
  },

  fetchRecord: async (id: string) => {
    const res = await fetch(`/api/records/${id}`);
    const json = await res.json();
    const record = mapRecordToFE(json.data);
    set({ currentRecord: record });
  },

  deleteRecord: async (id: string) => {
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    set((state) => ({
      currentRecord: state.currentRecord?.id === id ? null : state.currentRecord,
      allRecords: state.allRecords.filter((r) => r.id !== id),
      selectedRecordIds: state.selectedRecordIds.filter((rid) => rid !== id),
    }));
  },

  compareRecords: async (recordIds: string[]) => {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordIds }),
    });
    const json = await res.json();
    const result: CompareResponse = {
      records: (json.data?.records ?? []).map(mapRecordToFE),
      differences: json.data?.differences ?? [],
      coverageWarnings: json.data?.coverageWarnings ?? [],
    };
    set({ compareResult: result });
  },

  setSelectedRecordIds: (ids: string[]) => {
    set({ selectedRecordIds: ids });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setAnomalyFilter: (filter) => {
    set({ anomalyFilter: filter });
  },
}));
