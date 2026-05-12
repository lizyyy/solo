import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { QCState } from './types';

const DATA_DIR = '.qc-data';
const STATE_FILE = 'state.json';

let cachedState: QCState | null = null;

function getDefaultState(): QCState {
  return {
    version: '1.0.0',
    initialized: false,
    initializedAt: 0,
    subtitles: {},
    metadata: {},
    sensitiveWords: {},
    terms: {},
    issues: {},
    sessions: {},
    operators: ['system'],
  };
}

export function getDataDir(): string {
  return path.join(process.cwd(), DATA_DIR);
}

export function getStateFilePath(): string {
  return path.join(getDataDir(), STATE_FILE);
}

export function isInitialized(): boolean {
  return fs.existsSync(getStateFilePath());
}

export function loadState(): QCState {
  if (cachedState) {
    return cachedState;
  }
  
  const statePath = getStateFilePath();
  if (!fs.existsSync(statePath)) {
    cachedState = getDefaultState();
    return cachedState;
  }
  
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    cachedState = JSON.parse(content) as QCState;
    return cachedState;
  } catch (e) {
    cachedState = getDefaultState();
    return cachedState;
  }
}

export function saveState(state: QCState): void {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), 'utf-8');
  cachedState = state;
}

export function initState(): QCState {
  const state: QCState = {
    version: '1.0.0',
    initialized: true,
    initializedAt: Date.now(),
    subtitles: {},
    metadata: {},
    sensitiveWords: {},
    terms: {},
    issues: {},
    sessions: {},
    operators: ['system'],
  };
  saveState(state);
  return state;
}

export function generateId(prefix: string): string {
  const hash = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${hash}`;
}

export function calculateChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}
