const Database = require('../db/database');
const { generateMaterialHash, generateBatchNo } = require('../utils/hash');

class BatchService {
  static async submitBatch(data) {
    const { submitter, cableCarId, cableCarName, inspectionDate, inspectionItems } = data;
    
    const hashData = {
      cableCarId,
      cableCarName,
      inspectionDate,
      inspectionItems: inspectionItems.map(i => ({ name: i.itemName, result: i.itemResult }))
    };
    const materialHash = generateMaterialHash(hashData);

    const existing = await Database.get(
      'SELECT * FROM batches WHERE material_hash = ?',
      [materialHash]
    );

    if (existing) {
      return {
        isDuplicate: true,
        batch: existing,
        message: '该批次材料已存在，返回原有记录'
      };
    }

    const batchNo = generateBatchNo();
    const result = await Database.run(
      `INSERT INTO batches (batch_no, material_hash, submitter, cable_car_id, cable_car_name, inspection_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'inspecting')`,
      [batchNo, materialHash, submitter, cableCarId, cableCarName, inspectionDate]
    );

    const batchId = result.lastID;
    
    for (const item of inspectionItems) {
      await Database.run(
        `INSERT INTO inspection_records (batch_id, item_name, item_result, remark, inspector)
         VALUES (?, ?, ?, ?, ?)`,
        [batchId, item.itemName, item.itemResult, item.remark || '', item.inspector]
      );
    }

    const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    return {
      isDuplicate: false,
      batch,
      message: '批次提交成功'
    };
  }

  static async getBatchDetail(batchId) {
    const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return null;

    const inspectionRecords = await Database.all(
      'SELECT * FROM inspection_records WHERE batch_id = ?',
      [batchId]
    );

    const trialRunRecords = await Database.all(
      'SELECT * FROM trial_run_records WHERE batch_id = ?',
      [batchId]
    );

    const approvalRecords = await Database.all(
      'SELECT * FROM approval_records WHERE batch_id = ? ORDER BY approval_time',
      [batchId]
    );

    return {
      batch,
      inspectionRecords,
      trialRunRecords,
      approvalRecords
    };
  }

  static async getBatchList(params = {}) {
    const { status, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    let queryParams = [];

    if (status) {
      whereClause = 'WHERE status = ?';
      queryParams.push(status);
    }

    const batches = await Database.all(
      `SELECT * FROM batches ${whereClause} ORDER BY submit_time DESC LIMIT ? OFFSET ?`,
      [...queryParams, pageSize, offset]
    );

    const total = await Database.get(
      `SELECT COUNT(*) as count FROM batches ${whereClause}`,
      queryParams
    );

    return {
      batches,
      total: total.count,
      page,
      pageSize
    };
  }

  static async getStatistics() {
    const total = await Database.get('SELECT COUNT(*) as count FROM batches');
    const pending = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'pending'");
    const inspecting = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'inspecting'");
    const trialing = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'trialing'");
    const approving = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'approving'");
    const passed = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'passed'");
    const rejected = await Database.get("SELECT COUNT(*) as count FROM batches WHERE status = 'rejected'");

    return {
      total: total.count,
      pending: pending.count,
      inspecting: inspecting.count,
      trialing: trialing.count,
      approving: approving.count,
      passed: passed.count,
      rejected: rejected.count
    };
  }
}

module.exports = BatchService;
