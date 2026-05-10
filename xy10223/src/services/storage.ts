import type { Batch, TemperatureRecord, StageTransition } from '../types';
import { FermentationStage } from '../types';
import { generateId } from '../utils';

const STORAGE_KEY = 'bakery_fermentation_batches';
const DATA_VERSION = '1.0';

export const getBatches = (): Batch[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取本地存储失败:', error);
  }
  return [];
};

export const saveBatches = (batches: Batch[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch (error) {
    console.error('保存到本地存储失败:', error);
  }
};

export const addBatch = (batch: Omit<Batch, 'id' | 'createdAt' | 'stageTransitions' | 'temperatureRecords'>): Batch => {
  const batches = getBatches();
  const existingBatch = batches.find(b => b.batchNumber === batch.batchNumber);
  if (existingBatch) {
    return existingBatch;
  }
  const newBatch: Batch = {
    ...batch,
    id: generateId(),
    createdAt: new Date().toISOString(),
    stageTransitions: [{
      fromStage: null,
      toStage: batch.currentStage,
      timestamp: new Date().toISOString()
    }],
    temperatureRecords: []
  };
  batches.push(newBatch);
  saveBatches(batches);
  return newBatch;
};

export const updateBatch = (batchId: string, updates: Partial<Batch>): Batch | null => {
  const batches = getBatches();
  const index = batches.findIndex(b => b.id === batchId);
  if (index === -1) {
    return null;
  }
  batches[index] = { ...batches[index], ...updates };
  saveBatches(batches);
  return batches[index];
};

export const addTemperatureRecord = (
  batchId: string,
  record: Omit<TemperatureRecord, 'id' | 'recordedAt'>
): TemperatureRecord | null => {
  const batches = getBatches();
  const index = batches.findIndex(b => b.id === batchId);
  if (index === -1) {
    return null;
  }
  const existingRecord = batches[index].temperatureRecords.find(
    r => r.stage === record.stage && 
         Math.abs(new Date(r.recordedAt).getTime() - new Date().getTime()) < 1000
  );
  if (existingRecord) {
    return existingRecord;
  }
  const newRecord: TemperatureRecord = {
    ...record,
    id: generateId(),
    recordedAt: new Date().toISOString()
  };
  batches[index].temperatureRecords.push(newRecord);
  saveBatches(batches);
  return newRecord;
};

export const transitionStage = (
  batchId: string,
  toStage: string,
  note?: string
): Batch | null => {
  const batches = getBatches();
  const index = batches.findIndex(b => b.id === batchId);
  if (index === -1) {
    return null;
  }
  const batch = batches[index];
  const targetStage = toStage as FermentationStage;
  const existingTransition = batch.stageTransitions.find(
    t => t.toStage === targetStage
  );
  if (existingTransition) {
    return batch;
  }
  const transition: StageTransition = {
    fromStage: batch.currentStage,
    toStage: targetStage,
    timestamp: new Date().toISOString(),
    note
  };
  batches[index] = {
    ...batch,
    currentStage: targetStage,
    stageTransitions: [...batch.stageTransitions, transition]
  };
  saveBatches(batches);
  return batches[index];
};

export const deleteBatch = (batchId: string): boolean => {
  const batches = getBatches();
  const index = batches.findIndex(b => b.id === batchId);
  if (index === -1) {
    return false;
  }
  batches.splice(index, 1);
  saveBatches(batches);
  return true;
};

export const clearAllBatches = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const importBatches = (batches: Batch[], replaceExisting: boolean = false): Batch[] => {
  let existingBatches = getBatches();
  if (replaceExisting) {
    existingBatches = [];
  }
  const newBatches = batches.filter(
    batch => !existingBatches.some(existing => existing.batchNumber === batch.batchNumber)
  );
  const mergedBatches = [...existingBatches, ...newBatches];
  saveBatches(mergedBatches);
  return mergedBatches;
};

export const getDataVersion = (): string => {
  return DATA_VERSION;
};
