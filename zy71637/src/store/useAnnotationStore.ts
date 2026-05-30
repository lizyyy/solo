import { create } from 'zustand';
import { produce } from 'immer';
import { Annotation, AnnotationType, AnnotationTag, DEFAULT_TAGS } from '../types/annotation';

export type { AnnotationTag };

interface AnnotationState {
  annotations: Annotation[];
  tags: AnnotationTag[];
  selectedAnnotationId: string | null;
  isCreatingAnnotation: boolean;
  creationType: AnnotationType | null;
  tempAnnotation: Partial<Annotation> | null;
  isCreating: boolean;

  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt' | 'type' | 'startTime' | 'endTime' | 'startPrice' | 'endPrice' | 'tags' | 'author' | 'relatedCubeIds' | 'relatedAnomalyIds'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  startCreatingAnnotation: (type: AnnotationType) => void;
  cancelCreatingAnnotation: () => void;
  setTempAnnotation: (data: Partial<Annotation> | null) => void;
  finishCreatingAnnotation: (data: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addTag: (tag: Omit<AnnotationTag, 'id'>) => void;
  updateTag: (id: string, updates: Partial<AnnotationTag>) => void;
  deleteTag: (id: string) => void;
  getAnnotationsForCube: (cubeId: string, snapshotId: string) => Annotation[];
  getAnnotationsForTimeRange: (startTime: number, endTime: number) => Annotation[];
  clearAnnotations: () => void;
  setIsCreating: (creating: boolean) => void;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  tags: [...DEFAULT_TAGS],
  selectedAnnotationId: null,
  isCreatingAnnotation: false,
  creationType: null,
  tempAnnotation: null,
  isCreating: false,

  addAnnotation: (annotation) => {
    set(
      produce((state: AnnotationState) => {
        state.annotations.push({
          id: `annotation-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          type: 'point',
          title: annotation.title,
          content: annotation.content || '',
          startTime: annotation.timestamp || Date.now(),
          endTime: annotation.timestamp || Date.now(),
          startPrice: 0,
          endPrice: 0,
          tags: annotation.tagId ? [annotation.tagId] : [],
          author: '用户',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          relatedCubeIds: [],
          relatedAnomalyIds: [],
          tagId: annotation.tagId || DEFAULT_TAGS[0].id,
          snapshotIndex: annotation.snapshotIndex || 0,
          timestamp: annotation.timestamp || Date.now(),
        });
      })
    );
  },

  updateAnnotation: (id, updates) => {
    set(
      produce((state: AnnotationState) => {
        const index = state.annotations.findIndex(a => a.id === id);
        if (index > -1) {
          state.annotations[index] = {
            ...state.annotations[index],
            ...updates,
            updatedAt: Date.now(),
          };
        }
      })
    );
  },

  deleteAnnotation: (id) => {
    set(
      produce((state: AnnotationState) => {
        state.annotations = state.annotations.filter(a => a.id !== id);
        if (state.selectedAnnotationId === id) {
          state.selectedAnnotationId = null;
        }
      })
    );
  },

  selectAnnotation: (id) => {
    set({ selectedAnnotationId: id });
  },

  startCreatingAnnotation: (type) => {
    set({
      isCreatingAnnotation: true,
      creationType: type,
      tempAnnotation: { type },
      isCreating: true,
    });
  },

  cancelCreatingAnnotation: () => {
    set({
      isCreatingAnnotation: false,
      creationType: null,
      tempAnnotation: null,
      isCreating: false,
    });
  },

  setTempAnnotation: (data) => {
    set(
      produce((state: AnnotationState) => {
        state.tempAnnotation = { ...state.tempAnnotation, ...data };
      })
    );
  },

  finishCreatingAnnotation: (data) => {
    get().addAnnotation(data);
    set({
      isCreatingAnnotation: false,
      creationType: null,
      tempAnnotation: null,
      isCreating: false,
    });
  },

  addTag: (tag) => {
    set(
      produce((state: AnnotationState) => {
        state.tags.push({
          ...tag,
          id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        });
      })
    );
  },

  updateTag: (id, updates) => {
    set(
      produce((state: AnnotationState) => {
        const index = state.tags.findIndex(t => t.id === id);
        if (index > -1) {
          state.tags[index] = { ...state.tags[index], ...updates };
        }
      })
    );
  },

  deleteTag: (id) => {
    set(
      produce((state: AnnotationState) => {
        state.tags = state.tags.filter(t => t.id !== id);
      })
    );
  },

  getAnnotationsForCube: (cubeId, snapshotId) => {
    return get().annotations.filter(a => 
      a.relatedCubeIds.includes(cubeId) || a.relatedCubeIds.includes(snapshotId)
    );
  },

  getAnnotationsForTimeRange: (startTime, endTime) => {
    return get().annotations.filter(a => 
      (a.startTime >= startTime && a.startTime <= endTime) ||
      (a.endTime >= startTime && a.endTime <= endTime) ||
      (a.startTime <= startTime && a.endTime >= endTime)
    );
  },

  clearAnnotations: () => {
    set({
      annotations: [],
      selectedAnnotationId: null,
      isCreatingAnnotation: false,
      creationType: null,
      tempAnnotation: null,
      isCreating: false,
    });
  },

  setIsCreating: (creating) => {
    set({ isCreating: creating });
  },
}));
