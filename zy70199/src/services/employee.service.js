const { models, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, StateConflictError, ValidationError } = require('../utils/error-handler');
const AuditService = require('./audit.service');

class EmployeeService {
  static create(data, userId = 'system') {
    if (!data.name || !data.email) {
      throw new ValidationError('姓名和邮箱是必填项');
    }
    
    const employee = models.Employee.create({
      name: data.name,
      email: data.email,
      department: data.department,
      position: data.position,
      hireDate: data.hireDate,
      status: EmployeeStatus.PENDING_REVIEW,
      notes: data.notes
    });
    
    AuditService.log('CREATE', 'Employee', employee.id, userId, {
      name: employee.name,
      email: employee.email,
      initialStatus: employee.status
    });
    
    logger.info(`Created employee: ${employee.name} (${employee.id})`);
    return employee;
  }

  static getById(id) {
    const employee = models.Employee.findById(id);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${id}`);
    }
    return employee;
  }

  static getAll(filters = {}) {
    return models.Employee.find(emp => {
      if (filters.status && emp.status !== filters.status) return false;
      if (filters.department && emp.department !== filters.department) return false;
      return true;
    });
  }

  static updateStatus(id, newStatus, reason, userId = 'system') {
    const employee = this.getById(id);
    const previousStatus = employee.status;
    
    if (previousStatus === newStatus) {
      throw new StateConflictError(`员工状态已经是 ${newStatus}，无需重复操作`);
    }
    
    const validTransitions = this._getValidTransitions(previousStatus);
    const isManualCorrection = !validTransitions.includes(newStatus);
    
    if (isManualCorrection) {
      if (!reason) {
        throw new ValidationError('人工修正状态必须提供原因');
      }
      logger.warn(`Manual status correction for employee ${id}: ${previousStatus} -> ${newStatus}`);
    }
    
    models.Employee.update(id, { status: newStatus });
    
    AuditService.log('STATUS_CHANGE', 'Employee', id, userId, {
      previousStatus,
      newStatus,
      reason: reason || (isManualCorrection ? '人工修正' : '系统自动变更'),
      isManualCorrection
    });
    
    logger.info(`Employee ${id} status changed: ${previousStatus} -> ${newStatus}`);
    return { previousStatus, newStatus, isManualCorrection };
  }

  static manuallyCorrectStatus(id, newStatus, reason, userId = 'admin') {
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('人工修正状态的原因至少需要5个字符');
    }
    
    const employee = this.getById(id);
    const previousStatus = employee.status;
    
    models.Employee.update(id, { status: newStatus });
    
    AuditService.log('MANUAL_CORRECTION', 'Employee', id, userId, {
      previousStatus,
      newStatus,
      reason,
      correctedBy: userId
    });
    
    logger.warn(`Manual correction applied to employee ${id}: ${previousStatus} -> ${newStatus} by ${userId}`);
    
    return {
      employeeId: id,
      previousStatus,
      newStatus,
      reason,
      correctedAt: new Date().toISOString()
    };
  }

  static getWithDetails(id) {
    const employee = this.getById(id);
    const documents = models.EmployeeDocument.find(d => d.employeeId === id);
    const tasks = models.RemediationTask.find(t => t.employeeId === id);
    const contracts = models.Contract.find(c => c.employeeId === id);
    const account = models.Account.findOne(a => a.employeeId === id);
    const salary = models.SalaryRecord.findOne(s => s.employeeId === id);
    const auditLogs = AuditService.getEmployeeHistory(id);
    const statusHistory = AuditService.getStatusChanges(id);
    
    return {
      ...employee,
      documents,
      tasks,
      contracts,
      account,
      salary,
      auditLogs,
      statusHistory
    };
  }

  static _getValidTransitions(currentStatus) {
    const transitions = {
      [EmployeeStatus.PENDING_REVIEW]: [EmployeeStatus.DOCUMENTS_INCOMPLETE, EmployeeStatus.DOCUMENTS_COMPLETE],
      [EmployeeStatus.DOCUMENTS_INCOMPLETE]: [EmployeeStatus.DOCUMENTS_COMPLETE, EmployeeStatus.MANUALLY_CORRECTED],
      [EmployeeStatus.DOCUMENTS_COMPLETE]: [EmployeeStatus.CONTRACT_GENERATED, EmployeeStatus.MANUALLY_CORRECTED],
      [EmployeeStatus.CONTRACT_GENERATED]: [EmployeeStatus.ACCOUNT_CREATED, EmployeeStatus.MANUALLY_CORRECTED],
      [EmployeeStatus.ACCOUNT_CREATED]: [EmployeeStatus.SALARY_ESTABLISHED, EmployeeStatus.MANUALLY_CORRECTED],
      [EmployeeStatus.SALARY_ESTABLISHED]: [EmployeeStatus.ONBOARDED, EmployeeStatus.MANUALLY_CORRECTED],
      [EmployeeStatus.MANUALLY_CORRECTED]: Object.values(EmployeeStatus),
      [EmployeeStatus.ONBOARDED]: [EmployeeStatus.MANUALLY_CORRECTED]
    };
    
    return transitions[currentStatus] || [];
  }
}

module.exports = EmployeeService;
