import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { GameState, PurchaseDecision, PriceAdjustment, GameEvent } from '../types/game';
import { createInitialGameState, advanceDay } from '../utils/gameLogic';
import { saveGameState, loadGameState, saveToHistory, saveFullGameRecord } from '../utils/storage';

interface GameContextType {
  state: GameState;
  actions: {
    startNewGame: () => void;
    loadSavedGame: () => boolean;
    processDay: (purchases: PurchaseDecision[], priceAdjustments: PriceAdjustment[]) => GameEvent[];
    getRecordById: (id: string) => any;
    getCustomerById: (id: string) => any;
  };
}

const GameContext = createContext<GameContextType | undefined>(undefined);

type GameAction =
  | { type: 'SET_STATE'; payload: GameState }
  | { type: 'RESET_GAME' };

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'RESET_GAME':
      return createInitialGameState();
    default:
      return state;
  }
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, createInitialGameState());

  useEffect(() => {
    saveGameState(state);
    if (state.isGameOver) {
      saveToHistory(state);
      saveFullGameRecord(state);
    }
  }, [state]);

  const startNewGame = () => {
    dispatch({ type: 'RESET_GAME' });
  };

  const loadSavedGame = (): boolean => {
    const saved = loadGameState();
    if (saved && !saved.isGameOver) {
      dispatch({ type: 'SET_STATE', payload: saved });
      return true;
    }
    return false;
  };

  const processDay = (
    purchases: PurchaseDecision[],
    priceAdjustments: PriceAdjustment[]
  ): GameEvent[] => {
    const { newState, allEvents } = advanceDay(state, purchases, priceAdjustments);
    dispatch({ type: 'SET_STATE', payload: newState });
    return allEvents;
  };

  const getRecordById = (id: string) => {
    return state.vinylCatalog.find(r => r.id === id);
  };

  const getCustomerById = (id: string) => {
    return state.customerPreferences.find(c => c.id === id);
  };

  return (
    <GameContext.Provider
      value={{
        state,
        actions: {
          startNewGame,
          loadSavedGame,
          processDay,
          getRecordById,
          getCustomerById
        }
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
