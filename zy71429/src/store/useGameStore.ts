import { create } from 'zustand';
import {
  GameState,
  Ship,
  Berth,
  Tug,
  Weather,
  GameEvent,
  TimelineSnapshot,
  ImportResult,
  ImportError,
  ScheduleValidationResult,
  DecisionImpact,
} from '../types/game';
import { mockShips, mockBerths, mockTugs, mockWeather, getInitialGameTime, getGameEndTime } from '../data/mockScenario';
import {
  validateAndCreateSchedule,
  executeSchedule,
  cancelSchedule,
  advanceTime,
} from '../engine/scheduler';
import {
  validateSchedule as validateScheduleEngine,
  validateGameState,
} from '../engine/validator';
import {
  calculateDecisionImpact,
  getAvailableBerths,
  getAvailableTugs,
  findOptimalTugCombination,
} from '../engine/resource';
import {
  logScheduleCreation,
  logScheduleCancellation,
  logTimeAdvance,
  logGameStart,
  logGameEnd,
  logEventTriggered,
} from '../trace/auditor';
import { createTimelineSnapshot, generateGameId } from '../utils/exporter';

interface GameStore extends GameState {
  timelineSnapshots: TimelineSnapshot[];
  importErrors: ImportError[];
  isLoading: boolean;
  errorMessage: string | null;
  showBadDataDialog: boolean;

  initializeGame: () => void;
  resetGame: () => void;
  selectShip: (shipId: string | null) => void;
  selectBerth: (berthId: string | null) => void;
  toggleTugSelection: (tugId: string) => void;
  clearSelection: () => void;

  validateCurrentSelection: (plannedTime: Date, durationMinutes: number) => ScheduleValidationResult | null;
  calculateCurrentImpact: (plannedTime: Date, durationMinutes: number) => DecisionImpact | null;
  createSchedule: (plannedTime: Date, durationMinutes: number, decisionNote: string) => { success: boolean; errors: string[]; scheduleId?: string };
  executeScheduledShip: (scheduleId: string) => { success: boolean; errors: string[] };
  cancelScheduledShip: (scheduleId: string, reason: string) => { success: boolean; errors: string[] };

  advanceGameTime: (minutes: number) => { newEvents: GameEvent[] };
  togglePause: () => void;
  setSpeed: (speed: number) => void;

  getAvailableBerthsForShip: (shipId: string, plannedTime: Date, durationMinutes: number) => Berth[];
  getAvailableTugsForTime: (plannedTime: Date, durationMinutes: number) => Tug[];
  getOptimalTugsForShip: (shipId: string, plannedTime: Date, durationMinutes: number) => Tug[] | null;
  getEventsSortedByPriority: () => GameEvent[];
  getMissedWindowEvents: () => GameEvent[];

  importData: (type: 'ships' | 'berths' | 'tugs' | 'weather', data: ImportResult<unknown>) => { success: boolean; errors: ImportError[] };
  showBadData: (show: boolean) => void;
  clearImportErrors: () => void;

  setGameOver: () => void;
  setErrorMessage: (message: string | null) => void;
}

const createInitialState = (): GameState => {
  const gameId = generateGameId();
  const startTime = getInitialGameTime();
  const endTime = getGameEndTime();

  return {
    gameId,
    currentTime: new Date(startTime),
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    ships: [...mockShips],
    berths: [...mockBerths],
    tugs: [...mockTugs],
    weatherForecast: [...mockWeather],
    schedules: [],
    events: [],
    auditLogs: [],
    score: 0,
    isGameOver: false,
    isPaused: true,
    speed: 1,
    selectedShipId: null,
    selectedBerthId: null,
    selectedTugIds: [],
  };
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),
  timelineSnapshots: [],
  importErrors: [],
  isLoading: false,
  errorMessage: null,
  showBadDataDialog: false,

  initializeGame: () => {
    const initialState = createInitialState();
    const gameStartEvent: GameEvent = {
      id: `EVT-GAME-START-${Date.now()}`,
      type: 'game_start',
      timestamp: new Date(initialState.currentTime),
      scheduleId: null,
      shipId: null,
      tugId: null,
      description: '游戏开始，请安排船舶靠泊计划',
      rawData: {},
      priority: 9,
      resolved: true,
    };

    const tempState: GameState = {
      ...initialState,
      events: [gameStartEvent],
      auditLogs: [],
    };
    const stateWithEvent: GameState = {
      ...tempState,
      auditLogs: [logGameStart(tempState)],
    };

    const initialSnapshot = createTimelineSnapshot(stateWithEvent, [gameStartEvent]);

    set({
      ...stateWithEvent,
      timelineSnapshots: [initialSnapshot],
      isPaused: true,
    });
  },

  resetGame: () => {
    get().initializeGame();
  },

  selectShip: (shipId) => {
    const ship = get().ships.find(s => s.id === shipId);
    if (ship && ship.status === 'waiting') {
      set({ selectedShipId: shipId, selectedBerthId: null, selectedTugIds: [] });
    }
  },

  selectBerth: (berthId) => {
    const berth = get().berths.find(b => b.id === berthId);
    if (berth && (berth.status === 'available' || berth.status === 'locked')) {
      set({ selectedBerthId: berthId });
    }
  },

  toggleTugSelection: (tugId) => {
    const selectedTugIds = get().selectedTugIds;
    const tug = get().tugs.find(t => t.id === tugId);
    
    if (!tug) return;

    if (selectedTugIds.includes(tugId)) {
      set({ selectedTugIds: selectedTugIds.filter(id => id !== tugId) });
    } else if (tug.status !== 'refueling') {
      set({ selectedTugIds: [...selectedTugIds, tugId] });
    }
  },

  clearSelection: () => {
    set({ selectedShipId: null, selectedBerthId: null, selectedTugIds: [] });
  },

  validateCurrentSelection: (plannedTime, durationMinutes) => {
    const { selectedShipId, selectedBerthId, selectedTugIds, ships, berths, tugs, weatherForecast, schedules, currentTime } = get();
    
    if (!selectedShipId || !selectedBerthId || selectedTugIds.length === 0) {
      return null;
    }

    const ship = ships.find(s => s.id === selectedShipId)!;
    const berth = berths.find(b => b.id === selectedBerthId)!;
    const selectedTugs = tugs.filter(t => selectedTugIds.includes(t.id));

    return validateScheduleEngine(
      ship,
      berth,
      selectedTugs,
      plannedTime,
      durationMinutes,
      weatherForecast,
      schedules,
      currentTime
    );
  },

  calculateCurrentImpact: (plannedTime, durationMinutes) => {
    const { selectedShipId, selectedBerthId, selectedTugIds, ships, berths, tugs, schedules, weatherForecast } = get();
    
    if (!selectedShipId || !selectedBerthId || selectedTugIds.length === 0) {
      return null;
    }

    const ship = ships.find(s => s.id === selectedShipId)!;
    const berth = berths.find(b => b.id === selectedBerthId)!;
    const selectedTugs = tugs.filter(t => selectedTugIds.includes(t.id));

    return calculateDecisionImpact(
      ship,
      berth,
      selectedTugs,
      plannedTime,
      durationMinutes,
      schedules,
      weatherForecast
    );
  },

  createSchedule: (plannedTime, durationMinutes, decisionNote) => {
    const state = get();
    const { selectedShipId, selectedBerthId, selectedTugIds, ships, berths, tugs, weatherForecast, schedules, currentTime } = state;
    
    if (!selectedShipId || !selectedBerthId || selectedTugIds.length === 0) {
      return { success: false, errors: ['请先选择船舶、泊位和拖轮'] };
    }

    const ship = ships.find(s => s.id === selectedShipId)!;
    const berth = berths.find(b => b.id === selectedBerthId)!;
    const selectedTugs = tugs.filter(t => selectedTugIds.includes(t.id));

    const result = validateAndCreateSchedule(
      ship,
      berth,
      selectedTugs,
      plannedTime,
      durationMinutes,
      weatherForecast,
      schedules,
      currentTime,
      decisionNote
    );

    if (!result.schedule || !result.validation.valid) {
      return { success: false, errors: result.validation.errors };
    }

    const beforeState = { ...state };
    const newSchedules = [...schedules, result.schedule];
    
    const updatedBerths = berths.map(b => 
      b.id === berth.id 
        ? { ...b, status: 'locked' as const, occupiedUntil: result.schedule!.lockedResources.berth.end }
        : b
    );
    
    const updatedTugs = tugs.map(t => 
      selectedTugIds.includes(t.id)
        ? { ...t, status: 'assigned' as const, currentAssignment: result.schedule!.id }
        : t
    );

    const newEvents = [...state.events, ...result.events];
    const auditLog = logScheduleCreation(beforeState, { ...state, schedules: newSchedules }, result.schedule.id, decisionNote);
    const newAuditLogs = [...state.auditLogs, auditLog];

    const newState = {
      ...state,
      schedules: newSchedules,
      berths: updatedBerths,
      tugs: updatedTugs,
      events: newEvents,
      auditLogs: newAuditLogs,
      selectedShipId: null,
      selectedBerthId: null,
      selectedTugIds: [],
    };

    const snapshot = createTimelineSnapshot(newState, result.events);

    set({
      ...newState,
      timelineSnapshots: [...state.timelineSnapshots, snapshot],
    });

    return { success: true, errors: [], scheduleId: result.schedule.id };
  },

  executeScheduledShip: (scheduleId) => {
    const state = get();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    
    if (!schedule) {
      return { success: false, errors: ['未找到该调度计划'] };
    }
    
    if (schedule.status !== 'planned') {
      return { success: false, errors: ['该计划状态不允许执行'] };
    }

    const result = executeSchedule(schedule, state);
    
    const auditLogs = [...result.newState.auditLogs];
    result.newEvents.forEach(event => {
      auditLogs.push(logEventTriggered(result.newState, event));
    });

    const snapshot = createTimelineSnapshot(result.newState, result.newEvents);

    set({
      ...result.newState,
      auditLogs,
      timelineSnapshots: [...state.timelineSnapshots, snapshot],
    });

    return { success: true, errors: [] };
  },

  cancelScheduledShip: (scheduleId, reason) => {
    const state = get();
    const schedule = state.schedules.find(s => s.id === scheduleId);
    
    if (!schedule) {
      return { success: false, errors: ['未找到该调度计划'] };
    }
    
    if (schedule.status !== 'planned') {
      return { success: false, errors: ['该计划状态不允许取消'] };
    }

    const beforeState = { ...state };
    const result = cancelSchedule(schedule, state, reason);
    
    const auditLog = logScheduleCancellation(beforeState, result.newState, scheduleId, reason);
    const auditLogs = [...result.newState.auditLogs, auditLog];
    
    result.newEvents.forEach(event => {
      auditLogs.push(logEventTriggered(result.newState, event));
    });

    const snapshot = createTimelineSnapshot(result.newState, result.newEvents);

    set({
      ...result.newState,
      auditLogs,
      timelineSnapshots: [...state.timelineSnapshots, snapshot],
    });

    return { success: true, errors: [] };
  },

  advanceGameTime: (minutes) => {
    const state = get();
    const beforeState = { ...state };
    
    const result = advanceTime(state, minutes);
    
    const auditLog = logTimeAdvance(beforeState, result.newState, minutes);
    const auditLogs = [...result.newState.auditLogs, auditLog];
    
    result.newEvents.forEach(event => {
      auditLogs.push(logEventTriggered(result.newState, event));
    });

    if (result.newState.isGameOver) {
      const gameEndLog = logGameEnd(result.newState);
      auditLogs.push(gameEndLog);
    }

    const snapshot = createTimelineSnapshot(result.newState, result.newEvents);

    set({
      ...result.newState,
      auditLogs,
      timelineSnapshots: [...state.timelineSnapshots, snapshot],
    });

    return { newEvents: result.newEvents };
  },

  togglePause: () => {
    set(state => ({ isPaused: !state.isPaused }));
  },

  setSpeed: (speed) => {
    set({ speed });
  },

  getAvailableBerthsForShip: (shipId, plannedTime, durationMinutes) => {
    const { ships, berths } = get();
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return [];
    return getAvailableBerths(berths, ship, plannedTime, durationMinutes);
  },

  getAvailableTugsForTime: (plannedTime, durationMinutes) => {
    const { tugs } = get();
    return getAvailableTugs(tugs, plannedTime, durationMinutes);
  },

  getOptimalTugsForShip: (shipId, plannedTime, durationMinutes) => {
    const { ships } = get();
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return null;
    
    const availableTugs = get().getAvailableTugsForTime(plannedTime, durationMinutes);
    return findOptimalTugCombination(availableTugs, ship.tugRequired);
  },

  getEventsSortedByPriority: () => {
    const { events } = get();
    return [...events].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  },

  getMissedWindowEvents: () => {
    const { events } = get();
    return events.filter(e => e.type === 'window_missed');
  },

  importData: (type, importResult) => {
    const state = get();
    const { data, errors } = importResult;
    
    if (errors.length > 0) {
      set({ 
        importErrors: [...state.importErrors, ...errors],
        showBadDataDialog: true,
      });
    }

    if (data.length === 0) {
      return { success: false, errors };
    }

    const newState = { ...state };
    
    switch (type) {
      case 'ships':
        newState.ships = data as Ship[];
        break;
      case 'berths':
        newState.berths = data as Berth[];
        break;
      case 'tugs':
        newState.tugs = data as Tug[];
        break;
      case 'weather':
        newState.weatherForecast = data as Weather[];
        break;
    }

    const validationErrors = validateGameState(newState);
    if (validationErrors.length > 0) {
      set({ errorMessage: validationErrors.join('\n') });
      return { success: false, errors: [...errors, ...validationErrors.map(e => ({
        file: 'validation',
        line: 0,
        rawContent: '',
        errorType: 'conflict' as const,
        message: e,
        suggestion: '请检查数据一致性',
      }))] };
    }

    set(newState);
    return { success: true, errors };
  },

  showBadData: (show) => {
    set({ showBadDataDialog: show });
  },

  clearImportErrors: () => {
    set({ importErrors: [] });
  },

  setGameOver: () => {
    const state = get();
    const auditLog = logGameEnd(state);
    set({ 
      isGameOver: true,
      isPaused: true,
      auditLogs: [...state.auditLogs, auditLog],
    });
  },

  setErrorMessage: (message) => {
    set({ errorMessage: message });
  },
}));
