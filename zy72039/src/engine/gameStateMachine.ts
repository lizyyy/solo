import type { GameState, GameAction, GameConfig, GameRecord } from '../types';
import { processInput } from './dataProcessor';
import { analyzeFailure } from './failureAnalyzer';
import { formatTimestamp } from '../utils/timeUtils';

export function createInitialState(): GameState {
  return {
    status: 'idle',
    currentRound: 0,
    totalRounds: 0,
    currentLoad: 0,
    maxLoad: 0,
    targetLoad: 0,
    records: [],
    startTime: null,
    pauseTime: null,
    totalPausedDuration: 0,
    lastInputTime: null,
    config: null,
    playbackIndex: -1,
    playbackSpeed: 1,
    pauseNote: '',
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START': {
      const config = action.payload.config;
      return {
        ...state,
        status: 'playing',
        currentRound: 1,
        totalRounds: config.totalRounds,
        currentLoad: 0,
        maxLoad: config.maxLoad,
        targetLoad: config.targetLoad,
        records: [],
        startTime: Date.now(),
        pauseTime: null,
        totalPausedDuration: 0,
        lastInputTime: Date.now(),
        config,
        playbackIndex: -1,
        pauseNote: '',
      };
    }

    case 'PAUSE': {
      if (state.status !== 'playing') return state;
      return {
        ...state,
        status: 'paused',
        pauseTime: Date.now(),
        pauseNote: action.payload.note,
      };
    }

    case 'RESUME': {
      if (state.status !== 'paused' || !state.pauseTime) return state;
      const pausedDuration = Date.now() - state.pauseTime;
      return {
        ...state,
        status: 'playing',
        pauseTime: null,
        totalPausedDuration: state.totalPausedDuration + pausedDuration,
        lastInputTime: Date.now(),
        pauseNote: '',
      };
    }

    case 'INPUT': {
      if (state.status !== 'playing' || !state.config) return state;

      const now = Date.now();
      const responseTime = state.lastInputTime ? now - state.lastInputTime : null;

      const { record } = processInput(
        action.payload.value,
        action.payload.note,
        state.config,
        state.records,
        state.lastInputTime,
        state.currentRound,
        state.currentLoad,
        responseTime
      );

      if (!record.isSuccess) {
        const analysis = analyzeFailure(record, state.config);
        record.failureReason = analysis.reason;
        record.failureDetail = analysis.detail;
        if (record.processingNote) {
          record.processingNote += '；' + analysis.suggestions.join('；');
        } else {
          record.processingNote = analysis.suggestions.join('；');
        }
      }

      const newRecords = [...state.records, record];
      const gameEnded = state.currentRound >= state.totalRounds;

      return {
        ...state,
        records: newRecords,
        currentLoad: record.load,
        lastInputTime: now,
        currentRound: gameEnded ? state.currentRound : state.currentRound + 1,
        status: gameEnded ? 'ended' : 'playing',
      };
    }

    case 'RESTART': {
      if (!state.config) return createInitialState();
      return {
        ...createInitialState(),
        config: state.config,
      };
    }

    case 'END': {
      return {
        ...state,
        status: 'ended',
      };
    }

    case 'PLAYBACK_START': {
      if (state.records.length === 0) return state;
      return {
        ...state,
        status: 'playback',
        playbackIndex: 0,
      };
    }

    case 'PLAYBACK_NEXT': {
      if (state.status !== 'playback') return state;
      const nextIndex = Math.min(state.playbackIndex + 1, state.records.length - 1);
      const record = state.records[nextIndex];
      return {
        ...state,
        playbackIndex: nextIndex,
        currentLoad: record?.load ?? state.currentLoad,
        currentRound: record?.roundNumber ?? state.currentRound,
      };
    }

    case 'PLAYBACK_PREV': {
      if (state.status !== 'playback') return state;
      const prevIndex = Math.max(state.playbackIndex - 1, 0);
      const record = state.records[prevIndex];
      return {
        ...state,
        playbackIndex: prevIndex,
        currentLoad: record?.load ?? state.currentLoad,
        currentRound: record?.roundNumber ?? state.currentRound,
      };
    }

    case 'PLAYBACK_GOTO': {
      if (state.status !== 'playback') return state;
      const index = Math.max(0, Math.min(action.payload.index, state.records.length - 1));
      const record = state.records[index];
      return {
        ...state,
        playbackIndex: index,
        currentLoad: record?.load ?? state.currentLoad,
        currentRound: record?.roundNumber ?? state.currentRound,
      };
    }

    case 'PLAYBACK_STOP': {
      return {
        ...state,
        status: 'ended',
        playbackIndex: -1,
      };
    }

    default:
      return state;
  }
}

export function getCurrentPlaybackRecord(state: GameState): GameRecord | null {
  if (state.status !== 'playback' || state.playbackIndex < 0) return null;
  return state.records[state.playbackIndex] ?? null;
}

export function calculateGameStats(state: GameState) {
  const { records } = state;
  const successCount = records.filter(r => r.isSuccess).length;
  const failureCount = records.filter(r => !r.isSuccess).length;
  const flaggedCount = records.filter(r => !r.flags.includes('normal')).length;
  const totalScore = records.reduce((sum, r) => sum + (r.isSuccess ? (r.processedValue || 0) : 0), 0);
  const avgResponseTime = records.length > 0
    ? records.reduce((sum, r) => sum + (r.responseTime || 0), 0) / records.length
    : 0;

  return {
    totalRecords: records.length,
    successCount,
    failureCount,
    flaggedCount,
    totalScore,
    avgResponseTime,
    successRate: records.length > 0 ? (successCount / records.length) * 100 : 0,
    startTime: state.startTime ? formatTimestamp(state.startTime) : '-',
    endTime: state.status === 'ended' && records.length > 0 
      ? formatTimestamp(records[records.length - 1].timestamp) 
      : '-',
  };
}
