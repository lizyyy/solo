import fs from 'fs-extra';
import path from 'path';
import { DataStore } from '../types';

const STORE_DIR = path.resolve(process.cwd(), '.logistics-data');
const STORE_FILE = path.join(STORE_DIR, 'data.json');

const defaultStore: DataStore = {
  orders: [],
  signRecords: [],
  refuseRecords: [],
  claimRecords: [],
  abnormals: [],
  issues: [],
  reviews: [],
  processedBatches: [],
};

export function ensureStore(): void {
  fs.ensureDirSync(STORE_DIR);
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeJSONSync(STORE_FILE, defaultStore, { spaces: 2 });
  }
}

export function loadStore(): DataStore {
  ensureStore();
  return fs.readJSONSync(STORE_FILE);
}

export function saveStore(store: DataStore): void {
  ensureStore();
  fs.writeJSONSync(STORE_FILE, store, { spaces: 2 });
}

export function resetStore(): void {
  saveStore(defaultStore);
}

export function getStorePath(): string {
  return STORE_FILE;
}
