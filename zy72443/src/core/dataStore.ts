import * as fs from 'fs';
import * as path from 'path';
import { TicketExport, AudioFileRemark, LessonVerification, AnomalyRecord, ChangeHistory } from '../models';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const NO_HISTORY_FIELDS = new Set([
  'id', 'updatedAt', 'updatedBy', 'createdAt', 'importedAt',
  'verifiedAt', 'detectedAt', 'resolvedAt', 'initializedAt'
]);

interface PersistedData {
  tickets: TicketExport[];
  audioRemarks: AudioFileRemark[];
  verifications: LessonVerification[];
  anomalies: AnomalyRecord[];
  changeHistories: ChangeHistory[];
  initializedAt: string;
}

class DataStore {
  private tickets: Map<string, TicketExport> = new Map();
  private audioRemarks: Map<string, AudioFileRemark> = new Map();
  private verifications: Map<string, LessonVerification> = new Map();
  private anomalies: Map<string, AnomalyRecord> = new Map();
  private changeHistories: Map<string, ChangeHistory> = new Map();
  private persistenceEnabled = true;

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (e) {
        this.persistenceEnabled = false;
      }
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data: PersistedData = JSON.parse(raw);
        
        for (const t of data.tickets || []) this.tickets.set(t.ticketId, t);
        for (const a of data.audioRemarks || []) this.audioRemarks.set(a.audioFileId, a);
        for (const v of data.verifications || []) this.verifications.set(v.verificationNo, v);
        for (const an of data.anomalies || []) this.anomalies.set(an.id, an);
        for (const ch of data.changeHistories || []) this.changeHistories.set(ch.id, ch);
      }
    } catch (e) {
      console.error('加载持久化数据失败:', e);
    }
  }

  private saveToDisk(): void {
    if (!this.persistenceEnabled) return;
    
    try {
      this.ensureDataDir();
      const data: PersistedData = {
        tickets: Array.from(this.tickets.values()),
        audioRemarks: Array.from(this.audioRemarks.values()),
        verifications: Array.from(this.verifications.values()),
        anomalies: Array.from(this.anomalies.values()),
        changeHistories: Array.from(this.changeHistories.values()),
        initializedAt: new Date().toISOString()
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('保存持久化数据失败:', e);
    }
  }

  addChangeHistory(
    ticketId: string,
    entityType: ChangeHistory['entityType'],
    entityId: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
    changeReason: string
  ): ChangeHistory {
    const history: ChangeHistory = {
      id: `HIS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ticketId,
      entityType,
      entityId,
      fieldName,
      oldValue,
      newValue,
      changedBy,
      changeReason,
      changedAt: new Date().toISOString()
    };
    this.changeHistories.set(history.id, history);
    this.saveToDisk();
    return history;
  }

  getChangeHistoriesByTicket(ticketId: string): ChangeHistory[] {
    return Array.from(this.changeHistories.values())
      .filter(h => h.ticketId === ticketId)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }

  getAllChangeHistories(): ChangeHistory[] {
    return Array.from(this.changeHistories.values())
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }

  getChangeHistoriesByCity(city: string): ChangeHistory[] {
    return Array.from(this.changeHistories.values())
      .filter(h => 
        h.fieldName === 'authorizedCities' || 
        h.fieldName === 'actualAuthorizedCities' ||
        h.oldValue.includes(city) ||
        h.newValue.includes(city)
      )
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  }

  addTicket(ticket: TicketExport, opts?: { changedBy?: string; changeReason?: string }): void {
    const old = this.tickets.get(ticket.ticketId);
    if (old && opts?.changedBy) {
      for (const key of Object.keys(ticket) as (keyof TicketExport)[]) {
        if (NO_HISTORY_FIELDS.has(key)) continue;
        const oldVal = old[key];
        const newVal = ticket[key];
        const oldStr = Array.isArray(oldVal) ? oldVal.join('、') : String(oldVal);
        const newStr = Array.isArray(newVal) ? newVal.join('、') : String(newVal);
        if (oldStr !== newStr) {
          this.addChangeHistory(
            ticket.ticketId, 'ticket', ticket.ticketId, String(key),
            oldStr, newStr, opts.changedBy, opts.changeReason || '更新票务数据'
          );
        }
      }
    }
    this.tickets.set(ticket.ticketId, ticket);
    this.saveToDisk();
  }

  getTicket(ticketId: string): TicketExport | undefined {
    return this.tickets.get(ticketId);
  }

  getAllTickets(): TicketExport[] {
    return Array.from(this.tickets.values());
  }

  addAudioRemark(
    remark: AudioFileRemark, 
    opts?: { changedBy?: string; changeReason?: string }
  ): void {
    const old = this.audioRemarks.get(remark.audioFileId);
    if (old && opts?.changedBy) {
      for (const key of Object.keys(remark) as (keyof AudioFileRemark)[]) {
        if (NO_HISTORY_FIELDS.has(key)) continue;
        const oldVal = old[key];
        const newVal = remark[key];
        const oldStr = Array.isArray(oldVal) ? oldVal.join('、') : String(oldVal);
        const newStr = Array.isArray(newVal) ? newVal.join('、') : String(newVal);
        if (oldStr !== newStr) {
          this.addChangeHistory(
            remark.ticketId, 'audio_remark', remark.audioFileId, String(key),
            oldStr, newStr, opts.changedBy, opts.changeReason || '更新音频备注'
          );
        }
      }
    }
    this.audioRemarks.set(remark.audioFileId, remark);
    this.saveToDisk();
  }

  getAudioRemark(audioFileId: string): AudioFileRemark | undefined {
    return this.audioRemarks.get(audioFileId);
  }

  getAudioRemarkByTicket(ticketId: string): AudioFileRemark | undefined {
    return Array.from(this.audioRemarks.values()).find(r => r.ticketId === ticketId);
  }

  getAllAudioRemarks(): AudioFileRemark[] {
    return Array.from(this.audioRemarks.values());
  }

  addVerification(
    verification: LessonVerification,
    opts?: { changedBy?: string; changeReason?: string }
  ): void {
    const old = this.verifications.get(verification.verificationNo);
    if (old && opts?.changedBy) {
      for (const key of Object.keys(verification) as (keyof LessonVerification)[]) {
        if (NO_HISTORY_FIELDS.has(key)) continue;
        const oldVal = old[key];
        const newVal = verification[key];
        const oldStr = Array.isArray(oldVal) ? oldVal.join('、') : String(oldVal);
        const newStr = Array.isArray(newVal) ? newVal.join('、') : String(newVal);
        if (oldStr !== newStr) {
          this.addChangeHistory(
            verification.ticketId, 'verification', verification.verificationNo, String(key),
            oldStr, newStr, opts.changedBy, opts.changeReason || '更新核销单'
          );
        }
      }
    }
    this.verifications.set(verification.verificationNo, verification);
    this.saveToDisk();
  }

  getVerification(verificationNo: string): LessonVerification | undefined {
    return this.verifications.get(verificationNo);
  }

  getVerificationByTicket(ticketId: string): LessonVerification | undefined {
    return Array.from(this.verifications.values()).find(v => v.ticketId === ticketId);
  }

  getAllVerifications(): LessonVerification[] {
    return Array.from(this.verifications.values());
  }

  updateVerification(
    verificationNo: string, 
    updates: Partial<LessonVerification>,
    opts?: { changedBy?: string; changeReason?: string }
  ): LessonVerification | undefined {
    const existing = this.verifications.get(verificationNo);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      
      if (opts?.changedBy) {
        for (const key of Object.keys(updates) as (keyof LessonVerification)[]) {
          if (NO_HISTORY_FIELDS.has(key)) continue;
          const oldVal = existing[key];
          const newVal = updates[key];
          if (oldVal !== undefined && newVal !== undefined) {
            const oldStr = Array.isArray(oldVal) ? oldVal.join('、') : String(oldVal);
            const newStr = Array.isArray(newVal) ? newVal.join('、') : String(newVal);
            if (oldStr !== newStr) {
              this.addChangeHistory(
                existing.ticketId, 'verification', verificationNo, String(key),
                oldStr, newStr, opts.changedBy, opts.changeReason || '更新核销单'
              );
            }
          }
        }
      }
      
      this.verifications.set(verificationNo, updated);
      this.saveToDisk();
      return updated;
    }
    return undefined;
  }

  addAnomaly(
    anomaly: AnomalyRecord,
    opts?: { changedBy?: string; changeReason?: string }
  ): void {
    const old = this.anomalies.get(anomaly.id);
    if (old && opts?.changedBy) {
      for (const key of Object.keys(anomaly) as (keyof AnomalyRecord)[]) {
        const oldVal = old[key];
        const newVal = anomaly[key];
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        if (oldStr !== newStr) {
          this.addChangeHistory(
            anomaly.ticketId, 'anomaly', anomaly.id, String(key),
            oldStr, newStr, opts.changedBy, opts.changeReason || '更新异常记录'
          );
        }
      }
    }
    this.anomalies.set(anomaly.id, anomaly);
    this.saveToDisk();
  }

  getAnomaly(id: string): AnomalyRecord | undefined {
    return this.anomalies.get(id);
  }

  getAnomaliesByTicket(ticketId: string): AnomalyRecord[] {
    return Array.from(this.anomalies.values()).filter(a => a.ticketId === ticketId);
  }

  getUnresolvedAnomalies(): AnomalyRecord[] {
    return Array.from(this.anomalies.values()).filter(a => !a.resolved);
  }

  getAllAnomalies(): AnomalyRecord[] {
    return Array.from(this.anomalies.values());
  }

  resolveAnomaly(
    id: string, 
    resolvedBy: string, 
    notes: string
  ): AnomalyRecord | undefined {
    const anomaly = this.anomalies.get(id);
    if (anomaly) {
      const updated = {
        ...anomaly,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedBy,
        resolutionNotes: notes
      };
      
      this.addChangeHistory(
        anomaly.ticketId, 'anomaly', anomaly.id, 'resolved',
        'false', 'true', resolvedBy, notes
      );
      
      this.anomalies.set(id, updated);
      this.saveToDisk();
      return updated;
    }
    return undefined;
  }

  clear(): void {
    this.tickets.clear();
    this.audioRemarks.clear();
    this.verifications.clear();
    this.anomalies.clear();
    this.changeHistories.clear();
    this.saveToDisk();
  }

  hasData(): boolean {
    return this.tickets.size > 0;
  }

  getDataFilePath(): string {
    return DATA_FILE;
  }
}

export const dataStore = new DataStore();
