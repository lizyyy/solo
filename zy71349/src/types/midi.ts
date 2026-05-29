export interface ControllerEvent {
  id: string;
  type: 'cc' | 'note' | 'pitchbend' | 'aftertouch';
  channel: number;
  ccNumber?: number;
  noteNumber?: number;
  valueRange: [number, number];
  timestamp: number;
  label?: string;
}

export interface SoundParameter {
  id: string;
  name: string;
  type: 'continuous' | 'toggle' | 'enum';
  valueRange: [number, number] | string[];
  category: string;
}

export interface MappingEntry {
  id: string;
  controllerEventId: string;
  soundParameterId: string;
  transform: 'linear' | 'inverse' | 'logarithmic';
  polarity: 'normal' | 'reversed';
  createdAt: number;
  sourcePresetId?: string;
}

export interface TraceEntry {
  type: 'mapping' | 'preset' | 'event' | 'parameter';
  targetId: string;
  label: string;
}

export interface Conflict {
  id: string;
  type: 'channel_collision' | 'polarity_reversed' | 'preset_override';
  severity: 'warning' | 'critical';
  mappingIds: string[];
  description: string;
  sourceTrace: TraceEntry[];
  detectedAt: number;
  resolvedAt?: number;
}

export interface Preset {
  id: string;
  name: string;
  mappingIds: string[];
  createdAt: number;
  updatedAt: number;
  snapshot: MappingEntry[];
}

export interface OperationHistory {
  id: string;
  action: 'create_mapping' | 'delete_mapping' | 'update_mapping' | 'save_preset' | 'load_preset' | 'resolve_conflict' | 'supplement_material';
  payload: Record<string, unknown>;
  timestamp: number;
  mappingSnapshot: MappingEntry[];
  conflictsSnapshot: Conflict[];
}

export interface ReviewSession {
  id: string;
  createdAt: number;
  conclusion: string;
  conflictCount: number;
  mappingCompleteness: number;
  historySnapshotId: string;
  supplementalMaterials: SupplementalMaterial[];
}

export interface SupplementalMaterial {
  id: string;
  type: 'controller_event' | 'sound_parameter' | 'preset_file';
  content: unknown;
  receivedAt: number;
  processedAt?: number;
  reviewSessionId: string;
}
