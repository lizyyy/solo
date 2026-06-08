import { create } from 'zustand';
import type { VibrationRecord, Compressor, RecordStatus } from '@/types';
import { MOCK_RECORDS, COMPRESSORS, generateId } from '@/data/mockData';
import { convertToMmPerS, convertToMmPerSSafe } from '@/utils/unitConversion';
import { validateRecord } from '@/utils/validation';
import { judgeThreshold, detectExtremeValues } from '@/utils/threshold';

export interface AddRecordResult {
  success: boolean;
  record?: VibrationRecord;
  errors: string[];
  warnings: string[];
  conversionNote?: string;
}

interface VibrationState {
  compressors: Compressor[];
  records: VibrationRecord[];
  selectedCompressorId: string;

  addRecord: (record: Omit<VibrationRecord, 'id' | 'amplitudeMmPerS' | 'validationNotes' | 'isExtreme' | 'status'>) => AddRecordResult;
  updateRecord: (id: string, updates: Partial<VibrationRecord>) => void;
  confirmRecord: (id: string, note: string) => void;
  deleteRecord: (id: string) => void;
  setSelectedCompressor: (id: string) => void;
  getRecordsByCompressor: (compressorId: string) => VibrationRecord[];
}

export const useVibrationStore = create<VibrationState>((set, get) => ({
  compressors: COMPRESSORS,
  records: MOCK_RECORDS,
  selectedCompressorId: 'comp-001',

  addRecord: (recordData) => {
    const existingRecords = get().records;
    const validation = validateRecord(
      {
        direction: recordData.direction,
        frequencyHz: recordData.frequencyHz,
        amplitude: recordData.amplitude,
        amplitudeUnit: recordData.amplitudeUnit,
        rpm: recordData.rpm,
        recordTime: recordData.recordTime,
      },
      existingRecords
    );

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    const conversionResult = convertToMmPerSSafe(recordData.amplitude, recordData.amplitudeUnit, recordData.frequencyHz);

    if (!conversionResult.ok) {
      return {
        success: false,
        errors: [conversionResult.note],
        warnings: validation.warnings,
      };
    }

    const amplitudeMmPerS = Math.round(conversionResult.value * 100) / 100;

    if (isNaN(amplitudeMmPerS)) {
      return {
        success: false,
        errors: ['换算结果无效(NaN)，请检查幅值和单位是否匹配。'],
        warnings: validation.warnings,
      };
    }

    const threshold = judgeThreshold(amplitudeMmPerS);
    let status: RecordStatus = '正常';
    if (recordData.dataSource === '维修微信群') {
      status = '旧口径';
    } else if (threshold.level !== '正常' || validation.warnings.length > 0) {
      status = '需确认';
    }

    const allValues = existingRecords.map(r => r.amplitudeMmPerS).concat(amplitudeMmPerS);
    const extremes = detectExtremeValues(allValues);
    const isExtreme = extremes[extremes.length - 1];

    const allValidationNotes = [...validation.warnings];
    if (conversionResult.note) {
      allValidationNotes.push(conversionResult.note);
    }

    const newRecord: VibrationRecord = {
      ...recordData,
      id: generateId(),
      amplitudeMmPerS,
      validationNotes: allValidationNotes,
      isExtreme,
      status,
      confirmationNote: recordData.confirmationNote || '',
    };

    set((state) => {
      const updatedRecords = [...state.records, newRecord];
      const allVals = updatedRecords.map(r => r.amplitudeMmPerS);
      const ext = detectExtremeValues(allVals);
      const updatedWithExtremes = updatedRecords.map((r, i) => ({
        ...r,
        isExtreme: ext[i],
      }));
      return { records: updatedWithExtremes };
    });

    return {
      success: true,
      record: newRecord,
      errors: [],
      warnings: allValidationNotes,
      conversionNote: conversionResult.note,
    };
  },

  updateRecord: (id, updates) => {
    set((state) => ({
      records: state.records.map(r =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  },

  confirmRecord: (id, note) => {
    set((state) => ({
      records: state.records.map(r =>
        r.id === id
          ? { ...r, status: '正常' as RecordStatus, confirmationNote: note }
          : r
      ),
    }));
  },

  deleteRecord: (id) => {
    set((state) => ({
      records: state.records.filter(r => r.id !== id),
    }));
  },

  setSelectedCompressor: (id) => {
    set({ selectedCompressorId: id });
  },

  getRecordsByCompressor: (compressorId) => {
    return get().records.filter(r => r.compressorId === compressorId);
  },
}));
