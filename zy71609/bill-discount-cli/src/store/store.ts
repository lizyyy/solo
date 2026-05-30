import * as fs from 'fs';
import * as path from 'path';
import { Store, DataType } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function defaultStore(): Store {
  return {
    bills: [],
    quotes: [],
    applications: [],
    calendar: [],
    payments: [],
    anomalies: [],
    calculations: [],
    importHistory: [],
  };
}

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): Store {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    return defaultStore();
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    return JSON.parse(raw) as Store;
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: Store): void {
  ensureDataDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

export function getCollection<K extends DataType>(store: Store, type: K): Store[K] {
  return store[type];
}

export function setCollection<K extends DataType>(store: Store, type: K, data: Store[K]): void {
  store[type] = data;
  saveStore(store);
}
