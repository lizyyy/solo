export interface Preset {
  id: string;
  name: string;
  version: string;
  source: string;
  importedAt: string;
  status: 'active' | 'archived' | 'overridden';
  params: Record<string, unknown>;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface KeyboardModel {
  id: string;
  brand: string;
  model: string;
  firmwareVersion: string;
  addedAt: string;
}

export interface PedalMapping {
  id: string;
  name: string;
  version: string;
  source: string;
  polarity: 'normal' | 'reversed';
  ccMappings: Record<string, number>;
  importedAt: string;
  isActive: boolean;
}

export interface CompatibilityResult {
  id: string;
  presetId: string;
  modelId: string;
  mappingId: string;
  status: 'compatible' | 'incompatible' | 'polarity_warning' | 'override_pending';
  issueType: 'override' | 'model_incompatible' | 'polarity_reversed' | null;
  affectedItems: string[];
  description: string;
  checkedAt: string;
}

export interface PresetOverride {
  id: string;
  newerPresetId: string;
  olderPresetId: string;
  affectedModelIds: string[];
  affectedMappingIds: string[];
  description: string;
  detectedAt: string;
}

export interface PolarityIssue {
  id: string;
  mappingId: string;
  previousMappingId: string | null;
  affectedPresetIds: string[];
  affectedModelIds: string[];
  description: string;
  detectedAt: string;
}

export interface FilterState {
  search: string;
  status: string;
  issueType: string;
  modelId: string;
  presetId: string;
  mappingId: string;
  dateFrom: string;
  dateTo: string;
}

export type ExportFormat = 'json' | 'csv';
