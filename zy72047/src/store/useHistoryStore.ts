import { create } from 'zustand';
import type { GameRound, Operation, ScoreNote, Conflict } from '@/types/game';
import { storage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/types/storage';

interface HistoryStore {
  rounds: GameRound[];
  operations: Record<string, Operation[]>;
  notes: Record<string, ScoreNote[]>;
  conflicts: Record<string, Conflict[]>;
  loading: boolean;
  error: string | null;
  selectedRoundId: string | null;
  loadAllData: () => void;
  loadRoundOperations: (roundId: string) => Operation[];
  loadRoundNotes: (roundId: string) => ScoreNote[];
  loadRoundConflicts: (roundId: string) => Conflict[];
  setSelectedRound: (roundId: string | null) => void;
  addNote: (roundId: string, content: string, source: string, author: string) => ScoreNote;
  addConflict: (conflict: Conflict) => void;
  updateConflict: (conflictId: string, updates: Partial<Conflict>) => Conflict | null;
  deleteRound: (roundId: string) => void;
  clearAllHistory: () => void;
  getRoundWithData: (roundId: string) => {
    round: GameRound | undefined;
    operations: Operation[];
    notes: ScoreNote[];
    conflicts: Conflict[];
  };
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  rounds: [],
  operations: {},
  notes: {},
  conflicts: {},
  loading: false,
  error: null,
  selectedRoundId: null,

  loadAllData: () => {
    set({ loading: true });
    try {
      const rounds = storage.get(STORAGE_KEYS.ROUNDS, [] as GameRound[]);
      const allOperations = storage.get(STORAGE_KEYS.OPERATIONS, [] as Operation[]);
      const allNotes = storage.get(STORAGE_KEYS.NOTES, [] as ScoreNote[]);
      const allConflicts = storage.get(STORAGE_KEYS.CONFLICTS, [] as Conflict[]);

      const operationsByRound: Record<string, Operation[]> = {};
      const notesByRound: Record<string, ScoreNote[]> = {};
      const conflictsByRound: Record<string, Conflict[]> = {};

      allOperations.forEach(op => {
        if (!operationsByRound[op.roundId]) {
          operationsByRound[op.roundId] = [];
        }
        operationsByRound[op.roundId].push(op);
      });

      allNotes.forEach(note => {
        if (!notesByRound[note.roundId]) {
          notesByRound[note.roundId] = [];
        }
        notesByRound[note.roundId].push(note);
      });

      allConflicts.forEach(conflict => {
        if (!conflictsByRound[conflict.roundId]) {
          conflictsByRound[conflict.roundId] = [];
        }
        conflictsByRound[conflict.roundId].push(conflict);
      });

      Object.values(operationsByRound).forEach(ops => {
        ops.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      Object.values(notesByRound).forEach(nts => {
        nts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      });

      set({
        rounds: rounds.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        operations: operationsByRound,
        notes: notesByRound,
        conflicts: conflictsByRound,
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : '加载历史数据失败',
        loading: false,
      });
    }
  },

  loadRoundOperations: (roundId: string) => {
    const { operations } = get();
    return operations[roundId] || [];
  },

  loadRoundNotes: (roundId: string) => {
    const { notes } = get();
    return notes[roundId] || [];
  },

  loadRoundConflicts: (roundId: string) => {
    const { conflicts } = get();
    return conflicts[roundId] || [];
  },

  setSelectedRound: (roundId: string | null) => {
    set({ selectedRoundId: roundId });
  },

  addNote: (roundId: string, content: string, source: string, author: string) => {
    const { notes } = get();
    const newNote: ScoreNote = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      roundId,
      content,
      source,
      timestamp: new Date().toISOString(),
      author,
    };

    const roundNotes = [...(notes[roundId] || []), newNote];
    const updatedNotes = { ...notes, [roundId]: roundNotes };
    
    const allNotes = storage.get(STORAGE_KEYS.NOTES, [] as ScoreNote[]);
    allNotes.push(newNote);
    storage.set(STORAGE_KEYS.NOTES, allNotes);

    set({ notes: updatedNotes });
    return newNote;
  },

  addConflict: (conflict: Conflict) => {
    const { conflicts } = get();
    const roundConflicts = [...(conflicts[conflict.roundId] || []), conflict];
    const updatedConflicts = { ...conflicts, [conflict.roundId]: roundConflicts };
    
    const allConflicts = storage.get(STORAGE_KEYS.CONFLICTS, [] as Conflict[]);
    allConflicts.push(conflict);
    storage.set(STORAGE_KEYS.CONFLICTS, allConflicts);

    set({ conflicts: updatedConflicts });
  },

  updateConflict: (conflictId: string, updates: Partial<Conflict>) => {
    const { conflicts } = get();
    
    for (const roundId of Object.keys(conflicts)) {
      const roundConflicts = conflicts[roundId];
      const index = roundConflicts.findIndex(c => c.id === conflictId);
      if (index !== -1) {
        const updatedConflict = { ...roundConflicts[index], ...updates };
        const newRoundConflicts = [...roundConflicts];
        newRoundConflicts[index] = updatedConflict;
        
        const updatedConflicts = { ...conflicts, [roundId]: newRoundConflicts };
        
        const allConflicts = storage.get(STORAGE_KEYS.CONFLICTS, [] as Conflict[]);
        const globalIndex = allConflicts.findIndex(c => c.id === conflictId);
        if (globalIndex !== -1) {
          allConflicts[globalIndex] = updatedConflict;
          storage.set(STORAGE_KEYS.CONFLICTS, allConflicts);
        }
        
        set({ conflicts: updatedConflicts });
        return updatedConflict;
      }
    }
    return null;
  },

  deleteRound: (roundId: string) => {
    const { rounds, operations, notes, conflicts } = get();
    
    const updatedRounds = rounds.filter(r => r.id !== roundId);
    const { [roundId]: _, ...remainingOps } = operations;
    const { [roundId]: __, ...remainingNotes } = notes;
    const { [roundId]: ___, ...remainingConflicts } = conflicts;

    storage.set(STORAGE_KEYS.ROUNDS, updatedRounds);
    
    const allOps = storage.get(STORAGE_KEYS.OPERATIONS, [] as Operation[]);
    storage.set(STORAGE_KEYS.OPERATIONS, allOps.filter(o => o.roundId !== roundId));
    
    const allNotes = storage.get(STORAGE_KEYS.NOTES, [] as ScoreNote[]);
    storage.set(STORAGE_KEYS.NOTES, allNotes.filter(n => n.roundId !== roundId));
    
    const allConflicts = storage.get(STORAGE_KEYS.CONFLICTS, [] as Conflict[]);
    storage.set(STORAGE_KEYS.CONFLICTS, allConflicts.filter(c => c.roundId !== roundId));

    set({
      rounds: updatedRounds,
      operations: remainingOps,
      notes: remainingNotes,
      conflicts: remainingConflicts,
      selectedRoundId: get().selectedRoundId === roundId ? null : get().selectedRoundId,
    });
  },

  clearAllHistory: () => {
    storage.remove(STORAGE_KEYS.ROUNDS);
    storage.remove(STORAGE_KEYS.OPERATIONS);
    storage.remove(STORAGE_KEYS.NOTES);
    storage.remove(STORAGE_KEYS.CONFLICTS);
    
    set({
      rounds: [],
      operations: {},
      notes: {},
      conflicts: {},
      selectedRoundId: null,
    });
  },

  getRoundWithData: (roundId: string) => {
    const { rounds, operations, notes, conflicts } = get();
    return {
      round: rounds.find(r => r.id === roundId),
      operations: operations[roundId] || [],
      notes: notes[roundId] || [],
      conflicts: conflicts[roundId] || [],
    };
  },
}));
