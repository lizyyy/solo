import { create } from 'zustand';
import { Level, NoteCard, WorkSlot, Measure, GameState, ActionRecord, ValidationResult } from '../types';
import { validateNotePlacement, calculateMeasureBeats } from '../utils/validation';
import { cloneLevel } from '../data/levels';

interface GameStore extends GameState {
  setLevel: (level: Level) => void;
  placeNote: (noteId: string, slotId: string) => ValidationResult;
  removeNote: (slotId: string) => void;
  loadMeasure: (measureIndex: number) => void;
  clearFeedback: () => void;
  resetGame: () => void;
  getAvailableNotes: () => NoteCard[];
  getSlotById: (slotId: string) => WorkSlot | null;
  getMeasureBySlotId: (slotId: string) => Measure | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentLevel: null,
  currentScore: 0,
  accuracy: 100,
  actionHistory: [],
  isComplete: false,
  placedNotes: new Map(),
  feedbackMessage: null,

  setLevel: (level: Level) => {
    const clonedLevel = cloneLevel(level);
    set({
      currentLevel: clonedLevel,
      currentScore: 0,
      accuracy: 100,
      actionHistory: [],
      isComplete: false,
      placedNotes: new Map(),
      feedbackMessage: null,
    });

    setTimeout(() => {
      get().loadMeasure(0);
    }, 300);
  },

  loadMeasure: (measureIndex: number) => {
    const state = get();
    if (!state.currentLevel) return;

    const updatedMeasures = state.currentLevel.measures.map((m, i) => {
      if (i === measureIndex) {
        return { ...m, isLoaded: true };
      }
      return m;
    });

    set({
      currentLevel: {
        ...state.currentLevel,
        measures: updatedMeasures,
      },
    });

    if (measureIndex < state.currentLevel.measures.length - 1) {
      setTimeout(() => {
        get().loadMeasure(measureIndex + 1);
      }, 400);
    }
  },

  placeNote: (noteId: string, slotId: string) => {
    const state = get();
    if (!state.currentLevel) {
      return { isValid: false, errorMessage: '关卡未加载' };
    }

    const note = state.currentLevel.notePool.find(n => n.id === noteId);
    if (!note) {
      return { isValid: false, errorMessage: '音符不存在' };
    }

    const targetSlot = state.getSlotById(slotId);
    if (!targetSlot) {
      return { isValid: false, errorMessage: '工位不存在' };
    }

    const measure = state.getMeasureBySlotId(slotId);
    if (!measure) {
      return { isValid: false, errorMessage: '小节不存在' };
    }

    const validation = validateNotePlacement(note, targetSlot, measure, measure.slots);

    const record: ActionRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type: 'place',
      noteId,
      slotId,
      validation,
    };

    if (validation.isValid) {
      const updatedMeasures = state.currentLevel.measures.map(m => {
        if (m.id === measure.id) {
          const updatedSlots = m.slots.map(s => {
            if (s.id === slotId) {
              return { ...s, assignedNote: note, errorState: null };
            }
            return s;
          });
          return {
            ...m,
            slots: updatedSlots,
            currentBeats: calculateMeasureBeats(updatedSlots),
          };
        }
        return m;
      });

      const newPlacedNotes = new Map(state.placedNotes);
      newPlacedNotes.set(slotId, noteId);

      set({
        currentLevel: {
          ...state.currentLevel,
          measures: updatedMeasures,
        },
        placedNotes: newPlacedNotes,
        actionHistory: [...state.actionHistory, record],
        feedbackMessage: { type: 'success', message: validation.errorMessage },
      });
    } else {
      const updatedMeasures = state.currentLevel.measures.map(m => {
        if (m.id === measure.id) {
          const updatedSlots = m.slots.map(s => {
            if (s.id === slotId) {
              return { ...s, errorState: validation.errorType || null };
            }
            return s;
          });
          return { ...m, slots: updatedSlots };
        }
        return m;
      });

      set({
        currentLevel: {
          ...state.currentLevel,
          measures: updatedMeasures,
        },
        actionHistory: [...state.actionHistory, record],
        feedbackMessage: { type: 'error', message: validation.errorMessage },
      });

      setTimeout(() => {
        const currentState = get();
        if (!currentState.currentLevel) return;
        
        const clearedMeasures = currentState.currentLevel.measures.map(m => ({
          ...m,
          slots: m.slots.map(s => ({ ...s, errorState: null })),
        }));
        
        set({
          currentLevel: {
            ...currentState.currentLevel,
            measures: clearedMeasures,
          },
        });
      }, 1500);
    }

    return validation;
  },

  removeNote: (slotId: string) => {
    const state = get();
    if (!state.currentLevel) return;

    const slot = state.getSlotById(slotId);
    if (!slot || !slot.assignedNote || slot.isFixed) return;

    const measure = state.getMeasureBySlotId(slotId);
    if (!measure) return;

    const updatedMeasures = state.currentLevel.measures.map(m => {
      if (m.id === measure.id) {
        const updatedSlots = m.slots.map(s => {
          if (s.id === slotId) {
            return { ...s, assignedNote: null, errorState: null };
          }
          return s;
        });
        return {
          ...m,
          slots: updatedSlots,
          currentBeats: calculateMeasureBeats(updatedSlots),
        };
      }
      return m;
    });

    const newPlacedNotes = new Map(state.placedNotes);
    newPlacedNotes.delete(slotId);

    set({
      currentLevel: {
        ...state.currentLevel,
        measures: updatedMeasures,
      },
      placedNotes: newPlacedNotes,
      feedbackMessage: { type: 'info', message: `已移除音符` },
    });
  },

  clearFeedback: () => {
    set({ feedbackMessage: null });
  },

  resetGame: () => {
    const state = get();
    if (!state.currentLevel) return;
    get().setLevel(state.currentLevel);
  },

  getAvailableNotes: () => {
    const state = get();
    if (!state.currentLevel) return [];
    
    const placedNoteIds = new Set(state.placedNotes.values());
    return state.currentLevel.notePool.filter(n => !placedNoteIds.has(n.id));
  },

  getSlotById: (slotId: string) => {
    const state = get();
    if (!state.currentLevel) return null;
    
    for (const measure of state.currentLevel.measures) {
      const slot = measure.slots.find(s => s.id === slotId);
      if (slot) return slot;
    }
    return null;
  },

  getMeasureBySlotId: (slotId: string) => {
    const state = get();
    if (!state.currentLevel) return null;
    
    return state.currentLevel.measures.find(m => 
      m.slots.some(s => s.id === slotId)
    ) || null;
  },
}));
