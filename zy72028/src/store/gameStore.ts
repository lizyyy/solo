import { create } from 'zustand';
import type { GameState, MaterialPackage, SupplementRecord, ValidationResult } from '../types';
import { sampleMaterials } from '../data/sampleMaterials';
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
  loadGame: (gameId: string) => void;
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
    const allMaterials = storedMaterials.length > 0 
      ? storedMaterials 
      : sampleMaterials;
    
    const validationResults: Record<string, ValidationResult> = {};
    allMaterials.forEach(m => {
      validationResults[m.id] = ConfigValidator.validate(m);
    });

    set({ materials: allMaterials, validationResults });
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
