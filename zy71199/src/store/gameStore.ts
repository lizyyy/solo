import { create } from 'zustand';
import type { GamePhase, FileCard, ActionRecord, SettlementReport, Level, ConfidentialityLevel, RetentionPeriod } from '@/types';
import { levels, getLevel } from '@/data/levels';
import { calculateScore, getGrade } from '@/utils/gameLogic';

interface GameState {
  phase: GamePhase;
  currentLevelId: number | null;
  currentFileIndex: number;
  currentFile: FileCard | null;
  timeRemaining: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  actionHistory: ActionRecord[];
  selectedConfidentiality: ConfidentialityLevel | null;
  selectedRetention: RetentionPeriod | null;
  selectedBoxId: string | null;
  completedLevels: number[];
  levelScores: Record<number, number>;
  lastReport: SettlementReport | null;
  borrowQueue: { requestId: string; fileId: string }[];
  currentBorrowRequest: { requestId: string; fileId: string } | null;
  showRuleHint: boolean;

  startLevel: (levelId: number) => void;
  selectConfidentiality: (level: ConfidentialityLevel) => void;
  selectRetention: (period: RetentionPeriod) => void;
  selectBox: (boxId: string) => void;
  submitFile: () => void;
  nextFile: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  quit: () => void;
  tick: () => void;
  toggleRuleHint: () => void;
  finishLevel: () => void;
  processBorrow: (approved: boolean, registered: boolean) => void;
  loadProgress: () => void;
  resetProgress: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  currentLevelId: null,
  currentFileIndex: 0,
  currentFile: null,
  timeRemaining: 0,
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  actionHistory: [],
  selectedConfidentiality: null,
  selectedRetention: null,
  selectedBoxId: null,
  completedLevels: [],
  levelScores: {},
  lastReport: null,
  borrowQueue: [],
  currentBorrowRequest: null,
  showRuleHint: true,

  startLevel: (levelId: number) => {
    const level = getLevel(levelId);
    if (!level) return;
    const borrowQueue = level.borrowRequests
      ? level.borrowRequests.map(br => ({ requestId: br.id, fileId: br.fileId }))
      : [];
    set({
      phase: 'playing',
      currentLevelId: levelId,
      currentFileIndex: 0,
      currentFile: { ...level.files[0] },
      timeRemaining: level.timeLimit,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      actionHistory: [],
      selectedConfidentiality: null,
      selectedRetention: null,
      selectedBoxId: null,
      borrowQueue,
      currentBorrowRequest: null,
    });
  },

  selectConfidentiality: (level) => {
    if (get().phase !== 'playing') return;
    set({ selectedConfidentiality: level });
  },

  selectRetention: (period) => {
    if (get().phase !== 'playing') return;
    set({ selectedRetention: period });
  },

  selectBox: (boxId) => {
    if (get().phase !== 'playing') return;
    set({ selectedBoxId: boxId });
  },

  submitFile: () => {
    const state = get();
    if (state.phase !== 'playing' || !state.currentFile) return;
    const { selectedConfidentiality, selectedRetention, selectedBoxId, currentFile } = state;

    if (!selectedConfidentiality || !selectedRetention || !selectedBoxId) return;

    const isConfCorrect = selectedConfidentiality === currentFile.confidentiality;
    const isRetCorrect = selectedRetention === currentFile.retentionPeriod;
    const isBoxCorrect = selectedBoxId === currentFile.correctBoxId;

    const newActions: ActionRecord[] = [
      {
        timestamp: new Date().toISOString(),
        fileId: currentFile.id,
        action: 'set_confidentiality',
        value: selectedConfidentiality,
        isCorrect: isConfCorrect,
        errorReason: isConfCorrect ? undefined : `正确级别应为「${currentFile.confidentiality}」`,
      },
      {
        timestamp: new Date().toISOString(),
        fileId: currentFile.id,
        action: 'set_retention',
        value: selectedRetention,
        isCorrect: isRetCorrect,
        errorReason: isRetCorrect ? undefined : `正确期限应为「${currentFile.retentionPeriod}」`,
      },
      {
        timestamp: new Date().toISOString(),
        fileId: currentFile.id,
        action: 'assign_box',
        value: selectedBoxId,
        isCorrect: isBoxCorrect,
        errorReason: isBoxCorrect ? undefined : `正确盒应为「${currentFile.correctBoxId}」`,
      },
    ];

    const allCorrect = isConfCorrect && isRetCorrect && isBoxCorrect;
    const newCorrect = state.correctCount + (allCorrect ? 1 : 0);
    const newWrong = state.wrongCount + (allCorrect ? 0 : 1);

    set({
      actionHistory: [...state.actionHistory, ...newActions],
      correctCount: newCorrect,
      wrongCount: newWrong,
      score: calculateScore(newCorrect, newWrong),
      selectedConfidentiality: null,
      selectedRetention: null,
      selectedBoxId: null,
    });

    const level = getLevel(state.currentLevelId!);
    if (level) {
      const nextIndex = state.currentFileIndex + 1;
      if (nextIndex >= level.files.length) {
        get().finishLevel();
      } else {
        const borrowQueue = state.borrowQueue;
        const nextBorrow = borrowQueue.find(b => {
          const br = level.borrowRequests?.find(r => r.id === b.requestId);
          return br && br.fileId === level.files[nextIndex].id && !br.registered;
        });
        set({
          currentFileIndex: nextIndex,
          currentFile: { ...level.files[nextIndex] },
          currentBorrowRequest: nextBorrow || null,
        });
      }
    }
  },

  nextFile: () => {
    const state = get();
    const level = getLevel(state.currentLevelId!);
    if (!level) return;
    const nextIndex = state.currentFileIndex + 1;
    if (nextIndex >= level.files.length) {
      get().finishLevel();
    } else {
      set({
        currentFileIndex: nextIndex,
        currentFile: { ...level.files[nextIndex] },
        selectedConfidentiality: null,
        selectedRetention: null,
        selectedBoxId: null,
      });
    }
  },

  pause: () => {
    if (get().phase === 'playing') set({ phase: 'paused' });
  },

  resume: () => {
    if (get().phase === 'paused') set({ phase: 'playing' });
  },

  restart: () => {
    const state = get();
    if (state.currentLevelId) get().startLevel(state.currentLevelId);
  },

  quit: () => {
    set({
      phase: 'menu',
      currentLevelId: null,
      currentFileIndex: 0,
      currentFile: null,
      timeRemaining: 0,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      actionHistory: [],
      selectedConfidentiality: null,
      selectedRetention: null,
      selectedBoxId: null,
      borrowQueue: [],
      currentBorrowRequest: null,
    });
  },

  tick: () => {
    const state = get();
    if (state.phase !== 'playing') return;
    const newTime = state.timeRemaining - 1;
    if (newTime <= 0) {
      set({ timeRemaining: 0 });
      get().finishLevel();
    } else {
      set({ timeRemaining: newTime });
    }
  },

  toggleRuleHint: () => {
    set({ showRuleHint: !get().showRuleHint });
  },

  finishLevel: () => {
    const state = get();
    const level = getLevel(state.currentLevelId!);
    if (!level) return;

    const totalActions = level.fileCount * 3;
    const grade = getGrade(state.score, totalActions);
    const report: SettlementReport = {
      sessionId: `session-${Date.now()}`,
      levelId: level.id,
      levelName: level.name,
      totalScore: state.score,
      grade,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      accuracy: totalActions > 0 ? (state.correctCount / level.fileCount) * 100 : 0,
      duration: level.timeLimit - state.timeRemaining,
      actionHistory: state.actionHistory,
      wrongActions: state.actionHistory.filter(a => !a.isCorrect),
      exportTime: new Date().toISOString(),
    };

    const completedLevels = state.completedLevels.includes(level.id)
      ? state.completedLevels
      : [...state.completedLevels, level.id];

    const levelScores = {
      ...state.levelScores,
      [level.id]: Math.max(state.levelScores[level.id] || 0, state.score),
    };

    set({
      phase: 'finished',
      lastReport: report,
      completedLevels,
      levelScores,
    });

    try {
      localStorage.setItem('archive-game-progress', JSON.stringify({
        completedLevels,
        levelScores,
      }));
    } catch {}
  },

  processBorrow: (approved, registered) => {
    const state = get();
    if (!state.currentBorrowRequest) return;
    const level = getLevel(state.currentLevelId!);
    if (!level) return;
    const br = level.borrowRequests?.find(r => r.id === state.currentBorrowRequest!.requestId);
    if (!br) return;

    const isRegisteredCorrect = registered;
    const isApprovalCorrect = br.needsApproval ? approved : true;
    const allCorrect = isRegisteredCorrect && isApprovalCorrect;

    const action: ActionRecord = {
      timestamp: new Date().toISOString(),
      fileId: br.fileId,
      action: 'process_borrow',
      value: `借阅: ${br.borrower}, 登记: ${registered}, 审批: ${approved}`,
      isCorrect: allCorrect,
      errorReason: allCorrect ? undefined : `借阅处理有误，请检查登记和审批流程`,
    };

    const newCorrect = state.correctCount + (allCorrect ? 1 : 0);
    const newWrong = state.wrongCount + (allCorrect ? 0 : 1);

    set({
      actionHistory: [...state.actionHistory, action],
      correctCount: newCorrect,
      wrongCount: newWrong,
      score: calculateScore(newCorrect, newWrong),
      borrowQueue: state.borrowQueue.filter(b => b.requestId !== br.id),
      currentBorrowRequest: null,
    });
  },

  loadProgress: () => {
    try {
      const data = localStorage.getItem('archive-game-progress');
      if (data) {
        const progress = JSON.parse(data);
        set({
          completedLevels: progress.completedLevels || [],
          levelScores: progress.levelScores || {},
        });
      }
    } catch {}
  },

  resetProgress: () => {
    set({ completedLevels: [], levelScores: {} });
    try {
      localStorage.removeItem('archive-game-progress');
    } catch {}
  },
}));