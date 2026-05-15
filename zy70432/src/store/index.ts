import { SearchKeywordReport, RecordingSession, AuditEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

function ensureDataDir(): void {
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
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export class RecordStore {
  private records: Map<string, SearchKeywordReport>;
  private hashToId: Map<string, string>;

  constructor() {
    this.records = new Map();
    this.hashToId = new Map();
    this.load();
  }

  private load(): void {
    const data = readJsonFile<SearchKeywordReport[]>(RECORDS_FILE, []);
    for (const record of data) {
      if (record.id) {
        this.records.set(record.id, record);
      }
    }
  }

  private save(): void {
    const data = Array.from(this.records.values());
    writeJsonFile(RECORDS_FILE, data);
  }

  add(record: SearchKeywordReport, hash: string): string {
    const id = uuidv4();
    const newRecord = { ...record, id };
    this.records.set(id, newRecord);
    this.hashToId.set(hash, id);
    this.save();
    return id;
  }

  getById(id: string): SearchKeywordReport | undefined {
    return this.records.get(id);
  }

  getByHash(hash: string): SearchKeywordReport | undefined {
    const id = this.hashToId.get(hash);
    return id ? this.records.get(id) : undefined;
  }

  hasHash(hash: string): boolean {
    return this.hashToId.has(hash);
  }

  getAll(): SearchKeywordReport[] {
    return Array.from(this.records.values());
  }

  updateHashMapping(hash: string, id: string): void {
    this.hashToId.set(hash, id);
  }
}

export class SessionStore {
  private sessions: Map<string, RecordingSession>;

  constructor() {
    this.sessions = new Map();
    this.load();
  }

  private load(): void {
    const data = readJsonFile<RecordingSession[]>(SESSIONS_FILE, []);
    for (const session of data) {
      this.sessions.set(session.id, session);
    }
  }

  private save(): void {
    const data = Array.from(this.sessions.values());
    writeJsonFile(SESSIONS_FILE, data);
  }

  create(name: string, createdBy: string): RecordingSession {
    const session: RecordingSession = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'recording',
      recordCount: 0
    };
    this.sessions.set(session.id, session);
    this.save();
    return session;
  }

  getById(id: string): RecordingSession | undefined {
    return this.sessions.get(id);
  }

  update(id: string, updates: Partial<RecordingSession>): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    Object.assign(session, updates);
    this.save();
    return true;
  }

  getAll(): RecordingSession[] {
    return Array.from(this.sessions.values());
  }
}

export class AuditStore {
  private entries: AuditEntry[];

  constructor() {
    this.entries = [];
    this.load();
  }

  private load(): void {
    this.entries = readJsonFile<AuditEntry[]>(AUDIT_FILE, []);
  }

  private save(): void {
    writeJsonFile(AUDIT_FILE, this.entries);
  }

  add(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const newEntry: AuditEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };
    this.entries.push(newEntry);
    this.save();
    return newEntry;
  }

  getAll(): AuditEntry[] {
    return [...this.entries];
  }

  getPendingConfirmations(): AuditEntry[] {
    return this.entries.filter(e => e.needsConfirmation && !e.confirmed);
  }

  confirm(id: string, confirmedBy: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;
    entry.confirmed = true;
    entry.confirmedBy = confirmedBy;
    entry.confirmedAt = new Date().toISOString();
    this.save();
    return true;
  }
}

export const recordStore = new RecordStore();
export const sessionStore = new SessionStore();
export const auditStore = new AuditStore();
