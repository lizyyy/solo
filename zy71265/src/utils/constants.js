export const COLORS = {
  primary: 0x667eea,
  secondary: 0x764ba2,
  accent: 0xfbbf24,
  success: 0x22c55e,
  warning: 0xf59e0b,
  danger: 0xef4444,
  info: 0x3b82f6,
  white: 0xffffff,
  floor: 0x2a2a3e,
  wall: 0x3d3d5c,
  artwork: 0x8b5cf6
};

export const HEATMAP_COLORS = [
  { stop: 0.0, color: [34, 197, 94] },
  { stop: 0.5, color: [234, 179, 8] },
  { stop: 1.0, color: [239, 68, 68] }
];

export const VIEW_MODES = {
  PERSPECTIVE: 'perspective',
  TOP: 'top',
  FRONT: 'front',
  SIDE: 'side',
  ORBIT: 'orbit'
};

export const VISUAL_MODES = {
  NORMAL: 'normal',
  HEATMAP: 'heatmap',
  PATH: 'path',
  COMBINED: 'combined'
};

export const CONFLICT_ACTIONS = {
  SKIP: 'skip',
  OVERWRITE: 'overwrite',
  APPEND: 'append'
};

export const FILTER_TYPES = {
  ALL: 'all',
  BATCH: 'batch',
  FLOOR: 'floor',
  ARTWORK: 'artwork'
};

export const EXPORT_FORMATS = {
  JSON: 'json',
  HTML: 'html',
  CSV: 'csv'
};

export const STORAGE_KEYS = {
  RECORDS: 'gallery_heatmap_records',
  CURRENT_RECORD: 'gallery_heatmap_current',
  SETTINGS: 'gallery_heatmap_settings',
  IMPORTED_FILES: 'gallery_heatmap_imported_files'
};

export const DEFAULT_SETTINGS = {
  heatmapOpacity: 0.6,
  heatmapRadius: 2.5,
  pathOpacity: 0.8,
  pathWidth: 2,
  animationSpeed: 1,
  showLabels: true,
  showGrid: true,
  showFloorPlan: true,
  activeFloor: 1,
  viewMode: 'perspective',
  visualMode: 'combined'
};

export const GALLERY_DIMENSIONS = {
  width: 40,
  height: 6,
  depth: 30,
  wallThickness: 0.5,
  floorCount: 2
};
