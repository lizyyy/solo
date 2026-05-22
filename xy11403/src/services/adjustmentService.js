const {
  BatchDAO,
  BoxDAO,
  ReconciliationResultDAO,
  OperationHistoryDAO,
  ManualAdjustmentDAO
} = require('../db/dao');
const { BatchService } = require('./batchService');

class AdjustmentService {
  static adjustCompensation(batchId, boxId, newCompensation, reason, operator) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    if (batch.frozen) throw new Error('批次已冻结，无法改判');

    const box = BoxDAO.findByBoxNoAndBatchId(batchId, boxId);
    if (!box) throw new Error('箱号不存在');

    const oldCompensation = box.compensation_amount;

    BoxDAO.update(box.id, { compensation_amount: newCompensation });

    ManualAdjustmentDAO.create({
      batch_id: batchId,
      box_id: box.id,
      adjust_type: 'compensation',
      field_name: 'compensation_amount',
      old_value: String(oldCompensation),
      new_value: String(newCompensation),
      reason,
      operator
    });

    OperationHistoryDAO.create({
      batch_id: batchId,
      box_id: box.id,
      operation_type: 'manual_adjust',
      operation_subtype: 'compensation',
      operator,
      before_data: { compensation: oldCompensation },
      after_data: { compensation: newCompensation },
      remark: reason
    });

    this._recalculateBatchTotal(batchId);

    return {
      success: true,
      box_no: boxId,
      old_compensation: oldCompensation,
      new_compensation: newCompensation
    };
  }

  static adjustBoxStatus(batchId, boxId, newStatus, reason, operator) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    if (batch.frozen) throw new Error('批次已冻结，无法改判');

    const box = BoxDAO.findByBoxNoAndBatchId(batchId, boxId);
    if (!box) throw new Error('箱号不存在');

    const oldStatus = box.status;

    BoxDAO.update(box.id, { status: newStatus });

    ManualAdjustmentDAO.create({
      batch_id: batchId,
      box_id: box.id,
      adjust_type: 'status',
      field_name: 'status',
      old_value: oldStatus,
      new_value: newStatus,
      reason,
      operator
    });

    OperationHistoryDAO.create({
      batch_id: batchId,
      box_id: box.id,
      operation_type: 'manual_adjust',
      operation_subtype: 'status',
      operator,
      before_data: { status: oldStatus },
      after_data: { status: newStatus },
      remark: reason
    });

    return {
      success: true,
      box_no: boxId,
      old_status: oldStatus,
      new_status: newStatus
    };
  }

  static adjustBatchRemark(batchId, newRemark, operator) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');

    const oldRemark = batch.remark;

    BatchDAO.updateStatus(batchId, batch.status);
    
    const { getDb } = require('../db/index');
    const db = getDb();
    db.prepare('UPDATE batches SET remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRemark, batchId);

    OperationHistoryDAO.create({
      batch_id: batchId,
      operation_type: 'manual_adjust',
      operation_subtype: 'remark',
      operator,
      before_data: { remark: oldRemark },
      after_data: { remark: newRemark },
      remark: '修改批次备注'
    });

    return {
      success: true,
      batch_id: batchId,
      old_remark: oldRemark,
      new_remark: newRemark
    };
  }

  static _recalculateBatchTotal(batchId) {
    const boxes = BoxDAO.findByBatchId(batchId);
    const totalCompensation = boxes.reduce((sum, box) => sum + (box.compensation_amount || 0), 0);

    const existing = ReconciliationResultDAO.findByBatchId(batchId);
    if (existing) {
      const { getDb } = require('../db/index');
      const db = getDb();
      db.prepare(`
        UPDATE reconciliation_results 
        SET total_compensation = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE batch_id = ?
      `).run(totalCompensation, batchId);
    }
  }

  static getAdjustments(batchId) {
    return ManualAdjustmentDAO.findByBatchId(batchId);
  }
}

class FreezeService {
  static freezeBatch(batchId, operator) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    if (batch.frozen) throw new Error('批次已冻结');

    BatchDAO.freeze(batchId, operator);

    OperationHistoryDAO.create({
      batch_id: batchId,
      operation_type: 'freeze',
      operator,
      before_data: { frozen: 0 },
      after_data: { frozen: 1 },
      remark: '批次冻结（导出前）'
    });

    return { success: true, message: '批次已冻结', batch_id: batchId };
  }

  static unfreezeBatch(batchId, operator) {
    const batch = BatchDAO.findById(batchId);
    if (!batch) throw new Error('批次不存在');
    if (!batch.frozen) throw new Error('批次未冻结');

    BatchDAO.unfreeze(batchId);

    OperationHistoryDAO.create({
      batch_id: batchId,
      operation_type: 'unfreeze',
      operator,
      before_data: { frozen: 1 },
      after_data: { frozen: 0 },
      remark: '批次解冻'
    });

    return { success: true, message: '批次已解冻', batch_id: batchId };
  }
}

module.exports = { AdjustmentService, FreezeService };
