const Batch = require('../models/batch');
const Prescription = require('../models/prescription');
const { WorkOrder } = require('../models/workOrder');
const { BATCH_STATUS, PRESCRIPTION_STATUS, WORK_ORDER_STATUS } = require('../utils/enums');
const { ERROR_CODES } = require('../utils/response');

class BatchService {
  static async createBatch(data) {
    const required = ['prescriptionId', 'batchNumber', 'modelNumber', 'technician'];
    for (const field of required) {
      if (!data[field]) {
        return { error: { code: ERROR_CODES.BAD_REQUEST, message: `缺少必填字段: ${field}` } };
      }
    }
    
    const prescription = await Prescription.findById(data.prescriptionId);
    if (!prescription) {
      return { error: { code: ERROR_CODES.PRESCRIPTION_NOT_FOUND, message: '处方不存在' } };
    }
    
    const batch = await Batch.create(data);
    const workOrders = await WorkOrder.generateForBatch(batch.id);
    
    return { data: { batch, workOrders } };
  }

  static async getBatch(id) {
    const batch = await Batch.findById(id);
    if (!batch) {
      return { error: { code: ERROR_CODES.BATCH_NOT_FOUND, message: '批次不存在' } };
    }
    return { data: batch };
  }

  static async listBatches(params = {}) {
    const batches = await Batch.findAll(params);
    return { data: batches };
  }

  static async startProduction(batchId) {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return { error: { code: ERROR_CODES.BATCH_NOT_FOUND, message: '批次不存在' } };
    }
    
    if (batch.status === BATCH_STATUS.COMPLETED || batch.status === BATCH_STATUS.CLOSED) {
      return { error: { code: ERROR_CODES.BATCH_ALREADY_FINISHED, message: '批次已完成，无法开始生产' } };
    }
    
    await Batch.updateStatus(batchId, BATCH_STATUS.IN_PRODUCTION);
    await Prescription.updateStatus(batch.prescriptionId, PRESCRIPTION_STATUS.IN_PRODUCTION);
    
    const updated = await Batch.findById(batchId);
    return { data: updated };
  }

  static async completeWorkOrder(workOrderId, operator, notes) {
    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) {
      return { error: { code: ERROR_CODES.WORK_ORDER_NOT_FOUND, message: '工序不存在' } };
    }
    
    if (workOrder.status === WORK_ORDER_STATUS.COMPLETED) {
      return { data: workOrder, message: '工序已完成' };
    }
    
    await WorkOrder.updateStatus(workOrderId, WORK_ORDER_STATUS.COMPLETED, operator, notes);
    
    const completionCheck = await WorkOrder.checkAllCompleted(workOrder.batchId);
    
    if (completionCheck.allCompleted) {
      await Batch.updateStatus(workOrder.batchId, BATCH_STATUS.COMPLETED);
      
      const batch = await Batch.findById(workOrder.batchId);
      if (batch) {
        await Prescription.updateStatus(batch.prescriptionId, PRESCRIPTION_STATUS.COMPLETED);
      }
    }
    
    const updated = await WorkOrder.findById(workOrderId);
    return { data: updated, allCompleted: completionCheck.allCompleted };
  }

  static async getBatchWithWorkOrders(batchId) {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return { error: { code: ERROR_CODES.BATCH_NOT_FOUND, message: '批次不存在' } };
    }
    
    const workOrders = await WorkOrder.findByBatchId(batchId);
    
    return {
      data: {
        ...batch,
        workOrders
      }
    };
  }

  static async resetForRework(batchId) {
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return { error: { code: ERROR_CODES.BATCH_NOT_FOUND, message: '批次不存在' } };
    }
    
    await WorkOrder.resetForRework(batchId);
    await Batch.updateStatus(batchId, BATCH_STATUS.REWORKING);
    await Batch.updateReworkCount(batchId);
    
    const updated = await Batch.findById(batchId);
    return { data: updated };
  }
}

module.exports = BatchService;
