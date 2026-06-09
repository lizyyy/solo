import type { CollisionRecord } from '@/types';
import { generateSeedData } from '@/data/seedData';

const STORAGE_KEY = 'curtain_wall_collision_data_v1';

interface StorageShape {
  __version: string;
  __seededAt: string;
  collisions: CollisionRecord[];
}

function readRaw(): StorageShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StorageShape;
  } catch {
    return null;
  }
}

function writeRaw(data: StorageShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function initializeStorage(): StorageShape {
  const existing = readRaw();
  if (existing && existing.collisions && existing.collisions.length > 0) {
    return existing;
  }
  const seeded: StorageShape = {
    __version: '1.0',
    __seededAt: new Date().toISOString(),
    collisions: generateSeedData(),
  };
  writeRaw(seeded);
  return seeded;
}

export function getAllCollisions(): CollisionRecord[] {
  const store = initializeStorage();
  return store.collisions;
}

export function saveAllCollisions(collisions: CollisionRecord[]) {
  const existing = readRaw() || { __version: '1.0', __seededAt: new Date().toISOString(), collisions: [] };
  writeRaw({ ...existing, collisions });
}

export function upsertCollision(record: CollisionRecord) {
  const all = getAllCollisions();
  const idx = all.findIndex((c) => c.id === record.id);
  if (idx >= 0) {
    all[idx] = { ...record, updatedAt: new Date().toISOString() };
  } else {
    all.push(record);
  }
  saveAllCollisions(all);
  return all;
}

export function resetToSeed() {
  localStorage.removeItem(STORAGE_KEY);
  return initializeStorage();
}
