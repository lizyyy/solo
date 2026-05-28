export interface FilterConfig {
  id: string;
  name: string;
  classIds: string[];
  hueRange: [number, number];
  lightnessRange: [number, number];
  saturationRange: [number, number];
  savedAt: string;
}

export interface FilterState {
  selectedClassIds: string[];
  hueRange: [number, number];
  lightnessRange: [number, number];
  saturationRange: [number, number];
  savedConfigs: FilterConfig[];
  showQualityFlags: ('transparentBgRisk' | 'extremeColorRisk' | 'missingData')[];
}

export interface FilterFailureInfo {
  failed: boolean;
  count: number;
  minCount: number;
  suggestions: string[];
  recommendedClassIds: string[];
}
