import { DrumPieceType, PolarPattern, DistanceUnit } from '@/types';

export const DRUM_PIECE_NAMES: Record<DrumPieceType, string> = {
  snare: '军鼓',
  kick: '底鼓',
  tom1: '一通鼓',
  tom2: '二通鼓',
  floorTom: '落地通鼓',
  hihat: '踩镲',
  crash: '碎音镲',
  ride: '叮叮镲',
};

export const DRUM_PIECE_SIZES: Record<DrumPieceType, string> = {
  snare: '14" × 6.5"',
  kick: '22" × 18"',
  tom1: '12" × 9"',
  tom2: '13" × 10"',
  floorTom: '16" × 16"',
  hihat: '14"',
  crash: '18"',
  ride: '20"',
};

export const POLAR_PATTERN_NAMES: Record<PolarPattern, string> = {
  cardioid: '心形指向',
  omnidirectional: '全指向',
  bidirectional: '八字指向',
  figure8: '双指向',
};

export const DISTANCE_UNIT_NAMES: Record<DistanceUnit, string> = {
  cm: '厘米 (cm)',
  m: '米 (m)',
  inch: '英寸 (inch)',
};

export const DISTANCE_UNIT_FACTORS: Record<DistanceUnit, number> = {
  cm: 0.01,
  m: 1,
  inch: 0.0254,
};

export const MIC_MODEL_OPTIONS = [
  'Shure SM57',
  'Shure SM58',
  'Sennheiser E604',
  'Sennheiser MD421',
  'AKG D112',
  'Shure Beta 52A',
  'Neumann U47',
  'AKG C414',
  'Rode NT1-A',
  '其他',
];

export const DEFAULT_DRUM_PIECES = [
  { type: 'kick' as DrumPieceType, position: { x: 0, y: 0.3, z: 1.2 }, rotationY: 0 },
  { type: 'snare' as DrumPieceType, position: { x: 0, y: 0.6, z: -0.3 }, rotationY: 0 },
  { type: 'tom1' as DrumPieceType, position: { x: -0.5, y: 1.0, z: 0.2 }, rotationY: -0.3 },
  { type: 'tom2' as DrumPieceType, position: { x: 0.5, y: 1.0, z: 0.2 }, rotationY: 0.3 },
  { type: 'floorTom' as DrumPieceType, position: { x: 0.9, y: 0.6, z: -0.1 }, rotationY: 0.4 },
  { type: 'hihat' as DrumPieceType, position: { x: -0.9, y: 0.9, z: -0.5 }, rotationY: -0.5 },
  { type: 'crash' as DrumPieceType, position: { x: -1.0, y: 1.4, z: 0.4 }, rotationY: -0.8 },
  { type: 'ride' as DrumPieceType, position: { x: 1.2, y: 1.2, z: 0.3 }, rotationY: 0.8 },
];

export const DEFAULT_MICROPHONES = [
  {
    drumPieceType: 'kick' as DrumPieceType,
    name: '底鼓内麦',
    model: 'AKG D112',
    position: { x: 0, y: 0.3, z: 1.5 },
    rotation: { x: 0, y: Math.PI, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: 0,
  },
  {
    drumPieceType: 'snare' as DrumPieceType,
    name: '军鼓上麦',
    model: 'Shure SM57',
    position: { x: 0, y: 0.9, z: -0.5 },
    rotation: { x: -0.5, y: 0, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: 0,
  },
  {
    drumPieceType: 'snare' as DrumPieceType,
    name: '军鼓下麦',
    model: 'Shure SM57',
    position: { x: 0, y: 0.3, z: -0.5 },
    rotation: { x: 0.5, y: 0, z: Math.PI },
    polarPattern: 'cardioid' as PolarPattern,
    phaseInverted: true,
    distanceUnit: 'cm' as DistanceUnit,
    gain: -3,
  },
  {
    drumPieceType: 'tom1' as DrumPieceType,
    name: '一通鼓麦',
    model: 'Sennheiser E604',
    position: { x: -0.7, y: 1.1, z: 0.4 },
    rotation: { x: -0.4, y: 0.3, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: 0,
  },
  {
    drumPieceType: 'tom2' as DrumPieceType,
    name: '二通鼓麦',
    model: 'Sennheiser E604',
    position: { x: 0.7, y: 1.1, z: 0.4 },
    rotation: { x: -0.4, y: -0.3, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: 0,
  },
  {
    drumPieceType: 'floorTom' as DrumPieceType,
    name: '落地通鼓麦',
    model: 'Sennheiser MD421',
    position: { x: 1.1, y: 0.7, z: -0.3 },
    rotation: { x: -0.3, y: -0.4, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: 0,
  },
  {
    drumPieceType: 'hihat' as DrumPieceType,
    name: '踩镲麦',
    model: 'Shure SM57',
    position: { x: -1.1, y: 1.2, z: -0.7 },
    rotation: { x: -0.4, y: 0.5, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: -2,
  },
  {
    drumPieceType: 'crash' as DrumPieceType,
    name: '碎音镲麦',
    model: 'AKG C414',
    position: { x: -1.2, y: 1.7, z: 0.6 },
    rotation: { x: -0.6, y: 0.8, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: -5,
  },
  {
    drumPieceType: 'ride' as DrumPieceType,
    name: '叮叮镲麦',
    model: 'AKG C414',
    position: { x: 1.4, y: 1.5, z: 0.5 },
    rotation: { x: -0.5, y: -0.8, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'cm' as DistanceUnit,
    gain: -5,
  },
  {
    drumPieceType: 'snare' as DrumPieceType,
    name: ' overhead L',
    model: 'Neumann U47',
    position: { x: -1.5, y: 2.5, z: -1 },
    rotation: { x: -0.8, y: 0.3, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'm' as DistanceUnit,
    gain: -8,
  },
  {
    drumPieceType: 'snare' as DrumPieceType,
    name: 'overhead R',
    model: 'Neumann U47',
    position: { x: 1.5, y: 2.5, z: -1 },
    rotation: { x: -0.8, y: -0.3, z: 0 },
    polarPattern: 'cardioid' as PolarPattern,
    distanceUnit: 'm' as DistanceUnit,
    gain: -8,
  },
];

export const COLORS = {
  background: '#0f172a',
  panel: '#1e293b',
  accent: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#cbd5e1',
  textMuted: '#64748b',
  border: '#334155',
};

export const PHASE_COLORS = [
  { threshold: 30, color: '#10b981', label: '同相' },
  { threshold: 90, color: '#f59e0b', label: '轻微偏移' },
  { threshold: 150, color: '#f97316', label: '中度偏移' },
  { threshold: 210, color: '#ef4444', label: '反向风险' },
  { threshold: 270, color: '#f97316', label: '中度偏移' },
  { threshold: 330, color: '#f59e0b', label: '轻微偏移' },
  { threshold: 360, color: '#10b981', label: '同相' },
];

export const CROSSTALK_COLORS = [
  { threshold: -40, color: '#10b981' },
  { threshold: -30, color: '#84cc16' },
  { threshold: -20, color: '#f59e0b' },
  { threshold: -10, color: '#f97316' },
  { threshold: 0, color: '#ef4444' },
];
