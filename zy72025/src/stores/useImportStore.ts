import { create } from 'zustand';
import type { Level, PlayerRecord, Conflict, GameSession, ImportedLevel, ImportedPlayerRecord } from '@/types';
import { LocalStorage } from '@/storage/LocalStorage';
import { ConflictDetector } from '@/engine/ConflictDetector';
import { GameEngine } from '@/engine/GameEngine';
import { deepClone, readJsonFile, generateId } from '@/utils/helpers';

interface ImportState {
  levels: Level[];
  importedRecords: PlayerRecord[];
  detectedConflicts: Conflict[];
  selectedLevelId: string | null;
  selectedRecordId: string | null;
  isLoading: boolean;
  error: string | null;
  importResult: { importedSessions: number; importedLevels: number } | null;
  fetchLevels: () => void;
  importLevels: (levels: Level[]) => Promise<void>;
  importLevelsFromFile: (file: File) => Promise<void>;
  importRecordsFromFile: (file: File) => Promise<void>;
  processRecord: (record: PlayerRecord) => Promise<GameSession>;
  detectConflicts: (session: GameSession, record: PlayerRecord) => void;
  resolveConflict: (
    session: GameSession,
    conflict: Conflict,
    resolution: 'use_student' | 'use_imported' | 'manual' | 'skip' | 'flag_for_review',
    resolvedBy: string,
    notes?: string
  ) => GameSession;
  clearImportResult: () => void;
  setSelectedLevelId: (id: string | null) => void;
  setSelectedRecordId: (id: string | null) => void;
  setError: (error: string | null) => void;
  clearConflicts: () => void;
  validateLevel: (level: Level) => { valid: boolean; errors: string[] };
  saveLevel: (level: Level) => void;
  deleteLevel: (id: string) => void;
  exportSampleData: () => { levels: Level[]; records: PlayerRecord[] };
}

export const useImportStore = create<ImportState>((set, get) => ({
  levels: [],
  importedRecords: [],
  detectedConflicts: [],
  selectedLevelId: null,
  selectedRecordId: null,
  isLoading: false,
  error: null,
  importResult: null,

  fetchLevels: () => {
    set({ isLoading: true });
    try {
      const levels = LocalStorage.getLevels();
      set({ levels, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载关卡失败', 
        isLoading: false 
      });
    }
  },

  importLevels: async (levels: Level[]) => {
    set({ isLoading: true, error: null });
    try {
      levels.forEach((level) => {
        const validation = GameEngine.validateLevel(level);
        if (!validation.valid) {
          throw new Error(`关卡 "${level.name}" 验证失败: ${validation.errors.join(', ')}`);
        }
      });

      LocalStorage.saveLevels(levels);
      const updatedLevels = LocalStorage.getLevels();
      set({ levels: updatedLevels, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '导入关卡失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  importLevelsFromFile: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      const data = await readJsonFile<ImportedLevel>(file);
      
      if (!data.levels || !Array.isArray(data.levels)) {
        throw new Error('文件格式不正确，缺少 levels 数组');
      }

      await get().importLevels(data.levels);
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '读取关卡文件失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  importRecordsFromFile: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      const data = await readJsonFile<ImportedPlayerRecord>(file);
      
      if (!data.records || !Array.isArray(data.records)) {
        throw new Error('文件格式不正确，缺少 records 数组');
      }

      set({ importedRecords: data.records, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '读取记录文件失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  processRecord: async (record: PlayerRecord): Promise<GameSession> => {
    set({ isLoading: true, error: null });
    try {
      const level = LocalStorage.getLevel(record.levelId);
      if (!level) {
        throw new Error(`找不到关卡 ${record.levelId}，请先导入关卡`);
      }

      const engine = new GameEngine(level);
      let session = engine.startGame(level.id, record.playerName);

      const conflicts: Conflict[] = [];
      
      for (let i = 0; i < record.steps.length; i++) {
        const step = record.steps[i];
        
        if (!step.decision || step.decision.trim() === '') {
          conflicts.push({
            id: generateId(),
            sessionId: session.id,
            type: 'null_value',
            stepIndex: i,
            studentRecord: step,
            importedData: { message: '决策为空' },
            evidence: [],
            suggestedActions: [],
          });
          continue;
        }

        try {
          session = engine.makeDecision(step.decision);
        } catch (e) {
          conflicts.push({
            id: generateId(),
            sessionId: session.id,
            type: 'step_missing',
            stepIndex: i,
            studentRecord: step,
            importedData: { error: e instanceof Error ? e.message : '未知错误' },
            evidence: [],
            suggestedActions: [],
          });
        }
      }

      if (session.status === 'playing') {
        session = engine.endGame();
      }

      if (record.teacherNotes) {
        session = engine.setTeacherNotes(record.teacherNotes);
      }

      const detectedConflicts = ConflictDetector.detectConflicts(session, record);
      session.conflicts = [...conflicts, ...detectedConflicts].map((c) => ({
        ...c,
        evidence: ConflictDetector.generateEvidence(c),
        suggestedActions: ConflictDetector.suggestActions(c),
      }));

      LocalStorage.saveSession(session);

      set({ 
        detectedConflicts: session.conflicts,
        isLoading: false,
      });

      return session;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '处理记录失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  detectConflicts: (session: GameSession, record: PlayerRecord) => {
    const conflicts = ConflictDetector.detectConflicts(session, record);
    set({ detectedConflicts: conflicts });
  },

  resolveConflict: (
    session: GameSession,
    conflict: Conflict,
    resolution: 'use_student' | 'use_imported' | 'manual' | 'skip' | 'flag_for_review',
    resolvedBy: string,
    notes?: string
  ): GameSession => {
    const updatedSession = ConflictDetector.applyResolution(
      session,
      conflict,
      resolution,
      resolvedBy,
      notes
    );

    const remainingConflicts = get().detectedConflicts.filter(
      (c) => c.id !== conflict.id
    );
    set({ detectedConflicts: remainingConflicts });

    return updatedSession;
  },

  clearImportResult: () => {
    set({ importResult: null });
  },

  setSelectedLevelId: (id: string | null) => {
    set({ selectedLevelId: id });
  },

  setSelectedRecordId: (id: string | null) => {
    set({ selectedRecordId: id });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearConflicts: () => {
    set({ detectedConflicts: [] });
  },

  validateLevel: (level: Level): { valid: boolean; errors: string[] } => {
    return GameEngine.validateLevel(level);
  },

  saveLevel: (level: Level) => {
    const validation = GameEngine.validateLevel(level);
    if (!validation.valid) {
      throw new Error(`关卡验证失败: ${validation.errors.join(', ')}`);
    }
    LocalStorage.saveLevel(level);
    const levels = LocalStorage.getLevels();
    set({ levels });
  },

  deleteLevel: (id: string) => {
    LocalStorage.deleteLevel(id);
    const levels = LocalStorage.getLevels();
    set({ levels });
  },

  exportSampleData: () => {
    const levels = LocalStorage.getLevels();
    const records: PlayerRecord[] = [];
    return { levels, records };
  },
}));
