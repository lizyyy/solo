import { create } from 'zustand';
import {
  SynthParams,
  HistoryItem,
  Preset,
  Score,
  Session,
  Warning,
  ValidationResult,
  ReportData,
  DEFAULT_PARAMS,
  INITIAL_SCORE,
  SourceType,
} from '../types/synth';
import { AudioEngine } from '../engine/AudioEngine';
import { validationMiddleware } from './middleware/validation';
import {
  createHistoryItem,
  createPresetHistoryItem,
  createImportHistoryItem,
} from './middleware/history';
import { scoringMiddleware } from './middleware/scoring';
import {
  generateId,
  validateSynthParams,
  sanitizeParams,
} from '../utils/validator';
import { generateReportData } from '../utils/export';

interface SynthState {
  params: SynthParams;
  history: HistoryItem[];
  presets: Preset[];
  currentScore: Score;
  sessionId: string;
  warnings: Warning[];
  isPlaying: boolean;
  sessionStartTime: number;

  setParam: (module: string, param: string, value: unknown, source?: SourceType) => void;
  noteOn: (frequency?: number) => void;
  noteOff: () => void;
  savePreset: (name: string) => { success: boolean; error?: string };
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  importConfig: (jsonString: string) => ValidationResult;
  exportConfig: () => string;
  exportSession: () => string;
  importSession: (jsonString: string) => ValidationResult;
  generateReport: () => ReportData;
  clearWarnings: () => void;
  resetSession: () => void;
}

function createNewSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function loadPresetsFromStorage(): Preset[] {
  try {
    const stored = localStorage.getItem('synth_presets');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load presets from storage');
  }
  return [];
}

function savePresetsToStorage(presets: Preset[]): void {
  try {
    localStorage.setItem('synth_presets', JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save presets to storage');
  }
}

export const useSynthStore = create<SynthState>((set, get) => ({
  params: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
  history: [],
  presets: loadPresetsFromStorage(),
  currentScore: JSON.parse(JSON.stringify(INITIAL_SCORE)),
  sessionId: createNewSessionId(),
  warnings: [],
  isPlaying: false,
  sessionStartTime: Date.now(),

  setParam: (module: string, param: string, value: unknown, source: SourceType = 'user') => {
    const state = get();
    const currentParams = state.params;

    const oldValue = (currentParams as unknown as Record<string, Record<string, unknown>>)[module]?.[param];

    const validationResult = validationMiddleware(module, param, value, currentParams);
    const finalValue = validationResult.value;

    if (validationResult.warning) {
      set((s) => ({
        warnings: [...s.warnings, validationResult.warning!],
      }));
    }

    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.setParam(module, param, finalValue);
    }

    const newParams = JSON.parse(JSON.stringify(currentParams));
    (newParams as Record<string, Record<string, unknown>>)[module][param] = finalValue;

    const tempHistoryItem = createHistoryItem(
      module,
      param,
      oldValue,
      finalValue,
      null,
      null,
      source
    );

    const { newScore, scoreImpact } = scoringMiddleware(
      state.currentScore,
      newParams,
      state.history,
      validationResult.warning,
      tempHistoryItem
    );

    const historyItem = createHistoryItem(
      module,
      param,
      oldValue,
      finalValue,
      validationResult.warning,
      scoreImpact,
      source
    );

    set({
      params: newParams,
      history: [...state.history, historyItem],
      currentScore: newScore,
    });
  },

  noteOn: async (frequency?: number) => {
    const audioEngine = AudioEngine.getInstance();
    await audioEngine.ensureStarted();
    audioEngine.noteOn(frequency);
    set({ isPlaying: true });
  },

  noteOff: () => {
    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.noteOff();
    }
    set({ isPlaying: false });
  },

  savePreset: (name: string) => {
    const state = get();

    const existing = state.presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return {
        success: false,
        error: `预设 "${name}" 已存在，请使用其他名称或确认覆盖`,
      };
    }

    const preset: Preset = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      params: JSON.parse(JSON.stringify(state.params)),
    };

    const historyItem = createPresetHistoryItem('preset_save', name, state.params);

    const newPresets = [...state.presets, preset];
    savePresetsToStorage(newPresets);

    set({
      presets: newPresets,
      history: [...state.history, historyItem],
    });

    return { success: true };
  },

  loadPreset: (id: string) => {
    const state = get();
    const preset = state.presets.find((p) => p.id === id);
    if (!preset) return;

    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.setAllParams(preset.params);
    }

    const historyItem = createPresetHistoryItem('preset_load', preset.name, preset.params);

    const { newScore } = scoringMiddleware(
      state.currentScore,
      preset.params,
      state.history,
      null,
      historyItem
    );

    set({
      params: JSON.parse(JSON.stringify(preset.params)),
      history: [...state.history, historyItem],
      currentScore: newScore,
    });
  },

  deletePreset: (id: string) => {
    const state = get();
    const newPresets = state.presets.filter((p) => p.id !== id);
    savePresetsToStorage(newPresets);
    set({ presets: newPresets });
  },

  importConfig: (jsonString: string): ValidationResult => {
    const state = get();

    let configData: { params?: SynthParams; type?: string; session?: Session };
    try {
      configData = JSON.parse(jsonString);
    } catch (e) {
      return validateSynthParams(jsonString);
    }

    let paramsToValidate: SynthParams;

    if (configData.type === 'session' && configData.session) {
      paramsToValidate = configData.session.params;
    } else if (configData.params) {
      paramsToValidate = configData.params;
    } else {
      paramsToValidate = configData as unknown as SynthParams;
    }

    const validationResult = validateSynthParams(JSON.stringify(paramsToValidate));

    if (!validationResult.valid) {
      return validationResult;
    }

    const sanitized = sanitizeParams(validationResult.correctedParams || paramsToValidate);

    if (sanitized.master.volume > 0.8) {
      sanitized.master.volume = 0.8;
      const warning: Warning = {
        type: 'clipping',
        message: '导入配置的音量过高，已自动降低到安全值 0.8',
        severity: 'medium',
        param: 'master.volume',
        value: paramsToValidate.master?.volume || 1,
        correctedValue: 0.8,
      };
      validationResult.errors.push({
        type: 'out_of_range',
        message: warning.message,
        field: 'master.volume',
        value: paramsToValidate.master?.volume,
        expected: '<= 0.8',
        actual: String(paramsToValidate.master?.volume),
      });
      set((s) => ({
        warnings: [...s.warnings, warning],
      }));
    }

    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.setAllParams(sanitized);
    }

    const historyItem = createImportHistoryItem(sanitized);

    const { newScore } = scoringMiddleware(
      state.currentScore,
      sanitized,
      state.history,
      null,
      historyItem
    );

    set({
      params: sanitized,
      history: [...state.history, historyItem],
      currentScore: newScore,
    });

    return {
      valid: true,
      errors: validationResult.errors,
      correctedParams: sanitized,
    };
  },

  exportConfig: () => {
    const state = get();
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'config',
      params: state.params,
    };
    return JSON.stringify(exportData, null, 2);
  },

  exportSession: () => {
    const state = get();
    const session: Session = {
      id: state.sessionId,
      createdAt: state.sessionStartTime,
      updatedAt: Date.now(),
      params: state.params,
      history: state.history,
      presets: state.presets,
      currentScore: state.currentScore,
    };
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      type: 'session',
      session,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importSession: (jsonString: string): ValidationResult => {
    const result = validateSynthParams(jsonString);
    if (!result.valid) {
      return result;
    }

    let sessionData: { session?: Session };
    try {
      sessionData = JSON.parse(jsonString);
    } catch (e) {
      return {
        valid: false,
        errors: [
          {
            type: 'json_parse',
            message: 'JSON 解析失败',
          },
        ],
      };
    }

    if (!sessionData.session) {
      return {
        valid: false,
        errors: [
          {
            type: 'missing_field',
            message: '缺少 session 字段',
            field: 'session',
          },
        ],
      };
    }

    const session = sessionData.session;
    const sanitized = sanitizeParams(session.params);

    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.setAllParams(sanitized);
    }

    set({
      sessionId: session.id,
      sessionStartTime: session.createdAt,
      params: sanitized,
      history: session.history || [],
      presets: session.presets || [],
      currentScore: session.currentScore || INITIAL_SCORE,
    });

    return {
      valid: true,
      errors: [],
      correctedParams: sanitized,
    };
  },

  generateReport: (): ReportData => {
    const state = get();
    const session: Session = {
      id: state.sessionId,
      createdAt: state.sessionStartTime,
      updatedAt: Date.now(),
      params: state.params,
      history: state.history,
      presets: state.presets,
      currentScore: state.currentScore,
    };
    return generateReportData(session, state.warnings);
  },

  clearWarnings: () => {
    set({ warnings: [] });
  },

  resetSession: () => {
    const audioEngine = AudioEngine.getInstance();
    if (audioEngine.getIsInitialized()) {
      audioEngine.setAllParams(DEFAULT_PARAMS);
    }

    set({
      params: JSON.parse(JSON.stringify(DEFAULT_PARAMS)),
      history: [],
      currentScore: JSON.parse(JSON.stringify(INITIAL_SCORE)),
      sessionId: createNewSessionId(),
      warnings: [],
      isPlaying: false,
      sessionStartTime: Date.now(),
    });
  },
}));
