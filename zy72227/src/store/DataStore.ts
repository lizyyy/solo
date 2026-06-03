import { v4 as uuidv4 } from 'uuid';
import {
  PensionFundSwapRecord,
  BusinessRecordLine,
  ConflictEvidence,
  SelfCheckIssue,
  ImportEmailRequest,
  CalculationTrace,
  UnifiedRecordView
} from '../types';
import { getLatestParams, getFeeRate } from '../config/calculationParams';

class DataStore {
  private records: Map<string, PensionFundSwapRecord> = new Map();
  private businessNoIndex: Map<string, string[]> = new Map();
  private emailSourceIndex: Map<string, string[]> = new Map();

  generateId(): string {
    return uuidv4();
  }

  createCalculationTrace(
    tradeDate: string,
    holdingDays: number,
    calculatedBy: string
  ): CalculationTrace {
    const params = getLatestParams(tradeDate);
    const { reason } = getFeeRate(holdingDays);
    return {
      paramsVersion: params.version,
      decisionReason: reason,
      calculatedAt: new Date().toISOString(),
      calculatedBy
    };
  }

  createRecordFromEmail(request: ImportEmailRequest): PensionFundSwapRecord {
    const now = new Date().toISOString();
    const recordId = this.generateId();

    const lines: BusinessRecordLine[] = request.lines.map(line => ({
      ...line,
      id: this.generateId(),
      calculationTrace: this.createCalculationTrace(
        line.tradeDate,
        line.lineType === 'FEE' ? 0 : 365,
        request.importedBy
      )
    }));

    const record: PensionFundSwapRecord = {
      id: recordId,
      businessNo: request.businessNo,
      status: 'EMAIL_IMPORTED',
      lines,
      managerEmailSource: request.emailSource,
      managerEmailContent: request.emailContent,
      managerEmailImportedAt: now,
      managerEmailImportedBy: request.importedBy,
      conflicts: [],
      selfCheckIssues: [],
      createdAt: now,
      updatedAt: now
    };

    this.records.set(recordId, record);

    const existing = this.businessNoIndex.get(request.businessNo) || [];
    this.businessNoIndex.set(request.businessNo, [...existing, recordId]);

    const emailExisting = this.emailSourceIndex.get(request.emailSource) || [];
    this.emailSourceIndex.set(request.emailSource, [...emailExisting, recordId]);

    return record;
  }

  getRecord(id: string): PensionFundSwapRecord | undefined {
    return this.records.get(id);
  }

  getRecordsByBusinessNo(businessNo: string): PensionFundSwapRecord[] {
    const ids = this.businessNoIndex.get(businessNo) || [];
    return ids.map(id => this.records.get(id)!).filter(Boolean);
  }

  getRecordsByEmailSource(emailSource: string): PensionFundSwapRecord[] {
    const ids = this.emailSourceIndex.get(emailSource) || [];
    return ids.map(id => this.records.get(id)!).filter(Boolean);
  }

  getAllRecords(): PensionFundSwapRecord[] {
    return Array.from(this.records.values());
  }

  updateRecord(id: string, updates: Partial<PensionFundSwapRecord>): PensionFundSwapRecord {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }
    const updated = {
      ...record,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.records.set(id, updated);
    return updated;
  }

  addConflict(recordId: string, conflict: Omit<ConflictEvidence, 'id' | 'detectedAt'>): ConflictEvidence {
    const record = this.getRecord(recordId);
    if (!record) {
      throw new Error(`Record not found: ${recordId}`);
    }
    const newConflict: ConflictEvidence = {
      ...conflict,
      id: this.generateId(),
      detectedAt: new Date().toISOString()
    };
    this.updateRecord(recordId, {
      conflicts: [...record.conflicts, newConflict]
    });
    return newConflict;
  }

  addSelfCheckIssue(
    recordId: string,
    issue: Omit<SelfCheckIssue, 'id' | 'detectedAt'>
  ): SelfCheckIssue {
    const record = this.getRecord(recordId);
    if (!record) {
      throw new Error(`Record not found: ${recordId}`);
    }
    const newIssue: SelfCheckIssue = {
      ...issue,
      id: this.generateId(),
      detectedAt: new Date().toISOString()
    };
    this.updateRecord(recordId, {
      selfCheckIssues: [...record.selfCheckIssues, newIssue]
    });
    return newIssue;
  }

  getUnifiedView(recordId: string): UnifiedRecordView | undefined {
    const record = this.getRecord(recordId);
    if (!record) return undefined;

    const totalPrincipal = record.lines
      .filter(l => l.lineType === 'PRINCIPAL' || l.lineType === 'COMBINED')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalFee = record.lines
      .filter(l => l.lineType === 'FEE')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalAmount = totalPrincipal + totalFee;

    const hasSplitLines = record.lines.some(l => l.lineType === 'PRINCIPAL') &&
                         record.lines.some(l => l.lineType === 'FEE') &&
                         record.lines.length >= 2;

    const hasConflicts = record.conflicts.some(c => !c.resolvedAt);

    const pendingActions: string[] = [];
    if (hasConflicts) {
      pendingActions.push('OPERATOR');
    }
    if (hasSplitLines && record.status === 'SPLIT_LINES_PENDING') {
      pendingActions.push('SUPERVISOR');
    }

    return {
      record,
      totalPrincipal,
      totalFee,
      totalAmount,
      hasSplitLines,
      hasConflicts,
      pendingActions: pendingActions as any
    };
  }

  clear(): void {
    this.records.clear();
    this.businessNoIndex.clear();
    this.emailSourceIndex.clear();
  }
}

export const dataStore = new DataStore();
