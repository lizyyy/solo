import { create } from 'zustand';
import {
  AppState,
  AppActions,
  Slice,
  Annotation,
  CaseNote,
  HistoryRecord,
  Screenshot,
} from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  slices: [],
  annotations: [],
  caseNotes: [],
  history: [],
  screenshots: [],
  currentWindowWidth: 400,
  currentWindowCenter: 50,
  selectedSliceId: null,
  selectedAnnotationId: null,
  sliceSpacing: 0.15,
  rotation: { x: -0.3, y: 0.5, z: 0 },
  authorName: '学生用户',
  filterErrorsOnly: false,
  filterAnnotatedOnly: false,

  setWindowLevel: (width: number, center: number) => {
    const before = { width: get().currentWindowWidth, center: get().currentWindowCenter };
    set({ currentWindowWidth: width, currentWindowCenter: center });
    const record: HistoryRecord = {
      id: generateId(),
      action: 'window_adjust',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `调整窗宽窗位: ${width}/${center}`,
      beforeState: before,
      afterState: { width, center },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  selectSlice: (sliceId: string | null) => {
    set({ selectedSliceId: sliceId });
  },

  selectAnnotation: (annotationId: string | null) => {
    set({ selectedAnnotationId: annotationId });
  },

  addAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ annotations: [...state.annotations, newAnnotation] }));
    const record: HistoryRecord = {
      id: generateId(),
      action: 'annotation_add',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `添加标注: ${annotation.description}`,
      afterState: { annotationId: newAnnotation.id },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  updateAnnotation: (id: string, updates: Partial<Annotation>) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
    const record: HistoryRecord = {
      id: generateId(),
      action: 'annotation_edit',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `编辑标注`,
      afterState: { annotationId: id, ...updates },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  deleteAnnotation: (id: string) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
    }));
    const record: HistoryRecord = {
      id: generateId(),
      action: 'annotation_delete',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `删除标注`,
      beforeState: { annotationId: id },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  addCaseNote: (note: Omit<CaseNote, 'id' | 'timestamp'>) => {
    const newNote: CaseNote = {
      ...note,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ caseNotes: [...state.caseNotes, newNote] }));
    const record: HistoryRecord = {
      id: generateId(),
      action: 'note_add',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `添加病例备注`,
      afterState: { noteId: newNote.id },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  toggleSliceVisibility: (sliceId: string) => {
    set((state) => ({
      slices: state.slices.map((s) =>
        s.id === sliceId ? { ...s, isVisible: !s.isVisible } : s
      ),
    }));
  },

  highlightSlice: (sliceId: string, highlighted: boolean) => {
    set((state) => ({
      slices: state.slices.map((s) =>
        s.id === sliceId ? { ...s, isHighlighted: highlighted } : s
      ),
    }));
  },

  setSliceSpacing: (spacing: number) => {
    set({ sliceSpacing: spacing });
  },

  setRotation: (rotation: { x: number; y: number; z: number }) => {
    set({ rotation });
  },

  addScreenshot: (screenshot: Omit<Screenshot, 'id' | 'timestamp'>) => {
    const newScreenshot: Screenshot = {
      ...screenshot,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    set((state) => ({ screenshots: [...state.screenshots, newScreenshot] }));
    const record: HistoryRecord = {
      id: generateId(),
      action: 'screenshot_export',
      timestamp: new Date().toISOString(),
      author: get().authorName,
      description: `导出截图: ${screenshot.description}`,
      afterState: { screenshotId: newScreenshot.id },
    };
    set((state) => ({ history: [record, ...state.history].slice(0, 100) }));
  },

  setFilterErrorsOnly: (value: boolean) => {
    set({ filterErrorsOnly: value });
  },

  setFilterAnnotatedOnly: (value: boolean) => {
    set({ filterAnnotatedOnly: value });
  },

  resolveAnnotationDrift: (annotationId: string, newX: number, newY: number) => {
    const annotation = get().annotations.find((a) => a.id === annotationId);
    if (annotation) {
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === annotationId
            ? { ...a, x: newX, y: newY, hasDrift: false, originalPosition: undefined, isResolved: true }
            : a
        ),
      }));
    }
  },

  fixSliceError: (sliceId: string) => {
    set((state) => ({
      slices: state.slices.map((s) =>
        s.id === sliceId ? { ...s, hasError: false, errorType: undefined, errorNote: undefined } : s
      ),
    }));
  },

  initializeSlices: (slices: Slice[]) => {
    set({ slices });
  },
}));
