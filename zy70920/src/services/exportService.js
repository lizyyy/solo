const { Parser } = require('json2csv');
const { allQuery } = require('../models/database');

async function exportSamplesByQuery(queryParams = {}) {
  const { sampleNo, status, recheckResult, batchId } = queryParams;
  
  let sql = `SELECT 
    s.id,
    s.sample_no,
    b.batch_no,
    s.sample_name,
    s.sample_type,
    s.quantity,
    s.unit,
    s.package,
    s.status,
    CASE s.status
      WHEN 'pending' THEN '待处理'
      WHEN 'testing' THEN '检测中'
      WHEN 'passed' THEN '已通过'
      WHEN 'failed' THEN '未通过'
      WHEN 'rechecking' THEN '复检中'
      WHEN 'mixed' THEN '混批标记'
      ELSE s.status
    END as status_desc,
    s.recheck_count,
    s.recheck_result,
    CASE s.recheck_result
      WHEN 'passed' THEN '复检通过'
      WHEN 'failed' THEN '复检未通过'
      WHEN 'withdrawn' THEN '报告撤回'
      ELSE s.recheck_result
    END as recheck_result_desc,
    s.mixed_note,
    s.created_at,
    s.updated_at
  FROM samples s 
  LEFT JOIN batches b ON s.batch_id = b.id 
  WHERE 1=1`;
  
  const params = [];
  
  if (batchId) {
    sql += ' AND s.batch_id = ?';
    params.push(batchId);
  }
  if (sampleNo) {
    sql += ' AND s.sample_no LIKE ?';
    params.push('%' + sampleNo + '%');
  }
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (recheckResult) {
    sql += ' AND s.recheck_result = ?';
    params.push(recheckResult);
  }
  
  sql += ' ORDER BY s.created_at DESC';
  
  const samples = await allQuery(sql, params);
  
  const fields = [
    { label: '批次编号', value: 'batch_no' },
    { label: '样品编号', value: 'sample_no' },
    { label: '样品名称', value: 'sample_name' },
    { label: '样品类型', value: 'sample_type' },
    { label: '数量', value: 'quantity' },
    { label: '单位', value: 'unit' },
    { label: '包装', value: 'package' },
    { label: '状态', value: 'status_desc' },
    { label: '复检次数', value: 'recheck_count' },
    { label: '复检结论', value: 'recheck_result_desc' },
    { label: '混批说明', value: 'mixed_note' },
    { label: '创建时间', value: 'created_at' },
    { label: '更新时间', value: 'updated_at' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(samples);
  
  return {
    success: true,
    count: samples.length,
    csv: '\uFEFF' + csv,
    data: samples
  };
}

async function exportBatchDetails(batchId) {
  const [batch, samples, logs] = await Promise.all([
    allQuery('SELECT * FROM batches WHERE id = ?', [batchId]),
    allQuery(`
      SELECT 
        s.*,
        CASE s.status
          WHEN 'pending' THEN '待处理'
          WHEN 'testing' THEN '检测中'
          WHEN 'passed' THEN '已通过'
          WHEN 'failed' THEN '未通过'
          WHEN 'rechecking' THEN '复检中'
          WHEN 'mixed' THEN '混批标记'
          ELSE s.status
        END as status_desc
      FROM samples s 
      WHERE batch_id = ? 
      ORDER BY created_at DESC`, [batchId]),
    allQuery(`
      SELECT 
        l.*,
        CASE l.operation_type
          WHEN 'CREATE_BATCH' THEN '创建批次'
          WHEN 'PROCESS_BATCH' THEN '标记处理'
          WHEN 'RETURN_BATCH' THEN '退回修改'
          WHEN 'WITHDRAW_BATCH' THEN '撤回批次'
          WHEN 'IMPORT_SAMPLES' THEN '导入样品'
          WHEN 'MARK_MIXED' THEN '标记混批'
          WHEN 'REQUEST_RECHECK' THEN '申请复检'
          WHEN 'SET_RECHECK_RESULT' THEN '设置复检结论'
          ELSE l.operation_type
        END as operation_desc
      FROM operation_logs l 
      WHERE batch_id = ? 
      ORDER BY operation_time DESC`, [batchId])
  ]);
  
  return {
    success: true,
    batch: batch[0] || null,
    samples: samples,
    sampleCount: samples.length,
    logs: logs,
    logCount: logs.length
  };
}

async function exportLogs() {
  const logs = await allQuery(`
    SELECT 
      l.id,
      l.operation_type,
      CASE l.operation_type
        WHEN 'CREATE_BATCH' THEN '创建批次'
        WHEN 'PROCESS_BATCH' THEN '标记处理'
        WHEN 'RETURN_BATCH' THEN '退回修改'
        WHEN 'WITHDRAW_BATCH' THEN '撤回批次'
        WHEN 'IMPORT_SAMPLES' THEN '导入样品'
        WHEN 'MARK_MIXED' THEN '标记混批'
        WHEN 'REQUEST_RECHECK' THEN '申请复检'
        WHEN 'SET_RECHECK_RESULT' THEN '设置复检结论'
        ELSE l.operation_type
      END as operation_desc,
      b.batch_no,
      s.sample_no,
      l.handler,
      l.reason,
      l.old_status,
      l.new_status,
      l.operation_time
    FROM operation_logs l 
    LEFT JOIN batches b ON l.batch_id = b.id
    LEFT JOIN samples s ON l.sample_id = s.id
    ORDER BY l.operation_time DESC 
    LIMIT 1000`);
  
  const fields = [
    { label: '操作类型', value: 'operation_desc' },
    { label: '批次编号', value: 'batch_no' },
    { label: '样品编号', value: 'sample_no' },
    { label: '处理人', value: 'handler' },
    { label: '原因说明', value: 'reason' },
    { label: '操作时间', value: 'operation_time' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(logs);
  
  return {
    success: true,
    count: logs.length,
    csv: '\uFEFF' + csv,
    data: logs
  };
}

module.exports = {
  exportSamplesByQuery,
  exportBatchDetails,
  exportLogs
};
