import {
  CreateTaskRequest,
  UpdateTaskRequest,
  ApplyRecoveryRequest,
  AuditRecoveryRequest,
  WithdrawRequest,
  ManualRemarkRequest,
  RecordFailureRequest,
  ValidationError
} from '../types';

export class Validator {
  private errors: ValidationError[] = [];

  getErrors(): ValidationError[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  private addError(field: string, message: string, rule: string): void {
    this.errors.push({ field, message, rule });
  }

  validateCreateTask(data: CreateTaskRequest): boolean {
    this.errors = [];
    
    if (!data.taskName || data.taskName.trim() === '') {
      this.addError('taskName', '任务名称不能为空', 'REQUIRED');
    } else if (data.taskName.length > 100) {
      this.addError('taskName', '任务名称不能超过100个字符', 'MAX_LENGTH');
    }

    if (!data.taskCode || data.taskCode.trim() === '') {
      this.addError('taskCode', '任务编码不能为空', 'REQUIRED');
    } else if (!/^[A-Za-z0-9_-]+$/.test(data.taskCode)) {
      this.addError('taskCode', '任务编码只能包含字母、数字、下划线和中划线', 'PATTERN');
    } else if (data.taskCode.length > 50) {
      this.addError('taskCode', '任务编码不能超过50个字符', 'MAX_LENGTH');
    }

    if (!data.schedulerName || data.schedulerName.trim() === '') {
      this.addError('schedulerName', '调度器名称不能为空', 'REQUIRED');
    } else if (data.schedulerName.length > 50) {
      this.addError('schedulerName', '调度器名称不能超过50个字符', 'MAX_LENGTH');
    }

    return !this.hasErrors();
  }

  validateUpdateTask(data: UpdateTaskRequest): boolean {
    this.errors = [];

    if (data.taskName !== undefined) {
      if (data.taskName.trim() === '') {
        this.addError('taskName', '任务名称不能为空', 'REQUIRED');
      } else if (data.taskName.length > 100) {
        this.addError('taskName', '任务名称不能超过100个字符', 'MAX_LENGTH');
      }
    }

    if (data.schedulerName !== undefined) {
      if (data.schedulerName.trim() === '') {
        this.addError('schedulerName', '调度器名称不能为空', 'REQUIRED');
      } else if (data.schedulerName.length > 50) {
        this.addError('schedulerName', '调度器名称不能超过50个字符', 'MAX_LENGTH');
      }
    }

    return !this.hasErrors();
  }

  validateApplyRecovery(data: ApplyRecoveryRequest): boolean {
    this.errors = [];

    if (!data.applicant || data.applicant.trim() === '') {
      this.addError('applicant', '申请人不能为空', 'REQUIRED');
    }

    if (!data.recoveryRemark || data.recoveryRemark.trim() === '') {
      this.addError('recoveryRemark', '恢复说明不能为空', 'REQUIRED');
    } else if (data.recoveryRemark.length > 500) {
      this.addError('recoveryRemark', '恢复说明不能超过500个字符', 'MAX_LENGTH');
    }

    if (!data.recoveryConditions || !Array.isArray(data.recoveryConditions)) {
      this.addError('recoveryConditions', '恢复条件必须是数组', 'TYPE');
    } else if (data.recoveryConditions.length === 0) {
      this.addError('recoveryConditions', '至少需要一个恢复条件', 'MIN_LENGTH');
    } else {
      data.recoveryConditions.forEach((condition, index) => {
        if (!condition.type) {
          this.addError(`recoveryConditions[${index}].type`, '条件类型不能为空', 'REQUIRED');
        } else if (!['FIX_ERROR', 'DATA_CLEAN', 'DEPENDENCY_READY', 'OTHER'].includes(condition.type)) {
          this.addError(`recoveryConditions[${index}].type`, '无效的条件类型', 'ENUM');
        }
        if (!condition.description || condition.description.trim() === '') {
          this.addError(`recoveryConditions[${index}].description`, '条件描述不能为空', 'REQUIRED');
        } else if (condition.description.length > 200) {
          this.addError(`recoveryConditions[${index}].description`, '条件描述不能超过200个字符', 'MAX_LENGTH');
        }
      });
    }

    return !this.hasErrors();
  }

  validateAuditRecovery(data: AuditRecoveryRequest): boolean {
    this.errors = [];

    if (!data.auditor || data.auditor.trim() === '') {
      this.addError('auditor', '审核人不能为空', 'REQUIRED');
    }

    if (typeof data.approved !== 'boolean') {
      this.addError('approved', '审核结果必须是布尔值', 'TYPE');
    }

    if (data.auditRemark && data.auditRemark.length > 500) {
      this.addError('auditRemark', '审核备注不能超过500个字符', 'MAX_LENGTH');
    }

    return !this.hasErrors();
  }

  validateWithdraw(data: WithdrawRequest): boolean {
    this.errors = [];

    if (!data.operator || data.operator.trim() === '') {
      this.addError('operator', '操作人不能为空', 'REQUIRED');
    }

    if (!data.reason || data.reason.trim() === '') {
      this.addError('reason', '撤回原因不能为空', 'REQUIRED');
    } else if (data.reason.length > 500) {
      this.addError('reason', '撤回原因不能超过500个字符', 'MAX_LENGTH');
    }

    return !this.hasErrors();
  }

  validateManualRemark(data: ManualRemarkRequest): boolean {
    this.errors = [];

    if (!data.operator || data.operator.trim() === '') {
      this.addError('operator', '操作人不能为空', 'REQUIRED');
    }

    if (!data.remark || data.remark.trim() === '') {
      this.addError('remark', '备注内容不能为空', 'REQUIRED');
    } else if (data.remark.length > 500) {
      this.addError('remark', '备注内容不能超过500个字符', 'MAX_LENGTH');
    }

    return !this.hasErrors();
  }

  validateRecordFailure(data: RecordFailureRequest): boolean {
    this.errors = [];

    if (!data.errorMessage || data.errorMessage.trim() === '') {
      this.addError('errorMessage', '错误信息不能为空', 'REQUIRED');
    }

    if (typeof data.retryCount !== 'number' || data.retryCount < 0) {
      this.addError('retryCount', '重试次数必须是非负整数', 'TYPE');
    }

    return !this.hasErrors();
  }

  validateImportRow(data: any, rowIndex: number): boolean {
    this.errors = [];

    if (!data.taskCode || data.taskCode.trim() === '') {
      this.addError(`row[${rowIndex}].taskCode`, '任务编码不能为空', 'REQUIRED');
    }

    if (!data.taskName || data.taskName.trim() === '') {
      this.addError(`row[${rowIndex}].taskName`, '任务名称不能为空', 'REQUIRED');
    }

    if (!data.schedulerName || data.schedulerName.trim() === '') {
      this.addError(`row[${rowIndex}].schedulerName`, '调度器名称不能为空', 'REQUIRED');
    }

    if (data.failureCount !== undefined) {
      if (isNaN(parseInt(data.failureCount, 10)) || parseInt(data.failureCount, 10) < 0) {
        this.addError(`row[${rowIndex}].failureCount`, '失败次数必须是非负整数', 'TYPE');
      }
    }

    return !this.hasErrors();
  }
}

export const validator = new Validator();
