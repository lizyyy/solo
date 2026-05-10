const { models, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, DuplicateOperationError } = require('../utils/error-handler');
const AuditService = require('./audit.service');
const EmployeeService = require('./employee.service');
const ContractService = require('./contract.service');
const DocumentService = require('./document.service');

class SalaryService {
  static canEstablish(employeeId) {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${employeeId}`);
    }
    
    const validStatuses = [
      EmployeeStatus.ACCOUNT_CREATED,
      EmployeeStatus.MANUALLY_CORRECTED
    ];
    
    if (!validStatuses.includes(employee.status)) {
      return {
        canEstablish: false,
        reason: `员工状态为 ${employee.status}，需要先创建账号`,
        requiredStatus: 'ACCOUNT_CREATED'
      };
    }
    
    const existingSalary = models.SalaryRecord.findOne(s => s.employeeId === employeeId);
    if (existingSalary) {
      return {
        canEstablish: false,
        reason: '该员工已有薪资档案',
        existingSalary: {
          id: existingSalary.id,
          baseSalary: existingSalary.baseSalary,
          status: existingSalary.status
        }
      };
    }
    
    const contract = ContractService.getLatestContract(employeeId);
    if (!contract) {
      return {
        canEstablish: false,
        reason: '该员工尚未生成合同，无法建立薪资档案'
      };
    }
    
    const bankCardDoc = models.EmployeeDocument.findOne(d => 
      d.employeeId === employeeId && 
      d.catalogCode === 'BANK_CARD'
    );
    
    if (!bankCardDoc || bankCardDoc.status !== 'APPROVED') {
      return {
        canEstablish: false,
        reason: '银行卡信息尚未审批通过',
        requiredDocument: 'BANK_CARD'
      };
    }
    
    return {
      canEstablish: true,
      employeeName: employee.name,
      contractSalary: contract.salary
    };
  }

  static establish(employeeId, salaryData, userId = 'system') {
    const checkResult = this.canEstablish(employeeId);
    
    if (!checkResult.canEstablish) {
      throw new ValidationError(checkResult.reason);
    }
    
    const employee = models.Employee.findById(employeeId);
    const contract = ContractService.getLatestContract(employeeId);
    const bankCardDoc = models.EmployeeDocument.findOne(d => 
      d.employeeId === employeeId && d.catalogCode === 'BANK_CARD'
    );
    
    const salary = models.SalaryRecord.create({
      employeeId,
      employeeName: employee.name,
      baseSalary: salaryData.baseSalary || contract.salary,
      bonus: salaryData.bonus || 0,
      allowance: salaryData.allowance || 0,
      socialSecurityBase: salaryData.socialSecurityBase || salaryData.baseSalary || contract.salary,
      housingFundBase: salaryData.housingFundBase || salaryData.baseSalary || contract.salary,
      bankName: salaryData.bankName,
      bankAccount: salaryData.bankAccount || (bankCardDoc ? bankCardDoc.content : null),
      effectiveDate: salaryData.effectiveDate || contract.startDate,
      createdBy: userId,
      status: 'ACTIVE'
    });
    
    AuditService.log('SALARY_ESTABLISHED', 'SalaryRecord', salary.id, userId, {
      employeeId,
      baseSalary: salary.baseSalary,
      effectiveDate: salary.effectiveDate
    });
    
    EmployeeService.updateStatus(employeeId, EmployeeStatus.SALARY_ESTABLISHED, '薪资档案已建立', userId);
    
    logger.info(`Salary record ${salary.id} established for employee ${employeeId}`);
    return salary;
  }

  static getById(id) {
    const salary = models.SalaryRecord.findById(id);
    if (!salary) {
      throw new NotFoundError(`薪资档案不存在: ${id}`);
    }
    return salary;
  }

  static getByEmployeeId(employeeId) {
    return models.SalaryRecord.findOne(s => s.employeeId === employeeId);
  }

  static update(salaryId, updates, userId = 'admin') {
    const salary = this.getById(salaryId);
    
    const updated = models.SalaryRecord.update(salaryId, {
      ...updates,
      updatedBy: userId
    });
    
    AuditService.log('SALARY_UPDATED', 'SalaryRecord', salaryId, userId, {
      employeeId: salary.employeeId,
      previousBaseSalary: salary.baseSalary,
      newBaseSalary: updates.baseSalary || salary.baseSalary
    });
    
    logger.info(`Salary record ${salaryId} updated by ${userId}`);
    return updated;
  }

  static terminate(salaryId, reason, userId = 'admin') {
    const salary = this.getById(salaryId);
    
    if (salary.status === 'TERMINATED') {
      throw new DuplicateOperationError('该薪资档案已终止');
    }
    
    if (!reason || reason.trim().length < 5) {
      throw new ValidationError('终止原因至少需要5个字符');
    }
    
    models.SalaryRecord.update(salaryId, {
      status: 'TERMINATED',
      terminatedAt: new Date().toISOString(),
      terminatedBy: userId,
      terminationReason: reason
    });
    
    AuditService.log('SALARY_TERMINATED', 'SalaryRecord', salaryId, userId, {
      employeeId: salary.employeeId,
      reason
    });
    
    logger.warn(`Salary record ${salaryId} terminated: ${reason}`);
    return models.SalaryRecord.findById(salaryId);
  }
}

module.exports = SalaryService;
