export type SampleStatus = 'normal' | 'abnormal' | 'duplicate' | 'pending';

export type NoteType = 'score' | 'supplement' | 'conclusion';

export type ClueType = 'score' | 'calculation' | 'supplement' | 'conclusion';

export interface ParamVersion {
  id: string;
  name: string;
  formula: string;
  threshold: number;
  description: string;
  params: {
    a: number;
    b: number;
    c: number;
  };
  createdAt: string;
}

export interface Sample {
  id: string;
  paramVersionId: string;
  sampleCode: string;
  sequence: number[];
  expected: number;
  actual: number;
  deviation: number;
  status: SampleStatus;
  duplicateOf: string[];
  scoreNote: string;
  calculationTrace: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  sampleId: string;
  type: NoteType;
  content: string;
  operator: string;
  createdAt: string;
}

export interface Clue {
  id: string;
  sampleId: string;
  type: ClueType;
  title: string;
  content: string;
  operator: string;
  timestamp: string;
}

export interface FilterState {
  status: SampleStatus[];
  sampleCode: string;
  dateRange: [string, string] | null;
}

export interface AppState {
  paramVersions: ParamVersion[];
  currentParamVersionId: string;
  samples: Sample[];
  notes: Note[];
  clues: Clue[];
  filters: FilterState;
  selectedSampleId: string | null;
  tracePanelOpen: boolean;
  activeTraceTab: 'score' | 'formula' | 'clue';
}
