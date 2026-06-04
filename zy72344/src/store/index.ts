import { create } from 'zustand';
import type { ParameterTable, StudentAnswer, HistoryRecord, MealPlanResult, VisualizationData, AnswerStatus } from '@/types';
import { mockParameterTables, mockStudentAnswers, mockHistoryRecords, mockMealPlanResults, mockVisualizationData } from '@/data/mockData';

interface AppState {
  parameterTables: ParameterTable[];
  studentAnswers: StudentAnswer[];
  historyRecords: HistoryRecord[];
  mealPlanResults: MealPlanResult[];
  visualizationData: VisualizationData[];
  currentUser: string;
  
  addParameterTable: (table: Omit<ParameterTable, 'id' | 'importedAt' | 'hash'>) => boolean;
  updateAnswerStatus: (answerId: string, status: AnswerStatus) => void;
  updateAnswerRemark: (answerId: string, remark: string) => void;
  updateAnswerManualExample: (answerId: string, example: string) => void;
  addHistoryRecord: (record: Omit<HistoryRecord, 'id' | 'operatedAt'>) => void;
  getStudentAnswersByStudentId: (studentId: string) => StudentAnswer[];
  getHistoryByTargetId: (targetId: string) => HistoryRecord[];
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateHash = (records: any[]) => {
  return btoa(JSON.stringify(records));
};

export const useAppStore = create<AppState>((set, get) => ({
  parameterTables: mockParameterTables,
  studentAnswers: mockStudentAnswers,
  historyRecords: mockHistoryRecords,
  mealPlanResults: mockMealPlanResults,
  visualizationData: mockVisualizationData,
  currentUser: '吴老师',

  addParameterTable: (table) => {
    const newHash = generateHash(table.records);
    const existing = get().parameterTables.find(t => t.hash === newHash);
    
    if (existing) {
      return false;
    }

    const newTable: ParameterTable = {
      ...table,
      id: `param-${generateId()}`,
      importedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      hash: newHash,
    };

    set(state => ({
      parameterTables: [...state.parameterTables, newTable],
    }));
    return true;
  },

  updateAnswerStatus: (answerId, status) => {
    const answer = get().studentAnswers.find(a => a.id === answerId);
    if (!answer) return;

    set(state => ({
      studentAnswers: state.studentAnswers.map(a =>
        a.id === answerId ? { ...a, status } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'status',
      oldValue: answer.status,
      newValue: status,
      operator: get().currentUser,
    });
  },

  updateAnswerRemark: (answerId, remark) => {
    const answer = get().studentAnswers.find(a => a.id === answerId);
    if (!answer) return;

    set(state => ({
      studentAnswers: state.studentAnswers.map(a =>
        a.id === answerId ? { ...a, remark } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'remark',
      oldValue: answer.remark,
      newValue: remark,
      operator: get().currentUser,
    });
  },

  updateAnswerManualExample: (answerId, example) => {
    const answer = get().studentAnswers.find(a => a.id === answerId);
    if (!answer) return;

    set(state => ({
      studentAnswers: state.studentAnswers.map(a =>
        a.id === answerId ? { ...a, manualExample: example } : a
      ),
    }));

    get().addHistoryRecord({
      targetId: answerId,
      targetType: 'answer',
      fieldName: 'manualExample',
      oldValue: answer.manualExample || '',
      newValue: example,
      operator: get().currentUser,
    });
  },

  addHistoryRecord: (record) => {
    const newRecord: HistoryRecord = {
      ...record,
      id: `hist-${generateId()}`,
      operatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    set(state => ({
      historyRecords: [...state.historyRecords, newRecord],
    }));
  },

  getStudentAnswersByStudentId: (studentId) => {
    return get().studentAnswers.filter(a => a.studentId === studentId);
  },

  getHistoryByTargetId: (targetId) => {
    return get().historyRecords.filter(h => h.targetId === targetId);
  },
}));
