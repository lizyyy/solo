import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { GameState, GameHistory, Level } from '../game/types';
import { GameEngine } from '../game/engine';
import { getLevelById } from '../game/levels';
import { HistoryRecorder } from '../game/recorder';
import { CostCalculator } from '../game/calculator';

interface GameContextType {
  gameState: GameState;
  currentLevel: Level | undefined;
  setScheduledOrders: (orderIds: string[]) => void;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  setSpeed: (speed: number) => void;
  setLevel: (levelId: number) => void;
  saveHistory: (result: { isWin: boolean; score: string; stars: number }) => void;
  getHistory: () => GameHistory[];
}

const GameContext = createContext<GameContextType | undefined>(undefined);

type GameAction =
  | { type: 'SET_LEVEL'; payload: number }
  | { type: 'SET_STATE'; payload: GameState }
  | { type: 'SCHEDULE_ORDERS'; payload: string[] }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; payload: number }
  | { type: 'TICK'; payload: number };

interface GameProviderState {
  levelId: number;
  gameState: GameState;
  engine: GameEngine | null;
}

const initialState: GameProviderState = {
  levelId: 1,
  gameState: {
    levelId: 1,
    status: 'idle',
    scheduledOrders: [],
    currentTime: 0,
    currentMoldId: 'A1',
    currentOrderIndex: 0,
    currentPhase: 'idle',
    phaseStartTime: 0,
    phaseDuration: 0,
    costs: { total: 0, changeover: 0, cleaning: 0, idle: 0, delay: 0 },
    completedOrders: [],
    events: [],
    speed: 1
  },
  engine: null
};

function gameReducer(state: GameProviderState, action: GameAction): GameProviderState {
  switch (action.type) {
    case 'SET_LEVEL': {
      const level = getLevelById(action.payload);
      if (!level) return state;
      
      const engine = new GameEngine(level);
      const newState = engine.getState();
      
      return {
        ...state,
        levelId: action.payload,
        gameState: newState,
        engine
      };
    }
    
    case 'SET_STATE':
      return { ...state, gameState: action.payload };
    
    case 'SCHEDULE_ORDERS':
      if (state.engine) {
        state.engine.setScheduledOrders(action.payload);
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'START':
      if (state.engine) {
        state.engine.start();
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'PAUSE':
      if (state.engine) {
        state.engine.pause();
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'RESUME':
      if (state.engine) {
        state.engine.resume();
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'RESET':
      if (state.engine) {
        state.engine.reset();
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'SET_SPEED':
      if (state.engine) {
        state.engine.setSpeed(action.payload);
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    case 'TICK':
      if (state.engine) {
        state.engine.tick(action.payload);
        return { ...state, gameState: state.engine.getState() };
      }
      return state;
    
    default:
      return state;
  }
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState, (initial) => {
    const level = getLevelById(initial.levelId);
    if (level) {
      const engine = new GameEngine(level);
      return {
        ...initial,
        engine,
        gameState: engine.getState()
      };
    }
    return initial;
  });

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (state.gameState.status === 'running') {
      lastTimeRef.current = performance.now();
      
      const tick = (currentTime: number) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 1000;
        lastTimeRef.current = currentTime;
        
        dispatch({ type: 'TICK', payload: deltaTime * 60 });
        
        animationRef.current = requestAnimationFrame(tick);
      };
      
      animationRef.current = requestAnimationFrame(tick);
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [state.gameState.status]);

  const setLevel = useCallback((levelId: number) => {
    dispatch({ type: 'SET_LEVEL', payload: levelId });
  }, []);

  const setScheduledOrders = useCallback((orderIds: string[]) => {
    dispatch({ type: 'SCHEDULE_ORDERS', payload: orderIds });
  }, []);

  const startGame = useCallback(() => {
    dispatch({ type: 'START' });
  }, []);

  const pauseGame = useCallback(() => {
    dispatch({ type: 'PAUSE' });
  }, []);

  const resumeGame = useCallback(() => {
    dispatch({ type: 'RESUME' });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    dispatch({ type: 'SET_SPEED', payload: speed });
  }, []);

  const saveHistory = useCallback((result: { isWin: boolean; score: string; stars: number }) => {
    if (!state.engine) return;
    
    const level = getLevelById(state.levelId);
    if (!level) return;
    
    const history = HistoryRecorder.createHistoryFromGameState(
      state.gameState,
      level,
      result
    );
    
    HistoryRecorder.saveHistory(history);
    HistoryRecorder.saveLevelProgress(state.levelId, {
      ...result,
      finalCost: state.gameState.costs.total
    });
  }, [state.engine, state.levelId, state.gameState]);

  const getHistory = useCallback((): GameHistory[] => {
    return HistoryRecorder.getHistory();
  }, []);

  const currentLevel = getLevelById(state.levelId);

  return (
    <GameContext.Provider
      value={{
        gameState: state.gameState,
        currentLevel,
        setScheduledOrders,
        startGame,
        pauseGame,
        resumeGame,
        resetGame,
        setSpeed,
        setLevel,
        saveHistory,
        getHistory
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
