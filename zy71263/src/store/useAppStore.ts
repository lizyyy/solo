import { create } from 'zustand';
import type { Quaternion, EulerAngles, InterpolationConfig, ValidationResult } from '@/types';
import { quatNormalize, quatNorm } from '@/utils/quaternion';
import { eulerToQuaternion, quaternionToEuler, isGimbalLock } from '@/utils/euler';
import { validateAll } from '@/utils/validation';
import { isLongPath } from '@/utils/interpolation';
import { samplePacks } from '@/utils/samples';
import { saveParameters, loadParameters, exportReport, downloadJson } from '@/utils/persistence';

interface AppState {
  currentQuaternion: Quaternion;
  targetQuaternion: Quaternion;
  eulerAngles: EulerAngles;
  interpolationConfig: InterpolationConfig;
  validationResults: ValidationResult[];
  animationProgress: number;
  isPlaying: boolean;
  selectedSampleId: string | null;
  singularityPoints: EulerAngles[];
  activePanel: 'params' | 'samples' | 'export';

  setCurrentQuaternion: (q: Quaternion) => void;
  setTargetQuaternion: (q: Quaternion) => void;
  setEulerAngles: (e: EulerAngles) => void;
  setInterpolationConfig: (c: Partial<InterpolationConfig>) => void;
  setAnimationProgress: (p: number) => void;
  togglePlayback: () => void;
  stopPlayback: () => void;
  loadSample: (id: string) => void;
  saveCurrentParameters: () => void;
  loadSavedParameters: () => void;
  exportCurrentReport: () => void;
  setActivePanel: (p: 'params' | 'samples' | 'export') => void;
  negateTargetQuaternion: () => void;
  normalizeCurrentQuaternion: () => void;
  normalizeTargetQuaternion: () => void;
}

function runValidation(q: Quaternion, euler: EulerAngles, target: Quaternion): ValidationResult[] {
  return validateAll(q, euler, target);
}

const defaultQuaternion: Quaternion = { w: 1, x: 0, y: 0, z: 0, source: 'raw' };
const defaultEuler: EulerAngles = { roll: 0, pitch: 0, yaw: 0, sequence: 'ZYX', source: 'raw' };
const defaultConfig: InterpolationConfig = { method: 'slerp', steps: 30 };

const saved = loadParameters();

export const useAppStore = create<AppState>((set, get) => ({
  currentQuaternion: saved?.currentQuaternion ?? { ...defaultQuaternion },
  targetQuaternion: saved?.targetQuaternion ?? { w: 0.7071, x: 0, y: 0, z: 0.7071, source: 'raw' },
  eulerAngles: saved?.eulerAngles ?? { ...defaultEuler },
  interpolationConfig: saved?.interpolationConfig ?? { ...defaultConfig },
  validationResults: [],
  animationProgress: 0,
  isPlaying: false,
  selectedSampleId: null,
  singularityPoints: [],
  activePanel: 'params',

  setCurrentQuaternion: (q: Quaternion) => {
    const euler = quaternionToEuler(q, get().eulerAngles.sequence);
    const validations = runValidation(q, euler, get().targetQuaternion);
    const gimbalPts = isGimbalLock(euler) ? [euler] : [];
    set({ currentQuaternion: q, eulerAngles: euler, validationResults: validations, singularityPoints: gimbalPts });
  },

  setTargetQuaternion: (q: Quaternion) => {
    const validations = runValidation(get().currentQuaternion, get().eulerAngles, q);
    set({ targetQuaternion: q, validationResults: validations });
  },

  setEulerAngles: (e: EulerAngles) => {
    const q = eulerToQuaternion(e);
    const validations = runValidation(q, e, get().targetQuaternion);
    const gimbalPts = isGimbalLock(e) ? [e] : [];
    set({ eulerAngles: e, currentQuaternion: q, validationResults: validations, singularityPoints: gimbalPts });
  },

  setInterpolationConfig: (c: Partial<InterpolationConfig>) => {
    set((s) => ({ interpolationConfig: { ...s.interpolationConfig, ...c } }));
  },

  setAnimationProgress: (p: number) => set({ animationProgress: p }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stopPlayback: () => set({ isPlaying: false }),

  loadSample: (id: string) => {
    const sample = samplePacks.find((s) => s.id === id);
    if (!sample) return;
    const euler = quaternionToEuler(sample.quaternion, sample.eulerAngles.sequence);
    const validations = runValidation(sample.quaternion, euler, sample.targetAttitude);
    const gimbalPts = isGimbalLock(euler) ? [euler] : [];
    set({
      currentQuaternion: sample.quaternion,
      targetQuaternion: sample.targetAttitude,
      eulerAngles: { ...euler, source: sample.eulerAngles.source },
      interpolationConfig: { method: 'slerp', steps: sample.interpolationSteps },
      selectedSampleId: id,
      validationResults: validations,
      singularityPoints: gimbalPts,
      animationProgress: 0,
      isPlaying: false,
    });
  },

  saveCurrentParameters: () => {
    const s = get();
    saveParameters({
      currentQuaternion: s.currentQuaternion,
      targetQuaternion: s.targetQuaternion,
      eulerAngles: s.eulerAngles,
      interpolationConfig: s.interpolationConfig,
    });
  },

  loadSavedParameters: () => {
    const saved = loadParameters();
    if (!saved) return;
    const validations = runValidation(saved.currentQuaternion, saved.eulerAngles, saved.targetQuaternion);
    set({ ...saved, validationResults: validations });
  },

  exportCurrentReport: () => {
    const s = get();
    const selectedSample = s.selectedSampleId
      ? samplePacks.find((p) => p.id === s.selectedSampleId) ?? null
      : null;
    const data = {
      timestamp: new Date().toISOString(),
      currentQuaternion: s.currentQuaternion,
      targetQuaternion: s.targetQuaternion,
      eulerAngles: s.eulerAngles,
      interpolationConfig: s.interpolationConfig,
      validationResults: s.validationResults,
      animationProgress: s.animationProgress,
      attitudeModel: selectedSample?.attitudeModel ?? null,
      sampleReport: selectedSample?.report ?? null,
      sampleItems: selectedSample?.items ?? null,
    };
    const json = exportReport(data);
    downloadJson(json, `quat-report-${Date.now()}.json`);
  },

  setActivePanel: (p) => set({ activePanel: p }),

  negateTargetQuaternion: () => {
    const t = get().targetQuaternion;
    const negated: Quaternion = { w: -t.w, x: -t.x, y: -t.y, z: -t.z, source: t.source };
    const validations = runValidation(get().currentQuaternion, get().eulerAngles, negated);
    set({ targetQuaternion: negated, validationResults: validations });
  },

  normalizeCurrentQuaternion: () => {
    const q = get().currentQuaternion;
    const nq = quatNormalize(q);
    const euler = quaternionToEuler(nq, get().eulerAngles.sequence);
    const validations = runValidation(nq, euler, get().targetQuaternion);
    set({ currentQuaternion: { ...nq, source: 'computed' }, eulerAngles: euler, validationResults: validations });
  },

  normalizeTargetQuaternion: () => {
    const t = get().targetQuaternion;
    const nt = quatNormalize(t);
    const validations = runValidation(get().currentQuaternion, get().eulerAngles, nt);
    set({ targetQuaternion: { ...nt, source: 'computed' }, validationResults: validations });
  },
}));

export function getQuatNormDisplay(q: Quaternion): string {
  return quatNorm(q).toFixed(6);
}

export function isLongPathActive(q1: Quaternion, q2: Quaternion): boolean {
  return isLongPath(q1, q2);
}
