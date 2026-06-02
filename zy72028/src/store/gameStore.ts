import { create } from 'zustand';
import type { GameState, MaterialPackage, SupplementRecord, ValidationResult } from '../types';
import { allMaterials } from '../data/sampleMaterials';
import { ConfigValidator } from '../utils/ConfigValidator';
import { GameEngine } from '../utils/GameEngine';
import { Storage } from '../utils/Storage';

interface GameStore {
  materials: MaterialPackage[];
  currentGame: GameState | null;
  currentMaterial: MaterialPackage | null;
  validationResults: Record<string, ValidationResult>;
  supplements: Record<string, SupplementRecord[]>;
  isLoading: boolean;

  initMaterials: () => void;
  selectMaterial: (materialId: string) => void;
  validateMaterial: (materialId: string) => ValidationResult | null;
  startGame: () => void;
  processDecision: (optionId: string, timeTaken: number) => { feedback: string; isCorrect: boolean } | null;
  endGame: (failureType?: 'timeout' | 'rule_misunderstanding') => void;
  pauseGame: () => void;
  resumeGame: () => void;
  loadGame: (gameId: string) => void;
  restorePlayingGame: (materialId: string) => boolean;
  addSupplement: (gameId: string, notes: string, supplementedBy: string) => void;
  loadSupplements: (gameId: string) => void;
  clearCurrentGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  materials: [],
  currentGame: null,
  currentMaterial: null,
  validationResults: {},
  supplements: {},
  isLoading: false,

  initMaterials: () => {
    const storedMaterials = Storage.getAllMaterials();
    const allMats = storedMaterials.length > 0 
      ? storedMaterials 
      : allMaterials;
    
    const validationResults: Record<string, ValidationResult> = {};
    allMats.forEach(m => {
      validationResults[m.id] = ConfigValidator.validate(m);
    });

    set({ materials: allMats, validationResults });
  },

  selectMaterial: (materialId: string) => {
    const material = get().materials.find(m => m.id === materialId);
    set({ currentMaterial: material || null });
  },

  validateMaterial: (materialId: string) => {
    return get().validationResults[materialId] || null;
  },

  startGame: () => {
    const { currentMaterial } = get();
    if (!currentMaterial) return;

    const validation = ConfigValidator.validate(currentMaterial);
    if (!validation.isValid) {
      throw new Error(`材料包配置有误: ${ConfigValidator.formatErrors(validation.errors)}`);
    }

    const gameState = GameEngine.startGame(currentMaterial);
    Storage.saveGame(gameState);
    set({ currentGame: gameState });
  },

  processDecision: (optionId: string, timeTaken: number) => {
    const { currentGame, currentMaterial } = get();
    if (!currentGame || !currentMaterial) return null;

    const currentEvent = currentMaterial.events[currentGame.currentEventIndex];
    if (!currentEvent) return null;

    const result = GameEngine.processDecision(currentGame, currentEvent, optionId, timeTaken);
    Storage.saveGame(result.newState);
    set({ currentGame: result.newState });

    return { feedback: result.feedback, isCorrect: result.isCorrect };
  },

  endGame: (failureType) => {
    const { currentGame } = get();
    if (!currentGame) return;

    const finalizedGame = GameEngine.finalizeGame(currentGame, failureType);
    Storage.saveGame(finalizedGame);
    set({ currentGame: finalizedGame });
  },

  pauseGame: () => {
    const { currentGame } = get();
    if (!currentGame || currentGame.status !== 'playing') return;
    const paused = GameEngine.pauseGame(currentGame);
    Storage.saveGame(paused);
    set({ currentGame: paused });
  },

  resumeGame: () => {
    const { currentGame } = get();
    if (!currentGame || !currentGame.pausedAt) return;
    const resumed = GameEngine.resumeGame(currentGame);
    Storage.saveGame(resumed);
    set({ currentGame: resumed });
  },

  restorePlayingGame: (materialId: string) => {
    const allGames = Storage.getAllGames();
    const playing = allGames.find(
      g => g.materialId === materialId && g.status === 'playing'
    );
    if (!playing) return false;

    const material = get().materials.find(m => m.id === playing.materialId);
    const paused = playing.pausedAt ? playing : GameEngine.pauseGame(playing);
    Storage.saveGame(paused);
    set({ currentGame: paused, currentMaterial: material || null });
    return true;
  },

  loadGame: (gameId: string) => {
    const game = Storage.getGame(gameId);
    if (game) {
      const material = get().materials.find(m => m.id === game.materialId);
      set({ 
        currentGame: game,
        currentMaterial: material || null
      });
    }
  },

  addSupplement: (gameId: string, notes: string, supplementedBy: string) => {
    const game = Storage.getGame(gameId);
    if (!game) return;

    const supplement: SupplementRecord = {
      gameId,
      supplementedAt: new Date().toISOString(),
      supplementedBy,
      notes,
      originalScore: game.score,
      adjustments: [
        {
          field: 'notes',
          oldValue: '',
          newValue: notes,
          reason: '助教补录备注'
        }
      ]
    };

    Storage.saveSupplement(supplement);
    get().loadSupplements(gameId);
  },

  loadSupplements: (gameId: string) => {
    const supplements = Storage.getSupplements(gameId);
    set(state => ({
      supplements: {
        ...state.supplements,
        [gameId]: supplements
      }
    }));
  },

  clearCurrentGame: () => {
    set({ currentGame: null, currentMaterial: null });
  }
}));
