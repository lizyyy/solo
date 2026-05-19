import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { DeadLetterMessage, ReplayBatch, SkipRule, ApiRequestLog, MessageStatus, HistoryRecord } from './types';

const DATA_DIR = path.join(__dirname, '../data');

class DataStore {
  private messages: Map<string, DeadLetterMessage> = new Map();
  private batches: Map<string, ReplayBatch> = new Map();
  private rules: Map<string, SkipRule> = new Map();
  private logs: ApiRequestLog[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getDataPath(name: string) {
    return path.join(DATA_DIR, `${name}.json`);
  }

  private loadData() {
    try {
      if (fs.existsSync(this.getDataPath('messages'))) {
        const data = JSON.parse(fs.readFileSync(this.getDataPath('messages'), 'utf-8'));
        this.messages = new Map(Object.entries(data));
      }
      if (fs.existsSync(this.getDataPath('batches'))) {
        const data = JSON.parse(fs.readFileSync(this.getDataPath('batches'), 'utf-8'));
        this.batches = new Map(Object.entries(data));
      }
      if (fs.existsSync(this.getDataPath('rules'))) {
        const data = JSON.parse(fs.readFileSync(this.getDataPath('rules'), 'utf-8'));
        this.rules = new Map(Object.entries(data));
      }
      if (fs.existsSync(this.getDataPath('logs'))) {
        this.logs = JSON.parse(fs.readFileSync(this.getDataPath('logs'), 'utf-8'));
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  private saveData() {
    try {
      fs.writeFileSync(this.getDataPath('messages'), JSON.stringify(Object.fromEntries(this.messages), null, 2));
      fs.writeFileSync(this.getDataPath('batches'), JSON.stringify(Object.fromEntries(this.batches), null, 2));
      fs.writeFileSync(this.getDataPath('rules'), JSON.stringify(Object.fromEntries(this.rules), null, 2));
      fs.writeFileSync(this.getDataPath('logs'), JSON.stringify(this.logs.slice(-1000), null, 2));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  }

  addMessage(message: Omit<DeadLetterMessage, 'id' | 'createdAt' | 'updatedAt' | 'history'>): DeadLetterMessage {
    const now = Date.now();
    const id = uuidv4();
    const msg: DeadLetterMessage = {
      ...message,
      id,
      createdAt: now,
      updatedAt: now,
      history: [{
        timestamp: now,
        action: 'created',
        status: message.status,
        operator: 'system'
      }]
    };
    this.messages.set(id, msg);
    this.saveData();
    return msg;
  }

  getMessage(id: string): DeadLetterMessage | undefined {
    return this.messages.get(id);
  }

  getMessages(filters?: { topic?: string; status?: MessageStatus }): DeadLetterMessage[] {
    let result = Array.from(this.messages.values());
    if (filters?.topic) {
      result = result.filter(m => m.topic === filters.topic);
    }
    if (filters?.status) {
      result = result.filter(m => m.status === filters.status);
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  updateMessage(id: string, updates: Partial<DeadLetterMessage>): DeadLetterMessage | undefined {
    const msg = this.messages.get(id);
    if (!msg) return undefined;
    const updated = { ...msg, ...updates, updatedAt: Date.now() };
    this.messages.set(id, updated);
    this.saveData();
    return updated;
  }

  addHistory(id: string, history: Omit<HistoryRecord, never>): DeadLetterMessage | undefined {
    const msg = this.messages.get(id);
    if (!msg) return undefined;
    msg.history.push(history);
    msg.updatedAt = Date.now();
    this.saveData();
    return msg;
  }

  addBatch(batch: Omit<ReplayBatch, 'id' | 'createdAt' | 'successCount' | 'failedCount' | 'skippedCount'>): ReplayBatch {
    const now = Date.now();
    const id = uuidv4();
    const b: ReplayBatch = {
      ...batch,
      id,
      createdAt: now,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0
    };
    this.batches.set(id, b);
    this.saveData();
    return b;
  }

  getBatch(id: string): ReplayBatch | undefined {
    return this.batches.get(id);
  }

  getBatches(): ReplayBatch[] {
    return Array.from(this.batches.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateBatch(id: string, updates: Partial<ReplayBatch>): ReplayBatch | undefined {
    const batch = this.batches.get(id);
    if (!batch) return undefined;
    const updated = { ...batch, ...updates };
    this.batches.set(id, updated);
    this.saveData();
    return updated;
  }

  addRule(rule: Omit<SkipRule, 'id' | 'createdAt'>): SkipRule {
    const now = Date.now();
    const id = uuidv4();
    const r: SkipRule = { ...rule, id, createdAt: now };
    this.rules.set(id, r);
    this.saveData();
    return r;
  }

  getRules(): SkipRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  updateRule(id: string, updates: Partial<SkipRule>): SkipRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;
    const updated = { ...rule, ...updates };
    this.rules.set(id, updated);
    this.saveData();
    return updated;
  }

  deleteRule(id: string): boolean {
    const result = this.rules.delete(id);
    this.saveData();
    return result;
  }

  addLog(log: Omit<ApiRequestLog, 'id' | 'timestamp'>): ApiRequestLog {
    const now = Date.now();
    const id = uuidv4();
    const l: ApiRequestLog = { ...log, id, timestamp: now };
    this.logs.push(l);
    this.saveData();
    return l;
  }

  getLogs(): ApiRequestLog[] {
    return this.logs.slice().reverse();
  }

  getTopics(): string[] {
    const topics = new Set<string>();
    this.messages.forEach(m => topics.add(m.topic));
    return Array.from(topics);
  }
}

export const store = new DataStore();
