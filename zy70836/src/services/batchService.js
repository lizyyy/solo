const { runAsync, getAsync, allAsync } = require('../database');
const { logOperation, recordException, trackMileage } = require('./importService');

const generateBatchNo = () => {
  const date = new Date();
  const prefix = `B${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return prefix + Math.random().toString(36).substr(2, 4).toUpperCase();
};

const createBatch = async (batchName, operator) => {
  const batchNo = generateBatchNo();
  const result = await runAsync(
    'INSERT INTO batches (batch_no, batch_name, handler) VALUES (?, ?, ?)',
    [batchNo, batchName, operator]
  );
  
  await logOperation('create', 'batch', result.lastID, operator, `创建批次:${batchName}`);
  
  return {
    id: result.lastID,
    batch_no: batchNo,
    batch_name: batchName
  };
};

const getBatchList = async (filters = {}) => {
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  
  sql += ' ORDER BY created_at DESC';
  return await allAsync(sql, params);
};

const getBatchDetail = async (batchId) => {
  const batch = await getAsync('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) return null;
  
  const vehicles = await allAsync('SELECT * FROM vehicles WHERE batch_id = ?', [batchId]);
  const borrowRecords = await allAsync('SELECT * FROM borrow_return_records WHERE batch_id = ?', [batchId]);
  const violations = await allAsync('SELECT * FROM violation_records WHERE batch_id = ?', [batchId]);
  const exceptions = await allAsync('SELECT * FROM exception_logs WHERE record_type = ? AND record_id IN (SELECT id FROM borrow_return_records WHERE batch_id = ?)', ['borrow_return', batchId]);
  const operations = await allAsync('SELECT * FROM operation_logs WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC', ['batch', batchId]);
  
  return {
    batch,
    vehicles,
    borrowRecords,
    violations,
    exceptions,
    operations
  };
};

const processBatch = async (batchId, operator, remark = '') => {
  const batch = await getAsync('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');
  
  await runAsync(
    'UPDATE batches SET status = ?, handler = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['processed', operator, remark, batchId]
  );
  
  await logOperation('process', 'batch', batchId, operator, `标记处理完成:${remark}`);
  
  return true;
};

const returnBatchForRevision = async (batchId, operator, reason) => {
  const batch = await getAsync('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) throw new Error('批次不存在');
  
  await runAsync(
    'UPDATE batches SET status = ?, handler = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['returned', operator, reason, batchId]
  );
  
  await recordException('batch', batchId, 'returned', reason, operator);
  await logOperation('return', 'batch', batchId, operator, `退回修改:${reason}`);
  
  return true;
};

const processReturn = async (recordId, returnData, operator) => {
  const record = await getAsync('SELECT * FROM borrow_return_records WHERE id = ?', [recordId]);
  if (!record) throw new Error('记录不存在');
  
  const { actual_return_time, end_mileage, end_fuel_balance, remark } = returnData;
  
  await runAsync(
    `UPDATE borrow_return_records 
     SET actual_return_time = ?, end_mileage = ?, end_fuel_balance = ?, status = 'returned', remark = ?
     WHERE id = ?`,
    [actual_return_time, end_mileage, end_fuel_balance, remark, recordId]
  );
  
  const mileageChange = end_mileage - record.start_mileage;
  await trackMileage(record.vehicle_id, record.vin, recordId, 'return',
    end_mileage, mileageChange, `还车记录`, operator);
  
  if (end_fuel_balance < record.start_fuel_balance) {
    await recordException('borrow_return', recordId, 'fuel_abnormal',
      `油卡余额异常: 借出${record.start_fuel_balance}, 归还${end_fuel_balance}`, operator);
  }
  
  await runAsync('UPDATE vehicles SET current_mileage = ?, fuel_card_balance = ? WHERE id = ?',
    [end_mileage, end_fuel_balance, record.vehicle_id]);
  
  await logOperation('return', 'borrow_return', recordId, operator, `处理还车, 里程变化:${mileageChange}`);
  
  return true;
};

const handleViolation = async (violationId, attributionResult, handler, remark) => {
  const violation = await getAsync('SELECT * FROM violation_records WHERE id = ?', [violationId]);
  if (!violation) throw new Error('违章记录不存在');
  
  await runAsync(
    `UPDATE violation_records 
     SET attribution_result = ?, handler = ?, remark = ?, processed = 1
     WHERE id = ?`,
    [attributionResult, handler, remark, violationId]
  );
  
  await recordException('violation', violationId, 'violation_attribution',
    `违章归属处理:${attributionResult}`, handler);
  
  await logOperation('handle', 'violation', violationId, handler, `违章处理:${attributionResult}, 备注:${remark}`);
  
  return true;
};

module.exports = {
  createBatch,
  getBatchList,
  getBatchDetail,
  processBatch,
  returnBatchForRevision,
  processReturn,
  handleViolation
};