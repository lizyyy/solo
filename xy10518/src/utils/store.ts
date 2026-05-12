import * as fs from 'fs';
import * as path from 'path';
import { DataStore, Batch, SamplingSheet } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'qc-data.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): DataStore {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { batches: {}, samplingSheets: {} };
  }
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(content) as DataStore;
  } catch {
    return { batches: {}, samplingSheets: {} };
  }
}

export function saveStore(store: DataStore): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function initStore(): DataStore {
  const store: DataStore = { batches: {}, samplingSheets: {} };
  saveStore(store);
  return store;
}

export function saveBatch(batch: Batch): void {
  const store = loadStore();
  store.batches[batch.batchNumber] = batch;
  saveStore(store);
}

export function getBatch(batchNumber: string): Batch | undefined {
  const store = loadStore();
  return store.batches[batchNumber];
}

export function getAllBatches(): Batch[] {
  const store = loadStore();
  return Object.values(store.batches);
}

export function saveSamplingSheet(sheet: SamplingSheet): void {
  const store = loadStore();
  store.samplingSheets[sheet.sheetNumber] = sheet;
  saveStore(store);
}

export function getSamplingSheet(sheetNumber: string): SamplingSheet | undefined {
  const store = loadStore();
  return store.samplingSheets[sheetNumber];
}

export function getAllSamplingSheets(): SamplingSheet[] {
  const store = loadStore();
  return Object.values(store.samplingSheets);
}

export function getStorePath(): string {
  return DATA_FILE;
}

export function storeExists(): boolean {
  return fs.existsSync(DATA_FILE);
}
