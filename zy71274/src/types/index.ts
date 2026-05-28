export interface EnergyLevel {
  id: number;
  n: number;
  energy_eV: number;
  color: string;
  height: number;
  notes: string;
  original_value?: string;
}

export interface Transition {
  id: number;
  from_level: number;
  to_level: number;
  probability: number;
  selection_rule: string;
  original_value?: string;
}

export interface SpectrumLine {
  id: number;
  transition_id: number;
  wavelength_nm: number;
  color_hex: string;
  intensity: number;
  series: string;
  original_value?: string;
}

export interface ExternalField {
  field_type: 'electric' | 'magnetic';
  strength: number;
  direction: [number, number, number];
  effect_description: string;
}

export type ValidationType = 'energy_order' | 'probability' | 'spectrum_color';
export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationResult {
  type: ValidationType;
  level: ValidationLevel;
  message: string;
  suggestion: string;
  affected_ids: number[];
}

export type IssueStatus = 'discovered' | 'fixed' | 'confirmed';

export interface IssueTrack {
  id: string;
  issue_type: string;
  description: string;
  discovered_by: string;
  discovered_at: Date;
  fixed_by?: string;
  fixed_at?: Date;
  confirmed_by?: string;
  confirmed_at?: Date;
  status: IssueStatus;
}

export interface Screenshot {
  id: string;
  filename: string;
  created_at: Date;
  data_snapshot: string;
  created_by: string;
}

export interface AppState {
  energyLevels: EnergyLevel[];
  transitions: Transition[];
  spectrumLines: SpectrumLine[];
  externalField: ExternalField;
  selectedLevel: number | null;
  activeTransition: number | null;
  validationResults: ValidationResult[];
  issueTracks: IssueTrack[];
  screenshots: Screenshot[];
}

export interface AppActions {
  selectLevel: (id: number | null) => void;
  setActiveTransition: (id: number | null) => void;
  updateEnergyLevel: (id: number, updates: Partial<EnergyLevel>) => void;
  updateTransition: (id: number, updates: Partial<Transition>) => void;
  updateSpectrumLine: (id: number, updates: Partial<SpectrumLine>) => void;
  updateExternalField: (updates: Partial<ExternalField>) => void;
  validateData: () => void;
  addIssueTrack: (issue: Omit<IssueTrack, 'id' | 'discovered_at'>) => void;
  updateIssueTrack: (id: string, updates: Partial<IssueTrack>) => void;
  addScreenshot: (screenshot: Omit<Screenshot, 'id' | 'created_at'>) => void;
  resetToOriginal: (dataType: 'energy' | 'transition' | 'spectrum', id: number) => void;
}
