import * as fs from 'fs';
import * as path from 'path';
import { SamplingTask, SampleBottle, FlowRecord, ColdStorageRecord } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const BOTTLES_FILE = path.join(DATA_DIR, 'bottles.json');
const FLOW_RECORDS_FILE = path.join(DATA_DIR, 'flow-records.json');
const COLD_STORAGE_FILE = path.join(DATA_DIR, 'cold-storage.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export class Storage {
  static getTasks(): SamplingTask[] {
    return readJsonFile<SamplingTask[]>(TASKS_FILE, []);
  }

  static saveTasks(tasks: SamplingTask[]): void {
    writeJsonFile(TASKS_FILE, tasks);
  }

  static getBottles(): SampleBottle[] {
    return readJsonFile<SampleBottle[]>(BOTTLES_FILE, []);
  }

  static saveBottles(bottles: SampleBottle[]): void {
    writeJsonFile(BOTTLES_FILE, bottles);
  }

  static getFlowRecords(): FlowRecord[] {
    return readJsonFile<FlowRecord[]>(FLOW_RECORDS_FILE, []);
  }

  static saveFlowRecords(records: FlowRecord[]): void {
    writeJsonFile(FLOW_RECORDS_FILE, records);
  }

  static getColdStorageRecords(): ColdStorageRecord[] {
    return readJsonFile<ColdStorageRecord[]>(COLD_STORAGE_FILE, []);
  }

  static saveColdStorageRecords(records: ColdStorageRecord[]): void {
    writeJsonFile(COLD_STORAGE_FILE, records);
  }

  static clearAll(): void {
    writeJsonFile(TASKS_FILE, []);
    writeJsonFile(BOTTLES_FILE, []);
    writeJsonFile(FLOW_RECORDS_FILE, []);
    writeJsonFile(COLD_STORAGE_FILE, []);
  }
}
