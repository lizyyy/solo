const Return = require('../models/return');
const Batch = require('../models/batch');
const Prescription = require('../models/prescription');
const Responsibility = require('../models/responsibility');
const { RETURN_STATUS, BATCH_STATUS, PRESCRIPTION_STATUS, DEPARTMENTS, RETURN_REASONS } = require('../utils/enums');
const { ERROR_CODES } = require('../utils/response');

class ReturnService {
  static async submitReturn(data) {
    const required = ['prescriptionId', 'batchId', 'reason', 'returnedBy'];
    for (const field of required) {
      if (!data[field]) {
        return { error: { code: ERROR_CODES.BAD_REQUEST, message: `缺少必填字段: ${field}` } };
      }
    }
    
    const validReasons = Object.values(RETURN_REASONS);
    if (!validReasons.includes(data.reason)) {
      return { error: { code: ERROR_CODES.REASON_NOT_FOUND, message: '无效的返修原因' } };
    }
    
    const prescription = await Prescription.findById(data.prescriptionId);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    const batch = await Batch.findById(data.batchId);
    if (!batch) {
      return { error: { code: ERROR_CODES.BATCH_NOT_FOUND, message: '批次不存在' } };
    }
    
    if (batch.prescriptionId !== data.prescriptionId) {
      return { error: { code: ERROR_CODES.CONFLICT, message: '批次不属于该处方' } };
    }
    
    const returnRecord = await Return.create(data);
    await Prescription.updateStatus(data.prescriptionId, PRESCRIPTION_STATUS.RETURNED);
    await Prescription.updateReturnCount(data.prescriptionId);
    await Batch.updateStatus(data.batchId, BATCH_STATUS.RETURNED);
    
    return { data: returnRecord };
  }

  static async getReturn(id) {
    const returnRecord = await Return.findById(id);
    if (!returnRecord) {
      return { error: { code: ERROR_CODES.RETURN_NOT_FOUND, message: '返修申请不存在' } };
    }
    return { data: returnRecord };
  }

  static async listReturns(params = {}) {
    const returns = await Return.findAll(params);
    return { data: returns };
  }

  static async assignResponsibility(returnId, responsibilityData) {
    const returnRecord = await Return.findById(returnId);
    if (!returnRecord) {
      return { error: { code: ERROR_CODES.RETURN_NOT_FOUND, message: '返修申请不存在' } };
    }
    
    if (returnRecord.status !== RETURN_STATUS.SUBMITTED) {
      return { error: { code: ERROR_CODES.RESPONSIBILITY_ALREADY_ASSIGNED, message: '该返修申请已完成归因' } };
    }
    
    const { primaryDepartment, operator, description, severity } = responsibilityData;
    
    if (!primaryDepartment) {
      return { error: { code: ERROR_CODES.BAD_REQUEST, message: '缺少主要责任部门' } };
    }
    
    const validDepartments = Object.values(DEPARTMENTS);
    if (!validDepartments.includes(primaryDepartment)) {
      return { error: { code: ERROR_CODES.INVALID_RESPONSIBILITY_DEPARTMENT, message: '无效的责任部门' } };
    }
    
    const responsibility = await Responsibility.create({
      returnId,
      primaryDepartment,
      secondaryDepartments: responsibilityData.secondaryDepartments || [],
      operator,
      processCode: responsibilityData.processCode,
      processName: responsibilityData.processName,
      description,
      severity: severity || 'medium'
    });
    
    await Return.updateStatus(returnId, RETURN_STATUS.RESPONSIBILITY_ASSIGNED);
    
    const updatedReturn = await Return.findById(returnId);
    
    return { data: { responsibility, returnRecord: updatedReturn } };
  }

  static async startRework(returnId) {
    const returnRecord = await Return.findById(returnId);
    if (!returnRecord) {
      return { error: { code: ERROR_CODES.RETURN_NOT_FOUND, message: '返修申请不存在' } };
    }
    
    if (returnRecord.status !== RETURN_STATUS.RESPONSIBILITY_ASSIGNED) {
      return { error: { code: ERROR_CODES.STATUS_TRANSITION_INVALID, message: '需先完成责任归因才能开始返工' } };
    }
    
    await Return.updateStatus(returnId, RETURN_STATUS.REWORK_IN_PROGRESS);
    await Prescription.updateStatus(returnRecord.prescriptionId, PRESCRIPTION_STATUS.REWORK_IN_PROGRESS);
    await Batch.updateStatus(returnRecord.batchId, BATCH_STATUS.REWORKING);
    
    const updated = await Return.findById(returnId);
    return { data: updated };
  }

  static async resolveReturn(returnId, resolvedBy, resolutionNotes) {
    const returnRecord = await Return.findById(returnId);
    if (!returnRecord) {
      return { error: { code: ERROR_CODES.RETURN_NOT_FOUND, message: '返修申请不存在' } };
    }
    
    if (returnRecord.status !== RETURN_STATUS.REWORK_IN_PROGRESS) {
      return { error: { code: ERROR_CODES.STATUS_TRANSITION_INVALID, message: '只有进行中的返修可以标记为已解决' } };
    }
    
    await Return.updateStatus(returnId, RETURN_STATUS.RESOLVED, resolvedBy, resolutionNotes);
    await Prescription.updateStatus(returnRecord.prescriptionId, PRESCRIPTION_STATUS.COMPLETED);
    await Batch.updateStatus(returnRecord.batchId, BATCH_STATUS.COMPLETED);
    
    const updated = await Return.findById(returnId);
    return { data: updated };
  }

  static async getReturnWithDetails(id) {
    const returnRecord = await Return.findWithDetails(id);
    if (!returnRecord) {
      return { error: { code: ERROR_CODES.RETURN_NOT_FOUND, message: '返修申请不存在' } };
    }
    
    const responsibilities = await Responsibility.findByReturnId(id);
    
    return {
      data: {
        ...returnRecord,
        responsibilities
      }
    };
  }

  static async getReturnHistoryByPrescription(prescriptionId) {
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    const returns = await Return.findByPrescriptionId(prescriptionId);
    return { data: returns };
  }
}

module.exports = ReturnService;
