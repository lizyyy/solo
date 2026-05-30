export type LengthUnit = 'mm' | 'cm' | 'in';
export type DensityUnit = 'kg_m3' | 'g_cm3';
export type RecordStatus = 'processed' | 'pending' | 'returned';
export type AuditAction = 'create' | 'update' | 'status_change' | 'export' | 'import';

export interface BoxDimensions {
  length: number;
  width: number;
  depth: number;
}

export interface SoundHole {
  diameter: number;
  position: string;
}

export interface WoodMaterial {
  name: string;
  density: number;
  elasticModulus: number;
  isCustom: boolean;
}

export interface ParameterSnapshot {
  id: string;
  recordId: string;
  source: 'manual' | 'import';
  sourceDetail: string;
  boxDims: BoxDimensions;
  soundHole: SoundHole;
  wood: WoodMaterial;
  lengthUnit: LengthUnit;
  densityUnit: DensityUnit;
}

export interface FrequencyPeak {
  id: string;
  recordId: string;
  frequency: number;
  amplitude: number;
  modeLabel: string;
  isOverlapping: boolean;
}

export interface AuditEntry {
  id: string;
  recordId: string;
  action: AuditAction;
  operator: string;
  reason: string;
  timestamp: string;
  snapshot: ParameterSnapshot;
}

export interface ModalRecord {
  id: string;
  name: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  parameters: ParameterSnapshot;
  peaks: FrequencyPeak[];
  auditLog: AuditEntry[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
}

export interface UnitConversionResult {
  originalValue: number;
  originalUnit: string;
  convertedValue: number;
  targetUnit: string;
}
