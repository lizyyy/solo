const {
  STABLE_COLUMN_ORDER,
  STATUS_TYPES,
  INSURANCE_STATUS,
  OPERATION_TYPES,
  validateIdCard,
  normalizeRecord,
  createRecordId
} = require('./models');

class InsuranceListProcessor {
  constructor(options = {}) {
    this.records = new Map();
    this.auditLog = [];
    this.currentOperator = options.operator || 'system';
    this.idempotencyKey = options.idempotencyKey || null;
    this.processedOperations = new Set();
    this.stats = {
      total: 0,
      teamChanges: 0,
      withdrawals: 0,
      idCardCorrections: 0,
      insuranceUpdates: 0
    };
  }

  setOperator(operator) {
    this.currentOperator = operator;
  }

  setIdempotencyKey(key) {
    this.idempotencyKey = key;
  }

  isOperationProcessed(operationId) {
    return this.processedOperations.has(operationId);
  }

  markOperationProcessed(operationId) {
    this.processedOperations.add(operationId);
  }

  loadRecords(recordsData) {
    recordsData.forEach(record => {
      const normalized = normalizeRecord(record);
      if (!normalized.recordId) {
        normalized.recordId = createRecordId(normalized.studyProgramId, normalized.participantId);
      }
      this.records.set(normalized.recordId, normalized);
      this.stats.total++;
    });
    
    this._addAuditLog({
      operation: OPERATION_TYPES.CREATE,
      details: `批量加载 ${recordsData.length} 条记录`,
      operator: this.currentOperator
    });
    
    return this;
  }

  changeTeam(recordId, newTeamId, newTeamName, reason = '') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录不存在: ${recordId}`);
    }

    const oldTeamId = record.teamId;
    const oldTeamName = record.teamName;
    
    if (oldTeamId === newTeamId) {
      return { success: false, message: '队伍未变化', record };
    }

    record.teamId = newTeamId;
    record.teamName = newTeamName;
    record.status = STATUS_TYPES.TEAM_CHANGED;
    record.statusChangeDate = new Date().toISOString().split('T')[0];
    record.operator = this.currentOperator;
    
    this.stats.teamChanges++;
    
    this._addAuditLog({
      operation: OPERATION_TYPES.TEAM_CHANGE,
      recordId,
      participantName: record.participantName,
      oldValue: { teamId: oldTeamId, teamName: oldTeamName },
      newValue: { teamId: newTeamId, teamName: newTeamName },
      reason,
      operator: this.currentOperator
    });

    return { success: true, message: '改队成功', record };
  }

  withdraw(recordId, reason = '') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录不存在: ${recordId}`);
    }

    if (record.status === STATUS_TYPES.WITHDRAWN) {
      return { success: false, message: '已处于退团状态', record };
    }

    const oldStatus = record.status;
    const oldInsuranceStatus = record.insuranceStatus;
    
    record.status = STATUS_TYPES.WITHDRAWN;
    record.insuranceStatus = INSURANCE_STATUS.REFUNDED;
    record.statusChangeDate = new Date().toISOString().split('T')[0];
    record.operator = this.currentOperator;
    
    this.stats.withdrawals++;
    
    this._addAuditLog({
      operation: OPERATION_TYPES.WITHDRAW,
      recordId,
      participantName: record.participantName,
      oldValue: { status: oldStatus, insuranceStatus: oldInsuranceStatus },
      newValue: { status: STATUS_TYPES.WITHDRAWN, insuranceStatus: INSURANCE_STATUS.REFUNDED },
      reason,
      operator: this.currentOperator
    });

    return { success: true, message: '退团成功', record };
  }

  correctIdCard(recordId, newIdCard, reason = '') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录不存在: ${recordId}`);
    }

    const validation = validateIdCard(newIdCard);
    if (!validation.valid) {
      return { success: false, message: validation.error, record };
    }

    const oldIdCard = record.idCardNumber;
    
    if (oldIdCard === validation.normalized) {
      return { success: false, message: '身份证号未变化', record };
    }

    record.idCardNumber = validation.normalized;
    record.idCardType = validation.type;
    record.operator = this.currentOperator;
    
    this.stats.idCardCorrections++;
    
    this._addAuditLog({
      operation: OPERATION_TYPES.ID_CARD_CORRECT,
      recordId,
      participantName: record.participantName,
      oldValue: { idCardNumber: oldIdCard },
      newValue: { idCardNumber: validation.normalized, type: validation.type },
      reason,
      operator: this.currentOperator
    });

    return { success: true, message: '身份证修正成功', record, validation };
  }

  updateInsurance(recordId, insuranceStatus, reason = '') {
    const record = this.records.get(recordId);
    if (!record) {
      throw new Error(`记录不存在: ${recordId}`);
    }

    const oldInsuranceStatus = record.insuranceStatus;
    
    if (oldInsuranceStatus === insuranceStatus) {
      return { success: false, message: '保险状态未变化', record };
    }

    record.insuranceStatus = insuranceStatus;
    record.operator = this.currentOperator;
    
    if (insuranceStatus === INSURANCE_STATUS.SUCCESS) {
      record.status = STATUS_TYPES.INSURED;
    }
    
    this.stats.insuranceUpdates++;
    
    this._addAuditLog({
      operation: insuranceStatus === INSURANCE_STATUS.SUCCESS 
        ? OPERATION_TYPES.INSURANCE_SUCCESS 
        : OPERATION_TYPES.INSURANCE_FAIL,
      recordId,
      participantName: record.participantName,
      oldValue: { insuranceStatus: oldInsuranceStatus },
      newValue: { insuranceStatus },
      reason,
      operator: this.currentOperator
    });

    return { success: true, message: '保险状态更新成功', record };
  }

  validateAllIdCards() {
    const results = [];
    this.records.forEach((record, recordId) => {
      const validation = validateIdCard(record.idCardNumber);
      results.push({
        recordId,
        participantName: record.participantName,
        idCardNumber: record.idCardNumber,
        ...validation
      });
    });
    return results;
  }

  getRecords() {
    return Array.from(this.records.values())
      .sort((a, b) => a.recordId.localeCompare(b.recordId));
  }

  getRecordsForOutput() {
    return this.getRecords().map(record => {
      const output = {};
      STABLE_COLUMN_ORDER.forEach(key => {
        output[key] = record[key];
      });
      return output;
    });
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  getStats() {
    return { ...this.stats };
  }

  getSummary() {
    const records = this.getRecords();
    const statusCounts = {};
    const insuranceCounts = {};
    const teamCounts = {};

    records.forEach(record => {
      statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
      insuranceCounts[record.insuranceStatus] = (insuranceCounts[record.insuranceStatus] || 0) + 1;
      if (record.teamName) {
        teamCounts[record.teamName] = (teamCounts[record.teamName] || 0) + 1;
      }
    });

    return {
      total: records.length,
      byStatus: statusCounts,
      byInsuranceStatus: insuranceCounts,
      byTeam: teamCounts,
      operations: this.stats
    };
  }

  _addAuditLog(entry) {
    this.auditLog.push({
      ...entry,
      timestamp: new Date().toISOString(),
      idempotencyKey: this.idempotencyKey
    });
  }
}

module.exports = { InsuranceListProcessor };
