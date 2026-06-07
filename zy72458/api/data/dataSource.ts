import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ResidentComplaint, AuditLog, SelfCheckResult, OperationRecord } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

const FILES = {
  complaints: path.join(DATA_DIR, 'complaints.json'),
  auditLogs: path.join(DATA_DIR, 'audit-logs.json'),
  selfCheckResults: path.join(DATA_DIR, 'self-check-results.json'),
  operationRecords: path.join(DATA_DIR, 'operation-records.json'),
  exportSnapshot: path.join(DATA_DIR, 'export-snapshot.json'),
};

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const dataSource = {
  async getComplaints(): Promise<ResidentComplaint[]> {
    return readJsonFile<ResidentComplaint[]>(FILES.complaints, []);
  },

  async saveComplaints(complaints: ResidentComplaint[]): Promise<void> {
    await writeJsonFile(FILES.complaints, complaints);
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    return readJsonFile<AuditLog[]>(FILES.auditLogs, []);
  },

  async saveAuditLogs(logs: AuditLog[]): Promise<void> {
    await writeJsonFile(FILES.auditLogs, logs);
  },

  async getSelfCheckResults(): Promise<SelfCheckResult[]> {
    return readJsonFile<SelfCheckResult[]>(FILES.selfCheckResults, []);
  },

  async saveSelfCheckResults(results: SelfCheckResult[]): Promise<void> {
    await writeJsonFile(FILES.selfCheckResults, results);
  },

  async getOperationRecords(): Promise<OperationRecord[]> {
    return readJsonFile<OperationRecord[]>(FILES.operationRecords, []);
  },

  async saveOperationRecords(records: OperationRecord[]): Promise<void> {
    await writeJsonFile(FILES.operationRecords, records);
  },

  async getExportSnapshot(): Promise<{ data: ResidentComplaint[]; timestamp: string } | null> {
    return readJsonFile<{ data: ResidentComplaint[]; timestamp: string } | null>(FILES.exportSnapshot, null);
  },

  async saveExportSnapshot(data: ResidentComplaint[]): Promise<void> {
    await writeJsonFile(FILES.exportSnapshot, {
      data,
      timestamp: new Date().toISOString(),
    });
  },
};
