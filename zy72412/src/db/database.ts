import fs from 'fs';
import path from 'path';
import { TicketRecord, TicketBatch, AuthReminder, AudioFile } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseData {
  ticketBatches: TicketBatch[];
  tickets: TicketRecord[];
  audioFiles: AudioFile[];
  authReminders: AuthReminder[];
  auditLogs: any[];
}

let dbCache: DatabaseData | null = null;

function initData(): DatabaseData {
  return {
    ticketBatches: [],
    tickets: [],
    audioFiles: [],
    authReminders: [],
    auditLogs: []
  };
}

export function getDb(): DatabaseData {
  if (!dbCache) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        dbCache = JSON.parse(content);
      } catch (e) {
        dbCache = initData();
      }
    } else {
      dbCache = initData();
    }
  }
  return dbCache!;
}

export function saveDb(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
}

export function closeDb(): void {
  saveDb();
  dbCache = null;
}

let nextTicketId = 1;
let nextBatchId = 1;
let nextReminderId = 1;
let nextAudioId = 1;

export function getNextTicketId(): number {
  const db = getDb();
  if (db.tickets.length > 0) {
    nextTicketId = Math.max(...db.tickets.map(t => t.id || 0)) + 1;
  }
  return nextTicketId++;
}

export function getNextReminderId(): number {
  const db = getDb();
  if (db.authReminders.length > 0) {
    nextReminderId = Math.max(...db.authReminders.map(r => r.id || 0)) + 1;
  }
  return nextReminderId++;
}

export function getNextAudioId(): number {
  const db = getDb();
  if (db.audioFiles.length > 0) {
    nextAudioId = Math.max(...db.audioFiles.map(a => a.id || 0)) + 1;
  }
  return nextAudioId++;
}

export function resetDb(): void {
  dbCache = initData();
  saveDb();
}
