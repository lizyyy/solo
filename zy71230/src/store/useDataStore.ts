import { create } from 'zustand';
import type { Tour, Stop, MerchItem, ProcessingLogEntry, ValidationError } from '../types/tour';

interface ParsedData {
  tour: Partial<Tour>;
  stops: Partial<Stop>[];
  merch: Partial<MerchItem>[];
}

interface DataState {
  rawFiles: File[];
  parsedData: ParsedData;
  processingLog: ProcessingLogEntry[];
  validationErrors: ValidationError[];
  isDirty: boolean;
  isProcessing: boolean;

  setRawFiles: (files: File[]) => void;
  setParsedData: (data: ParsedData) => void;
  addProcessingLog: (entries: ProcessingLogEntry[]) => void;
  addValidationErrors: (errors: ValidationError[]) => void;
  resolveProcessingLog: (entryId: string, userOverride?: string) => void;
  clearValidationError: (errorId: string) => void;
  setIsProcessing: (processing: boolean) => void;
  clearData: () => void;
  markAsDirty: () => void;
}

const initialParsedData: ParsedData = {
  tour: {},
  stops: [],
  merch: [],
};

export const useDataStore = create<DataState>((set) => ({
  rawFiles: [],
  parsedData: initialParsedData,
  processingLog: [],
  validationErrors: [],
  isDirty: false,
  isProcessing: false,

  setRawFiles: (files: File[]) => {
    set({ rawFiles: files, isDirty: true });
  },

  setParsedData: (data: ParsedData) => {
    set({ parsedData: data, isDirty: true });
  },

  addProcessingLog: (entries: ProcessingLogEntry[]) => {
    set((state) => ({
      processingLog: [...state.processingLog, ...entries].sort((a, b) => a.priority - b.priority),
    }));
  },

  addValidationErrors: (errors: ValidationError[]) => {
    set((state) => ({
      validationErrors: [...state.validationErrors, ...errors],
    }));
  },

  resolveProcessingLog: (entryId: string, userOverride?: string) => {
    set((state) => ({
      processingLog: state.processingLog.map((entry) =>
        entry.id === entryId
          ? { ...entry, resolved: true, userOverride }
          : entry
      ),
    }));
  },

  clearValidationError: (errorId: string) => {
    set((state) => ({
      validationErrors: state.validationErrors.filter((e) => e.id !== errorId),
    }));
  },

  setIsProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  clearData: () => {
    set({
      rawFiles: [],
      parsedData: initialParsedData,
      processingLog: [],
      validationErrors: [],
      isDirty: false,
      isProcessing: false,
    });
  },

  markAsDirty: () => {
    set({ isDirty: true });
  },
}));
