const CreditRecord = require('../models/CreditRecord');
const { SourceType, SourceTypeLabel, RecordStatus, OperationType, OperationTypeLabel } = require('../models/constants');
const { BusinessError, ErrorMessages } = require('../utils/BusinessError');

class FundLevelService {
  constructor() {
    this.records = [];
    this.accounts = [];
  }

  addAccount(account) {
    if (!account.id) {
      const error = ErrorMessages.MISSING_REQUIRED('id', '账户编号');
      throw new BusinessError(error.message, error.code, error.details);
    }
    if (!account.name) {
      const error = ErrorMessages.MISSING_REQUIRED('name', '账户名称');
      throw new BusinessError(error.message, error.code, error.details);
    }
    this.accounts.push(account);
    return account;
  }

  getAccounts() {
    return this.accounts.map(a => a.toJSON());
  }

  getAccountById(accountId) {
    return this.accounts.find(a => a.id === accountId);
  }

  addCreditRecord(data, operator = 'system') {
    this._validateCreditData(data);

    const duplicates = this._findDuplicates(data);
    if (duplicates.length > 0) {
      const existingRecord = duplicates[0];
      const error = ErrorMessages.DUPLICATE_CREDIT(
        data.accountName,
        SourceTypeLabel[data.sourceType] || data.sourceType,
        SourceTypeLabel[existingRecord.sourceType] || existingRecord.sourceType,
        existingRecord.handler
      );
      throw new BusinessError(error.message, error.code, {
        ...error.details,
        existingRecord: existingRecord.toJSON(),
        isDuplicate: true
      });
    }

    const record = new CreditRecord(data);
    this.records.push(record);
    return record.toJSON();
  }

  _validateCreditData(data) {
    if (!data.accountId) {
      const error = ErrorMessages.MISSING_REQUIRED('accountId', '账户编号');
      throw new BusinessError(error.message, error.code, error.details);
    }
    if (!data.accountName) {
      const error = ErrorMessages.MISSING_REQUIRED('accountName', '账户名称');
      throw new BusinessError(error.message, error.code, error.details);
    }
    if (!data.creditAmount || isNaN(Number(data.creditAmount))) {
      const error = ErrorMessages.INVALID_AMOUNT('授信额度', data.creditAmount);
      throw new BusinessError(error.message, error.code, error.details);
    }
    if (data.usedAmount !== undefined && isNaN(Number(data.usedAmount))) {
      const error = ErrorMessages.INVALID_AMOUNT('已用额度', data.usedAmount);
      throw new BusinessError(error.message, error.code, error.details);
    }
    if (!data.sourceType || !SourceType[data.sourceType.toUpperCase()]) {
      const error = ErrorMessages.INVALID_SOURCE_TYPE(data.sourceType);
      throw new BusinessError(error.message, error.code, error.details);
    }
  }

  _findDuplicates(data) {
    return this.records.filter(r => 
      r.accountId === data.accountId && 
      r.sourceDate === data.sourceDate &&
      r.status !== RecordStatus.MANUALLY_MODIFIED
    );
  }

  updateCreditRecord(recordId, data, operator = 'system') {
    const record = this.records.find(r => r.id === recordId);
    if (!record) {
      const error = ErrorMessages.RECORD_NOT_FOUND(recordId);
      throw new BusinessError(error.message, error.code, error.details);
    }

    if (data.creditAmount !== undefined && (isNaN(Number(data.creditAmount)) || Number(data.creditAmount) < 0)) {
      const error = ErrorMessages.INVALID_AMOUNT('授信额度', data.creditAmount);
      throw new BusinessError(error.message, error.code, error.details);
    }

    record.update(data, operator);
    return record.toJSON();
  }

  getCreditRecords(filters = {}) {
    let result = [...this.records];

    if (filters.accountId) {
      result = result.filter(r => r.accountId === filters.accountId);
    }
    if (filters.status) {
      result = result.filter(r => r.status === filters.status);
    }
    if (filters.sourceType) {
      result = result.filter(r => r.sourceType === filters.sourceType);
    }
    if (filters.operationType) {
      result = result.filter(r => r.operationType === filters.operationType);
    }

    return result.map(r => r.toJSON()).sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  getCreditRecordById(recordId) {
    const record = this.records.find(r => r.id === recordId);
    return record ? record.toJSON() : null;
  }

  getReviewList() {
    const records = this.records.map(r => r.toJSON());
    
    return {
      confirmed: records.filter(r => r.status === RecordStatus.CONFIRMED).map(r => ({
        ...r,
        processingGuide: '该记录已确认无误，可用于后续资金核算。如有疑问，请联系原录入人员核实。'
      })),
      pendingSupplement: records.filter(r => r.status === RecordStatus.PENDING_SUPPLEMENT).map(r => ({
        ...r,
        processingGuide: this._getPendingGuide(r)
      })),
      manuallyModified: records.filter(r => r.status === RecordStatus.MANUALLY_MODIFIED).map(r => ({
        ...r,
        processingGuide: '该记录经过人工修改，请重点复核历史变更记录。如有不一致，请与修改人员确认口径。'
      }))
    };
  }

  _getPendingGuide(record) {
    const sourceLabel = SourceTypeLabel[record.sourceType] || record.sourceType;
    if (record.operationType === OperationType.MATERIAL_SUPPLEMENT) {
      return `该记录来自${sourceLabel}，当前仅作为补充材料归档。如需正式生效，请联系${record.handler || '客户经理'}确认后标记为"已确认"。`;
    } else {
      return `该记录来自${sourceLabel}，标注为结论修改。请与${record.handler || '客户经理'}确认修改依据后，决定是否确认生效或退回重填。`;
    }
  }

  getFundLevelSummary() {
    const summary = {};
    
    this.accounts.forEach(account => {
      const accountRecords = this.records.filter(r => 
        r.accountId === account.id && 
        r.status === RecordStatus.CONFIRMED
      );

      const totalCredit = accountRecords.reduce((sum, r) => sum + r.creditAmount, 0);
      const totalUsed = accountRecords.reduce((sum, r) => sum + r.usedAmount, 0);
      
      summary[account.id] = {
        accountId: account.id,
        accountName: account.name,
        customerName: account.customerName,
        branch: account.branch,
        totalCredit,
        totalUsed,
        availableAmount: totalCredit - totalUsed,
        usageRate: totalCredit > 0 ? (totalUsed / totalCredit * 100).toFixed(2) + '%' : '0%',
        recordCount: accountRecords.length,
        hasPending: this.records.some(r => 
          r.accountId === account.id && 
          r.status === RecordStatus.PENDING_SUPPLEMENT
        ),
        hasModified: this.records.some(r => 
          r.accountId === account.id && 
          r.status === RecordStatus.MANUALLY_MODIFIED
        )
      };
    });

    return Object.values(summary);
  }

  deleteCreditRecord(recordId) {
    const index = this.records.findIndex(r => r.id === recordId);
    if (index === -1) {
      const error = ErrorMessages.RECORD_NOT_FOUND(recordId);
      throw new BusinessError(error.message, error.code, error.details);
    }
    this.records.splice(index, 1);
    return true;
  }
}

module.exports = FundLevelService;
