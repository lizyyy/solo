import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  VisitorRecord,
  HostConfirmation,
  PlateEntry,
  AccessQRCode,
  CheckoutRecord,
  BlacklistRecord,
  OperationLog,
  SecurityReport,
  VisitorStatus,
  OperationType
} from '../../shared/types';

class DataStore {
  private visitors: Map<string, VisitorRecord> = new Map();
  private hostConfirmations: Map<string, HostConfirmation> = new Map();
  private plateEntries: Map<string, PlateEntry> = new Map();
  private qrCodes: Map<string, AccessQRCode> = new Map();
  private checkoutRecords: Map<string, CheckoutRecord> = new Map();
  private blacklist: Map<string, BlacklistRecord> = new Map();
  private operationLogs: Map<string, OperationLog> = new Map();
  private securityReports: Map<string, SecurityReport> = new Map();

  addVisitor(visitor: Omit<VisitorRecord, 'id' | 'createdAt' | 'updatedAt'>): VisitorRecord {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newVisitor: VisitorRecord = {
      ...visitor,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.visitors.set(id, newVisitor);
    return newVisitor;
  }

  getVisitor(id: string): VisitorRecord | undefined {
    return this.visitors.get(id);
  }

  updateVisitor(id: string, updates: Partial<VisitorRecord>): VisitorRecord | undefined {
    const visitor = this.visitors.get(id);
    if (!visitor) return undefined;
    const updated = { ...visitor, ...updates, updatedAt: dayjs().toISOString() };
    this.visitors.set(id, updated);
    return updated;
  }

  getAllVisitors(): VisitorRecord[] {
    return Array.from(this.visitors.values());
  }

  addHostConfirmation(confirmation: Omit<HostConfirmation, 'id' | 'createdAt'>): HostConfirmation {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newConfirmation: HostConfirmation = {
      ...confirmation,
      id,
      createdAt: now
    };
    this.hostConfirmations.set(id, newConfirmation);
    return newConfirmation;
  }

  getHostConfirmationsByVisitor(visitorId: string): HostConfirmation[] {
    return Array.from(this.hostConfirmations.values())
      .filter(c => c.visitorId === visitorId)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  updateHostConfirmation(id: string, updates: Partial<HostConfirmation>): HostConfirmation | undefined {
    const confirmation = this.hostConfirmations.get(id);
    if (!confirmation) return undefined;
    const previousValue = { ...confirmation };
    const updated = { ...confirmation, ...updates, previousValue };
    this.hostConfirmations.set(id, updated);
    return updated;
  }

  addPlateEntry(entry: Omit<PlateEntry, 'id' | 'createdAt'>): PlateEntry {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newEntry: PlateEntry = {
      ...entry,
      id,
      createdAt: now
    };
    this.plateEntries.set(id, newEntry);
    return newEntry;
  }

  getPlateEntriesByVisitor(visitorId: string): PlateEntry[] {
    return Array.from(this.plateEntries.values())
      .filter(e => e.visitorId === visitorId)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  updatePlateEntry(id: string, updates: Partial<PlateEntry>): PlateEntry | undefined {
    const entry = this.plateEntries.get(id);
    if (!entry) return undefined;
    const previousValue = { ...entry };
    const updated = { ...entry, ...updates, previousValue };
    this.plateEntries.set(id, updated);
    return updated;
  }

  addQRCode(qrcode: Omit<AccessQRCode, 'id' | 'createdAt'>): AccessQRCode {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newQRCode: AccessQRCode = {
      ...qrcode,
      id,
      createdAt: now
    };
    this.qrCodes.set(id, newQRCode);
    return newQRCode;
  }

  getQRCodesByVisitor(visitorId: string): AccessQRCode[] {
    return Array.from(this.qrCodes.values())
      .filter(q => q.visitorId === visitorId)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  updateQRCode(id: string, updates: Partial<AccessQRCode>): AccessQRCode | undefined {
    const qrcode = this.qrCodes.get(id);
    if (!qrcode) return undefined;
    const previousValue = { ...qrcode };
    const updated = { ...qrcode, ...updates, previousValue };
    this.qrCodes.set(id, updated);
    return updated;
  }

  addCheckoutRecord(record: Omit<CheckoutRecord, 'id' | 'createdAt'>): CheckoutRecord {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newRecord: CheckoutRecord = {
      ...record,
      id,
      createdAt: now
    };
    this.checkoutRecords.set(id, newRecord);
    return newRecord;
  }

  getCheckoutRecordsByVisitor(visitorId: string): CheckoutRecord[] {
    return Array.from(this.checkoutRecords.values())
      .filter(r => r.visitorId === visitorId)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  addBlacklistRecord(record: Omit<BlacklistRecord, 'id' | 'addedAt'>): BlacklistRecord {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newRecord: BlacklistRecord = {
      ...record,
      id,
      addedAt: now
    };
    this.blacklist.set(id, newRecord);
    return newRecord;
  }

  updateBlacklistRecord(id: string, updates: Partial<BlacklistRecord>): BlacklistRecord | undefined {
    const record = this.blacklist.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...updates };
    this.blacklist.set(id, updated);
    return updated;
  }

  getBlacklistByPhone(phone: string): BlacklistRecord | undefined {
    return Array.from(this.blacklist.values())
      .find(r => r.visitorPhone === phone && r.isActive);
  }

  getBlacklistByIdCard(idCard: string): BlacklistRecord | undefined {
    return Array.from(this.blacklist.values())
      .find(r => r.visitorIdCard === idCard && r.isActive);
  }

  getAllBlacklist(): BlacklistRecord[] {
    return Array.from(this.blacklist.values());
  }

  addOperationLog(log: Omit<OperationLog, 'id' | 'createdAt'>): OperationLog {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newLog: OperationLog = {
      ...log,
      id,
      createdAt: now
    };
    this.operationLogs.set(id, newLog);
    return newLog;
  }

  getOperationLogs(visitorId?: string): OperationLog[] {
    let logs = Array.from(this.operationLogs.values());
    if (visitorId) {
      logs = logs.filter(l => l.visitorId === visitorId);
    }
    return logs.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }

  addSecurityReport(report: Omit<SecurityReport, 'id' | 'generatedAt'>): SecurityReport {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const newReport: SecurityReport = {
      ...report,
      id,
      generatedAt: now
    };
    this.securityReports.set(id, newReport);
    return newReport;
  }

  getAllSecurityReports(): SecurityReport[] {
    return Array.from(this.securityReports.values())
      .sort((a, b) => dayjs(b.generatedAt).valueOf() - dayjs(a.generatedAt).valueOf());
  }

  getAllOperationLogs(): OperationLog[] {
    return Array.from(this.operationLogs.values())
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }
}

export const store = new DataStore();
