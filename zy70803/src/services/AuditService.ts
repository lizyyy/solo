import { Repository, Between } from 'typeorm';
import { AuditLog } from '../models/AuditLog';
import { AppDataSource } from '../database/data-source';

export interface ChangeRecord {
  fieldName: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export class AuditService {
  private auditLogRepository: Repository<AuditLog>;

  constructor() {
    this.auditLogRepository = AppDataSource.getRepository(AuditLog);
  }

  async logChange(
    recordId: string,
    operator: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    changeReason: string
  ): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      recordId,
      operator,
      fieldName,
      oldValue: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
      newValue: newValue !== undefined && newValue !== null ? String(newValue) : null,
      changeReason
    });
    return await this.auditLogRepository.save(log);
  }

  async logMultipleChanges(
    recordId: string,
    operator: string,
    changes: ChangeRecord[]
  ): Promise<AuditLog[]> {
    const logs = changes.map(change => this.auditLogRepository.create({
      recordId,
      operator,
      fieldName: change.fieldName,
      oldValue: change.oldValue !== undefined && change.oldValue !== null ? String(change.oldValue) : null,
      newValue: change.newValue !== undefined && change.newValue !== null ? String(change.newValue) : null,
      changeReason: change.reason
    }));
    return await this.auditLogRepository.save(logs);
  }

  async getRecordHistory(recordId: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { recordId },
      order: { changeTime: 'DESC' }
    });
  }

  async getFieldHistory(recordId: string, fieldName: string): Promise<AuditLog[]> {
    return await this.auditLogRepository.find({
      where: { recordId, fieldName },
      order: { changeTime: 'DESC' }
    });
  }

  async getOperatorHistory(operator: string, startDate?: Date, endDate?: Date): Promise<AuditLog[]> {
    const where: any = { operator };
    if (startDate && endDate) {
      where.changeTime = Between(startDate, endDate);
    }
    return await this.auditLogRepository.find({
      where,
      order: { changeTime: 'DESC' }
    });
  }
}
