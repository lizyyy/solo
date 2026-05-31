import { create } from 'zustand';
import type { Classroom, Record, ScoreSheet, Annotation } from '@/types';
import { storage, generateId } from '@/utils/storage';
import { mockClassrooms, mockRecords, mockScoreSheets } from '@/data/mockData';

interface ClassroomState {
  classrooms: Classroom[];
  records: Record[];
  scoreSheets: ScoreSheet[];
  initialized: boolean;

  initData: () => void;
  addClassroom: (name: string) => Classroom;
  getClassroom: (id: string) => Classroom | undefined;
  getClassroomRecords: (classroomId: string) => Record[];
  getClassroomScoreSheets: (classroomId: string) => ScoreSheet[];

  addRecord: (data: Omit<Record, 'id' | 'timestamp'>) => Record;
  addAnnotation: (recordId: string, annotation: Omit<Annotation, 'id' | 'annotatedAt'>) => void;

  addScoreSheet: (classroomId: string, name: string, content: string, uploader: string) => ScoreSheet;
  addScoreSheetVersion: (sheetId: string, content: string, uploader: string) => ScoreSheetVersion | null;

  getRecord: (id: string) => Record | undefined;
  getScoreSheet: (id: string) => ScoreSheet | undefined;
}

export const useClassroomStore = create<ClassroomState>((set, get) => ({
  classrooms: [],
  records: [],
  scoreSheets: [],
  initialized: false,

  initData: () => {
    const storedClassrooms = storage.get<Classroom[]>('classrooms', null);
    const storedRecords = storage.get<Record[]>('records', null);
    const storedScoreSheets = storage.get<ScoreSheet[]>('scoreSheets', null);

    if (storedClassrooms && storedRecords && storedScoreSheets) {
      set({
        classrooms: storedClassrooms,
        records: storedRecords,
        scoreSheets: storedScoreSheets,
        initialized: true,
      });
    } else {
      set({
        classrooms: mockClassrooms,
        records: mockRecords,
        scoreSheets: mockScoreSheets,
        initialized: true,
      });
      storage.set('classrooms', mockClassrooms);
      storage.set('records', mockRecords);
      storage.set('scoreSheets', mockScoreSheets);
    }
  },

  addClassroom: (name: string) => {
    const newClassroom: Classroom = {
      id: generateId(),
      name,
      createdAt: new Date().toISOString(),
      status: 'active',
    };
    const classrooms = [...get().classrooms, newClassroom];
    set({ classrooms });
    storage.set('classrooms', classrooms);
    return newClassroom;
  },

  getClassroom: (id: string) => {
    return get().classrooms.find((c) => c.id === id);
  },

  getClassroomRecords: (classroomId: string) => {
    return get().records
      .filter((r) => r.classroomId === classroomId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  getClassroomScoreSheets: (classroomId: string) => {
    return get().scoreSheets.filter((s) => s.classroomId === classroomId);
  },

  addRecord: (data) => {
    const newRecord: Record = {
      ...data,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    const records = [...get().records, newRecord];
    set({ records });
    storage.set('records', records);
    return newRecord;
  },

  addAnnotation: (recordId, annotation) => {
    const records = get().records.map((r) => {
      if (r.id === recordId) {
        return {
          ...r,
          annotation: {
            ...annotation,
            id: generateId(),
            annotatedAt: new Date().toISOString(),
          },
        };
      }
      return r;
    });
    set({ records });
    storage.set('records', records);
  },

  addScoreSheet: (classroomId, name, content, uploader) => {
    const newSheet: ScoreSheet = {
      id: generateId(),
      classroomId,
      name,
      versions: [
        {
          id: generateId(),
          version: 1,
          content,
          uploadedAt: new Date().toISOString(),
          uploader,
        },
      ],
    };
    const scoreSheets = [...get().scoreSheets, newSheet];
    set({ scoreSheets });
    storage.set('scoreSheets', scoreSheets);
    return newSheet;
  },

  addScoreSheetVersion: (sheetId, content, uploader) => {
    const sheet = get().scoreSheets.find((s) => s.id === sheetId);
    if (!sheet) return null;

    const newVersion = {
      id: generateId(),
      version: sheet.versions.length + 1,
      content,
      uploadedAt: new Date().toISOString(),
      uploader,
    };

    const scoreSheets = get().scoreSheets.map((s) => {
      if (s.id === sheetId) {
        return {
          ...s,
          versions: [...s.versions, newVersion],
        };
      }
      return s;
    });

    set({ scoreSheets });
    storage.set('scoreSheets', scoreSheets);
    return newVersion;
  },

  getRecord: (id: string) => {
    return get().records.find((r) => r.id === id);
  },

  getScoreSheet: (id: string) => {
    return get().scoreSheets.find((s) => s.id === id);
  },
}));
