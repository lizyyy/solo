import auditLogRepository from '../repositories/AuditLogRepository.js';
import type { AuditLog, OperationType } from '../../shared/types.js';

export class AuditTrailService {
  logCreation(detailId: string, batchId: string, operator: string): AuditLog {
    return auditLogRepository.create({
      detailId,
      batchId,
      operator,
      operationType: 'CREATE',
      remark: '创建结算明细'
    });
  }

  logUpdate(
    detailId: string,
    batchId: string,
    operator: string,
    fieldName: string,
    oldValue: string,
    newValue: string,
    remark?: string
  ): AuditLog {
    return auditLogRepository.create({
      detailId,
      batchId,
      operator,
      operationType: 'UPDATE',
      fieldName,
      oldValue,
      newValue,
      remark
    });
  }

  logStatusChange(
    detailId: string,
    batchId: string,
    operator: string,
    oldStatus: string,
    newStatus: string,
    remark?: string
  ): AuditLog {
    return auditLogRepository.create({
      detailId,
      batchId,
      operator,
      operationType: 'STATUS_CHANGE',
      fieldName: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      remark
    });
  }

  logTaxRateUpdate(
    detailId: string,
    batchId: string,
    operator: string,
    oldTaxRate: string,
    newTaxRate: string,
    remark?: string
  ): AuditLog {
    return auditLogRepository.create({
      detailId,
      batchId,
      operator,
      operationType: 'TAX_RATE_UPDATE',
      fieldName: 'taxRate',
      oldValue: oldTaxRate,
      newValue: newTaxRate,
      remark
    });
  }

  logCurrencyReview(
    detailId: string,
    batchId: string,
    operator: string,
    decision: string,
    remark?: string
  ): AuditLog {
    return auditLogRepository.create({
      detailId,
      batchId,
      operator,
      operationType: 'CURRENCY_REVIEW',
      fieldName: 'currency',
      newValue: decision,
      remark
    });
  }

  getDetailAuditTrail(detailId: string): AuditLog[] {
    return auditLogRepository.findByDetailId(detailId);
  }

  getBatchAuditTrail(batchId: string): AuditLog[] {
    return auditLogRepository.findByBatchId(batchId);
  }

  getStepActions(batchId: string, step: 'risk_control' | 'audit'): AuditLog[] {
    return auditLogRepository.findByBatchIdAndStep(batchId, step);
  }
}

export default new AuditTrailService();
