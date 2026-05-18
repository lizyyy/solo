import { v4 as uuidv4 } from 'uuid';
import {
  AuditRecord,
  AuditStatus,
  AuditAction,
  CreateAuditRequest,
  AuditActionRequest,
  AuditResult,
  OperationHistory,
  WindWarning,
  WindWarningLevel,
  SafetyEquipment
} from '../types';
import {
  isValidTransition,
  getNextStatus,
  getTransitionConditions,
  WIND_WARNING_THRESHOLD
} from '../config/auditTransitions';
import { store } from '../store/memoryStore';

export const ErrorCodes = {
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CONDITION_CHECK_FAILED: 'CONDITION_CHECK_FAILED',
  WIND_WARNING_VIOLATION: 'WIND_WARNING_VIOLATION',
  DUPLICATE_OPERATION: 'DUPLICATE_OPERATION',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VERSION_CONFLICT: 'VERSION_CONFLICT'
};

class AuditService {
  createAudit(request: CreateAuditRequest): AuditResult<AuditRecord> {
    const validation = this.validateCreateRequest(request);
    if (!validation.success) {
      return validation;
    }

    const record = store.create({
      status: AuditStatus.DRAFT,
      installationTeam: {
        ...request.installationTeam,
        teamId: uuidv4()
      },
      advertisement: {
        ...request.advertisement,
        adId: uuidv4()
      },
      safetyEquipments: request.safetyEquipments.map(se => ({
        ...se,
        equipmentId: uuidv4()
      })),
      plannedInstallationDate: request.plannedInstallationDate,
      plannedInstallationTime: request.plannedInstallationTime,
      applicantId: request.applicantId,
      applicantName: request.applicantName
    });

    const history = this.createOperationHistory(
      AuditAction.SUBMIT,
      null,
      AuditStatus.DRAFT,
      request.applicantId,
      request.applicantName,
      request.submissionSource,
      '创建审批申请'
    );
    store.update(record.id, {
      operationHistories: [history]
    });

    return {
      success: true,
      data: store.findById(record.id)
    };
  }

  executeAction(request: AuditActionRequest): AuditResult<AuditRecord> {
    const record = store.findById(request.recordId);
    if (!record) {
      return {
        success: false,
        error: '审批记录不存在',
        errorCode: ErrorCodes.RECORD_NOT_FOUND
      };
    }

    if (!isValidTransition(record.status, request.action)) {
      return {
        success: false,
        error: `状态 ${record.status} 不允许执行动作 ${request.action}`,
        errorCode: ErrorCodes.INVALID_TRANSITION
      };
    }

    const conditionCheck = this.checkTransitionConditions(record, request.action, request);
    if (!conditionCheck.success) {
      return conditionCheck;
    }

    const nextStatus = getNextStatus(record.status, request.action);
    if (!nextStatus) {
      return {
        success: false,
        error: '无法确定下一个状态',
        errorCode: ErrorCodes.INVALID_TRANSITION
      };
    }

    const history = this.createOperationHistory(
      request.action,
      record.status,
      nextStatus,
      request.operatorId,
      request.operatorName,
      request.submissionSource,
      request.remark,
      request.ipAddress
    );

    const updates: Partial<AuditRecord> = {
      status: nextStatus,
      operationHistories: [...record.operationHistories, history]
    };

    if (request.windWarning) {
      updates.windWarning = request.windWarning;
      updates.hasWindWarningViolation = this.checkWindWarningViolation(request.windWarning);
    }

    if (request.action === AuditAction.REJECT && request.remark) {
      updates.rejectReason = request.remark;
    }

    const updatedRecord = store.update(request.recordId, updates);
    return {
      success: true,
      data: updatedRecord!
    };
  }

  getAuditById(id: string): AuditResult<AuditRecord> {
    const record = store.findById(id);
    if (!record) {
      return {
        success: false,
        error: '审批记录不存在',
        errorCode: ErrorCodes.RECORD_NOT_FOUND
      };
    }
    return { success: true, data: record };
  }

  getAllAudits(): AuditResult<AuditRecord[]> {
    return { success: true, data: store.findAll() };
  }

  getAuditsByStatus(status: AuditStatus): AuditResult<AuditRecord[]> {
    return { success: true, data: store.findByStatus(status) };
  }

  getWindWarningViolations(): AuditResult<AuditRecord[]> {
    return { success: true, data: store.findWindWarningViolations() };
  }

  checkConsistency(recordId: string): AuditResult<{ consistent: boolean; issues: string[] }> {
    const record = store.findById(recordId);
    if (!record) {
      return {
        success: false,
        error: '审批记录不存在',
        errorCode: ErrorCodes.RECORD_NOT_FOUND
      };
    }

    const issues: string[] = [];

    if (record.operationHistories.length > 0) {
      let currentStatus = AuditStatus.DRAFT;
      for (const history of record.operationHistories) {
        if (history.previousStatus && history.previousStatus !== currentStatus) {
          issues.push(`操作记录状态不一致: 预期 ${currentStatus}, 实际 ${history.previousStatus}`);
        }
        currentStatus = history.newStatus;
      }
      if (currentStatus !== record.status) {
        issues.push(`最终状态不一致: 预期 ${currentStatus}, 实际 ${record.status}`);
      }
    }

    if (record.windWarning && record.status === AuditStatus.APPROVED) {
      if (this.checkWindWarningViolation(record.windWarning)) {
        issues.push('大风预警期间违规批准高空作业');
      }
    }

    return {
      success: true,
      data: {
        consistent: issues.length === 0,
        issues
      }
    };
  }

  private validateCreateRequest(request: CreateAuditRequest): AuditResult {
    const errors: string[] = [];

    if (!request.installationTeam.teamName) {
      errors.push('安装队名称不能为空');
    }
    if (!request.installationTeam.leaderName) {
      errors.push('队长姓名不能为空');
    }
    if (!request.installationTeam.leaderPhone) {
      errors.push('队长电话不能为空');
    }
    if (!request.advertisement.adTitle) {
      errors.push('广告标题不能为空');
    }
    if (!request.advertisement.installationLocation) {
      errors.push('安装位置不能为空');
    }
    if (!request.plannedInstallationDate) {
      errors.push('计划安装日期不能为空');
    }
    if (!request.applicantId) {
      errors.push('申请人ID不能为空');
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join('; '),
        errorCode: ErrorCodes.VALIDATION_ERROR
      };
    }

    return { success: true };
  }

  private checkTransitionConditions(
    record: AuditRecord,
    action: AuditAction,
    request: AuditActionRequest
  ): AuditResult {
    const conditions = getTransitionConditions(record.status, action);
    const failedConditions: string[] = [];

    for (const condition of conditions) {
      switch (condition) {
        case 'hasRequiredFields':
          if (!this.hasRequiredFields(record)) {
            failedConditions.push('必填字段不完整');
          }
          break;
        case 'safetyEquipmentsValid':
          if (!this.areSafetyEquipmentsValid(record.safetyEquipments)) {
            failedConditions.push('安全装备已过期或损坏');
          }
          break;
        case 'basicInfoComplete':
          if (!this.isBasicInfoComplete(record)) {
            failedConditions.push('基本信息不完整');
          }
          break;
        case 'safetyEquipmentsChecked':
          if (!this.areSafetyEquipmentsChecked(record)) {
            failedConditions.push('安全装备未检查');
          }
          break;
        case 'teamCertificationValid':
          if (!this.isTeamCertificationValid(record.installationTeam)) {
            failedConditions.push('安装队资质已过期');
          }
          break;
        case 'noHighWindWarning':
          if (request.windWarning) {
            if (this.checkWindWarningViolation(request.windWarning)) {
              failedConditions.push('存在大风预警，禁止高空作业');
            }
          }
          break;
        case 'hasCorrections':
          if (!record.rejectReason) {
            failedConditions.push('缺少整改说明');
          }
          break;
      }
    }

    if (failedConditions.length > 0) {
      return {
        success: false,
        error: failedConditions.join('; '),
        errorCode: ErrorCodes.CONDITION_CHECK_FAILED
      };
    }

    return { success: true };
  }

  private hasRequiredFields(record: AuditRecord): boolean {
    return !!(
      record.installationTeam.teamName &&
      record.installationTeam.leaderName &&
      record.advertisement.adTitle &&
      record.advertisement.installationLocation &&
      record.plannedInstallationDate
    );
  }

  private areSafetyEquipmentsValid(equipments: SafetyEquipment[]): boolean {
    return equipments.every(e => e.status === 'VALID');
  }

  private isBasicInfoComplete(record: AuditRecord): boolean {
    return !!(
      record.installationTeam.certificationLevel &&
      record.advertisement.adSize &&
      record.advertisement.installationHeight > 0
    );
  }

  private areSafetyEquipmentsChecked(record: AuditRecord): boolean {
    return record.safetyEquipments.length > 0;
  }

  private isTeamCertificationValid(team: { certificationExpiryDate: string }): boolean {
    if (!team.certificationExpiryDate) return false;
    return new Date(team.certificationExpiryDate) > new Date();
  }

  private checkWindWarningViolation(warning: WindWarning): boolean {
    const threshold = WIND_WARNING_THRESHOLD[AuditStatus.WIND_WARNING_CHECK];
    return (
      warning.windSpeed > threshold.maxWindSpeed ||
      threshold.forbiddenLevels.includes(warning.warningLevel)
    );
  }

  private createOperationHistory(
    action: AuditAction,
    previousStatus: AuditStatus | null,
    newStatus: AuditStatus,
    operatorId: string,
    operatorName: string,
    submissionSource: any,
    remark?: string,
    ipAddress?: string
  ): OperationHistory {
    return {
      id: uuidv4(),
      action,
      previousStatus: previousStatus as AuditStatus,
      newStatus,
      operatorId,
      operatorName,
      operationTime: new Date().toISOString(),
      submissionSource,
      remark,
      ipAddress
    };
  }
}

export const auditService = new AuditService();
