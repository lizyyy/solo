import { 
  LedgerRecord, 
  RecordStatus, 
  FaultStatus, 
  ChangeLog, 
  AuditLog, 
  Role,
  ViewFilter,
  SourceEvidence
} from '../models/types';
import { generateId } from '../utils/crypto';
import { store } from '../store/fileStore';

export class LedgerService {
  private static canTransition(from: RecordStatus, to: RecordStatus): boolean {
    const transitions: Record<RecordStatus, RecordStatus[]> = {
      [RecordStatus.DRAFT]: [RecordStatus.SUBMITTED, RecordStatus.ARCHIVED],
      [RecordStatus.SUBMITTED]: [RecordStatus.REJECTED, RecordStatus.SECONDARY_CONFIRMED, RecordStatus.DRAFT],
      [RecordStatus.REJECTED]: [RecordStatus.DRAFT, RecordStatus.ARCHIVED],
      [RecordStatus.SECONDARY_CONFIRMED]: [RecordStatus.FROZEN, RecordStatus.REJECTED],
      [RecordStatus.FROZEN]: [RecordStatus.ARCHIVED],
      [RecordStatus.ARCHIVED]: []
    };
    return transitions[from]?.includes(to) ?? false;
  }

  static getRecord(id: string): LedgerRecord | undefined {
    return store.getRecord(id);
  }

  static getRecordWithDetails(id: string): {
    record: LedgerRecord;
    evidences: SourceEvidence[];
    changeLogs: ChangeLog[];
    auditLogs: AuditLog[];
  } | undefined {
    const record = store.getRecord(id);
    if (!record) return undefined;

    return {
      record,
      evidences: store.getEvidences(record.evidences),
      changeLogs: store.getChangeLogsForRecord(id),
      auditLogs: store.getAuditLogsForRecord(id)
    };
  }

  static listRecords(filter?: ViewFilter): LedgerRecord[] {
    let records = store.getAllRecords();

    if (filter) {
      if (filter.status) {
        records = records.filter(r => r.status === filter.status);
      }
      if (filter.faultStatus) {
        records = records.filter(r => r.faultStatus === filter.faultStatus);
      }
      if (filter.area) {
        records = records.filter(r => r.area === filter.area);
      }
      if (filter.pileId) {
        records = records.filter(r => r.pileId === filter.pileId);
      }
      if (filter.dateRange) {
        const start = new Date(filter.dateRange.start).getTime();
        const end = new Date(filter.dateRange.end).getTime();
        records = records.filter(r => {
          const time = new Date(r.faultStartTime).getTime();
          return time >= start && time <= end;
        });
      }
    }

    return records.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private static addChangeLog(
    recordId: string,
    field: string,
    oldValue: any,
    newValue: any,
    operator: string,
    reason: string,
    isManual: boolean = false
  ): void {
    const changeLog: ChangeLog = {
      id: generateId(),
      recordId,
      field,
      oldValue,
      newValue,
      changedBy: operator,
      changedAt: new Date().toISOString(),
      changeReason: reason,
      isManualOverride: isManual
    };
    store.saveChangeLog(changeLog);
  }

  private static addAuditLog(
    recordId: string,
    action: string,
    operator: string,
    role: Role,
    details: Record<string, any> = {},
    ip?: string
  ): void {
    const auditLog: AuditLog = {
      id: generateId(),
      recordId,
      action,
      operator,
      role,
      timestamp: new Date().toISOString(),
      details,
      ip
    };
    store.addAuditLog(auditLog);
  }

  static submitRecord(id: string, operator: string, role: Role, ip?: string): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status !== RecordStatus.DRAFT && record.status !== RecordStatus.REJECTED) {
      throw new Error(`当前状态 ${record.status} 不能提交`);
    }

    if (!LedgerService.canTransition(record.status, RecordStatus.SUBMITTED)) {
      throw new Error(`状态流转不允许: ${record.status} -> ${RecordStatus.SUBMITTED}`);
    }

    const oldStatus = record.status;
    record.status = RecordStatus.SUBMITTED;
    record.submittedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    record.version += 1;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'status', oldStatus, RecordStatus.SUBMITTED, operator, '提交记录');
    LedgerService.addAuditLog(id, 'submit', operator, role, { fromStatus: oldStatus }, ip);

    return record;
  }

  static rejectRecord(id: string, operator: string, role: Role, reason: string, ip?: string): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (!LedgerService.canTransition(record.status, RecordStatus.REJECTED)) {
      throw new Error(`状态流转不允许: ${record.status} -> ${RecordStatus.REJECTED}`);
    }

    const oldStatus = record.status;
    record.status = RecordStatus.REJECTED;
    record.updatedAt = new Date().toISOString();
    record.version += 1;
    record.modificationReason = reason;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'status', oldStatus, RecordStatus.REJECTED, operator, reason);
    LedgerService.addAuditLog(id, 'reject', operator, role, { fromStatus: oldStatus, reason }, ip);

    return record;
  }

  static secondaryConfirm(id: string, operator: string, role: Role, ip?: string): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status !== RecordStatus.SUBMITTED) {
      throw new Error(`当前状态 ${record.status} 不能进行二次确认`);
    }

    if (!LedgerService.canTransition(record.status, RecordStatus.SECONDARY_CONFIRMED)) {
      throw new Error(`状态流转不允许: ${record.status} -> ${RecordStatus.SECONDARY_CONFIRMED}`);
    }

    const oldStatus = record.status;
    record.status = RecordStatus.SECONDARY_CONFIRMED;
    record.updatedAt = new Date().toISOString();
    record.version += 1;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'status', oldStatus, RecordStatus.SECONDARY_CONFIRMED, operator, '二次确认通过');
    LedgerService.addAuditLog(id, 'secondary_confirm', operator, role, { fromStatus: oldStatus }, ip);

    return record;
  }

  static freezeRecord(id: string, operator: string, role: Role, reason: string, ip?: string): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status !== RecordStatus.SECONDARY_CONFIRMED) {
      throw new Error(`当前状态 ${record.status} 不能冻结`);
    }

    if (!LedgerService.canTransition(record.status, RecordStatus.FROZEN)) {
      throw new Error(`状态流转不允许: ${record.status} -> ${RecordStatus.FROZEN}`);
    }

    const oldStatus = record.status;
    record.status = RecordStatus.FROZEN;
    record.frozenAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    record.version += 1;
    record.modificationReason = reason;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'status', oldStatus, RecordStatus.FROZEN, operator, reason);
    LedgerService.addAuditLog(id, 'freeze', operator, role, { fromStatus: oldStatus, reason }, ip);

    return record;
  }

  static withdrawToDraft(id: string, operator: string, role: Role, reason: string, ip?: string): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status !== RecordStatus.SUBMITTED && record.status !== RecordStatus.REJECTED) {
      throw new Error(`当前状态 ${record.status} 不能撤回`);
    }

    const oldStatus = record.status;
    record.status = RecordStatus.DRAFT;
    record.updatedAt = new Date().toISOString();
    record.version += 1;
    record.modificationReason = reason;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'status', oldStatus, RecordStatus.DRAFT, operator, reason);
    LedgerService.addAuditLog(id, 'withdraw', operator, role, { fromStatus: oldStatus, reason }, ip);

    return record;
  }

  static manualUpdate(
    id: string,
    operator: string,
    role: Role,
    updates: Partial<LedgerRecord>,
    reason: string,
    ip?: string
  ): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status === RecordStatus.FROZEN || record.status === RecordStatus.ARCHIVED) {
      throw new Error(`已冻结或归档的记录不能修改`);
    }

    const protectedFields = ['id', 'factKey', 'evidences', 'createdAt', 'version'];
    const updatableFields = [
      'faultStatus', 'faultEndTime', 'faultDuration', 'faultDescription',
      'handler', 'handlerRole', 'processor', 'area', 'modificationReason'
    ];

    const now = new Date().toISOString();

    for (const [field, value] of Object.entries(updates)) {
      if (protectedFields.includes(field)) {
        continue;
      }
      if (!updatableFields.includes(field)) {
        throw new Error(`字段 ${field} 不允许手动修改`);
      }

      const oldValue = (record as any)[field];
      if (oldValue !== value) {
        LedgerService.addChangeLog(id, field, oldValue, value, operator, reason, true);
        (record as any)[field] = value;
      }
    }

    record.isManuallyModified = true;
    record.modificationReason = reason;
    record.updatedAt = now;
    record.version += 1;

    store.saveRecord(record);
    LedgerService.addAuditLog(id, 'manual_update', operator, role, { updates, reason }, ip);

    return record;
  }

  static updateFaultStatus(
    id: string,
    faultStatus: FaultStatus,
    operator: string,
    role: Role,
    reason: string,
    endTime?: string,
    ip?: string
  ): LedgerRecord {
    const record = store.getRecord(id);
    if (!record) {
      throw new Error(`记录不存在: ${id}`);
    }

    if (record.status === RecordStatus.FROZEN || record.status === RecordStatus.ARCHIVED) {
      throw new Error(`已冻结或归档的记录不能修改`);
    }

    const oldStatus = record.faultStatus;
    record.faultStatus = faultStatus;
    
    if (endTime) {
      record.faultEndTime = endTime;
      record.faultDuration = Math.ceil(
        (new Date(endTime).getTime() - new Date(record.faultStartTime).getTime()) / 60000
      );
    }

    record.updatedAt = new Date().toISOString();
    record.version += 1;

    store.saveRecord(record);

    LedgerService.addChangeLog(id, 'faultStatus', oldStatus, faultStatus, operator, reason, true);
    if (endTime) {
      LedgerService.addChangeLog(id, 'faultEndTime', record.faultEndTime, endTime, operator, reason, true);
    }
    LedgerService.addAuditLog(id, 'update_fault_status', operator, role, { oldStatus, newStatus: faultStatus, reason }, ip);

    return record;
  }

  static getStatistics(filter?: ViewFilter): {
    total: number;
    byStatus: Record<string, number>;
    byFaultStatus: Record<string, number>;
    totalDuration: number;
    byArea: Record<string, { count: number; duration: number }>;
  } {
    const records = this.listRecords(filter);

    const stats = {
      total: records.length,
      byStatus: {} as Record<string, number>,
      byFaultStatus: {} as Record<string, number>,
      totalDuration: 0,
      byArea: {} as Record<string, { count: number; duration: number }>
    };

    for (const record of records) {
      stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;
      stats.byFaultStatus[record.faultStatus] = (stats.byFaultStatus[record.faultStatus] || 0) + 1;
      stats.totalDuration += record.faultDuration;

      const area = record.area || 'unknown';
      if (!stats.byArea[area]) {
        stats.byArea[area] = { count: 0, duration: 0 };
      }
      stats.byArea[area].count += 1;
      stats.byArea[area].duration += record.faultDuration;
    }

    return stats;
  }

  static getChangeDiff(id: string): ChangeLog[] {
    return store.getChangeLogsForRecord(id);
  }

  static getAuditTrail(id: string): AuditLog[] {
    return store.getAuditLogsForRecord(id);
  }
}
