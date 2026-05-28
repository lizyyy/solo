import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Game,
  GameState,
  PolicyAction,
  ClassNote,
  EventCard,
  EventOption,
  Difficulty,
  ActionStatus,
  NoteCategory,
} from '@/types/game';
import {
  generateId,
  createInitialMarketState,
  processRound,
  generateEventCard,
  getDifficultyConfig,
  validateRoundSubmission,
} from '@/lib/gameEngine';

const STORAGE_KEY = 'omcb-game-storage';

interface GameStore {
  games: Game[];
  gameStates: Record<string, GameState>;
  currentGameId: string | null;

  createGame: (title: string, difficulty: Difficulty) => string;
  deleteGame: (gameId: string) => void;
  setCurrentGame: (gameId: string | null) => void;

  getCurrentGame: () => Game | null;
  getCurrentState: () => GameState | null;

  addPolicyAction: (
    gameId: string,
    action: Omit<PolicyAction, 'id' | 'roundNumber'>
  ) => void;
  updatePolicyAction: (
    gameId: string,
    actionId: string,
    updates: Partial<PolicyAction>
  ) => void;
  setActionStatus: (
    gameId: string,
    actionId: string,
    status: ActionStatus
  ) => void;
  removePolicyAction: (gameId: string, actionId: string) => void;

  selectEventOption: (gameId: string, optionId: string) => void;

  submitRound: (gameId: string) => { success: boolean; error?: string };
  restartGame: (gameId: string) => void;

  addClassNote: (
    gameId: string,
    content: string,
    category: NoteCategory
  ) => void;
  updateNoteStatus: (
    gameId: string,
    noteId: string,
    status: ActionStatus
  ) => void;
  deleteClassNote: (gameId: string, noteId: string) => void;

  exportGame: (gameId: string) => string;
  importGame: (jsonString: string) => string | null;

  clearError: (gameId: string) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      games: [],
      gameStates: {},
      currentGameId: null,

      createGame: (title: string, difficulty: Difficulty) => {
        const gameId = generateId();
        const config = getDifficultyConfig(difficulty);
        const now = new Date().toISOString();

        const newGame: Game = {
          id: gameId,
          title,
          difficulty,
          currentRound: 1,
          maxRounds: config.maxRounds,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        const initialMarket = createInitialMarketState();
        const newState: GameState = {
          game: newGame,
          marketHistory: [initialMarket],
          policyActions: [],
          eventCards: [],
          liquidityLogs: [],
          classNotes: [],
          currentEvent: null,
          roundStatus: 'pending',
          error: null,
        };

        set((state) => ({
          games: [...state.games, newGame],
          gameStates: { ...state.gameStates, [gameId]: newState },
          currentGameId: gameId,
        }));

        return gameId;
      },

      deleteGame: (gameId: string) => {
        set((state) => {
          const { [gameId]: _, ...remainingStates } = state.gameStates;
          return {
            games: state.games.filter((g) => g.id !== gameId),
            gameStates: remainingStates,
            currentGameId:
              state.currentGameId === gameId ? null : state.currentGameId,
          };
        });
      },

      setCurrentGame: (gameId: string | null) => {
        set({ currentGameId: gameId });
      },

      getCurrentGame: () => {
        const { currentGameId, games } = get();
        return games.find((g) => g.id === currentGameId) || null;
      },

      getCurrentState: () => {
        const { currentGameId, gameStates } = get();
        return currentGameId ? gameStates[currentGameId] || null : null;
      },

      addPolicyAction: (
        gameId: string,
        action: Omit<PolicyAction, 'id' | 'roundNumber'>
      ) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const newAction: PolicyAction = {
            ...action,
            id: generateId(),
            roundNumber: gameState.game.currentRound,
          };

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                policyActions: [...gameState.policyActions, newAction],
                roundStatus: 'pending',
              },
            },
          };
        });
      },

      updatePolicyAction: (
        gameId: string,
        actionId: string,
        updates: Partial<PolicyAction>
      ) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                policyActions: gameState.policyActions.map((a) =>
                  a.id === actionId ? { ...a, ...updates } : a
                ),
              },
            },
          };
        });
      },

      setActionStatus: (
        gameId: string,
        actionId: string,
        status: ActionStatus
      ) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const action = gameState.policyActions.find((a) => a.id === actionId);
          if (!action) return state;

          if (action.status === 'confirmed' && status === 'tentative') {
            return {
              gameStates: {
                ...state.gameStates,
                [gameId]: {
                  ...gameState,
                  error: '已确认的操作无法改为临时状态',
                },
              },
            };
          }

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                policyActions: gameState.policyActions.map((a) =>
                  a.id === actionId ? { ...a, status } : a
                ),
              },
            },
          };
        });
      },

      removePolicyAction: (gameId: string, actionId: string) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const action = gameState.policyActions.find((a) => a.id === actionId);
          if (action?.status === 'confirmed') {
            return {
              gameStates: {
                ...state.gameStates,
                [gameId]: {
                  ...gameState,
                  error: '已确认的操作无法删除',
                },
              },
            };
          }

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                policyActions: gameState.policyActions.filter(
                  (a) => a.id !== actionId
                ),
              },
            },
          };
        });
      },

      selectEventOption: (gameId: string, optionId: string) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState?.currentEvent) return state;

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                currentEvent: {
                  ...gameState.currentEvent,
                  selectedOptionId: optionId,
                },
              },
            },
          };
        });
      },

      submitRound: (gameId: string) => {
        const state = get();
        const gameState = state.gameStates[gameId];
        if (!gameState) return { success: false, error: '棋局不存在' };

        const roundActions = gameState.policyActions.filter(
          (a) => a.roundNumber === gameState.game.currentRound
        );

        const validation = validateRoundSubmission(
          roundActions,
          gameState.roundStatus
        );
        if (!validation.valid) {
          set((s) => ({
            gameStates: {
              ...s.gameStates,
              [gameId]: {
                ...s.gameStates[gameId],
                error: validation.error,
              },
            },
          }));
          return { success: false, error: validation.error };
        }

        const prevMarket =
          gameState.marketHistory[gameState.marketHistory.length - 1];
        const selectedOption = gameState.currentEvent?.options.find(
          (o) => o.id === gameState.currentEvent?.selectedOptionId
        ) || null;

        const { newState, liquidityChange } = processRound(
          prevMarket,
          roundActions,
          selectedOption,
          gameState.game.currentRound
        );

        const newRound = gameState.game.currentRound + 1;
        const isFinished = newRound > gameState.game.maxRounds;
        const now = new Date().toISOString();

        const newEvent = isFinished ? null : generateEventCard(newRound);

        set((s) => {
          const updatedGame: Game = {
            ...s.gameStates[gameId].game,
            currentRound: Math.min(newRound, gameState.game.maxRounds),
            status: isFinished ? 'finished' : 'active',
            updatedAt: now,
          };

          const updatedEventCards = gameState.currentEvent
            ? [...gameState.eventCards, gameState.currentEvent]
            : gameState.eventCards;

          return {
            games: s.games.map((g) =>
              g.id === gameId ? updatedGame : g
            ),
            gameStates: {
              ...s.gameStates,
              [gameId]: {
                ...s.gameStates[gameId],
                game: updatedGame,
                marketHistory: [...gameState.marketHistory, newState],
                eventCards: updatedEventCards,
                currentEvent: newEvent,
                roundStatus: 'confirmed',
                liquidityLogs: [
                  ...gameState.liquidityLogs,
                  {
                    id: generateId(),
                    roundNumber: gameState.game.currentRound,
                    beforeValue: prevMarket.liquidity,
                    afterValue: newState.liquidity,
                    changeReason: liquidityChange >= 0 ? '流动性净投放' : '流动性净回笼',
                  },
                ],
                error: null,
              },
            },
          };
        });

        return { success: true };
      },

      restartGame: (gameId: string) => {
        const state = get();
        const gameState = state.gameStates[gameId];
        if (!gameState) return;

        const config = getDifficultyConfig(gameState.game.difficulty);
        const now = new Date().toISOString();
        const initialMarket = createInitialMarketState();

        const resetGame: Game = {
          ...gameState.game,
          currentRound: 1,
          maxRounds: config.maxRounds,
          status: 'active',
          updatedAt: now,
        };

        set((s) => ({
          games: s.games.map((g) => (g.id === gameId ? resetGame : g)),
          gameStates: {
            ...s.gameStates,
            [gameId]: {
              game: resetGame,
              marketHistory: [initialMarket],
              policyActions: [],
              eventCards: [],
              liquidityLogs: [],
              classNotes: gameState.classNotes.map((n) => ({
                ...n,
                status: 'tentative' as const,
              })),
              currentEvent: null,
              roundStatus: 'pending',
              error: null,
            },
          },
        }));
      },

      addClassNote: (
        gameId: string,
        content: string,
        category: NoteCategory
      ) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const newNote: ClassNote = {
            id: generateId(),
            gameId,
            content,
            category,
            status: 'tentative',
            createdAt: new Date().toISOString(),
          };

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                classNotes: [...gameState.classNotes, newNote],
              },
            },
          };
        });
      },

      updateNoteStatus: (
        gameId: string,
        noteId: string,
        status: ActionStatus
      ) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const note = gameState.classNotes.find((n) => n.id === noteId);
          if (!note) return state;

          if (note.status === 'confirmed' && status === 'tentative') {
            return {
              gameStates: {
                ...state.gameStates,
                [gameId]: {
                  ...gameState,
                  error: '已确认的备注无法改为临时状态',
                },
              },
            };
          }

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                classNotes: gameState.classNotes.map((n) =>
                  n.id === noteId ? { ...n, status } : n
                ),
              },
            },
          };
        });
      },

      deleteClassNote: (gameId: string, noteId: string) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          const note = gameState.classNotes.find((n) => n.id === noteId);
          if (note?.status === 'confirmed') {
            return {
              gameStates: {
                ...state.gameStates,
                [gameId]: {
                  ...gameState,
                  error: '已确认的备注无法删除',
                },
              },
            };
          }

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                classNotes: gameState.classNotes.filter(
                  (n) => n.id !== noteId
                ),
              },
            },
          };
        });
      },

      exportGame: (gameId: string) => {
        const state = get();
        const gameState = state.gameStates[gameId];
        if (!gameState) return '';

        return JSON.stringify(
          {
            game: state.games.find((g) => g.id === gameId),
            state: gameState,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
      },

      importGame: (jsonString: string) => {
        try {
          const data = JSON.parse(jsonString);
          if (!data.game || !data.state) return null;

          const gameId = generateId();
          const importedGame: Game = {
            ...data.game,
            id: gameId,
            title: `${data.game.title} (导入)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const importedState: GameState = {
            ...data.state,
            game: importedGame,
            roundStatus: data.state.roundStatus || 'pending',
            classNotes: data.state.classNotes.map((n: ClassNote) => ({
              ...n,
              id: generateId(),
              gameId,
            })),
          };

          set((state) => ({
            games: [...state.games, importedGame],
            gameStates: { ...state.gameStates, [gameId]: importedState },
          }));

          return gameId;
        } catch {
          return null;
        }
      },

      clearError: (gameId: string) => {
        set((state) => {
          const gameState = state.gameStates[gameId];
          if (!gameState) return state;

          return {
            gameStates: {
              ...state.gameStates,
              [gameId]: {
                ...gameState,
                error: null,
              },
            },
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
