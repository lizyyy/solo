export interface Work {
  id: string;
  studentName: string;
  title: string;
  imageUrl: string;
  themeTag: string;
  status: 'complete' | 'incomplete';
}

export interface ColorSwatch {
  id: string;
  workId: string;
  hex: string;
  colorName: string;
  hue: number;
  saturation: number;
  lightness: number;
  oklch_l: number;
  oklch_c: number;
  oklch_h: number;
  isBackground: boolean;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface OKLCH {
  L: number;
  C: number;
  H: number;
}

export interface DistanceRecord {
  id: string;
  workAId: string;
  workBId: string;
  totalDistance: number;
  hueDistance: number;
  lightnessDistance: number;
  saturationDistance: number;
  ciede2000: number;
  euclideanRgb: number;
}

export interface DirtyDataAlert {
  id: string;
  workId: string;
  colorId: string;
  issueType: 'same_color_different_name' | 'background_contamination' | 'distance_scale_error';
  description: string;
  suggestion: string;
  severity: 'critical' | 'warning' | 'info';
  resolved: boolean;
}

export interface Cluster {
  id: string;
  label: string;
  description: string;
  workIds: string[];
  representativeWorkId: string;
  avgHue: number;
  avgSaturation: number;
  avgLightness: number;
}

export interface PendingRecord {
  id: string;
  workId: string;
  missingField: string;
  note: string;
  completed: boolean;
}
