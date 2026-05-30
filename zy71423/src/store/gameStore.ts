import { create } from 'zustand';
import {
  Screen,
  GameStatus,
  FunctionCard,
  PlayerState,
  GameRecord,
  ExceptionRecord,
  BatchReport,
  CurvePoint,
  Point,
} from '../types';
import {
  generateCurvePoints,
  generateBatchId,
  generateId,
  findNearestCurveIndex,
} from '../utils/curveGenerator';
import {
  checkAnyTrapCollision,
  checkBoundaryCrossing,
  checkBreakpointCrossing,
  checkSlopeMisjudgment,
  createSlopeMisjudgmentException,
  createOutOfBoundsException,
  createBreakpointCrossingException,
} from '../utils/obstacleDetector';
import {
  createGameRecord,
  markRecordAsWithdrawn,
  markRecordAsDuplicate,
  updateRecordNotes,
  confirmRecord,
  createLateRecord,
} from '../utils/recordManager';
import { confirmException } from '../utils/exceptionManager';
import { generateBatchReport } from '../utils/reportGenerator';
import { functionCards } from '../data/functionCards';

interface GameStore {
  currentScreen: Screen;
  selectedFunctionCard: FunctionCard | null;
  gameStatus: GameStatus;
  player: PlayerState;
  records: GameRecord[];
  exceptions: ExceptionRecord[];
  reports: BatchReport[];
  currentBatchId: string;
  currentGameId: string;
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  curvePoints: CurvePoint[];
  prevPosition: Point | null;
  gameStartTime: number | null;

  setScreen: (screen: Screen) => void;
  selectFunctionCard: (card: FunctionCard) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  movePlayer: (direction: 1 | -1, deltaTime: number) => void;
  setPlayerSpeed: (speed: number) => void;
  addRecord: (record: GameRecord) => void;
  addException: (exception: ExceptionRecord) => void;
  withdrawRecord: (recordId: string) => void;
  markDuplicate: (recordId: string, originalRecordId: string) => void;
  updateNotes: (recordId: string, notes: string) => void;
  confirmGameRecord: (recordId: string) => void;
  confirmExceptionRecord: (exceptionId: string) => void;
  addLateRecord: (originalRecord: GameRecord, data: Partial<GameRecord>) => void;
  generateReport: () => BatchReport | null;
  addReport: (report: BatchReport) => void;
  startNewBatch: () => void;
  resetGame: () => void;
  decreaseLife: () => void;
  increaseScore: (points: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  loadSampleData: () => void;
}

const initialPlayerState: PlayerState = {
  position: { x: 0, y: 0 },
  speed: 0.5,
  direction: 1,
  pathIndex: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  currentScreen: 'home',
  selectedFunctionCard: null,
  gameStatus: 'idle',
  player: { ...initialPlayerState },
  records: [],
  exceptions: [],
  reports: [],
  currentBatchId: generateBatchId(),
  currentGameId: generateId('game'),
  score: 0,
  lives: 3,
  combo: 0,
  maxCombo: 0,
  curvePoints: [],
  prevPosition: null,
  gameStartTime: null,

  setScreen: (screen) => set({ currentScreen: screen }),

  selectFunctionCard: (card) => {
    const curvePoints = generateCurvePoints(card);
    const startIndex = 0;
    const startPoint = curvePoints[startIndex];
    set({
      selectedFunctionCard: card,
      curvePoints,
      player: {
        ...initialPlayerState,
        position: { x: startPoint.x, y: startPoint.y },
        pathIndex: startIndex,
      },
    });
  },

  startGame: () => {
    const { selectedFunctionCard, currentBatchId } = get();
    if (!selectedFunctionCard) return;

    const curvePoints = generateCurvePoints(selectedFunctionCard);
    const startIndex = 0;
    const startPoint = curvePoints[startIndex];

    set({
      gameStatus: 'playing',
      currentGameId: generateId('game'),
      curvePoints,
      player: {
        ...initialPlayerState,
        position: { x: startPoint.x, y: startPoint.y },
        pathIndex: startIndex,
      },
      score: 0,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      prevPosition: null,
      gameStartTime: Date.now(),
    });
  },

  pauseGame: () => set({ gameStatus: 'paused' }),
  resumeGame: () => set({ gameStatus: 'playing' }),

  endGame: () => {
    set({ gameStatus: 'ended' });
  },

  movePlayer: (direction, deltaTime) => {
    const state = get();
    if (state.gameStatus !== 'playing' || !state.selectedFunctionCard) return;

    const { curvePoints, player, prevPosition, currentBatchId, currentGameId, selectedFunctionCard } = state;
    const moveAmount = player.speed * direction * deltaTime * 2;
    const currentPoint = curvePoints[player.pathIndex];

    let newX = currentPoint.x + moveAmount;
    const [minX, maxX] = selectedFunctionCard.domain;

    if (newX < minX) newX = minX;
    if (newX > maxX) newX = maxX;

    const newIndex = findNearestCurveIndex(curvePoints, newX);
    const newCurvePoint = curvePoints[newIndex];

    if (!newCurvePoint) return;

    const newPosition: Point = { x: newCurvePoint.x, y: newCurvePoint.y };

    const outOfBounds = checkBoundaryCrossing(
      prevPosition || player.position,
      newPosition,
      selectedFunctionCard.domain
    );

    const breakpoint = checkBreakpointCrossing(
      prevPosition || player.position,
      newPosition,
      selectedFunctionCard.discontinuities
    );

    const trap = checkAnyTrapCollision(newPosition, selectedFunctionCard);
    const slopeMisjudgment = checkSlopeMisjudgment(newCurvePoint, player.speed);

    let newRecord = createGameRecord(
      currentBatchId,
      currentGameId,
      selectedFunctionCard.id,
      newPosition,
      newCurvePoint.slope,
      newCurvePoint.isDifferentiable,
      player.speed,
      'normal',
      'normal'
    );

    let newException: ExceptionRecord | null = null;
    let status: 'normal' | 'pending' | 'exception' = 'normal';
    let shouldDecreaseLife = false;

    if (outOfBounds) {
      status = 'exception';
      shouldDecreaseLife = true;
      newException = createOutOfBoundsException(
        newRecord.id,
        currentBatchId,
        newPosition,
        selectedFunctionCard.domain
      );
      get().resetCombo();
    } else if (breakpoint !== null) {
      status = 'exception';
      shouldDecreaseLife = true;
      newException = createBreakpointCrossingException(
        newRecord.id,
        currentBatchId,
        newPosition,
        breakpoint
      );
      get().resetCombo();
    } else if (trap && slopeMisjudgment) {
      status = 'exception';
      shouldDecreaseLife = true;
      newException = createSlopeMisjudgmentException(
        newRecord.id,
        currentBatchId,
        newPosition,
        trap
      );
      get().resetCombo();
    } else if (trap && !slopeMisjudgment) {
      get().increaseScore(10);
      get().incrementCombo();
    } else {
      get().increaseScore(1);
      get().incrementCombo();
    }

    newRecord = { ...newRecord, status };

    if (shouldDecreaseLife) {
      get().decreaseLife();
    }

    set({
      player: {
        ...player,
        position: newPosition,
        pathIndex: newIndex,
        direction,
      },
      prevPosition: { ...player.position },
      records: [...state.records, newRecord],
      exceptions: newException ? [...state.exceptions, newException] : state.exceptions,
    });

    if (get().lives <= 0) {
      get().endGame();
    }
  },

  setPlayerSpeed: (speed) => {
    set((state) => ({
      player: { ...state.player, speed: Math.max(0.1, Math.min(2, speed)) },
    }));
  },

  addRecord: (record) => {
    set((state) => ({ records: [...state.records, record] }));
  },

  addException: (exception) => {
    set((state) => ({ exceptions: [...state.exceptions, exception] }));
  },

  withdrawRecord: (recordId) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? markRecordAsWithdrawn(r) : r
      ),
    }));
  },

  markDuplicate: (recordId, originalRecordId) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? markRecordAsDuplicate(r, originalRecordId) : r
      ),
    }));
  },

  updateNotes: (recordId, notes) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? updateRecordNotes(r, notes) : r
      ),
    }));
  },

  confirmGameRecord: (recordId) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === recordId ? confirmRecord(r) : r
      ),
    }));
  },

  confirmExceptionRecord: (exceptionId) => {
    set((state) => ({
      exceptions: confirmException(state.exceptions, exceptionId),
    }));
  },

  addLateRecord: (originalRecord, data) => {
    set((state) => ({
      records: state.records.map((r) =>
        r.id === originalRecord.id ? createLateRecord(r, data) : r
      ),
    }));
  },

  generateReport: () => {
    const state = get();
    if (!state.currentBatchId) return null;

    const report = generateBatchReport(
      state.currentBatchId,
      state.records,
      state.exceptions,
      functionCards,
      state.score,
      state.maxCombo
    );

    set((state) => ({ reports: [...state.reports, report] }));
    return report;
  },

  addReport: (report) => {
    set((state) => ({ reports: [...state.reports, report] }));
  },

  startNewBatch: () => {
    set({
      currentBatchId: generateBatchId(),
      currentGameId: generateId('game'),
      score: 0,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      gameStatus: 'idle',
      selectedFunctionCard: null,
      curvePoints: [],
      player: { ...initialPlayerState },
      prevPosition: null,
      gameStartTime: null,
    });
  },

  resetGame: () => {
    const state = get();
    if (!state.selectedFunctionCard) return;

    const curvePoints = generateCurvePoints(state.selectedFunctionCard);
    const startIndex = 0;
    const startPoint = curvePoints[startIndex];

    set({
      gameStatus: 'idle',
      currentGameId: generateId('game'),
      curvePoints,
      player: {
        ...initialPlayerState,
        position: { x: startPoint.x, y: startPoint.y },
        pathIndex: startIndex,
      },
      score: 0,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      prevPosition: null,
      gameStartTime: null,
    });
  },

  decreaseLife: () => {
    set((state) => ({ lives: Math.max(0, state.lives - 1) }));
  },

  increaseScore: (points) => {
    set((state) => ({ score: state.score + points }));
  },

  incrementCombo: () => {
    set((state) => {
      const newCombo = state.combo + 1;
      return {
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
      };
    });
  },

  resetCombo: () => {
    set({ combo: 0 });
  },

  loadSampleData: () => {
    const batchId = generateBatchId();
    const gameId = generateId('game');
    const sampleCard = functionCards[2];

    const sampleRecords: GameRecord[] = [];
    const sampleExceptions: ExceptionRecord[] = [];

    for (let i = 0; i < 15; i++) {
      const x = sampleCard.domain[0] + (i / 15) * (sampleCard.domain[1] - sampleCard.domain[0]);
      const y = sampleCard.fn(x);
      const isException = i === 5 || i === 10;
      const isLate = i === 3;
      const isMissing = i === 7;

      const record: GameRecord = {
        id: generateId('rec'),
        batchId,
        gameId,
        functionCardId: sampleCard.id,
        timestamp: Date.now() - (15 - i) * 1000,
        playerPosition: { x, y },
        slope: 2,
        isDifferentiable: !isException,
        speed: 0.5,
        status: isException ? 'exception' : isMissing ? 'pending' : 'normal',
        recordType: isLate ? 'late' : 'normal',
        missingFields: isMissing ? ['notes'] : [],
        notes: isLate ? '[晚补] 补录记录' : '',
        createdAt: Date.now() - (15 - i) * 1000,
        updatedAt: Date.now() - (15 - i) * 1000,
      };
      sampleRecords.push(record);

      if (isException) {
        const exc: ExceptionRecord = {
          id: generateId('exc'),
          recordId: record.id,
          batchId,
          type: i === 5 ? 'slope_misjudgment' : 'breakpoint_crossing',
          severity: 'medium',
          description: i === 5 ? '斜率误判：在角点处未减速' : '断点穿越：穿越间断点',
          position: { x, y },
          timestamp: Date.now() - (15 - i) * 1000,
          confirmed: false,
        };
        sampleExceptions.push(exc);
      }
    }

    set({
      currentBatchId: batchId,
      records: sampleRecords,
      exceptions: sampleExceptions,
    });
  },
}));
