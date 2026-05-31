import { create } from 'zustand';
import type { GameSession, ReplayState } from '@/types';
import { ReplayEngine } from '@/engine/ReplayEngine';
import { LocalStorage } from '@/storage/LocalStorage';
import { deepClone } from '@/utils/helpers';

interface HistoryState {
  sessions: GameSession[];
  replayEngine: ReplayEngine | null;
  replayState: ReplayState | null;
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchSessions: () => void;
  deleteSession: (id: string) => void;
  initReplayEngine: () => void;
  loadReplaySession: (sessionId: string) => Promise<void>;
  unloadReplaySession: () => void;
  playReplay: () => void;
  pauseReplay: () => void;
  toggleReplay: () => void;
  stopReplay: () => void;
  nextReplayStep: () => void;
  prevReplayStep: () => void;
  seekReplayTo: (stepIndex: number) => void;
  setReplaySpeed: (speed: number) => void;
  destroyReplayEngine: () => void;
  searchSessions: (query: string) => GameSession[];
  setSelectedSessionId: (id: string | null) => void;
  clearError: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  sessions: [],
  replayEngine: null,
  replayState: null,
  selectedSessionId: null,
  isLoading: false,
  error: null,

  fetchSessions: () => {
    set({ isLoading: true });
    try {
      const sessions = LocalStorage.getAllSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载历史记录失败', 
        isLoading: false 
      });
    }
  },

  deleteSession: (id: string) => {
    try {
      LocalStorage.deleteSession(id);
      const sessions = LocalStorage.getAllSessions();
      set({ sessions });
      
      const { selectedSessionId, replayEngine } = get();
      if (selectedSessionId === id) {
        set({ selectedSessionId: null });
      }
      
      if (replayEngine && get().replayState?.sessionId === id) {
        replayEngine.unloadSession();
        set({ replayState: null });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '删除记录失败' });
    }
  },

  initReplayEngine: () => {
    const existing = get().replayEngine;
    if (existing) {
      existing.destroy();
    }

    const engine = new ReplayEngine((state) => {
      set({ replayState: state });
    });
    
    set({ replayEngine: engine });
  },

  loadReplaySession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      let { replayEngine } = get();
      if (!replayEngine) {
        get().initReplayEngine();
        replayEngine = get().replayEngine;
      }
      
      if (!replayEngine) {
        throw new Error('Replay engine not initialized');
      }
      
      const state = replayEngine.loadSession(sessionId);
      set({ replayState: state, selectedSessionId: sessionId, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载回放失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  unloadReplaySession: () => {
    const { replayEngine } = get();
    if (replayEngine) {
      replayEngine.unloadSession();
    }
    set({ replayState: null, selectedSessionId: null });
  },

  playReplay: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.play();
  },

  pauseReplay: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.pause();
  },

  toggleReplay: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.toggle();
  },

  stopReplay: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.stop();
  },

  nextReplayStep: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.nextStep();
  },

  prevReplayStep: () => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.prevStep();
  },

  seekReplayTo: (stepIndex: number) => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.seekTo(stepIndex);
  },

  setReplaySpeed: (speed: number) => {
    const { replayEngine } = get();
    if (!replayEngine) {
      throw new Error('Replay engine not initialized');
    }
    replayEngine.setPlaybackSpeed(speed);
  },

  destroyReplayEngine: () => {
    const { replayEngine } = get();
    if (replayEngine) {
      replayEngine.destroy();
    }
    set({ replayEngine: null, replayState: null });
  },

  searchSessions: (query: string): GameSession[] => {
    return LocalStorage.searchSessions(query);
  },

  setSelectedSessionId: (id: string | null) => {
    set({ selectedSessionId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));
