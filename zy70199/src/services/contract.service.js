const { models, EmployeeStatus } = require('../models');
const logger = require('../utils/logger');
const { NotFoundError, DocumentMissingError, DuplicateOperationError, ValidationError } = require('../utils/error-handler');
const AuditService = require('./audit.service');
const DocumentService = require('./document.service');
const EmployeeService = require('./employee.service');

class ContractService {
  static canGenerate(employeeId) {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${employeeId}`);
    }
    
    const validStatuses = [
      EmployeeStatus.DOCUMENTS_COMPLETE,
      EmployeeStatus.MANUALLY_CORRECTED
    ];
    
    if (!validStatuses.includes(employee.status)) {
      return {
        canGenerate: false,
        reason: `员工状态为 ${employee.status}，需要先完成资料审核`,
        requiredStatus: 'DOCUMENTS_COMPLETE'
      };
    }
    
    const missingDocs = DocumentService.getMissingRequiredDocuments(employeeId);
    if (missingDocs.length > 0) {
      return {
        canGenerate: false,
        reason: `仍有 ${missingDocs.length} 项必填资料未完成`,
        missingDocuments: missingDocs.map(d => ({
          id: d.id,
          name: d.name,
          status: d.status
        }))
      };
    }
    
    return {
      canGenerate: true,
      employeeName: employee.name,
      employeeStatus: employee.status
    };
  }

  static generate(employeeId, contractData, userId = 'system') {
    const checkResult = this.canGenerate(employeeId);
    
    if (!checkResult.canGenerate) {
      if (checkResult.missingDocuments) {
        throw new DocumentMissingError(checkResult.reason, checkResult.missingDocuments);
      }
      throw new ValidationError(checkResult.reason);
    }
    
    const employee = models.Employee.findById(employeeId);
    const existingContracts = models.Contract.find(c => c.employeeId === employeeId);
    
    const contract = models.Contract.create({
      employeeId,
      employeeName: employee.name,
      contractType: contractData.contractType || 'FULL_TIME',
      startDate: contractData.startDate || employee.hireDate,
      endDate: contractData.endDate,
      salary: contractData.salary,
      position: contractData.position || employee.position,
      department: contractData.department || employee.department,
      terms: contractData.terms,
      version: existingContracts.length + 1,
      generatedBy: userId,
      status: 'GENERATED'
    });
    
    AuditService.log('CONTRACT_GENERATED', 'Contract', contract.id, userId, {
      employeeId,
      version: contract.version,
      contractType: contract.contractType
    });
    
    EmployeeService.updateStatus(employeeId, EmployeeStatus.CONTRACT_GENERATED, '合同已生成', userId);
    
    logger.info(`Contract ${contract.id} (v${contract.version}) generated for employee ${employeeId}`);
    return contract;
  }

  static getById(id) {
    const contract = models.Contract.findById(id);
    if (!contract) {
      throw new NotFoundError(`合同不存在: ${id}`);
    }
    return contract;
  }

  static getEmployeeContracts(employeeId) {
    const contracts = models.Contract.find(c => c.employeeId === employeeId);
    return contracts.sort((a, b) => b.version - a.version);
  }

  static getLatestContract(employeeId) {
    const contracts = this.getEmployeeContracts(employeeId);
    if (contracts.length === 0) {
      return null;
    }
    return contracts[0];
  }

  static regenerate(employeeId, contractData, userId = 'system') {
    const employee = models.Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError(`员工不存在: ${employeeId}`);
    }
    
    const existingContracts = models.Contract.find(c => c.employeeId === employeeId);
    if (existingContracts.length === 0) {
      throw new ValidationError('该员工尚无合同，请先生成合同');
    }
    
    const latestContract = existingContracts.reduce((latest, c) => 
      c.version > latest.version ? c : latest
    , existingContracts[0]);
    
    const newContract = models.Contract.create({
      employeeId,
      employeeName: employee.name,
      contractType: contractData.contractType || latestContract.contractType,
      startDate: contractData.startDate || latestContract.startDate,
      endDate: contractData.endDate,
      salary: contractData.salary || latestContract.salary,
      position: contractData.position || latestContract.position,
      department: contractData.department || latestContract.department,
      terms: contractData.terms,
      version: latestContract.version + 1,
      generatedBy: userId,
      status: 'GENERATED',
      replacesContractId: latestContract.id
    });
    
    AuditService.log('CONTRACT_REGENERATED', 'Contract', newContract.id, userId, {
      employeeId,
      newVersion: newContract.version,
      replacesContractId: latestContract.id
    });
    
    logger.info(`Contract ${newContract.id} (v${newContract.version}) regenerated for employee ${employeeId}, replaces ${latestContract.id}`);
    return newContract;
  }

  static sign(contractId, userId = 'admin') {
    const contract = this.getById(contractId);
    
    if (contract.status === 'SIGNED') {
      throw new DuplicateOperationError('该合同已签署');
    }
    
    models.Contract.update(contractId, {
      status: 'SIGNED',
      signedAt: new Date().toISOString(),
      signedBy: userId
    });
    
    AuditService.log('CONTRACT_SIGNED', 'Contract', contractId, userId, {
      employeeId: contract.employeeId,
      version: contract.version
    });
    
    logger.info(`Contract ${contractId} signed by ${userId}`);
    return models.Contract.findById(contractId);
  }
}

module.exports = ContractService;
