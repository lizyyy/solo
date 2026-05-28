export const INSTRUMENT_COLORS: Record<string, string> = {
  drums: '#ff6b35',
  bass: '#00f0ff',
  vocals: '#ff3366',
  guitar: '#00ff88',
  keys: '#ffd700',
};

export const INSTRUMENT_LABELS: Record<string, string> = {
  drums: '架子鼓',
  bass: '贝斯',
  vocals: '人声',
  guitar: '吉他',
  keys: '键盘',
};

export const INSTRUMENT_ICONS: Record<string, string> = {
  drums: '🥁',
  bass: '🎸',
  vocals: '🎤',
  guitar: '🎸',
  keys: '🎹',
};

export const DEFAULT_ROOM_CONFIG = {
  length: 10,
  width: 8,
  height: 3.5,
  wallMaterial: 'acoustic_panels',
  reverbTime: 0.8,
  ambientNoise: 35,
};

export const DEFAULT_MUSICIANS = [
  {
    type: 'drums',
    name: '鼓手',
    position: { x: -3, y: 0, z: -2 },
    rotation: Math.PI,
    sourceLevel: 105,
    directivity: 0.3,
  },
  {
    type: 'bass',
    name: '贝斯手',
    position: { x: 0, y: 0, z: -2.5 },
    rotation: Math.PI,
    sourceLevel: 95,
    directivity: 0.5,
  },
  {
    type: 'vocals',
    name: '主唱',
    position: { x: 2, y: 0, z: 1 },
    rotation: 0,
    sourceLevel: 90,
    directivity: 0.8,
  },
];

export const DEFAULT_MONITOR_POINTS = [
  {
    name: '混音位',
    position: { x: 0, y: 1.5, z: 3.5 },
  },
];

export const HEATMAP_GRID_SIZE = 0.5;
export const SOUND_OVERLAP_THRESHOLD = 0.5;
export const MIN_MONITOR_SOUND_LEVEL = 60;
export const MAX_VOLUME_RATIO = 0.6;
export const MIN_VOLUME_RATIO = 0.1;

export const DB_COLORS = [
  { level: 50, color: [0, 0, 255] },
  { level: 65, color: [0, 255, 255] },
  { level: 80, color: [0, 255, 0] },
  { level: 95, color: [255, 255, 0] },
  { level: 110, color: [255, 0, 0] },
];

export const WALL_MATERIALS = [
  { value: 'concrete', label: '混凝土', reverb: 1.5 },
  { value: 'drywall', label: '石膏板', reverb: 1.0 },
  { value: 'acoustic_panels', label: '吸音板', reverb: 0.6 },
  { value: 'wood', label: '木质', reverb: 0.8 },
  { value: 'brick', label: '砖墙', reverb: 1.2 },
];
