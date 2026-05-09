import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import {
  IndexSnapshot,
  SourceData,
  CheckResult,
  ReplayTask,
  CacheRefreshRecord,
  Report,
  HistoryEntry,
  Product,
} from '../types';
import { getConfig } from '../utils/config';

const config = getConfig();

const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const readJsonFile = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
};

const writeJsonFile = <T>(filePath: string, data: T): void => {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export const isInitialized = (): boolean => {
  return (
    fs.existsSync(config.dataDir) &&
    fs.existsSync(config.snapshotsDir) &&
    fs.existsSync(config.sourcesDir) &&
    fs.existsSync(config.resultsDir) &&
    fs.existsSync(config.reportsDir)
  );
};

export const initializeStore = (): boolean => {
  if (isInitialized()) {
    return false;
  }
  ensureDir(config.dataDir);
  ensureDir(config.snapshotsDir);
  ensureDir(config.sourcesDir);
  ensureDir(config.resultsDir);
  ensureDir(config.reportsDir);
  if (!fs.existsSync(config.historyFile)) {
    writeJsonFile<HistoryEntry[]>(config.historyFile, []);
  }
  return true;
};

export const addHistoryEntry = (
  type: HistoryEntry['type'],
  action: string,
  status: HistoryEntry['status'],
  details: string
): HistoryEntry => {
  const entries = readJsonFile<HistoryEntry[]>(config.historyFile) || [];
  const now = moment().toISOString();
  const entry: HistoryEntry = {
    id: uuidv4(),
    timestamp: now,
    type,
    action,
    status,
    details,
    createdAt: now,
  };
  entries.unshift(entry);
  writeJsonFile(config.historyFile, entries);
  return entry;
};

export const getHistory = (limit?: number, type?: HistoryEntry['type']): HistoryEntry[] => {
  const entries = readJsonFile<HistoryEntry[]>(config.historyFile) || [];
  let filtered = entries;
  if (type) {
    filtered = entries.filter((e) => e.type === type);
  }
  if (limit) {
    return filtered.slice(0, limit);
  }
  return filtered;
};

export const saveSnapshot = (
  name: string,
  products: Product[],
  description?: string
): IndexSnapshot => {
  const now = moment().toISOString();
  const snapshotId = uuidv4();
  const fileName = `snapshot-${snapshotId}.json`;
  const filePath = path.join(config.snapshotsDir, fileName);
  writeJsonFile(filePath, products);
  const snapshot: IndexSnapshot = {
    id: snapshotId,
    timestamp: now,
    name,
    description,
    productCount: products.length,
    filePath,
    createdAt: now,
  };
  const metaFile = path.join(config.snapshotsDir, 'meta.json');
  const metas = readJsonFile<IndexSnapshot[]>(metaFile) || [];
  metas.unshift(snapshot);
  writeJsonFile(metaFile, metas);
  return snapshot;
};

export const getSnapshots = (): IndexSnapshot[] => {
  const metaFile = path.join(config.snapshotsDir, 'meta.json');
  return readJsonFile<IndexSnapshot[]>(metaFile) || [];
};

export const getSnapshotById = (id: string): IndexSnapshot | null => {
  const snapshots = getSnapshots();
  return snapshots.find((s) => s.id === id) || null;
};

export const getSnapshotProducts = (id: string): Product[] | null => {
  const snapshot = getSnapshotById(id);
  if (!snapshot) {
    return null;
  }
  return readJsonFile<Product[]>(snapshot.filePath);
};

export const saveSourceData = (
  name: string,
  products: Product[],
  sourceType: SourceData['sourceType'],
  description?: string
): SourceData => {
  const now = moment().toISOString();
  const sourceId = uuidv4();
  const fileName = `source-${sourceId}.json`;
  const filePath = path.join(config.sourcesDir, fileName);
  writeJsonFile(filePath, products);
  const source: SourceData = {
    id: sourceId,
    timestamp: now,
    name,
    description,
    productCount: products.length,
    filePath,
    sourceType,
    createdAt: now,
  };
  const metaFile = path.join(config.sourcesDir, 'meta.json');
  const metas = readJsonFile<SourceData[]>(metaFile) || [];
  metas.unshift(source);
  writeJsonFile(metaFile, metas);
  return source;
};

export const getSources = (): SourceData[] => {
  const metaFile = path.join(config.sourcesDir, 'meta.json');
  return readJsonFile<SourceData[]>(metaFile) || [];
};

export const getSourceById = (id: string): SourceData | null => {
  const sources = getSources();
  return sources.find((s) => s.id === id) || null;
};

export const getSourceProducts = (id: string): Product[] | null => {
  const source = getSourceById(id);
  if (!source) {
    return null;
  }
  return readJsonFile<Product[]>(source.filePath);
};

export const saveCheckResult = (result: Omit<CheckResult, 'id' | 'timestamp' | 'createdAt'>): CheckResult => {
  const now = moment().toISOString();
  const resultId = uuidv4();
  const fullResult: CheckResult = {
    ...result,
    id: resultId,
    timestamp: now,
    createdAt: now,
  };
  const fileName = `check-${resultId}.json`;
  const filePath = path.join(config.resultsDir, fileName);
  writeJsonFile(filePath, fullResult);
  const metaFile = path.join(config.resultsDir, 'meta.json');
  const metas = readJsonFile<CheckResult[]>(metaFile) || [];
  metas.unshift(fullResult);
  writeJsonFile(metaFile, metas);
  return fullResult;
};

export const getCheckResults = (): CheckResult[] => {
  const metaFile = path.join(config.resultsDir, 'meta.json');
  return readJsonFile<CheckResult[]>(metaFile) || [];
};

export const getCheckResultById = (id: string): CheckResult | null => {
  const results = getCheckResults();
  return results.find((r) => r.id === id) || null;
};

export const saveReplayTask = (task: Omit<ReplayTask, 'id' | 'createdAt'>): ReplayTask => {
  const now = moment().toISOString();
  const taskId = uuidv4();
  const fullTask: ReplayTask = {
    ...task,
    id: taskId,
    createdAt: now,
  };
  const metaFile = path.join(config.dataDir, 'replays.json');
  const tasks = readJsonFile<ReplayTask[]>(metaFile) || [];
  tasks.unshift(fullTask);
  writeJsonFile(metaFile, tasks);
  return fullTask;
};

export const updateReplayTask = (taskId: string, updates: Partial<ReplayTask>): ReplayTask | null => {
  const metaFile = path.join(config.dataDir, 'replays.json');
  const tasks = readJsonFile<ReplayTask[]>(metaFile) || [];
  const index = tasks.findIndex((t) => t.id === taskId);
  if (index === -1) {
    return null;
  }
  tasks[index] = { ...tasks[index], ...updates };
  writeJsonFile(metaFile, tasks);
  return tasks[index];
};

export const getReplayTasks = (): ReplayTask[] => {
  const metaFile = path.join(config.dataDir, 'replays.json');
  return readJsonFile<ReplayTask[]>(metaFile) || [];
};

export const getReplayTaskById = (id: string): ReplayTask | null => {
  const tasks = getReplayTasks();
  return tasks.find((t) => t.id === id) || null;
};

export const saveCacheRecord = (record: Omit<CacheRefreshRecord, 'id' | 'createdAt'>): CacheRefreshRecord => {
  const now = moment().toISOString();
  const recordId = uuidv4();
  const fullRecord: CacheRefreshRecord = {
    ...record,
    id: recordId,
    createdAt: now,
  };
  const metaFile = path.join(config.dataDir, 'cache-records.json');
  const records = readJsonFile<CacheRefreshRecord[]>(metaFile) || [];
  records.unshift(fullRecord);
  writeJsonFile(metaFile, records);
  return fullRecord;
};

export const getCacheRecords = (): CacheRefreshRecord[] => {
  const metaFile = path.join(config.dataDir, 'cache-records.json');
  return readJsonFile<CacheRefreshRecord[]>(metaFile) || [];
};

export const saveReport = (
  name: string,
  type: Report['type'],
  content: string,
  checkResultId?: string,
  replayTaskId?: string,
  cacheRecordId?: string
): Report => {
  const now = moment().toISOString();
  const reportId = uuidv4();
  const fileName = `report-${reportId}.md`;
  const filePath = path.join(config.reportsDir, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');
  const report: Report = {
    id: reportId,
    timestamp: now,
    name,
    type,
    checkResultId,
    replayTaskId,
    cacheRecordId,
    filePath,
    createdAt: now,
  };
  const metaFile = path.join(config.reportsDir, 'meta.json');
  const metas = readJsonFile<Report[]>(metaFile) || [];
  metas.unshift(report);
  writeJsonFile(metaFile, metas);
  return report;
};

export const getReports = (): Report[] => {
  const metaFile = path.join(config.reportsDir, 'meta.json');
  return readJsonFile<Report[]>(metaFile) || [];
};

export const getReportById = (id: string): Report | null => {
  const reports = getReports();
  return reports.find((r) => r.id === id) || null;
};

export const getDataDir = (): string => config.dataDir;
