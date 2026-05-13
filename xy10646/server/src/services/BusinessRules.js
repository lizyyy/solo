const moment = require('moment');
const { FlowRecord, SampleRecord, AuditLog, SampleBottle } = require('../models');

const TIMEOUT_HOURS = 24;

class BusinessRulesService {
  static async checkPreservativeChange(sampleRecordId, newPreservative) {
    const sample = await SampleRecord.findByPk(sampleRecordId);
    if (!sample) {
      return { valid: false, message: '样品记录不存在' };
    }

    const oldPreservative = sample.preservative;
    if (oldPreservative && oldPreservative !== newPreservative) {
      return {
        valid: true,
        changed: true,
        oldValue: oldPreservative,
        newValue: newPreservative,
        message: `保存剂已变更: ${oldPreservative} → ${newPreservative}`
      };
    }

    return { valid: true, changed: false };
  }

  static async checkTransportInterception(flowData) {
    const { sampleRecordId, operationTime } = flowData;
    
    const lastReceive = await FlowRecord.findOne({
      where: {
        sampleRecordId,
        flowType: 'receive'
      },
      order: [['operationTime', 'DESC']]
    });

    if (lastReceive) {
      return {
        intercepted: true,
        reason: '该样品已完成接收，不能重复运输',
        valid: false
      };
    }

    return { intercepted: false, valid: true };
  }

  static async checkTimeoutReceive(flowData) {
    const { sampleRecordId, operationTime } = flowData;
    
    const sampleRecord = await SampleRecord.findByPk(sampleRecordId);
    if (!sampleRecord) {
      return { timeout: false, valid: false, message: '样品记录不存在' };
    }

    const samplingTime = moment(sampleRecord.samplingTime);
    const receiveTime = moment(operationTime);
    const hoursDiff = receiveTime.diff(samplingTime, 'hours');

    if (hoursDiff > TIMEOUT_HOURS) {
      return {
        timeout: true,
        hours: hoursDiff,
        limit: TIMEOUT_HOURS,
        message: `接收超时: 采样后${hoursDiff}小时接收，超过${TIMEOUT_HOURS}小时限制`,
        valid: false
      };
    }

    return { timeout: false, hours: hoursDiff, valid: true };
  }

  static async checkDuplicateSubmission(sampleRecordId, flowType) {
    const existingFlow = await FlowRecord.findOne({
      where: {
        sampleRecordId,
        flowType
      }
    });

    if (existingFlow) {
      return {
        duplicate: true,
        existingFlow,
        message: `该样品已存在${flowType}类型的流转记录`,
        valid: false
      };
    }

    return { duplicate: false, valid: true };
  }

  static async logAudit(entityType, entityId, fieldName, oldValue, newValue, operator) {
    await AuditLog.create({
      entityType,
      entityId,
      fieldName,
      oldValue: String(oldValue || ''),
      newValue: String(newValue || ''),
      operator,
      operationTime: new Date()
    });
  }

  static async validateFlowRecord(flowData) {
    const errors = [];
    const warnings = [];

    const duplicateCheck = await this.checkDuplicateSubmission(
      flowData.sampleRecordId,
      flowData.flowType
    );
    if (!duplicateCheck.valid) {
      errors.push(duplicateCheck.message);
    }

    if (flowData.flowType === 'transport') {
      const interceptCheck = await this.checkTransportInterception(flowData);
      if (!interceptCheck.valid) {
        errors.push(interceptCheck.reason);
      }
    }

    if (flowData.flowType === 'receive') {
      const timeoutCheck = await this.checkTimeoutReceive(flowData);
      if (!timeoutCheck.valid) {
        warnings.push(timeoutCheck.message);
        flowData.isTimeout = true;
        flowData.timeoutReason = timeoutCheck.message;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      flowData
    };
  }

  static async updateSampleRecordWithAudit(sampleId, updateData, operator) {
    const sample = await SampleRecord.findByPk(sampleId);
    if (!sample) {
      throw new Error('样品记录不存在');
    }

    const auditFields = ['samplingPointId', 'bottleId', 'preservative'];
    
    for (const field of auditFields) {
      if (updateData[field] !== undefined && updateData[field] !== sample[field]) {
        await this.logAudit(
          'sampleRecord',
          sampleId,
          field,
          sample[field],
          updateData[field],
          operator
        );
      }
    }

    await sample.update(updateData);
    return sample;
  }
}

module.exports = BusinessRulesService;
