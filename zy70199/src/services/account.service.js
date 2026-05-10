const { models, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, DuplicateOperationError, StateConflictError } = require('../utils/error-handler');
const AuditService = require('./audit.service');
const EmployeeService = require('./employee.service');
const ContractService = require('./contract.service');

class AccountService {
  static canCreate(employeeId) {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${employeeId}`);
    }
    
    const validStatuses = [
      EmployeeStatus.CONTRACT_GENERATED,
      EmployeeStatus.MANUALLY_CORRECTED
    ];
    
    if (!validStatuses.includes(employee.status)) {
      return {
        canCreate: false,
        reason: `员工状态为 ${employee.status}，需要先生成合同`,
        requiredStatus: 'CONTRACT_GENERATED'
      };
    }
    
    const existingAccount = models.Account.findOne(a => a.employeeId === employeeId);
    if (existingAccount) {
      return {
        canCreate: false,
        reason: '该员工已有账号',
        existingAccount: {
          id: existingAccount.id,
          username: existingAccount.username,
          status: existingAccount.status
        }
      };
    }
    
    const latestContract = ContractService.getLatestContract(employeeId);
    if (!latestContract) {
      return {
        canCreate: false,
        reason: '该员工尚未生成合同，无法创建账号'
      };
    }
    
    return {
      canCreate: true,
      employeeName: employee.name,
      employeeStatus: employee.status
    };
  }

  static create(employeeId, accountData, userId = 'system') {
    const checkResult = this.canCreate(employeeId);
    
    if (!checkResult.canCreate) {
      throw new ValidationError(checkResult.reason);
    }
    
    const employee = models.Employee.findById(employeeId);
    
    const username = accountData.username || this._generateUsername(employee.email);
    
    const account = models.Account.create({
      employeeId,
      employeeName: employee.name,
      username,
      email: accountData.email || employee.email,
      domain: accountData.domain || 'company.com',
      role: accountData.role || 'EMPLOYEE',
      department: employee.department,
      permissions: accountData.permissions || [],
      createdBy: userId,
      status: 'ACTIVE'
    });
    
    AuditService.log('ACCOUNT_CREATED', 'Account', account.id, userId, {
      employeeId,
      username: account.username,
      role: account.role
    });
    
    EmployeeService.updateStatus(employeeId, EmployeeStatus.ACCOUNT_CREATED, '账号已创建', userId);
    
    logger.info(`Account ${account.username} created for employee ${employeeId}`);
    return account;
  }

  static getById(id) {
    const account = models.Account.findById(id);
    if (!account) {
      throw new NotFoundError(`账号不存在: ${id}`);
    }
    return account;
  }

  static getByEmployeeId(employeeId) {
    return models.Account.findOne(a => a.employeeId === employeeId);
  }

  static updatePermissions(accountId, permissions, userId = 'admin') {
    const account = this.getById(accountId);
    
    models.Account.update(accountId, {
      permissions,
      updatedBy: userId
    });
    
    AuditService.log('ACCOUNT_PERMISSIONS_UPDATED', 'Account', accountId, userId, {
      employeeId: account.employeeId,
      previousPermissions: account.permissions,
      newPermissions: permissions
    });
    
    logger.info(`Account ${account.username} permissions updated`);
    return models.Account.findById(accountId);
  }

  static deactivate(accountId, reason, userId = 'admin') {
    const account = this.getById(accountId);
    
    if (account.status === 'INACTIVE') {
      throw new DuplicateOperationError('该账号已停用');
    }
    
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('停用原因至少需要5个字符');
    }
    
    models.Account.update(accountId, {
      status: 'INACTIVE',
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: userId,
      deactivationReason: reason
    });
    
    AuditService.log('ACCOUNT_DEACTIVATED', 'Account', accountId, userId, {
      employeeId: account.employeeId,
      username: account.username,
      reason
    });
    
    logger.warn(`Account ${account.username} deactivated: ${reason}`);
    return models.Account.findById(accountId);
  }

  static _generateUsername(email) {
    if (!email) return 'user_' + Date.now();
    const atIndex = email.indexOf('@');
    return atIndex > 0 ? email.substring(0, atIndex) : email.replace(/[^a-zA-Z0-9]/g, '_');
  }
}

module.exports = AccountService;
