import { create } from 'zustand';
import { BatchTask, Warning } from '../types';
import { executeBatchAnalysis, executeBatchConfirm, BatchResult } from '../services/batchProcess';

interface BatchState {
  tasks: BatchTask[];
  currentTask: BatchTask | null;
  lastResult: BatchResult | null;
  processing: boolean;

  batchAnalyze: (warnings: Warning[], onProgress?: (current: number, total: number) => void) => Promise<BatchResult>;
  batchConfirm: (warningIds: string[], onProgress?: (current: number, total: number) => void) => Promise<BatchResult>;
  clearLastResult: () => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  tasks: [],
  currentTask: null,
  lastResult: null,
  processing: false,

  batchAnalyze: async (warnings, onProgress) => {
    set({ processing: true, lastResult: null });
    
    try {
      const result = await executeBatchAnalysis(warnings, (current, total) => {
        if (onProgress) {
          onProgress(current, total);
        }
      });
      
      set({ 
        processing: false, 
        lastResult: result,
        currentTask: null,
      });
      
      return result;
    } catch (error) {
      set({ processing: false });
      throw error;
    }
  },

  batchConfirm: async (warningIds, onProgress) => {
    set({ processing: true, lastResult: null });
    
    try {
      const result = await executeBatchConfirm(warningIds, (current, total) => {
        if (onProgress) {
          onProgress(current, total);
        }
      });
      
      set({ 
        processing: false, 
        lastResult: result,
        currentTask: null,
      });
      
      return result;
    } catch (error) {
      set({ processing: false });
      throw error;
    }
  },

  clearLastResult: () => {
    set({ lastResult: null });
  },
}));
