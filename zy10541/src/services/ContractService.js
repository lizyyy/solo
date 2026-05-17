const { Contract, CONTRACT_STATUSES } = require('../models/Contract');
const { ExceptionRecord, EXCEPTION_TYPES, BUSINESS_RULES } = require('../models/ExceptionRecord');
const { ContractStore, ExceptionStore } = require('../utils/storage');
const { exportToJSON, exportToCSV } = require('../utils/exporter');
const { v4: uuidv4 } = require('uuid');

class ContractService {
  constructor() {
    this.contractStore = new ContractStore();
    this.exceptionStore = new ExceptionStore();
  }

  createContract(data) {
    const requestId = uuidv4();
    
    if (this.contractStore.exists(data.contractNo)) {
      const exception = new ExceptionRecord({
        requestId,
        exceptionType: EXCEPTION_TYPES.BUSINESS_RULE_ERROR,
        contractNo: data.contractNo,
        originalInput: JSON.parse(JSON.stringify(data)),
        errorMessage: '合同编号已存在',
        businessRule: BUSINESS_RULES.CONTRACT_NO_UNIQUE,
        processingBasis: ['合同编号唯一性校验失败', `已存在合同: ${data.contractNo}`]
      });
      this.exceptionStore.save(exception.toJSON());
      throw new Error(`合同编号 ${data.contractNo} 已存在`);
    }

    const contract = new Contract(data);
    
    const scopeValidation = contract.validateServiceScope();
    const priceValidation = contract.validatePrice();
    
    const validationErrors = [];
    
    if (!scopeValidation.valid) {
      validationErrors.push(`服务范围包含非法项: ${scopeValidation.invalidItems.join(', ')}`);
    }
    
    if (!priceValidation.valid) {
      validationErrors.push(priceValidation.message);
    }
    
    if (validationErrors.length > 0) {
      const exception = new ExceptionRecord({
        requestId,
        exceptionType: EXCEPTION_TYPES.VALIDATION_ERROR,
        contractNo: data.contractNo,
        originalInput: JSON.parse(JSON.stringify(data)),
        errorMessage: validationErrors.join('; '),
        businessRule: `${!scopeValidation.valid ? BUSINESS_RULES.SERVICE_SCOPE_VALID : ''} ${!priceValidation.valid ? BUSINESS_RULES.PRICE_NON_NEGATIVE : ''}`.trim(),
        processingBasis: [
          !scopeValidation.valid ? `服务范围校验失败: ${scopeValidation.invalidItems.join(', ')}` : '',
          !priceValidation.valid ? `价格校验失败: ${priceValidation.message}` : '',
          `允许的服务范围: ${scopeValidation.allowedScopes.join(', ')}`
        ].filter(Boolean)
      });
      this.exceptionStore.save(exception.toJSON());
      throw new Error(validationErrors.join('; '));
    }

    this.contractStore.save(contract.toJSON());
    return contract.toJSON();
  }

  getContract(contractNo) {
    return this.contractStore.findByContractNo(contractNo);
  }

  getAllContracts() {
    return this.contractStore.findAll();
  }

  transitionStatus(contractNo, action, operator, comment = '') {
    const contractData = this.contractStore.findByContractNo(contractNo);
    if (!contractData) {
      throw new Error('合同不存在');
    }

    const actionToStatus = {
      'SUBMIT': CONTRACT_STATUSES.SUBMITTED,
      'REVIEW': CONTRACT_STATUSES.REVIEWED,
      'START_SYNC': CONTRACT_STATUSES.SYNCING,
      'COMPLETE': CONTRACT_STATUSES.EFFECTIVE,
      'MARK_EXCEPTION': CONTRACT_STATUSES.EXCEPTION,
      'CORRECT': CONTRACT_STATUSES.CORRECTED,
      'BACK_TO_DRAFT': CONTRACT_STATUSES.DRAFT
    };

    const targetStatus = actionToStatus[action];
    if (!targetStatus) {
      throw new Error(`不支持的操作: ${action}`);
    }

    const contract = Object.assign(new Contract({
      contractNo,
      customerName: contractData.customerName,
      version: contractData.version,
      effectiveDate: contractData.effectiveDate,
      price: contractData.price,
      serviceScope: contractData.serviceScope,
      createdBy: contractData.createdBy
    }), contractData);

    try {
      contract.transitionStatus(targetStatus, operator, comment);
      this.contractStore.save(contract.toJSON());
      return contract.toJSON();
    } catch (error) {
      const exception = new ExceptionRecord({
        requestId: uuidv4(),
        exceptionType: EXCEPTION_TYPES.STATUS_TRANSITION_ERROR,
        contractNo: contractNo,
        originalInput: { action, operator, comment },
        errorMessage: error.message,
        businessRule: null,
        processingBasis: [`当前状态: ${contractData.status}`, `目标状态: ${targetStatus}`, error.message]
      });
      this.exceptionStore.save(exception.toJSON());
      throw error;
    }
  }

  syncToBusinessSystem(contractNo, targetSystem, operator) {
    const contractData = this.contractStore.findByContractNo(contractNo);
    if (!contractData) {
      throw new Error('合同不存在');
    }

    const contract = Object.assign(new Contract({
      contractNo,
      customerName: contractData.customerName,
      version: contractData.version,
      effectiveDate: contractData.effectiveDate,
      price: contractData.price,
      serviceScope: contractData.serviceScope,
      createdBy: contractData.createdBy
    }), contractData);

    const syncData = {
      contractNo: contract.contractNo,
      version: contract.version,
      price: contract.price,
      serviceScope: contract.serviceScope,
      effectiveDate: contract.effectiveDate
    };

    contract.addSyncRecord({
      targetSystem,
      status: 'SYNCING',
      requestData: syncData,
      operator
    });

    const mockSuccess = Math.random() > 0.3;
    
    if (mockSuccess) {
      contract.addSyncRecord({
        targetSystem,
        status: 'SUCCESS',
        requestData: syncData,
        responseData: { code: 200, message: '同步成功', syncTime: new Date().toISOString() },
        operator
      });
      
      if (contract.status === CONTRACT_STATUSES.SYNCING) {
        contract.transitionStatus(CONTRACT_STATUSES.EFFECTIVE, 'SYSTEM', '业务系统同步成功，合同生效');
      }
    } else {
      contract.addSyncRecord({
        targetSystem,
        status: 'FAILED',
        requestData: syncData,
        responseData: { code: 500, message: '业务系统暂时不可用，请重试' },
        errorMessage: '业务系统暂时不可用，请重试',
        operator
      });

      const exception = new ExceptionRecord({
        requestId: uuidv4(),
        exceptionType: EXCEPTION_TYPES.SYNC_ERROR,
        contractNo: contractNo,
        originalInput: { targetSystem, syncData },
        errorMessage: '业务系统同步失败',
        businessRule: null,
        processingBasis: ['业务系统调用超时', '请检查网络连接或稍后重试']
      });
      this.exceptionStore.save(exception.toJSON());
    }

    this.contractStore.save(contract.toJSON());
    return contract.toJSON();
  }

  correctContract(contractNo, correctionData) {
    const contractData = this.contractStore.findByContractNo(contractNo);
    if (!contractData) {
      throw new Error('合同不存在');
    }

    const contract = Object.assign(new Contract({
      contractNo,
      customerName: contractData.customerName,
      version: contractData.version,
      effectiveDate: contractData.effectiveDate,
      price: contractData.price,
      serviceScope: contractData.serviceScope,
      createdBy: contractData.createdBy
    }), contractData);

    contract.addCorrection(correctionData);

    if (correctionData.correctionType === 'PRICE_ADJUST') {
      contract.price = correctionData.newValue;
    } else if (correctionData.correctionType === 'SCOPE_ADJUST') {
      contract.serviceScope = correctionData.newValue;
    } else if (correctionData.correctionType === 'VERSION_UPDATE') {
      contract.version = correctionData.newValue;
    }

    if (contract.status === CONTRACT_STATUSES.EXCEPTION) {
      contract.transitionStatus(CONTRACT_STATUSES.CORRECTED, correctionData.operator, '异常已人工修正');
    }

    this.contractStore.save(contract.toJSON());
    return contract.toJSON();
  }

  exportReport(contractNo, format = 'json') {
    const contract = this.contractStore.findByContractNo(contractNo);
    if (!contract) {
      throw new Error('合同不存在');
    }

    if (format === 'csv') {
      return exportToCSV(contract);
    }
    return exportToJSON(contract);
  }

  getAllExceptions() {
    return this.exceptionStore.findAll();
  }

  getContractExceptions(contractNo) {
    return this.exceptionStore.findByContractNo(contractNo);
  }

  resolveException(exceptionId, handler, note) {
    return this.exceptionStore.markResolved(exceptionId, handler, note);
  }
}

module.exports = ContractService;