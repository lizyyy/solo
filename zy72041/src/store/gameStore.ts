import { create } from 'zustand';
import type { GameState, GameAction, ImportedData, DataConflict, EmptyValueReport, DuplicateReport } from '@/types';
import { GameEngine } from '@/utils/gameEngine';
import { PersistenceManager } from '@/utils/persistence';
import { DataValidator } from '@/utils/dataValidator';
import { getLevelById, getDefaultLevel } from '@/data/levels';

interface GameStore {
  state: GameState | null;
  conflicts: DataConflict[];
  warnings: string[];
  errors: string[];
  isLoading: boolean;
  playerName: string;
  
  dispatch: (action: GameAction) => void;
  startGame: (levelId: string, importData?: ImportedData) => void;
  makeChoice: (choiceId: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  resolveConflict: (conflictId: string, resolution: 'use_preset' | 'use_imported') => void;
  clearConflicts: () => void;
  detectConflictsForImport: (importData: ImportedData, levelId: string) => void;
  setPlayerName: (name: string) => void;
  loadSavedGame: (gameId: string) => void;
  clearError: () => void;
  reset: () => void;
}

const initialWarnings: string[] = [];
const initialErrors: string[] = [];

export const useGameStore = create<GameStore>((set, get) => {
  const gameReducer = (state: GameState, action: GameAction): GameState => {
    const level = getLevelById(state.levelId) || getDefaultLevel();
    
    switch (action.type) {
      case 'START_GAME': {
        const newState = GameEngine.startGame(action.payload.levelId, action.payload.importData);
        const importData = action.payload.importData;
        
        if (importData) {
          const conflicts = DataValidator.detectConflicts(level, importData);
          set({ conflicts });
          
          const emptyValueReports = DataValidator.checkEmptyValues(importData.data);
          if (emptyValueReports.length > 0) {
            set(state => ({
              warnings: [...state.warnings, `检测到${emptyValueReports.length}个空值字段，已使用默认值填充`]
            }));
          }

          const dataValues = Object.values(importData.data);
          const duplicateReports = DataValidator.checkDuplicates(dataValues);
          if (duplicateReports.length > 0) {
            set(state => ({
              warnings: [...state.warnings, `检测到${duplicateReports.length}组重复数据，已自动标记`]
            }));
          }
        }
        
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'MAKE_CHOICE': {
        const newState = GameEngine.makeChoice(state, action.payload.choiceId, level);
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'PAUSE_GAME': {
        const newState = GameEngine.pauseGame(state);
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'RESUME_GAME': {
        const newState = GameEngine.resumeGame(state);
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'RESTART_GAME': {
        const newState = GameEngine.restartGame(state);
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'COMPLETE_GAME': {
        const newState = { ...state, status: 'completed' as const, endTime: Date.now() };
        PersistenceManager.saveGameState(newState);
        return newState;
      }
      
      case 'RESOLVE_CONFLICT': {
        const updatedConflicts = state.conflicts?.map(c => 
          c.id === action.payload.conflictId
            ? { ...c, resolved: true, resolution: action.payload.resolution }
            : c
        ) || [];
        
        const unresolved = updatedConflicts.filter(c => !c.resolved);
        set({ conflicts: updatedConflicts });
        
        if (unresolved.length === 0) {
          set(state => ({ warnings: [...state.warnings, '所有数据冲突已解决，可以开始游戏'] }));
        }
        
        return { ...state, conflicts: updatedConflicts };
      }
      
      case 'SET_ERROR': {
        return { ...state, status: 'error' as const, errorMessage: action.payload.message };
      }
      
      case 'CLEAR_ERROR': {
        return { ...state, status: 'idle' as const, errorMessage: undefined };
      }
      
      default:
        return state;
    }
  };

  return {
    state: null,
    conflicts: [],
    warnings: initialWarnings,
    errors: initialErrors,
    isLoading: false,
    playerName: '',
    
    dispatch: (action: GameAction) => {
      set(state => {
        if (!state.state && action.type !== 'START_GAME') {
          return state;
        }
        
        try {
          if (state.state) {
            const newGameState = gameReducer(state.state, action);
            return { state: newGameState };
          }
          return state;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '发生未知错误';
          set({ errors: [...state.errors, errorMessage] });
          return {
            ...state,
            state: state.state ? { ...state.state, status: 'error', errorMessage } : null,
          };
        }
      });
    },
    
    startGame: (levelId: string, importData?: ImportedData) => {
      set({ isLoading: true, warnings: [], errors: [], conflicts: [] });
      
      try {
        const level = getLevelById(levelId) || getDefaultLevel();
        const validation = DataValidator.validateLevel(level);
        
        if (!validation.valid) {
          set({ 
            errors: validation.errors,
            warnings: validation.warnings,
            isLoading: false,
          });
          return;
        }
        
        if (validation.warnings.length > 0) {
          set({ warnings: validation.warnings });
        }
        
        let conflicts: DataConflict[] = [];
        let emptyValueReports: EmptyValueReport[] = [];
        let duplicateReports: DuplicateReport[] = [];
        
        if (importData) {
          const importValidation = DataValidator.validateImportedData(importData);
          if (!importValidation.valid) {
            set({ 
              errors: importValidation.errors,
              isLoading: false,
            });
            return;
          }
          
          if (importValidation.warnings.length > 0) {
            set(state => ({ warnings: [...state.warnings, ...importValidation.warnings] }));
          }
          
          const existingConflicts = get().conflicts;
          if (existingConflicts && existingConflicts.length > 0) {
            conflicts = existingConflicts;
          } else {
            conflicts = DataValidator.detectConflicts(level, importData);
            set({ conflicts });
          }
          
          emptyValueReports = DataValidator.checkEmptyValues(importData.data);
          if (emptyValueReports.length > 0) {
            set(state => ({ 
              warnings: [...state.warnings, `检测到${emptyValueReports.length}个空值字段，已使用默认值填充`] 
            }));
          }
          
          const dataValues = Object.values(importData.data);
          duplicateReports = DataValidator.checkDuplicates(dataValues);
          if (duplicateReports.length > 0) {
            set(state => ({ 
              warnings: [...state.warnings, `检测到${duplicateReports.length}组重复数据，已自动标记`] 
            }));
          }
        }
        
        const boundaryReports = DataValidator.checkBoundaryCases(level);
        if (boundaryReports.length > 0) {
          set(state => ({ 
            warnings: [...state.warnings, `检测到${boundaryReports.length}个边界情况，请特别注意处理`] 
          }));
        }
        
        let initialState = GameEngine.startGame(levelId, importData);
        initialState = {
          ...initialState,
          conflicts,
          emptyValueReports,
          duplicateReports,
          boundaryReports,
        };
        PersistenceManager.saveGameState(initialState);
        
        set({ 
          state: initialState,
          isLoading: false,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '启动游戏失败';
        set({ 
          errors: [errorMessage],
          isLoading: false,
        });
      }
    },
    
    makeChoice: (choiceId: string) => {
      set(state => {
        if (!state.state) return state;
        
        try {
          const level = getLevelById(state.state.levelId) || getDefaultLevel();
          const newState = GameEngine.makeChoice(state.state, choiceId, level);
          PersistenceManager.saveGameState(newState);
          return { state: newState };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '选择失败';
          return { 
            ...state,
            errors: [...state.errors, errorMessage],
            state: { ...state.state, status: 'error', errorMessage },
          };
        }
      });
    },
    
    pauseGame: () => {
      set(state => {
        if (!state.state) return state;
        const newState = GameEngine.pauseGame(state.state);
        PersistenceManager.saveGameState(newState);
        return { state: newState };
      });
    },
    
    resumeGame: () => {
      set(state => {
        if (!state.state) return state;
        const newState = GameEngine.resumeGame(state.state);
        PersistenceManager.saveGameState(newState);
        return { state: newState };
      });
    },
    
    restartGame: () => {
      set(state => {
        if (!state.state) return state;
        const newState = GameEngine.restartGame(state.state);
        PersistenceManager.saveGameState(newState);
        return { state: newState, warnings: [] };
      });
    },
    
    resolveConflict: (conflictId: string, resolution: 'use_preset' | 'use_imported') => {
      set(state => {
        const updatedConflicts = state.conflicts.map(c => 
          c.id === conflictId
            ? { ...c, resolved: true, resolution }
            : c
        );
        
        const unresolved = updatedConflicts.filter(c => !c.resolved);
        if (unresolved.length === 0) {
          set(state => ({ warnings: [...state.warnings, '所有数据冲突已解决，可以开始游戏'] }));
        }
        
        const newState = state.state ? {
          ...state.state,
          conflicts: updatedConflicts,
        } : null;
        
        if (newState) {
          PersistenceManager.saveGameState(newState);
        }
        
        return { 
          conflicts: updatedConflicts,
          state: newState,
        };
      });
    },
    
    clearConflicts: () => {
      set({ conflicts: [] });
    },
    
    detectConflictsForImport: (importData: ImportedData, levelId: string) => {
      const level = getLevelById(levelId) || getDefaultLevel();
      const conflicts = DataValidator.detectConflicts(level, importData);
      set({ conflicts });
    },
    
    setPlayerName: (name: string) => {
      set({ playerName: name });
    },
    
    loadSavedGame: (gameId: string) => {
      set({ isLoading: true });
      
      try {
        const savedState = PersistenceManager.loadGameState(gameId);
        if (savedState) {
          set({ state: savedState, isLoading: false });
        } else {
          set({ 
            errors: ['无法找到保存的游戏'],
            isLoading: false,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '加载游戏失败';
        set({ 
          errors: [errorMessage],
          isLoading: false,
        });
      }
    },
    
    clearError: () => {
      set(state => ({
        errors: [],
        state: state.state ? { ...state.state, status: 'idle', errorMessage: undefined } : null,
      }));
    },
    
    reset: () => {
      set({
        state: null,
        conflicts: [],
        warnings: [],
        errors: [],
        isLoading: false,
      });
    },
  };
});
