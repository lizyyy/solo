import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GameState, GameEvent } from '../types';
import { gameApi } from '../services/api';

interface GameStore {
  currentGame: GameState | null;
  gameId: string | null;
  isLoading: boolean;
  error: string | null;
  activeEvent: GameEvent | null;
  
  createGame: (name: string) => Promise<void>;
  loadGame: (gameId: string) => Promise<void>;
  performAction: (actionId: string, locationId?: string) => Promise<void>;
  endTurn: () => Promise<void>;
  handleEventChoice: (eventId: string, choiceId: string) => Promise<void>;
  setActiveEvent: (event: GameEvent | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      currentGame: null,
      gameId: null,
      isLoading: false,
      error: null,
      activeEvent: null,

      createGame: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const game = await gameApi.createGame(name);
          set({
            currentGame: game,
            gameId: game.id,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '创建游戏失败',
            isLoading: false,
          });
        }
      },

      loadGame: async (gameId: string) => {
        set({ isLoading: true, error: null });
        try {
          const game = await gameApi.getGame(gameId);
          set({
            currentGame: game,
            gameId: game.id,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '加载游戏失败',
            isLoading: false,
          });
        }
      },

      performAction: async (actionId: string, locationId?: string) => {
        const { gameId } = get();
        if (!gameId) return;

        set({ isLoading: true, error: null });
        try {
          const game = await gameApi.performAction(gameId, actionId, locationId);
          set({
            currentGame: game,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '执行行动失败',
            isLoading: false,
          });
        }
      },

      endTurn: async () => {
        const { gameId } = get();
        if (!gameId) return;

        set({ isLoading: true, error: null });
        try {
          const game = await gameApi.endTurn(gameId);
          
          const triggeredEvents = game.events.filter((e) => e.triggered && !e.dayTriggered);
          if (triggeredEvents.length > 0) {
            set({
              currentGame: game,
              activeEvent: triggeredEvents[0],
              isLoading: false,
            });
          } else {
            set({
              currentGame: game,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '结束回合失败',
            isLoading: false,
          });
        }
      },

      handleEventChoice: async (eventId: string, choiceId: string) => {
        const { gameId } = get();
        if (!gameId) return;

        set({ isLoading: true, error: null });
        try {
          const game = await gameApi.handleEventChoice(gameId, eventId, choiceId);
          
          const remainingEvents = game.events.filter((e) => e.triggered && !e.dayTriggered);
          set({
            currentGame: game,
            activeEvent: remainingEvents.length > 0 ? remainingEvents[0] : null,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '处理事件失败',
            isLoading: false,
          });
        }
      },

      setActiveEvent: (event: GameEvent | null) => {
        set({ activeEvent: event });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          currentGame: null,
          gameId: null,
          isLoading: false,
          error: null,
          activeEvent: null,
        });
      },
    }),
    {
      name: 'robinson-game-storage',
      partialize: (state) => ({
        gameId: state.gameId,
      }),
    }
  )
);
