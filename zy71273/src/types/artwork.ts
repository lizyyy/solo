export interface Artwork {
  id: string;
  title: string;
  classId: string;
  className: string;
  imageUrl: string;
  hue: number | null;
  lightness: number | null;
  saturation: number | null;
  score: number;
  dataVersion: string;
  sampledAt: string;
  qualityFlags: QualityFlags;
  versionHistory: VersionEntry[];
  notes?: string;
}

export interface QualityFlags {
  transparentBgRisk: boolean;
  extremeColorRisk: boolean;
  missingData: boolean;
  versionConflict: boolean;
}

export interface VersionEntry {
  version: string;
  timestamp: string;
  fields: Record<string, unknown>;
  note?: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  grade: string;
  artDirection: string;
  color: string;
}

export interface QualityReport {
  id: string;
  artworkId: string;
  alertType: 'transparent_bg' | 'extreme_color' | 'missing_data' | 'version_conflict' | 'filter_failure';
  severity: 'info' | 'warning' | 'error';
  description: string;
  suggestion: Record<string, unknown>;
}
