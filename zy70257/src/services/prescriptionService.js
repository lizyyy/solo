const Prescription = require('../models/prescription');
const Batch = require('../models/batch');
const { PRESCRIPTION_STATUS } = require('../utils/enums');
const { ERROR_CODES } = require('../utils/response');

class PrescriptionService {
  static async createPrescription(data) {
    const required = ['doctorName', 'patientName', 'clinic', 'toothPosition', 'dentureType'];
    for (const field of required) {
      if (!data[field]) {
        return { error: { code: ERROR_CODES.BAD_REQUEST, message: `缺少必填字段: ${field}` } };
      }
    }
    
    const prescription = await Prescription.create(data);
    return { data: prescription };
  }

  static async getPrescription(id) {
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    return { data: prescription };
  }

  static async listPrescriptions(params = {}) {
    const prescriptions = await Prescription.findAll(params);
    return { data: prescriptions };
  }

  static async updatePrescriptionStatus(id, status) {
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    await Prescription.updateStatus(id, status);
    const updated = await Prescription.findById(id);
    return { data: updated };
  }

  static async createBatchForPrescription(prescriptionId, batchData) {
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    if (!batchData.batchNumber) {
      return { error: { code: ERROR_CODES.BAD_REQUEST, message: '缺少批次号' } };
    }
    
    const batch = await Batch.create({ ...batchData, prescriptionId });
    return { data: batch };
  }

  static async getPrescriptionWithDetails(id) {
    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    const batches = await Batch.findByPrescriptionId(id);
    
    return {
      data: {
        ...prescription,
        batches
      }
    };
  }
}

module.exports = PrescriptionService;
