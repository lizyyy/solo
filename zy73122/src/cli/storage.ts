import fs from 'node:fs';
import path from 'node:path';
import type { BuoyCliRecord, StorageState } from './types';

const STORAGE_DIR_NAME = '.buoy-data';
const STORAGE_FILE_NAME = 'store.json';
const SCHEMA_VERSION = 1;

function getStorageDir(projectRoot: string): string {
  return path.join(projectRoot, STORAGE_DIR_NAME);
}

function getStoragePath(projectRoot: string): string {
  return path.join(getStorageDir(projectRoot), STORAGE_FILE_NAME);
}

function defaultState(): StorageState {
  return {
    records: [],
    schemaVersion: SCHEMA_VERSION,
  };
}

export function loadState(projectRoot: string): StorageState {
  const storagePath = getStoragePath(projectRoot);
  if (!fs.existsSync(storagePath)) {
    return defaultState();
  }
  try {
    const raw = fs.readFileSync(storagePath, 'utf-8');
    const parsed = JSON.parse(raw) as StorageState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

export function saveState(projectRoot: string, state: StorageState): void {
  const dir = getStorageDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const storagePath = getStoragePath(projectRoot);
  fs.writeFileSync(storagePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function resetState(projectRoot: string): void {
  const dir = getStorageDir(projectRoot);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function getDedupeKey(rec: { buoyId: string; latitude: number; longitude: number; recordTime: string }): string {
  const latKey = rec.latitude.toFixed(3);
  const lonKey = rec.longitude.toFixed(3);
  const timeKey = new Date(rec.recordTime).toISOString().slice(0, 10);
  return `${rec.buoyId}-${latKey}-${lonKey}-${timeKey}`;
}

export function buildRecordMap(records: BuoyCliRecord[]): Map<string, BuoyCliRecord> {
  const map = new Map<string, BuoyCliRecord>();
  for (const rec of records) {
    map.set(getDedupeKey(rec), rec);
  }
  return map;
}
