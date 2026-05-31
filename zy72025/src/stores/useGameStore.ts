import { create } from 'zustand';
import type { GameSession, ResourceEffect } from '@/types';
import { GameEngine } from '@/engine/GameEngine';
import { LocalStorage } from '@/storage/LocalStorage';
import { deepClone } from '@/utils/helpers';

interface GameState {
  engine: GameEngine | null;
  session: GameSession | null;
  isLoading: boolean;
  error: string | null;
  initEngine: (levelId?: string) => void;
  startGame: (levelId: string, playerName: string, existingSessionId?: string) => Promise<void>;
  makeDecision: (decisionId: string) => Promise<void>;
  supplementMaterials: (effects: ResourceEffect[], reason: string) => Promise<void>;
  pauseGame: () => Promise<void>;
  resumeGame: () => Promise<void>;
  restartGame: () => Promise<void>;
  endGame: () => Promise<void>;
  setTeacherNotes: (notes: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  clearGame: () => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  engine: null,
  session: null,
  isLoading: false,
  error: null,

  initEngine: (levelId?: string) => {
    let engine: GameEngine;
    
    if (levelId) {
      const level = LocalStorage.getLevel(levelId);
      if (level) {
        engine = new GameEngine(level);
      } else {
        engine = new GameEngine();
      }
    } else {
      engine = new GameEngine();
    }
    
    set({ engine });
  },

  startGame: async (levelId: string, playerName: string, existingSessionId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.startGame(levelId, playerName, existingSessionId);
      set({ session, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '开始游戏失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  makeDecision: async (decisionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.makeDecision(decisionId);
      set({ session, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '执行决策失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  supplementMaterials: async (effects: ResourceEffect[], reason: string) => {
    set({ isLoading: true, error: null });
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.supplementMaterials(effects, reason);
      set({ session, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '补充材料失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  pauseGame: async () => {
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.pauseGame();
      set({ session });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '暂停游戏失败' });
      throw error;
    }
  },

  resumeGame: async () => {
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.resumeGame();
      set({ session });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '继续游戏失败' });
      throw error;
    }
  },

  restartGame: async () => {
    set({ isLoading: true, error: null });
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.restartGame();
      set({ session, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '重新开始失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  endGame: async () => {
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.endGame();
      set({ session });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '结算失败' });
      throw error;
    }
  },

  setTeacherNotes: async (notes: string) => {
    try {
      const { engine } = get();
      if (!engine) {
        throw new Error('Engine not initialized');
      }
      
      const session = engine.setTeacherNotes(notes);
      set({ session });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '保存备注失败' });
      throw error;
    }
  },

  loadSession: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      let { engine } = get();
      if (!engine) {
        engine = new GameEngine();
        set({ engine });
      }
      
      const session = engine.loadSession(sessionId);
      set({ session, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : '加载会话失败', 
        isLoading: false 
      });
      throw error;
    }
  },

  clearGame: () => {
    set({
      engine: null,
      session: null,
      isLoading: false,
      error: null,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
