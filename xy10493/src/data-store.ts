import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  BookInventory,
  ActualCount,
  LocationOwner,
  Difference,
  AuditSession,
  AdjustmentHistory,
  AuditReport,
  DifferenceType
} from './types';

const DATA_DIR = path.join(process.cwd(), '.audit-data');
const AUDITS_DIR = path.join(DATA_DIR, 'audits');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

export class DataStore {
  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(AUDITS_DIR)) fs.mkdirSync(AUDITS_DIR, { recursive: true });
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }

  private getAuditDir(auditId: string): string {
    return path.join(AUDITS_DIR, auditId);
  }

  private ensureAuditDir(auditId: string): void {
    const auditDir = this.getAuditDir(auditId);
    if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
  }

  saveAuditSession(session: AuditSession): void {
    this.ensureAuditDir(session.id);
    const filePath = path.join(this.getAuditDir(session.id), 'session.json');
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  }

  getAuditSession(auditId: string): AuditSession | null {
    const filePath = path.join(this.getAuditDir(auditId), 'session.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  getAllAuditSessions(): AuditSession[] {
    if (!fs.existsSync(AUDITS_DIR)) return [];
    const sessions: AuditSession[] = [];
    const dirs = fs.readdirSync(AUDITS_DIR);
    for (const dir of dirs) {
      const session = this.getAuditSession(dir);
      if (session) sessions.push(session);
    }
    return sessions;
  }

  saveBookInventory(auditId: string, inventories: BookInventory[]): void {
    this.ensureAuditDir(auditId);
    const filePath = path.join(this.getAuditDir(auditId), 'book-inventory.json');
    fs.writeFileSync(filePath, JSON.stringify(inventories, null, 2));
  }

  getBookInventory(auditId: string): BookInventory[] {
    const filePath = path.join(this.getAuditDir(auditId), 'book-inventory.json');
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  saveActualCount(auditId: string, counts: ActualCount[]): void {
    this.ensureAuditDir(auditId);
    const filePath = path.join(this.getAuditDir(auditId), 'actual-count.json');
    fs.writeFileSync(filePath, JSON.stringify(counts, null, 2));
  }

  getActualCount(auditId: string): ActualCount[] {
    const filePath = path.join(this.getAuditDir(auditId), 'actual-count.json');
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  saveLocationOwners(owners: LocationOwner[]): void {
    const filePath = path.join(DATA_DIR, 'location-owners.json');
    fs.writeFileSync(filePath, JSON.stringify(owners, null, 2));
  }

  getLocationOwners(): LocationOwner[] {
    const filePath = path.join(DATA_DIR, 'location-owners.json');
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  saveDifferences(auditId: string, differences: Difference[]): void {
    this.ensureAuditDir(auditId);
    const filePath = path.join(this.getAuditDir(auditId), 'differences.json');
    fs.writeFileSync(filePath, JSON.stringify(differences, null, 2));
  }

  getDifferences(auditId: string): Difference[] {
    const filePath = path.join(this.getAuditDir(auditId), 'differences.json');
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  updateDifference(auditId: string, differenceId: string, updates: Partial<Difference>): boolean {
    const differences = this.getDifferences(auditId);
    const index = differences.findIndex(d => d.id === differenceId);
    if (index === -1) return false;
    
    differences[index] = {
      ...differences[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveDifferences(auditId, differences);
    return true;
  }

  saveAdjustmentHistory(history: AdjustmentHistory): void {
    const filePath = path.join(HISTORY_DIR, `${history.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
  }

  getAdjustmentHistory(auditId?: string): AdjustmentHistory[] {
    if (!fs.existsSync(HISTORY_DIR)) return [];
    const files = fs.readdirSync(HISTORY_DIR);
    const histories: AdjustmentHistory[] = [];
    
    for (const file of files) {
      const history: AdjustmentHistory = JSON.parse(
        fs.readFileSync(path.join(HISTORY_DIR, file), 'utf-8')
      );
      if (!auditId || history.auditId === auditId) {
        histories.push(history);
      }
    }
    
    return histories.sort((a, b) => 
      new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime()
    );
  }

  saveReport(auditId: string, report: AuditReport): void {
    this.ensureAuditDir(auditId);
    const filePath = path.join(this.getAuditDir(auditId), 'report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  }

  getReport(auditId: string): AuditReport | null {
    const filePath = path.join(this.getAuditDir(auditId), 'report.json');
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
}

export const dataStore = new DataStore();
