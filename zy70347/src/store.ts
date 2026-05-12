import * as fs from 'fs';
import * as path from 'path';
import { StoreData, FeatureFlag, FlagVersion, Environment } from './types';

const STORE_FILE = path.join(process.cwd(), '.feature-flags.json');

function loadStore(): StoreData {
  if (!fs.existsSync(STORE_FILE)) {
    const initialData: StoreData = {
      flags: {},
      versions: {},
      envOverrides: {},
    };
    saveStore(initialData);
    return initialData;
  }
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
}

function saveStore(data: StoreData): void {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

export function getFlag(flagId: string): FeatureFlag | undefined {
  const store = loadStore();
  return store.flags[flagId];
}

export function getAllFlags(): FeatureFlag[] {
  const store = loadStore();
  return Object.values(store.flags);
}

export function getFlagVersions(flagId: string): FlagVersion[] {
  const store = loadStore();
  return store.versions[flagId] || [];
}

export function getFlagVersion(flagId: string, version: number): FlagVersion | undefined {
  const versions = getFlagVersions(flagId);
  return versions.find((v) => v.version === version);
}

export function getLatestVersion(flagId: string): number {
  const versions = getFlagVersions(flagId);
  if (versions.length === 0) return 0;
  return Math.max(...versions.map((v) => v.version));
}

export function createFlag(flag: FeatureFlag): FlagVersion {
  const store = loadStore();
  const timestamp = Date.now();
  
  if (store.flags[flag.id]) {
    throw new Error(`Flag ${flag.id} already exists`);
  }

  const version: FlagVersion = {
    version: 1,
    flag: { ...flag, createdAt: timestamp, updatedAt: timestamp },
    timestamp,
    action: 'create',
  };

  store.flags[flag.id] = version.flag;
  store.versions[flag.id] = [version];
  saveStore(store);
  return version;
}

export function updateFlag(flag: FeatureFlag): FlagVersion {
  const store = loadStore();
  const timestamp = Date.now();

  if (!store.flags[flag.id]) {
    throw new Error(`Flag ${flag.id} does not exist`);
  }

  const currentVersion = getLatestVersion(flag.id);
  const newVersion: FlagVersion = {
    version: currentVersion + 1,
    flag: { ...flag, updatedAt: timestamp },
    timestamp,
    action: 'update',
    previousVersion: currentVersion,
  };

  store.flags[flag.id] = newVersion.flag;
  store.versions[flag.id] = [...(store.versions[flag.id] || []), newVersion];
  saveStore(store);
  return newVersion;
}

export function rollbackFlag(flagId: string, targetVersion: number): FlagVersion {
  const store = loadStore();
  const timestamp = Date.now();

  const versions = getFlagVersions(flagId);
  const targetFlagVersion = versions.find((v) => v.version === targetVersion);
  
  if (!targetFlagVersion) {
    throw new Error(`Version ${targetVersion} not found for flag ${flagId}`);
  }

  const currentVersion = getLatestVersion(flagId);
  const newVersion: FlagVersion = {
    version: currentVersion + 1,
    flag: { ...targetFlagVersion.flag, updatedAt: timestamp },
    timestamp,
    action: 'rollback',
    previousVersion: currentVersion,
  };

  store.flags[flagId] = newVersion.flag;
  store.versions[flagId] = [...(store.versions[flagId] || []), newVersion];
  saveStore(store);
  return newVersion;
}

export function setEnvOverride(
  flagId: string,
  environment: Environment,
  enabled: boolean,
  percentage?: number
): void {
  const store = loadStore();
  if (!store.envOverrides[environment]) {
    store.envOverrides[environment] = {};
  }
  store.envOverrides[environment]![flagId] = {
    enabled,
    percentage,
  };
  saveStore(store);
}

export function getEnvOverride(flagId: string, environment: Environment) {
  const store = loadStore();
  return store.envOverrides[environment]?.[flagId];
}

export function getAllEnvOverrides() {
  const store = loadStore();
  return store.envOverrides;
}

export function removeEnvOverride(flagId: string, environment: Environment): void {
  const store = loadStore();
  if (store.envOverrides[environment]?.[flagId]) {
    delete store.envOverrides[environment]![flagId];
    saveStore(store);
  }
}

export function exportStore(): StoreData {
  return loadStore();
}

export function importStore(data: StoreData): void {
  saveStore(data);
}

export function getStorePath(): string {
  return STORE_FILE;
}
