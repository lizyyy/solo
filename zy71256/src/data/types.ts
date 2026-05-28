export interface ChipPackage {
  id: string;
  name: string;
  type: 'BGA' | 'QFP' | 'QFN' | 'SOP';
  pinCount: number;
  bodyWidth: number;
  bodyHeight: number;
}

export interface Pin {
  id: string;
  name: string;
  position: number;
  side: 'top' | 'bottom' | 'left' | 'right';
  x: number;
  y: number;
  z: number;
  voltageDomainId: string;
  signalType: 'power' | 'ground' | 'signal' | 'clock' | 'reset';
  signalFrequency: number;
  functions: PinFunction[];
}

export interface VoltageDomain {
  id: string;
  name: string;
  nominalVoltage: number;
  color: string;
}

export interface PinFunction {
  id: string;
  pinId: string;
  functionName: string;
  isDefault: boolean;
}

export interface Conflict {
  id: string;
  type: 'voltage_mixed' | 'pin_mux' | 'label_occlusion';
  pinIds: string[];
  message: string;
  severity: 'error' | 'warning';
}

export interface ReviewReport {
  batchId: string;
  timestamp: string;
  chipName: string;
  conflicts: Conflict[];
  voltageDomainSummary: Record<string, number>;
  pinSignalMap: Record<string, string>;
}
