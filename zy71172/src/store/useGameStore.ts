
import { create } from 'zustand';
import { GameState, TrashItem, TargetType, GameError, ReplayAction, LevelConfig, GameRecord } from '@/types';
import { validateDrop, validateBagBreak, validateClean } from '@/engine/rules';
import { baseTrashItems, createTrashItem } from '@/data/trashItems';
import { getLevelById } from '@/data/levels';

interface GameStore extends GameState {
  levelConfig: LevelConfig | null;
  initGame: (levelId: number) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  generateTrashQueue: (levelConfig: LevelConfig) => TrashItem[];
  dropTrash: (trashId: string, target: TargetType) => void;
  bagBreakTrash: (trashId: string) => void;
  cleanTrash: (trashId: string) => void;
  setHighlightedBin: (bin: TargetType | null) => void;
  setTimeRemaining: (time: number) => void;
  setElapsedTime: (time: number) => void;
  saveGameRecord: () => string;
  resetStore: () => void;
}

const initialState: GameState = {
  status: 'idle',
  currentLevel: null,
  score: 0,
  timeRemaining: 0,
  elapsedTime: 0,
  currentTrashIndex: 0,
  trashQueue: [],
  correctCount: 0,
  wrongCount: 0,
  errors: [],
  appointmentSlots: [],
  replayActions: [],
  highlightedBin: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  levelConfig: null,

  initGame: (levelId: number) => {
    const levelConfig = getLevelById(levelId);
    if (!levelConfig) return;

    const trashQueue = get().generateTrashQueue(levelConfig);

    set({
      ...initialState,
      currentLevel: levelId,
      levelConfig,
      timeRemaining: levelConfig.timeLimit,
      trashQueue,
      appointmentSlots: levelConfig.appointmentSlots || [],
    });
  },

  startGame: () => {
    set({ status: 'playing' });
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },

  restartGame: () => {
    const { currentLevel } = get();
    if (currentLevel !== null) {
      get().initGame(currentLevel);
      set({ status: 'playing' });
    }
  },

  endGame: () => {
    set({ status: 'ended' });
  },

  generateTrashQueue: (levelConfig: LevelConfig): TrashItem[] => {
    const eligibleItems = baseTrashItems.filter(item =>
      levelConfig.availableCategories.includes(item.category)
    );

    const wetItems = eligibleItems.filter(item => item.category === 'wet' && item.requiresBagBreak);
    const wetWithoutBag = eligibleItems.filter(item => item.category === 'wet' && !item.requiresBagBreak);
    const contaminatedItems = eligibleItems.filter(item => item.category === 'recyclable' && item.isContaminated);
    const cleanRecyclable = eligibleItems.filter(item => item.category === 'recyclable' && !item.isContaminated);
    const bulkyItems = eligibleItems.filter(item => item.category === 'bulky');
    const otherItems = eligibleItems.filter(item =>
      !['wet', 'recyclable', 'bulky'].includes(item.category)
    );

    const queue: TrashItem[] = [];

    if (levelConfig.hasBagBreakMechanic && wetItems.length > 0) {
      queue.push(createTrashItem(wetItems[Math.floor(Math.random() * wetItems.length)]));
    }

    if (levelConfig.hasContaminationMechanic && contaminatedItems.length > 0) {
      queue.push(createTrashItem(contaminatedItems[Math.floor(Math.random() * contaminatedItems.length)]));
    }

    if (levelConfig.hasAppointmentMechanic && bulkyItems.length > 0) {
      queue.push(createTrashItem(bulkyItems[Math.floor(Math.random() * bulkyItems.length)]));
    }

    const allEligible = [...wetItems, ...wetWithoutBag, ...contaminatedItems, ...cleanRecyclable, ...bulkyItems, ...otherItems];
    while (queue.length < levelConfig.trashCount && allEligible.length > 0) {
      const randomItem = allEligible[Math.floor(Math.random() * allEligible.length)];
      queue.push(createTrashItem(randomItem));
    }

    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue.slice(0, levelConfig.trashCount);
  },

  dropTrash: (trashId: string, target: TargetType) => {
    const state = get();
    const { levelConfig, trashQueue, currentTrashIndex, score, correctCount, wrongCount, errors, replayActions, elapsedTime } = state;

    if (!levelConfig || state.status !== 'playing') return;

    const trashIndex = trashQueue.findIndex(t => t.id === trashId);
    if (trashIndex === -1) return;

    const trash = trashQueue[trashIndex];
    const result = validateDrop(trash, target, state, levelConfig);

    const newReplayAction: ReplayAction = {
      type: 'drop',
      trashId,
      target,
      timestamp: elapsedTime,
      isCorrect: result.isCorrect,
      scoreChange: result.scoreChange,
    };

    if (!result.isCorrect && result.explanation) {
      const newError: GameError = {
        id: Math.random().toString(36).substring(2, 11),
        trashItem: { ...trash },
        wrongAction: target === 'appointment' ? '预约' : `投入${target}桶`,
        correctAction: trash.correctAction,
        explanation: result.explanation,
        timestamp: elapsedTime,
      };

      const newWrongCount = wrongCount + 1;

      set({
        score: Math.max(0, score + result.scoreChange),
        wrongCount: newWrongCount,
        errors: [...errors, newError],
        currentTrashIndex: currentTrashIndex + 1,
        replayActions: [...replayActions, newReplayAction],
        status: newWrongCount >= levelConfig.maxWrongCount ? 'ended' : state.status,
      });
    } else {
      set({
        score: Math.max(0, score + result.scoreChange),
        correctCount: correctCount + 1,
        currentTrashIndex: currentTrashIndex + 1,
        replayActions: [...replayActions, newReplayAction],
      });
    }

    const newState = get();
    if (newState.currentTrashIndex >= newState.trashQueue.length && newState.status === 'playing') {
      set({ status: 'ended' });
    }
  },

  bagBreakTrash: (trashId: string) => {
    const state = get();
    const { levelConfig, trashQueue, replayActions, elapsedTime } = state;

    if (!levelConfig || state.status !== 'playing') return;

    const trashIndex = trashQueue.findIndex(t => t.id === trashId);
    if (trashIndex === -1) return;

    const trash = trashQueue[trashIndex];
    const result = validateBagBreak(trash, levelConfig);

    if (result.isCorrect) {
      const newQueue = [...trashQueue];
      newQueue[trashIndex] = { ...trash, isBagBroken: true };

      const newReplayAction: ReplayAction = {
        type: 'bagBreak',
        trashId,
        target: 'bagBreak',
        timestamp: elapsedTime,
        isCorrect: true,
        scoreChange: 0,
      };

      set({
        trashQueue: newQueue,
        replayActions: [...replayActions, newReplayAction],
      });
    }
  },

  cleanTrash: (trashId: string) => {
    const state = get();
    const { levelConfig, trashQueue, replayActions, elapsedTime } = state;

    if (!levelConfig || state.status !== 'playing') return;

    const trashIndex = trashQueue.findIndex(t => t.id === trashId);
    if (trashIndex === -1) return;

    const trash = trashQueue[trashIndex];
    const result = validateClean(trash, levelConfig);

    if (result.isCorrect) {
      const newQueue = [...trashQueue];
      newQueue[trashIndex] = { ...trash, isCleaned: true };

      const newReplayAction: ReplayAction = {
        type: 'clean',
        trashId,
        target: 'clean',
        timestamp: elapsedTime,
        isCorrect: true,
        scoreChange: 0,
      };

      set({
        trashQueue: newQueue,
        replayActions: [...replayActions, newReplayAction],
      });
    }
  },

  setHighlightedBin: (bin: TargetType | null) => {
    set({ highlightedBin: bin });
  },

  setTimeRemaining: (time: number) => {
    const state = get();
    if (time <= 0 && state.status === 'playing') {
      set({ timeRemaining: 0, status: 'ended' });
    } else {
      set({ timeRemaining: time });
    }
  },

  setElapsedTime: (time: number) => {
    set({ elapsedTime: time });
  },

  saveGameRecord: (): string => {
    const state = get();
    const totalAttempts = state.correctCount + state.wrongCount;
    const accuracy = totalAttempts > 0 ? Math.round((state.correctCount / totalAttempts) * 100) : 0;

    const record: GameRecord = {
      id: Math.random().toString(36).substring(2, 11),
      levelId: state.currentLevel || 1,
      score: state.score,
      accuracy,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      duration: state.elapsedTime,
      completedAt: new Date().toISOString(),
      replayActions: state.replayActions,
      errors: state.errors,
    };

    const existingRecords: GameRecord[] = JSON.parse(localStorage.getItem('gameRecords') || '[]');
    existingRecords.unshift(record);
    const trimmedRecords = existingRecords.slice(0, 50);
    localStorage.setItem('gameRecords', JSON.stringify(trimmedRecords));

    return record.id;
  },

  resetStore: () => {
    set(initialState);
  },
}));

export default useGameStore;
