import { CalibrationRecord } from '../types/calibration';

const STORAGE_KEY = 'vinyl_calibration_records';
const CORRUPTED_KEY = 'vinyl_calibration_corrupted';

export const loadRecords = (): CalibrationRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      handleCorruptedData(data);
      return [];
    }

    const validRecords: CalibrationRecord[] = [];
    const corruptedEntries: unknown[] = [];

    for (const entry of parsed) {
      if (isValidRecord(entry)) {
        validRecords.push(entry);
      } else {
        corruptedEntries.push(entry);
      }
    }

    if (corruptedEntries.length > 0) {
      console.warn(`Found ${corruptedEntries.length} corrupted records, attempting recovery...`);
      corruptedEntries.forEach(entry => {
        const recovered = attemptRecovery(entry);
        if (recovered) {
          validRecords.push(recovered);
        }
      });
      saveRecords(validRecords);
    }

    return validRecords;
  } catch (error) {
    console.error('Failed to load records:', error);
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      handleCorruptedData(data);
    }
    return [];
  }
};

export const saveRecords = (records: CalibrationRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save records:', error);
    throw new Error('无法保存记录，可能存储空间不足');
  }
};

export const saveSingleRecord = (record: CalibrationRecord): void => {
  const records = loadRecords();
  records.push(record);
  saveRecords(records);
};

export const deleteRecord = (id: string): void => {
  const records = loadRecords();
  const filtered = records.filter(r => r.id !== id);
  saveRecords(filtered);
};

export const updateRecord = (id: string, updates: Partial<CalibrationRecord>): void => {
  const records = loadRecords();
  const index = records.findIndex(r => r.id === id);
  if (index !== -1) {
    records[index] = { ...records[index], ...updates };
    saveRecords(records);
  }
};

const isValidRecord = (obj: unknown): obj is CalibrationRecord => {
  if (typeof obj !== 'object' || obj === null) return false;

  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.timestamp === 'number' &&
    typeof r.stylusPressure === 'number' &&
    typeof r.antiSkating === 'number' &&
    typeof r.tonearmLength === 'number' &&
    typeof r.recordRadius === 'number' &&
    typeof r.torque === 'number' &&
    typeof r.wearLevel === 'number'
  );
};

const attemptRecovery = (entry: unknown): CalibrationRecord | null => {
  if (typeof entry !== 'object' || entry === null) return null;

  const e = entry as Record<string, unknown>;
  try {
    const recovered: CalibrationRecord = {
      id: typeof e.id === 'string' ? e.id : `recovered_${Date.now()}_${Math.random()}`,
      timestamp: typeof e.timestamp === 'number' ? e.timestamp : Date.now(),
      stylusPressure: typeof e.stylusPressure === 'number' ? e.stylusPressure : 1.8,
      antiSkating: typeof e.antiSkating === 'number' ? e.antiSkating : 0.5,
      antiSkatingDirection:
        e.antiSkatingDirection === 'normal' || e.antiSkatingDirection === 'reverse'
          ? e.antiSkatingDirection
          : 'normal',
      tonearmLength: typeof e.tonearmLength === 'number' ? e.tonearmLength : 250,
      recordRadius: typeof e.recordRadius === 'number' ? e.recordRadius : 14,
      recordRadiusUnit:
        e.recordRadiusUnit === 'cm' || e.recordRadiusUnit === 'inch' ? e.recordRadiusUnit : 'cm',
      testTrack: typeof e.testTrack === 'string' ? e.testTrack : 'blank-groove',
      torque: typeof e.torque === 'number' ? e.torque : 0,
      wearLevel: typeof e.wearLevel === 'number' ? e.wearLevel : 0,
      errors: Array.isArray(e.errors) ? e.errors : [],
      screenshot: typeof e.screenshot === 'string' ? e.screenshot : null,
      notes: typeof e.notes === 'string' ? e.notes : '[数据已恢复，部分信息可能丢失]',
      manualCorrection: typeof e.manualCorrection === 'string' ? e.manualCorrection : '',
    };

    if (recovered.notes.includes('[数据已恢复')) {
      return recovered;
    }
    return null;
  } catch {
    return null;
  }
};

const handleCorruptedData = (data: string): void => {
  try {
    const corrupted = JSON.parse(localStorage.getItem(CORRUPTED_KEY) || '[]');
    corrupted.push({
      timestamp: Date.now(),
      data,
    });
    localStorage.setItem(CORRUPTED_KEY, JSON.stringify(corrupted.slice(-10)));
  } catch {
    // Ignore
  }
  localStorage.removeItem(STORAGE_KEY);
};

export const generateId = (): string => {
  return `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
