import { create } from 'zustand';
import { GameState, Level, Vehicle, InspectionRecord, GameHistory } from '../types';
import { validateInspection } from '../utils/validator';
import { generateVehiclesForLevel, generateId } from '../utils/generator';
import { saveGameHistory, saveBestScore, unlockLevel } from '../utils/storage';
import { SCORE_RULES } from '../data/levels';

interface GameStore {
  gameState: GameState;
  allVehicles: Vehicle[];
  currentVehicleIndex: number;
  
  startGame: (level: Level) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  endGame: () => void;
  
  passVehicle: () => void;
  interceptVehicle: () => void;
  handleTimeout: () => void;
  processNextVehicle: (record: InspectionRecord, scoreChange: number, isCorrect: boolean) => void;
  
  reset: () => void;
}

const initialGameState: GameState = {
  level: {
    id: 0,
    name: '',
    description: '',
    vehicleCount: 0,
    timePerVehicle: 0,
    dangerousRate: 0,
    mismatchRate: 0,
    maxQueueSize: 0,
    passScore: 0,
    difficulty: 1,
  },
  status: 'idle',
  currentVehicle: null,
  queue: [],
  score: 0,
  processedCount: 0,
  correctCount: 0,
  records: [],
  startTime: 0,
  pauseTime: 0,
  vehicleStartTime: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: initialGameState,
  allVehicles: [],
  currentVehicleIndex: 0,

  startGame: (level: Level) => {
    const vehicles = generateVehiclesForLevel(level);
    const initialQueue = vehicles.slice(0, Math.min(3, vehicles.length));
    const currentVehicle = initialQueue[0] || null;
    const remainingQueue = initialQueue.slice(1);

    set({
      gameState: {
        ...initialGameState,
        level,
        status: 'playing',
        currentVehicle,
        queue: remainingQueue,
        startTime: Date.now(),
        vehicleStartTime: Date.now(),
      },
      allVehicles: vehicles,
      currentVehicleIndex: 0,
    });
  },

  pauseGame: () => {
    set(state => ({
      gameState: {
        ...state.gameState,
        status: 'paused',
        pauseTime: Date.now(),
      },
    }));
  },

  resumeGame: () => {
    set(state => ({
      gameState: {
        ...state.gameState,
        status: 'playing',
        pauseTime: 0,
      },
    }));
  },

  restartGame: () => {
    const { level } = get().gameState;
    if (level.id > 0) {
      get().startGame(level);
    }
  },

  endGame: () => {
    const state = get();
    const { gameState } = state;
    
    const endTime = Date.now();
    const accuracy = gameState.processedCount > 0 
      ? Math.round((gameState.correctCount / gameState.processedCount) * 100) 
      : 0;
    
    const history: GameHistory = {
      id: generateId(),
      levelId: gameState.level.id,
      levelName: gameState.level.name,
      score: gameState.score,
      accuracy,
      totalVehicles: gameState.processedCount,
      correctCount: gameState.correctCount,
      errorCount: gameState.processedCount - gameState.correctCount,
      records: gameState.records,
      startTime: gameState.startTime,
      endTime,
      duration: endTime - gameState.startTime,
    };
    
    saveGameHistory(history);
    saveBestScore(gameState.level.id, gameState.score);
    
    if (gameState.score >= gameState.level.passScore && gameState.level.id < 5) {
      unlockLevel(gameState.level.id + 1);
    }

    set(state => ({
      gameState: {
        ...state.gameState,
        status: 'finished',
      },
    }));
  },

  passVehicle: () => {
    const state = get();
    const { currentVehicle } = state.gameState;
    
    if (!currentVehicle || state.gameState.status !== 'playing') return;

    const result = validateInspection(currentVehicle, 'pass');
    const timeSpent = (Date.now() - state.gameState.vehicleStartTime) / 1000;

    const record: InspectionRecord = {
      vehicleId: currentVehicle.id,
      containerNo: currentVehicle.container.containerNo,
      licensePlate: currentVehicle.container.licensePlate,
      hasDangerous: currentVehicle.container.hasDangerous,
      playerAction: 'pass',
      isCorrect: result.isCorrect,
      errorReason: result.errorReason,
      scoreChange: result.scoreChange,
      timestamp: Date.now(),
      timeSpent,
    };

    get().processNextVehicle(record, result.scoreChange, result.isCorrect);
  },

  interceptVehicle: () => {
    const state = get();
    const { currentVehicle } = state.gameState;
    
    if (!currentVehicle || state.gameState.status !== 'playing') return;

    const result = validateInspection(currentVehicle, 'intercept');
    const timeSpent = (Date.now() - state.gameState.vehicleStartTime) / 1000;

    const record: InspectionRecord = {
      vehicleId: currentVehicle.id,
      containerNo: currentVehicle.container.containerNo,
      licensePlate: currentVehicle.container.licensePlate,
      hasDangerous: currentVehicle.container.hasDangerous,
      playerAction: 'intercept',
      isCorrect: result.isCorrect,
      errorReason: result.errorReason,
      scoreChange: result.scoreChange,
      timestamp: Date.now(),
      timeSpent,
    };

    get().processNextVehicle(record, result.scoreChange, result.isCorrect);
  },

  handleTimeout: () => {
    const state = get();
    const { currentVehicle } = state.gameState;
    
    if (!currentVehicle || state.gameState.status !== 'playing') return;

    const timeSpent = state.gameState.level.timePerVehicle;

    const record: InspectionRecord = {
      vehicleId: currentVehicle.id,
      containerNo: currentVehicle.container.containerNo,
      licensePlate: currentVehicle.container.licensePlate,
      hasDangerous: currentVehicle.container.hasDangerous,
      playerAction: 'timeout',
      isCorrect: false,
      errorReason: '处理超时',
      scoreChange: SCORE_RULES.TIMEOUT,
      timestamp: Date.now(),
      timeSpent,
    };

    get().processNextVehicle(record, SCORE_RULES.TIMEOUT, false);
  },

  processNextVehicle: (
    record: InspectionRecord,
    scoreChange: number,
    isCorrect: boolean
  ) => {
    const state = get();
    const newIndex = state.currentVehicleIndex + 1;
    const { allVehicles, gameState } = state;

    let queuePenalty = 0;
    if (gameState.queue.length > 3) {
      queuePenalty = (gameState.queue.length - 3) * SCORE_RULES.QUEUE_PENALTY_PER_VEHICLE;
    }

    const newScore = gameState.score + scoreChange + queuePenalty;
    const newProcessedCount = gameState.processedCount + 1;
    const newCorrectCount = gameState.correctCount + (isCorrect ? 1 : 0);

    if (newIndex >= allVehicles.length) {
      set(state => ({
        gameState: {
          ...state.gameState,
          currentVehicle: null,
          queue: [],
          score: newScore,
          processedCount: newProcessedCount,
          correctCount: newCorrectCount,
          records: [...state.gameState.records, record],
        },
        currentVehicleIndex: newIndex,
      }));
      
      setTimeout(() => {
        get().endGame();
      }, 500);
      return;
    }

    const nextVehicle = allVehicles[newIndex];
    const currentQueue = [...gameState.queue];
    
    if (currentQueue.length > 0) {
      currentQueue.shift();
    }
    
    const nextQueueIndex = newIndex + 1 + currentQueue.length;
    if (nextQueueIndex < allVehicles.length && currentQueue.length < gameState.level.maxQueueSize - 1) {
      currentQueue.push(allVehicles[nextQueueIndex]);
    }

    set(state => ({
      gameState: {
        ...state.gameState,
        currentVehicle: nextVehicle,
        queue: currentQueue,
        score: newScore,
        processedCount: newProcessedCount,
        correctCount: newCorrectCount,
        records: [...state.gameState.records, record],
        vehicleStartTime: Date.now(),
      },
      currentVehicleIndex: newIndex,
    }));
  },

  reset: () => {
    set({
      gameState: initialGameState,
      allVehicles: [],
      currentVehicleIndex: 0,
    });
  },
}));
