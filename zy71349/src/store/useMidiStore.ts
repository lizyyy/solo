import { create } from 'zustand';
import type {
  ControllerEvent,
  SoundParameter,
  MappingEntry,
  Conflict,
  Preset,
  OperationHistory,
  ReviewSession,
  SupplementalMaterial,
} from '@/types/midi';

interface MidiState {
  controllerEvents: ControllerEvent[];
  soundParameters: SoundParameter[];
  mappings: MappingEntry[];
  conflicts: Conflict[];
  presets: Preset[];
  operationHistory: OperationHistory[];
  reviewSessions: ReviewSession[];
  supplementalMaterials: SupplementalMaterial[];
  isLearning: boolean;
  learningTargetMappingId: string | null;
}

interface MidiActions {
  addControllerEvent: (event: ControllerEvent) => void;
  removeControllerEvent: (id: string) => void;
  addSoundParameter: (param: SoundParameter) => void;
  removeSoundParameter: (id: string) => void;
  createMapping: (
    controllerEventId: string,
    soundParameterId: string,
    transform?: 'linear' | 'inverse' | 'logarithmic',
    polarity?: 'normal' | 'reversed',
  ) => void;
  updateMapping: (id: string, updates: Partial<MappingEntry>) => void;
  deleteMapping: (id: string) => void;
  resolveConflict: (id: string) => void;
  savePreset: (name: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  rollbackToHistory: (historyId: string) => void;
  startLearning: (mappingId?: string) => void;
  stopLearning: () => void;
  addReviewSession: (session: ReviewSession) => void;
  addSupplementalMaterial: (material: SupplementalMaterial) => void;
  processSupplementalMaterial: (materialId: string) => void;
  exportMappings: () => string;
  exportMappingsCSV: () => string;
}

type MidiStore = MidiState & MidiActions;

const pushHistory = (
  get: () => MidiStore,
  action: OperationHistory['action'],
  payload: Record<string, unknown>,
) => {
  const state = get();
  const entry: OperationHistory = {
    id: crypto.randomUUID(),
    action,
    payload,
    timestamp: Date.now(),
    mappingSnapshot: [...state.mappings],
    conflictsSnapshot: [...state.conflicts],
  };
  return { operationHistory: [...state.operationHistory, entry] };
};

const seedControllerEvents: ControllerEvent[] = [
  {
    id: crypto.randomUUID(),
    type: 'cc',
    channel: 1,
    ccNumber: 1,
    valueRange: [0, 127],
    timestamp: Date.now(),
    label: 'Mod Wheel (Ch1)',
  },
  {
    id: crypto.randomUUID(),
    type: 'cc',
    channel: 1,
    ccNumber: 7,
    valueRange: [0, 127],
    timestamp: Date.now(),
    label: 'Volume CC7 (Ch1)',
  },
  {
    id: crypto.randomUUID(),
    type: 'cc',
    channel: 2,
    ccNumber: 64,
    valueRange: [0, 127],
    timestamp: Date.now(),
    label: 'Sustain Pedal (Ch2)',
  },
  {
    id: crypto.randomUUID(),
    type: 'cc',
    channel: 2,
    ccNumber: 1,
    valueRange: [0, 127],
    timestamp: Date.now(),
    label: 'Mod Wheel (Ch2)',
  },
  {
    id: crypto.randomUUID(),
    type: 'cc',
    channel: 3,
    ccNumber: 11,
    valueRange: [0, 127],
    timestamp: Date.now(),
    label: 'Expression (Ch3)',
  },
];

const seedSoundParameters: SoundParameter[] = [
  {
    id: crypto.randomUUID(),
    name: 'Filter Cutoff',
    type: 'continuous',
    valueRange: [20, 20000],
    category: 'Filter',
  },
  {
    id: crypto.randomUUID(),
    name: 'Volume',
    type: 'continuous',
    valueRange: [0, 127],
    category: 'Amplitude',
  },
  {
    id: crypto.randomUUID(),
    name: 'Sustain Pedal',
    type: 'toggle',
    valueRange: [0, 1],
    category: 'Performance',
  },
  {
    id: crypto.randomUUID(),
    name: 'Modulation Depth',
    type: 'continuous',
    valueRange: [0, 127],
    category: 'Modulation',
  },
  {
    id: crypto.randomUUID(),
    name: 'Expression',
    type: 'continuous',
    valueRange: [0, 127],
    category: 'Performance',
  },
  {
    id: crypto.randomUUID(),
    name: 'Reverb Mix',
    type: 'continuous',
    valueRange: [0, 100],
    category: 'Effects',
  },
  {
    id: crypto.randomUUID(),
    name: 'Attack Time',
    type: 'continuous',
    valueRange: [0, 5000],
    category: 'Envelope',
  },
  {
    id: crypto.randomUUID(),
    name: 'Release Time',
    type: 'continuous',
    valueRange: [0, 10000],
    category: 'Envelope',
  },
];

export const useMidiStore = create<MidiStore>()((set, get) => ({
  controllerEvents: seedControllerEvents,
  soundParameters: seedSoundParameters,
  mappings: [],
  conflicts: [],
  presets: [],
  operationHistory: [],
  reviewSessions: [],
  supplementalMaterials: [],
  isLearning: false,
  learningTargetMappingId: null,

  addControllerEvent: (event) =>
    set((state) => ({
      controllerEvents: [...state.controllerEvents, event],
    })),

  removeControllerEvent: (id) =>
    set((state) => ({
      controllerEvents: state.controllerEvents.filter((e) => e.id !== id),
      mappings: state.mappings.filter((m) => m.controllerEventId !== id),
    })),

  addSoundParameter: (param) =>
    set((state) => ({
      soundParameters: [...state.soundParameters, param],
    })),

  removeSoundParameter: (id) =>
    set((state) => ({
      soundParameters: state.soundParameters.filter((p) => p.id !== id),
      mappings: state.mappings.filter((m) => m.soundParameterId !== id),
    })),

  createMapping: (controllerEventId, soundParameterId, transform = 'linear', polarity = 'normal') => {
    const mapping: MappingEntry = {
      id: crypto.randomUUID(),
      controllerEventId,
      soundParameterId,
      transform,
      polarity,
      createdAt: Date.now(),
    };
    set((state) => ({
      mappings: [...state.mappings, mapping],
      ...pushHistory(get, 'create_mapping', { mappingId: mapping.id, controllerEventId, soundParameterId, transform, polarity }),
    }));
  },

  updateMapping: (id, updates) =>
    set((state) => ({
      mappings: state.mappings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      ...pushHistory(get, 'update_mapping', { mappingId: id, updates }),
    })),

  deleteMapping: (id) =>
    set((state) => ({
      mappings: state.mappings.filter((m) => m.id !== id),
      ...pushHistory(get, 'delete_mapping', { mappingId: id }),
    })),

  resolveConflict: (id) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id ? { ...c, resolvedAt: Date.now() } : c,
      ),
      ...pushHistory(get, 'resolve_conflict', { conflictId: id }),
    })),

  savePreset: (name) => {
    const state = get();
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      mappingIds: state.mappings.map((m) => m.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      snapshot: [...state.mappings],
    };
    set((state) => ({
      presets: [...state.presets, preset],
      ...pushHistory(get, 'save_preset', { presetId: preset.id, name }),
    }));
  },

  loadPreset: (id) => {
    const state = get();
    const preset = state.presets.find((p) => p.id === id);
    if (!preset) return;
    set({
      mappings: [...preset.snapshot],
      ...pushHistory(get, 'load_preset', { presetId: id }),
    });
  },

  deletePreset: (id) =>
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
    })),

  rollbackToHistory: (historyId) => {
    const state = get();
    const entry = state.operationHistory.find((h) => h.id === historyId);
    if (!entry) return;
    set({
      mappings: [...entry.mappingSnapshot],
      conflicts: [...entry.conflictsSnapshot],
    });
  },

  startLearning: (mappingId) =>
    set({
      isLearning: true,
      learningTargetMappingId: mappingId ?? null,
    }),

  stopLearning: () =>
    set({
      isLearning: false,
      learningTargetMappingId: null,
    }),

  addReviewSession: (session) =>
    set((state) => ({
      reviewSessions: [...state.reviewSessions, session],
    })),

  addSupplementalMaterial: (material) =>
    set((state) => ({
      supplementalMaterials: [...state.supplementalMaterials, material],
    })),

  processSupplementalMaterial: (materialId) =>
    set((state) => ({
      supplementalMaterials: state.supplementalMaterials.map((m) =>
        m.id === materialId ? { ...m, processedAt: Date.now() } : m,
      ),
      ...pushHistory(get, 'supplement_material', { materialId }),
    })),

  exportMappings: () => {
    const state = get();
    return JSON.stringify(state.mappings, null, 2);
  },

  exportMappingsCSV: () => {
    const state = get();
    const header = 'id,controllerEventId,soundParameterId,transform,polarity,createdAt,sourcePresetId';
    const rows = state.mappings.map((m) =>
      `${m.id},${m.controllerEventId},${m.soundParameterId},${m.transform},${m.polarity},${m.createdAt},${m.sourcePresetId ?? ''}`,
    );
    return [header, ...rows].join('\n');
  },
}));
