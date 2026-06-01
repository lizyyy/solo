import { create } from 'zustand';
import type {
  GameState,
  GameSession,
  LevelConfig,
  OperationRecord,
  Note,
  Zone,
  DraggableElement,
} from '../types';
import { STORAGE_KEYS } from '../types';
import { mockLevels, defaultOperator, defaultSource } from '../data/mockLevels';
import {
  calculateEffect,
  createOperationRecord,
  createInitialSession,
  generateId,
} from '../utils/gameEngine';
import {
  createNote,
  createOriginalNoteFromLevel,
  updateSupplementaryNote,
} from '../utils/diffUtils';

interface GameStore {
  levels: LevelConfig[];
  currentLevelId: string | null;
  currentLevel: LevelConfig | null;
  currentSession: GameSession | null;
  currentState: GameState;
  records: OperationRecord[];
  notes: Note[];
  history: GameSession[];
  operatorName: string;
  isLoading: boolean;
  error: string | null;

  init: () => void;
  setCurrentLevel: (levelId: string) => void;
  startNewSession: () => void;
  endCurrentSession: () => void;
  handleElementDrop: (element: DraggableElement, zone: Zone) => void;
  handleElementClick: (element: DraggableElement) => void;
  addSupplementaryNote: (content: string, reason?: string) => void;
  updateNote: (noteId: string, newContent: string, reason?: string) => void;
  resetCurrentState: () => void;
  clearHistory: () => void;
  exportLevel: (levelId: string) => string;
  importLevel: (jsonString: string) => void;
  setOperatorName: (name: string) => void;
}

const getInitialState = (): GameState => ({
  resources: 100,
  score: 0,
  risk: 10,
  isNegative: false,
});

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`加载 ${key} 失败:`, e);
  }
  return defaultValue;
};

const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`保存 ${key} 失败:`, e);
  }
};

export const useGameStore = create<GameStore>((set, get) => ({
  levels: [],
  currentLevelId: null,
  currentLevel: null,
  currentSession: null,
  currentState: getInitialState(),
  records: [],
  notes: [],
  history: [],
  operatorName: defaultOperator,
  isLoading: true,
  error: null,

  init: () => {
    const levels = loadFromStorage<LevelConfig[]>(STORAGE_KEYS.LEVELS, mockLevels);
    const currentLevelId = loadFromStorage<string | null>(STORAGE_KEYS.CURRENT_LEVEL_ID, levels[0]?.id || null);
    const operatorName = loadFromStorage<string>(STORAGE_KEYS.OPERATOR_NAME, defaultOperator);
    const history = loadFromStorage<GameSession[]>(STORAGE_KEYS.HISTORY, []);
    const currentSession = loadFromStorage<GameSession | null>(STORAGE_KEYS.CURRENT_SESSION, null);

    const currentLevel = levels.find((l) => l.id === currentLevelId) || levels[0] || null;

    set({
      levels,
      currentLevelId,
      currentLevel,
      currentSession,
      currentState: currentSession?.currentState || getInitialState(),
      records: currentSession?.records || [],
      notes: currentSession?.notes || [],
      history,
      operatorName,
      isLoading: false,
    });
  },

  setCurrentLevel: (levelId: string) => {
    const { levels } = get();
    const level = levels.find((l) => l.id === levelId);
    if (!level) return;

    set({
      currentLevelId: levelId,
      currentLevel: level,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_LEVEL_ID, levelId);
  },

  startNewSession: () => {
    const { currentLevel, operatorName } = get();
    if (!currentLevel) {
      set({ error: '请先选择一个关卡' });
      return;
    }

    const { sessionId, initialState } = createInitialSession(currentLevel, operatorName);
    const originalNote = createOriginalNoteFromLevel(sessionId, currentLevel.rawNotes, currentLevel.source);

    const newSession: GameSession = {
      id: sessionId,
      levelId: currentLevel.id,
      levelName: currentLevel.name,
      startTime: Date.now(),
      operator: operatorName,
      source: defaultSource,
      currentState: initialState,
      records: [],
      notes: [originalNote],
    };

    set({
      currentSession: newSession,
      currentState: initialState,
      records: [],
      notes: [originalNote],
      error: null,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, newSession);
  },

  endCurrentSession: () => {
    const { currentSession, currentState, history } = get();
    if (!currentSession) return;

    const endedSession: GameSession = {
      ...currentSession,
      endTime: Date.now(),
      finalState: { ...currentState },
    };

    const newHistory = [endedSession, ...history];
    set({
      history: newHistory,
      currentSession: null,
      currentState: getInitialState(),
      records: [],
      notes: [],
    });

    saveToStorage(STORAGE_KEYS.HISTORY, newHistory);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  },

  handleElementDrop: (element: DraggableElement, zone: Zone) => {
    const { currentSession, currentState, currentLevel, operatorName, records } = get();
    if (!currentSession || !currentLevel) return;

    if (currentState.isNegative) {
      set({ error: '资源已为负数，无法继续操作！请先重置状态。' });
      return;
    }

    const tempOpId = generateId();
    const { newState, trace } = calculateEffect(
      zone,
      element,
      currentState,
      currentLevel.rules,
      tempOpId
    );

    const record = createOperationRecord(
      currentSession.id,
      'drag',
      element,
      zone,
      currentState,
      newState,
      trace,
      operatorName,
      defaultSource
    );

    trace.operationId = record.id;

    const newRecords = [...records, record];
    const updatedSession: GameSession = {
      ...currentSession,
      currentState: newState,
      records: newRecords,
    };

    set({
      currentState: newState,
      records: newRecords,
      currentSession: updatedSession,
      error: null,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, updatedSession);
  },

  handleElementClick: (element: DraggableElement) => {
    const { currentSession, currentState, currentLevel, operatorName, records } = get();
    if (!currentSession || !currentLevel) return;

    if (currentState.isNegative) {
      set({ error: '资源已为负数，无法继续操作！请先重置状态。' });
      return;
    }

    const clickZone: Zone = {
      id: 'click-zone',
      name: '快速点击',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      effect: {
        resources: -5 * element.baseValue,
        score: 8 * element.baseValue,
        risk: 3 * element.baseValue,
        formula: `快速点击：资源 -${5 * element.baseValue}, 分数 +${8 * element.baseValue}, 风险 +${3 * element.baseValue}`,
        description: '快速点击操作，小额消耗换取分数',
      },
      style: {},
    };

    const tempOpId = generateId();
    const { newState, trace } = calculateEffect(
      clickZone,
      element,
      currentState,
      currentLevel.rules,
      tempOpId
    );

    const record = createOperationRecord(
      currentSession.id,
      'click',
      element,
      null,
      currentState,
      newState,
      trace,
      operatorName,
      defaultSource
    );

    trace.operationId = record.id;

    const newRecords = [...records, record];
    const updatedSession: GameSession = {
      ...currentSession,
      currentState: newState,
      records: newRecords,
    };

    set({
      currentState: newState,
      records: newRecords,
      currentSession: updatedSession,
      error: null,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, updatedSession);
  },

  addSupplementaryNote: (content: string, reason: string = '补录备注') => {
    const { currentSession, notes, operatorName } = get();
    if (!currentSession) return;

    const newNote = createNote(currentSession.id, 'supplementary', content, operatorName, reason);
    const newNotes = [...notes, newNote];

    const updatedSession: GameSession = {
      ...currentSession,
      notes: newNotes,
    };

    set({
      notes: newNotes,
      currentSession: updatedSession,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, updatedSession);
  },

  updateNote: (noteId: string, newContent: string, reason: string = '补录备注') => {
    const { currentSession, notes, operatorName } = get();
    if (!currentSession) return;

    const noteIndex = notes.findIndex((n) => n.id === noteId);
    if (noteIndex === -1) return;

    const note = notes[noteIndex];
    if (note.type === 'original') {
      set({ error: '原始备注不可修改，只能添加补录备注' });
      return;
    }

    const updatedNote = updateSupplementaryNote(note, newContent, operatorName, reason);
    const newNotes = [...notes];
    newNotes[noteIndex] = updatedNote;

    const updatedSession: GameSession = {
      ...currentSession,
      notes: newNotes,
    };

    set({
      notes: newNotes,
      currentSession: updatedSession,
      error: null,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, updatedSession);
  },

  resetCurrentState: () => {
    const { currentLevel, currentSession } = get();
    if (!currentLevel || !currentSession) return;

    const state = { ...currentLevel.initialState };
    state.isNegative = false;

    const updatedSession: GameSession = {
      ...currentSession,
      currentState: state,
    };

    set({
      currentState: state,
      currentSession: updatedSession,
      error: null,
    });
    saveToStorage(STORAGE_KEYS.CURRENT_SESSION, updatedSession);
  },

  clearHistory: () => {
    set({ history: [] });
    saveToStorage(STORAGE_KEYS.HISTORY, []);
  },

  exportLevel: (levelId: string): string => {
    const { levels } = get();
    const level = levels.find((l) => l.id === levelId);
    if (!level) return '';
    return JSON.stringify(level, null, 2);
  },

  importLevel: (jsonString: string) => {
    try {
      const level = JSON.parse(jsonString) as LevelConfig;
      if (!level.id || !level.name) {
        throw new Error('无效的关卡数据');
      }

      const { levels } = get();
      const existingIndex = levels.findIndex((l) => l.id === level.id);
      let newLevels: LevelConfig[];

      if (existingIndex >= 0) {
        newLevels = [...levels];
        newLevels[existingIndex] = level;
      } else {
        newLevels = [...levels, level];
      }

      set({
        levels: newLevels,
        error: null,
      });
      saveToStorage(STORAGE_KEYS.LEVELS, newLevels);
    } catch (e) {
      set({ error: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` });
    }
  },

  setOperatorName: (name: string) => {
    set({ operatorName: name });
    saveToStorage(STORAGE_KEYS.OPERATOR_NAME, name);
  },
}));
