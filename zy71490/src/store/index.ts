import type {
  Preset,
  KeyboardModel,
  PedalMapping,
  CompatibilityResult,
  PresetOverride,
  PolarityIssue,
  FilterState,
} from '@/types';
import { create } from 'zustand';
import { runFullCompatibilityCheck } from '@/utils/compatibility';

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SAMPLE_PRESETS: Preset[] = [
  {
    id: 'p1',
    name: 'Concert Grand',
    version: '2.1',
    source: 'Yamaha官方库',
    importedAt: '2026-05-10T08:00:00Z',
    status: 'active',
    params: { reverb: 0.6, brightness: 0.8, layerMode: 'single' },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p2',
    name: 'FM Synth',
    version: '1.3',
    source: 'Dexed导出',
    importedAt: '2026-05-12T10:30:00Z',
    status: 'active',
    params: { algorithm: 5, feedback: 0.4, operatorLevels: [0.8, 0.6, 0.3, 0.9] },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p3',
    name: 'Drawbar Organ',
    version: '1.0',
    source: 'Nord用户分享',
    importedAt: '2026-05-08T14:00:00Z',
    status: 'active',
    params: { drawbars: [8, 0, 4, 0, 2, 1, 0, 0, 3], rotarySpeed: 'fast' },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p4',
    name: 'Concert Grand',
    version: '2.0',
    source: '旧工程备份',
    importedAt: '2026-04-15T09:00:00Z',
    status: 'overridden',
    params: { reverb: 0.5, brightness: 0.7, layerMode: 'dual' },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p5',
    name: 'Wavetable Lead',
    version: '3.2',
    source: 'Serum导出',
    importedAt: '2026-05-14T16:00:00Z',
    status: 'active',
    params: { wavetablePos: 64, filterCutoff: 800, resonance: 0.7 },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p6',
    name: 'VA Bass',
    version: '1.1',
    source: 'Arturia导出',
    importedAt: '2026-05-13T11:00:00Z',
    status: 'active',
    params: { oscillator: 'saw', filterEnv: 0.6, ampEnv: [0.1, 0.3, 0.8, 0.5] },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p7',
    name: 'Analog Pad',
    version: '2.0',
    source: 'OP-X导出',
    importedAt: '2026-05-11T07:00:00Z',
    status: 'active',
    params: { detune: 12, voices: 8, attack: 1.2 },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p8',
    name: 'Granular Texture',
    version: '1.0',
    source: 'Kurzweil用户库',
    importedAt: '2026-05-09T13:00:00Z',
    status: 'active',
    params: { grainSize: 50, scatter: 0.3, density: 0.6 },
    isArchived: false,
    archivedAt: null,
  },
  {
    id: 'p9',
    name: 'Electric Piano',
    version: '1.5',
    source: 'Lounge Lizard导出',
    importedAt: '2026-05-07T10:00:00Z',
    status: 'archived',
    params: { pickup: 'neck', tremolo: 0.3, drive: 0.1 },
    isArchived: true,
    archivedAt: '2026-05-12T10:00:00Z',
  },
  {
    id: 'p10',
    name: 'Drawbar Organ',
    version: '1.0',
    source: '旧工程备份',
    importedAt: '2026-03-20T08:00:00Z',
    status: 'archived',
    params: { drawbars: [8, 0, 4, 0, 2, 1, 0, 0, 2], rotarySpeed: 'slow' },
    isArchived: true,
    archivedAt: '2026-05-08T14:00:00Z',
  },
];

const SAMPLE_MODELS: KeyboardModel[] = [
  {
    id: 'm1',
    brand: 'Nord',
    model: 'Stage 3',
    firmwareVersion: '2.14',
    addedAt: '2026-05-01T08:00:00Z',
  },
  {
    id: 'm2',
    brand: 'Korg',
    model: 'Kronos',
    firmwareVersion: '3.1.2',
    addedAt: '2026-05-02T09:00:00Z',
  },
  {
    id: 'm3',
    brand: 'Yamaha',
    model: 'MODX',
    firmwareVersion: '3.50',
    addedAt: '2026-05-03T10:00:00Z',
  },
  {
    id: 'm4',
    brand: 'Roland',
    model: 'Fantom',
    firmwareVersion: '2.01',
    addedAt: '2026-05-04T11:00:00Z',
  },
  {
    id: 'm5',
    brand: 'Kurzweil',
    model: 'PC4',
    firmwareVersion: '1.5.0',
    addedAt: '2026-05-05T12:00:00Z',
  },
];

const SAMPLE_MAPPINGS: PedalMapping[] = [
  {
    id: 'pd1',
    name: 'Expression Pedal',
    version: '2.0',
    source: '出厂默认',
    polarity: 'normal',
    ccMappings: { CC11: 0, CC1: 0 },
    importedAt: '2026-05-06T08:00:00Z',
    isActive: true,
  },
  {
    id: 'pd2',
    name: 'Sustain Pedal',
    version: '1.0',
    source: '出厂默认',
    polarity: 'normal',
    ccMappings: { CC64: 0 },
    importedAt: '2026-05-06T08:00:00Z',
    isActive: true,
  },
  {
    id: 'pd3',
    name: 'Sustain Pedal',
    version: '2.0',
    source: '巡演配置',
    polarity: 'reversed',
    ccMappings: { CC64: 0 },
    importedAt: '2026-05-15T10:00:00Z',
    isActive: true,
  },
  {
    id: 'pd4',
    name: 'Mod Wheel',
    version: '1.0',
    source: '出厂默认',
    polarity: 'normal',
    ccMappings: { CC1: 0 },
    importedAt: '2026-05-06T08:00:00Z',
    isActive: true,
  },
  {
    id: 'pd5',
    name: 'Expression Pedal',
    version: '1.0',
    source: '旧工程备份',
    polarity: 'reversed',
    ccMappings: { CC11: 0, CC1: 0 },
    importedAt: '2026-04-01T08:00:00Z',
    isActive: true,
  },
];

interface StoreState {
  presets: Preset[];
  models: KeyboardModel[];
  mappings: PedalMapping[];
  compatibilityResults: CompatibilityResult[];
  presetOverrides: PresetOverride[];
  polarityIssues: PolarityIssue[];
  filters: FilterState;
  selectedPresetId: string | null;
  selectedModelId: string | null;
  selectedMappingId: string | null;

  addPreset: (preset: Omit<Preset, 'id' | 'importedAt' | 'status'>) => void;
  archivePreset: (id: string) => void;
  addModel: (model: Omit<KeyboardModel, 'id' | 'addedAt'>) => void;
  addMapping: (mapping: Omit<PedalMapping, 'id' | 'importedAt' | 'isActive'>) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  setSelectedPreset: (id: string | null) => void;
  setSelectedModel: (id: string | null) => void;
  setSelectedMapping: (id: string | null) => void;
  runCompatibility: () => void;
  getFilteredPresets: () => Preset[];
  getFilteredModels: () => KeyboardModel[];
  getFilteredMappings: () => PedalMapping[];
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  issueType: '',
  modelId: '',
  presetId: '',
  mappingId: '',
  dateFrom: '',
  dateTo: '',
};

function applyPresetFilters(presets: Preset[], filters: FilterState): Preset[] {
  return presets.filter((p) => {
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase()) && !p.source.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.status === 'active' && p.isArchived) return false;
    if (filters.status === 'archived' && !p.isArchived) return false;
    if (filters.dateFrom && new Date(p.importedAt) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(p.importedAt) > new Date(filters.dateTo + 'T23:59:59Z')) return false;
    return true;
  });
}

function applyModelFilters(models: KeyboardModel[], filters: FilterState): KeyboardModel[] {
  return models.filter((m) => {
    if (filters.search && !`${m.brand} ${m.model}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
}

function applyMappingFilters(mappings: PedalMapping[], filters: FilterState): PedalMapping[] {
  return mappings.filter((m) => {
    if (filters.search && !m.name.toLowerCase().includes(filters.search.toLowerCase()) && !m.source.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.modelId && m.polarity === 'reversed') return true;
    return true;
  });
}

export const useStore = create<StoreState>((set, get) => ({
  presets: SAMPLE_PRESETS,
  models: SAMPLE_MODELS,
  mappings: SAMPLE_MAPPINGS,
  compatibilityResults: [],
  presetOverrides: [],
  polarityIssues: [],
  filters: { ...DEFAULT_FILTERS },
  selectedPresetId: null,
  selectedModelId: null,
  selectedMappingId: null,

  addPreset: (preset) => {
    const now = new Date().toISOString();
    const newPreset: Preset = {
      ...preset,
      id: genId(),
      importedAt: now,
      status: preset.isArchived ? 'archived' : 'active',
    };
    set((s) => ({ presets: [...s.presets, newPreset] }));
    get().runCompatibility();
  },

  archivePreset: (id) => {
    set((s) => ({
      presets: s.presets.map((p) =>
        p.id === id
          ? { ...p, isArchived: true, archivedAt: new Date().toISOString(), status: 'archived' as const }
          : p
      ),
    }));
    get().runCompatibility();
  },

  addModel: (model) => {
    const newModel: KeyboardModel = {
      ...model,
      id: genId(),
      addedAt: new Date().toISOString(),
    };
    set((s) => ({ models: [...s.models, newModel] }));
    get().runCompatibility();
  },

  addMapping: (mapping) => {
    const newMapping: PedalMapping = {
      ...mapping,
      id: genId(),
      importedAt: new Date().toISOString(),
      isActive: true,
    };
    set((s) => ({ mappings: [...s.mappings, newMapping] }));
    get().runCompatibility();
  },

  setFilters: (newFilters) => {
    set((s) => ({ filters: { ...s.filters, ...newFilters } }));
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
  },

  setSelectedPreset: (id) => set({ selectedPresetId: id }),
  setSelectedModel: (id) => set({ selectedModelId: id }),
  setSelectedMapping: (id) => set({ selectedMappingId: id }),

  runCompatibility: () => {
    const { presets, models, mappings } = get();
    const result = runFullCompatibilityCheck(presets, models, mappings);

    const overrides: PresetOverride[] = result.overrides.map((o) => {
      const newer = presets.find((p) => p.id === o.newerId);
      const older = presets.find((p) => p.id === o.olderId);
      const affectedModelIds = models.map((m) => m.id);
      const affectedMappingIds = mappings.filter((m) => m.isActive).map((m) => m.id);
      return {
        id: genId(),
        newerPresetId: o.newerId,
        olderPresetId: o.olderId,
        affectedModelIds,
        affectedMappingIds,
        description: o.description,
        detectedAt: new Date().toISOString(),
      };
    });

    const polarityIssues: PolarityIssue[] = result.polarityIssues.map((pi) => {
      const mapping = mappings.find((m) => m.id === pi.mappingId);
      const affectedPresetIds = presets.filter((p) => !p.isArchived).map((p) => p.id);
      const affectedModelIds = models.map((m) => m.id);
      return {
        id: genId(),
        mappingId: pi.mappingId,
        previousMappingId: pi.previousMappingId,
        affectedPresetIds,
        affectedModelIds,
        description: pi.description,
        detectedAt: new Date().toISOString(),
      };
    });

    const compatResults: CompatibilityResult[] = [];
    for (const mi of result.modelIssues) {
      const preset = presets.find((p) => p.id === mi.presetId);
      const model = models.find((m) => m.id === mi.modelId);
      const activeMappings = mappings.filter((m) => m.isActive);
      for (const am of activeMappings) {
        compatResults.push({
          id: genId(),
          presetId: mi.presetId,
          modelId: mi.modelId,
          mappingId: am.id,
          status: 'incompatible',
          issueType: 'model_incompatible',
          affectedItems: [mi.presetId, mi.modelId],
          description: mi.reason,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    for (const override of result.overrides) {
      const activeMappings = mappings.filter((m) => m.isActive);
      for (const am of activeMappings) {
        compatResults.push({
          id: genId(),
          presetId: override.olderId,
          modelId: models[0]?.id || '',
          mappingId: am.id,
          status: 'override_pending',
          issueType: 'override',
          affectedItems: [override.olderId, override.newerId],
          description: override.description,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    for (const pi of result.polarityIssues) {
      const activePresets = presets.filter((p) => !p.isArchived);
      for (const ap of activePresets) {
        for (const model of models) {
          compatResults.push({
            id: genId(),
            presetId: ap.id,
            modelId: model.id,
            mappingId: pi.mappingId,
            status: 'polarity_warning',
            issueType: 'polarity_reversed',
            affectedItems: [pi.mappingId, ap.id, model.id],
            description: pi.description,
            checkedAt: new Date().toISOString(),
          });
        }
      }
    }

    set({
      presetOverrides: overrides,
      polarityIssues,
      compatibilityResults: compatResults,
    });
  },

  getFilteredPresets: () => {
    const { presets, filters } = get();
    return applyPresetFilters(presets, filters);
  },

  getFilteredModels: () => {
    const { models, filters } = get();
    return applyModelFilters(models, filters);
  },

  getFilteredMappings: () => {
    const { mappings, filters } = get();
    return applyMappingFilters(mappings, filters);
  },
}));
