import type { GameConfig, GameEvent, GameRecord, Resources, GameStatus } from '@/types/gameTypes';
import { checkNegativeResources } from './configValidator';

export interface GameEngineState {
  status: GameStatus;
  currentLevelIndex: number;
  currentEventIndex: number;
  resources: Resources;
  eventLog: GameEvent[];
  anomalies: string[];
  needsManualReview: boolean;
  startedAt: number;
  pausedAt?: number;
  totalPausedMs: number;
}

export function createInitialState(config: GameConfig): GameEngineState {
  return {
    status: 'idle',
    currentLevelIndex: 0,
    currentEventIndex: 0,
    resources: { ...config.initialResources },
    eventLog: [],
    anomalies: [],
    needsManualReview: false,
    startedAt: 0,
    totalPausedMs: 0,
  };
}

export function startGame(config: GameConfig): GameEngineState {
  const state = createInitialState(config);
  state.status = 'running';
  state.startedAt = Date.now();
  return state;
}

export function applyEvent(
  state: GameEngineState,
  event: GameEvent,
  config: GameConfig
): GameEngineState {
  const newResources = { ...state.resources };

  for (const [key, delta] of Object.entries(event.resourceChanges)) {
    if (typeof delta === 'number') {
      const boundary = config.resourceBoundaries[key];
      newResources[key] = (newResources[key] || 0) + delta;

      if (boundary && newResources[key] > boundary.max) {
        newResources[key] = boundary.max;
      }
    }
  }

  const resourceCheck = checkNegativeResources(newResources, config.resourceBoundaries);
  const newAnomalies = [...state.anomalies];
  let needsManualReview = state.needsManualReview;

  if (resourceCheck.hasNegative) {
    for (const key of resourceCheck.negativeKeys) {
      const msg = `资源"${key}"变为负数（${newResources[key]}），来源：${event.source}`;
      if (!newAnomalies.includes(msg)) {
        newAnomalies.push(msg);
      }
    }
    needsManualReview = true;
  }

  if (resourceCheck.boundaryOverflows.length > 0) {
    for (const key of resourceCheck.boundaryOverflows) {
      const msg = `资源"${key}"超出边界（${newResources[key]}），来源：${event.source}`;
      if (!newAnomalies.includes(msg)) {
        newAnomalies.push(msg);
      }
    }
    needsManualReview = true;
  }

  const loggedEvent: GameEvent = {
    ...event,
    timestamp: Date.now(),
  };

  return {
    ...state,
    resources: newResources,
    eventLog: [...state.eventLog, loggedEvent],
    anomalies: newAnomalies,
    needsManualReview,
  };
}

export function advanceEvent(
  state: GameEngineState,
  config: GameConfig
): GameEngineState & { finished: boolean; levelSkipped: boolean } {
  let { currentLevelIndex, currentEventIndex } = state;
  let levelSkipped = false;

  while (currentLevelIndex < config.levels.length) {
    const level = config.levels[currentLevelIndex];

    if (!level.events || level.events.length === 0) {
      currentLevelIndex += 1;
      currentEventIndex = 0;
      levelSkipped = true;
      continue;
    }

    if (currentEventIndex < level.events.length) {
      const event = level.events[currentEventIndex];
      const newState = applyEvent(state, event, config);

      return {
        ...newState,
        currentLevelIndex,
        currentEventIndex: currentEventIndex + 1,
        finished: false,
        levelSkipped,
      };
    }

    currentLevelIndex += 1;
    currentEventIndex = 0;
  }

  return {
    ...state,
    status: 'finished' as GameStatus,
    currentLevelIndex,
    currentEventIndex,
    finished: true,
    levelSkipped,
  };
}

export function pauseGame(state: GameEngineState): GameEngineState {
  if (state.status !== 'running') return state;
  return {
    ...state,
    status: 'paused',
    pausedAt: Date.now(),
  };
}

export function resumeGame(state: GameEngineState): GameEngineState {
  if (state.status !== 'paused') return state;
  const pausedMs = state.pausedAt ? Date.now() - state.pausedAt : 0;
  return {
    ...state,
    status: 'running',
    pausedAt: undefined,
    totalPausedMs: state.totalPausedMs + pausedMs,
  };
}

export function resetGame(config: GameConfig): GameEngineState {
  return createInitialState(config);
}

export function finishGame(state: GameEngineState, config: GameConfig): GameRecord {
  const elapsed = state.pausedAt
    ? state.pausedAt - state.startedAt - state.totalPausedMs
    : Date.now() - state.startedAt - state.totalPausedMs;

  return {
    id: `record-${Date.now()}`,
    configId: config.id,
    configName: config.name,
    startTime: state.startedAt,
    endTime: Date.now(),
    status: state.status === 'error' ? 'error' : 'finished',
    finalResources: { ...state.resources },
    eventLog: [...state.eventLog],
    anomalies: [...state.anomalies],
    needsManualReview: state.needsManualReview,
    dataFormatVersion: 'v2',
    source: `城市绿波信号赛-运行记录-${new Date(state.startedAt).toISOString().slice(0, 10)}`,
  };
}

export function getElapsedSeconds(state: GameEngineState): number {
  if (state.status === 'idle') return 0;
  const now = state.status === 'paused' && state.pausedAt ? state.pausedAt : Date.now();
  return Math.floor((now - state.startedAt - state.totalPausedMs) / 1000);
}

export function getProgress(state: GameEngineState, config: GameConfig): number {
  if (!config.levels || config.levels.length === 0) return 0;
  const totalEvents = config.levels.reduce((sum, l) => sum + (l.events?.length || 0), 0);
  if (totalEvents === 0) return 0;
  return Math.min(1, state.eventLog.length / totalEvents);
}

export function getCurrentLevelName(state: GameEngineState, config: GameConfig): string {
  const level = config.levels[state.currentLevelIndex];
  return level ? level.name : '已完成';
}
