import { create } from 'zustand';
import type { VibrationRecord, Compressor, RecordStatus } from '@/types';
import { MOCK_RECORDS, COMPRESSORS, generateId } from '@/data/mockData';
import { convertToMmPerS } from '@/utils/unitConversion';
import { validateRecord } from '@/utils/validation';
import { judgeThreshold, detectExtremeValues } from '@/utils/threshold';

interface VibrationState {
  compressors: Compressor[];
  records: VibrationRecord[];
  selectedCompressorId: string;

  addRecord: (record: Omit<VibrationRecord, 'id' | 'amplitudeMmPerS' | 'validationNotes' | 'isExtreme' | 'status'>) => VibrationRecord;
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
    const amplitudeMmPerS = convertToMmPerS(recordData.amplitude, recordData.amplitudeUnit, recordData.frequencyHz);
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

    const threshold = judgeThreshold(amplitudeMmPerS);
    let status: RecordStatus = '正常';
    if (recordData.dataSource === '维修微信群') {
      status = '旧口径';
    } else if (threshold.level !== '正常' || validation.warnings.length > 0 || !validation.isValid) {
      status = '需确认';
    }

    const allValues = existingRecords.map(r => r.amplitudeMmPerS).concat(amplitudeMmPerS);
    const extremes = detectExtremeValues(allValues);
    const isExtreme = extremes[extremes.length - 1];

    const newRecord: VibrationRecord = {
      ...recordData,
      id: generateId(),
      amplitudeMmPerS: Math.round(amplitudeMmPerS * 100) / 100,
      validationNotes: [...validation.errors, ...validation.warnings],
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

    return newRecord;
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
