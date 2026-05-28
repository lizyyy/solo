export type SliceErrorType = 'sequence_error' | 'window_lost' | 'drift_detected' | 'corrupted';
export type AnnotationType = 'lesion' | 'artifact' | 'note' | 'measurement';
export type HistoryActionType = 'window_adjust' | 'annotation_add' | 'annotation_edit' | 'annotation_delete' | 'slice_reorder' | 'note_add' | 'note_edit' | 'screenshot_export';

export interface Slice {
  id: string;
  index: number;
  imageData: string;
  windowWidth: number;
  windowCenter: number;
  sliceThickness: number;
  hasError: boolean;
  errorType?: SliceErrorType;
  errorNote?: string;
  isVisible: boolean;
  isHighlighted: boolean;
}

export interface Annotation {
  id: string;
  sliceId: string;
  x: number;
  y: number;
  type: AnnotationType;
  description: string;
  author: string;
  timestamp: string;
  hasDrift: boolean;
  originalPosition?: { x: number; y: number };
  isResolved: boolean;
}

export interface CaseNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  sliceReferences: string[];
  tags: string[];
}

export interface HistoryRecord {
  id: string;
  action: HistoryActionType;
  timestamp: string;
  author: string;
  description: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

export interface Screenshot {
  id: string;
  imageData: string;
  timestamp: string;
  author: string;
  description: string;
  sliceIndices: number[];
  windowSettings: { width: number; center: number };
}

export interface AppState {
  slices: Slice[];
  annotations: Annotation[];
  caseNotes: CaseNote[];
  history: HistoryRecord[];
  screenshots: Screenshot[];
  currentWindowWidth: number;
  currentWindowCenter: number;
  selectedSliceId: string | null;
  selectedAnnotationId: string | null;
  sliceSpacing: number;
  rotation: { x: number; y: number; z: number };
  authorName: string;
  filterErrorsOnly: boolean;
  filterAnnotatedOnly: boolean;
}

export interface AppActions {
  setWindowLevel: (width: number, center: number) => void;
  selectSlice: (sliceId: string | null) => void;
  selectAnnotation: (annotationId: string | null) => void;
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  addCaseNote: (note: Omit<CaseNote, 'id' | 'timestamp'>) => void;
  toggleSliceVisibility: (sliceId: string) => void;
  highlightSlice: (sliceId: string, highlighted: boolean) => void;
  setSliceSpacing: (spacing: number) => void;
  setRotation: (rotation: { x: number; y: number; z: number }) => void;
  addScreenshot: (screenshot: Omit<Screenshot, 'id' | 'timestamp'>) => void;
  setFilterErrorsOnly: (value: boolean) => void;
  setFilterAnnotatedOnly: (value: boolean) => void;
  resolveAnnotationDrift: (annotationId: string, newX: number, newY: number) => void;
  fixSliceError: (sliceId: string) => void;
  initializeSlices: (slices: Slice[]) => void;
}
