import { create } from 'zustand';
import type { GameConfig, GameRecord, GameEvent, GameStatus, Resources, ValidationResult, AppView, PlaybackSpeed } from '@/types/gameTypes';
import { validateConfig } from '@/engine/configValidator';
import { sampleConfig, edgeTestConfig, sampleRecords, allConfigs } from '@/data/sampleData';
import type { GameEngineState } from '@/engine/gameEngine';
import { startGame, pauseGame, resumeGame, resetGame, advanceEvent, finishGame, getElapsedSeconds, getProgress, getCurrentLevelName } from '@/engine/gameEngine';
import { createPlaybackState, playbackPlay, playbackPause, playbackSetSpeed, playbackSeek, playbackStepForward, playbackStepBackward } from '@/engine/playbackEngine';
import { computeReplayResources } from '@/engine/playbackEngine';

interface GameState {
  appView: AppView;
  currentConfig: GameConfig | null;
  configValidation: ValidationResult | null;
  engineState: GameEngineState;
  records: GameRecord[];
  currentReplayRecord: GameRecord | null;
  replayIndex: number;
  replayIsPlaying: boolean;
  replaySpeed: PlaybackSpeed;
  selectedConfigId: string;
  errorMessages: string[];

  setAppView: (view: AppView) => void;
  selectConfig: (configId: string) => void;
  startNewGame: () => void;
  pauseCurrentGame: () => void;
  resumeCurrentGame: () => void;
  restartGame: () => void;
  stepEvent: () => void;
  settleGame: () => void;
  startReplay: (record: GameRecord) => void;
  replayPlayToggle: () => void;
  replaySeekTo: (index: number) => void;
  replayStepForward: () => void;
  replayStepBackward: () => void;
  replaySetSpeed: (speed: PlaybackSpeed) => void;
  stopReplay: () => void;
  dismissError: (index: number) => void;

  getElapsed: () => number;
  getProgress: () => number;
  getCurrentLevelName: () => string;
  getReplayResources: () => Resources;
  getAvailableConfigs: () => GameConfig[];
}

const initialEngineState: GameEngineState = {
  status: 'idle',
  currentLevelIndex: 0,
  currentEventIndex: 0,
  resources: { time: 0, energy: 0, budget: 0 },
  eventLog: [],
  anomalies: [],
  needsManualReview: false,
  startedAt: 0,
  totalPausedMs: 0,
};

function findConfig(id: string): GameConfig | null {
  return allConfigs.find(c => c.id === id) || null;
}

export const useGameStore = create<GameState>((set, get) => ({
  appView: 'game',
  currentConfig: null,
  configValidation: null,
  engineState: initialEngineState,
  records: [...sampleRecords],
  currentReplayRecord: null,
  replayIndex: 0,
  replayIsPlaying: false,
  replaySpeed: 1,
  selectedConfigId: '',
  errorMessages: [],

  setAppView: (view) => set({ appView: view }),

  selectConfig: (configId) => {
    const config = findConfig(configId);
    if (!config) {
      set({ errorMessages: [...get().errorMessages, `找不到配置"${configId}"`] });
      return;
    }
    const validation = validateConfig(config);
    set({
      currentConfig: config,
      configValidation: validation,
      selectedConfigId: configId,
      engineState: resetGame(config),
    });
  },

  startNewGame: () => {
    const { currentConfig, errorMessages } = get();
    if (!currentConfig) {
      set({ errorMessages: [...errorMessages, '请先选择一个比赛配置'] });
      return;
    }
    const validation = validateConfig(currentConfig);
    if (!validation.valid) {
      set({ errorMessages: [...errorMessages, ...validation.errors] });
      return;
    }
    const engineState = startGame(currentConfig);
    set({ engineState, configValidation: validation, appView: 'game' });
  },

  pauseCurrentGame: () => {
    const { engineState } = get();
    set({ engineState: pauseGame(engineState) });
  },

  resumeCurrentGame: () => {
    const { engineState } = get();
    set({ engineState: resumeGame(engineState) });
  },

  restartGame: () => {
    const { currentConfig } = get();
    if (!currentConfig) return;
    set({ engineState: resetGame(currentConfig) });
  },

  stepEvent: () => {
    const { engineState, currentConfig } = get();
    if (!currentConfig || engineState.status !== 'running') return;
    const result = advanceEvent(engineState, currentConfig);
    const newEngineState: GameEngineState = {
      status: result.status,
      currentLevelIndex: result.currentLevelIndex,
      currentEventIndex: result.currentEventIndex,
      resources: result.resources,
      eventLog: result.eventLog,
      anomalies: result.anomalies,
      needsManualReview: result.needsManualReview,
      startedAt: result.startedAt,
      pausedAt: result.pausedAt,
      totalPausedMs: result.totalPausedMs,
    };

    if (result.finished) {
      const record = finishGame(newEngineState, currentConfig);
      set({
        engineState: { ...newEngineState, status: 'finished' },
        records: [...get().records, record],
      });
    } else {
      set({ engineState: newEngineState });
    }
  },

  settleGame: () => {
    const { engineState, currentConfig } = get();
    if (!currentConfig) return;
    const record = finishGame(engineState, currentConfig);
    set({
      engineState: { ...engineState, status: 'finished' },
      records: [...get().records, record],
      appView: 'report',
    });
  },

  startReplay: (record) => {
    const pbState = createPlaybackState(record);
    set({
      currentReplayRecord: record,
      replayIndex: 0,
      replayIsPlaying: false,
      replaySpeed: 1,
      appView: 'replay',
    });
  },

  replayPlayToggle: () => {
    const { replayIsPlaying } = get();
    set({ replayIsPlaying: !replayIsPlaying });
  },

  replaySeekTo: (index) => {
    const { currentReplayRecord } = get();
    if (!currentReplayRecord) return;
    const maxIndex = currentReplayRecord.eventLog.length - 1;
    set({ replayIndex: Math.max(0, Math.min(index, maxIndex)) });
  },

  replayStepForward: () => {
    const { replayIndex, currentReplayRecord } = get();
    if (!currentReplayRecord) return;
    const maxIndex = currentReplayRecord.eventLog.length - 1;
    if (replayIndex < maxIndex) {
      set({ replayIndex: replayIndex + 1 });
    }
  },

  replayStepBackward: () => {
    const { replayIndex } = get();
    if (replayIndex > 0) {
      set({ replayIndex: replayIndex - 1 });
    }
  },

  replaySetSpeed: (speed) => set({ replaySpeed: speed }),

  stopReplay: () => {
    set({
      currentReplayRecord: null,
      replayIsPlaying: false,
      appView: 'game',
    });
  },

  dismissError: (index) => {
    const { errorMessages } = get();
    set({ errorMessages: errorMessages.filter((_, i) => i !== index) });
  },

  getElapsed: () => {
    const { engineState } = get();
    return getElapsedSeconds(engineState);
  },

  getProgress: () => {
    const { engineState, currentConfig } = get();
    if (!currentConfig) return 0;
    return getProgress(engineState, currentConfig);
  },

  getCurrentLevelName: () => {
    const { engineState, currentConfig } = get();
    if (!currentConfig) return '';
    return getCurrentLevelName(engineState, currentConfig);
  },

  getReplayResources: () => {
    const { currentReplayRecord, replayIndex } = get();
    if (!currentReplayRecord) return { time: 0, energy: 0, budget: 0 };
    const config = findConfig(currentReplayRecord.configId) || sampleConfig;
    return computeReplayResources(config.initialResources, currentReplayRecord.eventLog, replayIndex) as Resources;
  },

  getAvailableConfigs: () => allConfigs,
}));
