const config = require('../config');
const dbManager = require('../db/database');
const ReplacementApplication = require('../models/ReplacementApplication');
const FaultAudit = require('../models/FaultAudit');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');

class FaultAuditService {
  canAudit(application) {
    const allowedStatuses = [
      config.business.status.APPLICATION_PENDING,
      config.business.status.FAULT_AUDITING
    ];
    return allowedStatuses.includes(application.status);
  }

  startFaultAudit(applicationId, operator) {
    const application = ReplacementApplication.findById(applicationId);
    if (!application) {
      throw new Error('申请单不存在');
    }

    if (!this.canAudit(application)) {
      throw new Error(`当前状态 ${application.status} 不允许开始故障审核`);
    }

    const existingAudit = FaultAudit.findByApplicationId(applicationId);
    if (existingAudit && existingAudit.audit_result !== config.business.faultStatus.PENDING) {
      throw new Error('该申请单已有审核记录');
    }

    if (!existingAudit) {
      FaultAudit.create({
        application_id: applicationId,
        audit_result: config.business.faultStatus.PENDING
      });
    }

    const result = StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.FAULT_AUDITING,
      'FAULT_AUDIT',
      operator,
      '开始故障审核'
    );

    return result.application;
  }

  submitFaultAudit(applicationId, auditData, operator) {
    const requestKey = IdempotencyService.generateRequestKey('fault_audit', applicationId);
    
    return IdempotencyService.checkAndExecute(requestKey, 'fault_audit', applicationId, () => {
      const application = ReplacementApplication.findById(applicationId);
      if (!application) {
        throw new Error('申请单不存在');
      }

      if (!this.canAudit(application)) {
        throw new Error(`当前状态 ${application.status} 不允许提交故障审核`);
      }

      let audit = FaultAudit.findByApplicationId(applicationId);
      const beforeAudit = audit ? { ...audit } : null;

      const auditResult = auditData.approved 
        ? config.business.faultStatus.CONFIRMED 
        : config.business.faultStatus.REJECTED;

      if (!audit) {
        audit = FaultAudit.create({
          application_id: applicationId,
          fault_description: auditData.fault_description,
          fault_type: auditData.fault_type,
          auditor: operator,
          audit_result: auditResult,
          audit_notes: auditData.audit_notes,
          confirm_need_replacement: auditData.approved ? 1 : 0,
          audited_at: new Date().toISOString()
        });
      } else {
        audit = FaultAudit.update(audit.id, {
          fault_description: auditData.fault_description || audit.fault_description,
          fault_type: auditData.fault_type || audit.fault_type,
          auditor: operator,
          audit_result: auditResult,
          audit_notes: auditData.audit_notes || audit.audit_notes,
          confirm_need_replacement: auditData.approved ? 1 : 0,
          audited_at: new Date().toISOString()
        });
      }

      OperationLogService.recordOperation(
        applicationId,
        'FAULT_AUDIT_SUBMIT',
        'FAULT_AUDIT',
        operator,
        beforeAudit,
        audit,
        auditData.audit_notes || '提交故障审核'
      );

      let newStatus;
      let reason;

      if (auditData.approved) {
        newStatus = config.business.status.FAULT_APPROVED;
        reason = '故障审核通过，确认需要换新';
      } else {
        newStatus = config.business.status.FAULT_REJECTED;
        reason = '故障审核不通过，无需换新';
      }

      const result = StatusHistoryService.updateApplicationStatus(
        applicationId,
        newStatus,
        'FAULT_AUDIT',
        operator,
        reason,
        {
          fault_type: auditData.fault_type,
          audit_notes: auditData.audit_notes
        }
      );

      return {
        application: result.application,
        audit: audit
      };
    });
  }

  getFaultAudit(applicationId) {
    return FaultAudit.findByApplicationId(applicationId);
  }
}

module.exports = new FaultAuditService();
