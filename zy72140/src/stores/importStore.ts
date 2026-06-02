import { create } from 'zustand';
import type { ImportResult, ConflictRecord } from '@/types';

type ConflictResolution = ConflictRecord['resolution'];

interface ImportState {
  importResult: ImportResult | null;
  isImporting: boolean;
  startImport: () => void;
  setImportResult: (result: ImportResult) => void;
  clearImportResult: () => void;
  resolveConflict: (conflictId: string, resolution: ConflictResolution, resolvedBy: string) => void;
}

export const useImportStore = create<ImportState>()((set) => ({
  importResult: null,
  isImporting: false,
  startImport: () => set({ isImporting: true, importResult: null }),
  setImportResult: (result) => set({ importResult: result, isImporting: false }),
  clearImportResult: () => set({ importResult: null, isImporting: false }),
  resolveConflict: (conflictId, resolution, resolvedBy) =>
    set((state) => {
      if (!state.importResult) return state;
      const updatedConflicts: ConflictRecord[] = state.importResult.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
          : c
      );
      return {
        importResult: { ...state.importResult, conflicts: updatedConflicts },
      };
    }),
}));
