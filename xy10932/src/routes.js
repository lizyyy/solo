const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('./database');
const business = require('./businessLogic');

const ALLOWED_TABLES = [
  'batches',
  'sample_boxes',
  'storage_locations',
  'inspections',
  'destructions',
  'trace_reports'
];

const ALLOWED_FIELDS = {
  batches: ['batch_no', 'dish_name', 'production_date', 'production_line', 'chef', 'quantity', 'shelf_life_days', 'ingredients', 'supplier', 'status', 'remarks'],
  sample_boxes: ['box_no', 'batch_id', 'location_id', 'sample_weight', 'sample_time', 'expiry_time', 'status', 'operator', 'remarks'],
  storage_locations: ['code', 'name', 'description', 'capacity', 'temperature_min', 'temperature_max', 'status'],
  inspections: ['inspector', 'temperature', 'appearance', 'smell', 'taste', 'microorganism_result', 'result', 'conclusion', 'status', 'reviewer', 'review_comment', 'compensation_details'],
  destructions: ['operator', 'witness', 'destruction_method', 'reason', 'status'],
  trace_reports: ['report_no', 'report_type', 'generated_by', 'status']
};

const validateManualCorrection = (target_table, field_name) => {
  if (!ALLOWED_TABLES.includes(target_table)) {
    throw new Error(`不允许修改表: ${target_table}，允许的表: ${ALLOWED_TABLES.join(', ')}`);
  }
  const allowedFields = ALLOWED_FIELDS[target_table] || [];
  if (!allowedFields.includes(field_name)) {
    throw new Error(`表 ${target_table} 不允许修改字段: ${field_name}，允许的字段: ${allowedFields.join(', ')}`);
  }
  return true;
};

const logException = async (req, error, conclusion = null) => {
  try {
    await runQuery(
      `INSERT INTO exception_logs (api_endpoint, request_method, request_body, request_headers, error_message, error_stack, handling_conclusion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.path, req.method, JSON.stringify(req.body), JSON.stringify(req.headers),
       error.message, error.stack, conclusion]
    );
  } catch (e) {
    console.error('记录异常日志失败:', e);
  }
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(async (error) => {
    await logException(req, error);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  });
};

router.get('/health', (req, res) => {
  res.json({ success: true, message: '餐厅预制菜留样API服务运行正常' });
});

router.post('/batches', asyncHandler(async (req, res) => {
  const result = await business.createBatch(req.body);
  res.json({
    success: true,
    status: 'created',
    data: result,
    message: '批次创建成功'
  });
}));

router.get('/batches', asyncHandler(async (req, res) => {
  const { status, dish_name, page = 1, limit = 20 } = req.query;
  let sql = 'SELECT * FROM batches WHERE 1=1';
  let params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (dish_name) {
    sql += ' AND dish_name LIKE ?';
    params.push(`%${dish_name}%`);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const batches = await getAll(sql, params);
  const countResult = await getOne('SELECT COUNT(*) as total FROM batches');
  
  res.json({
    success: true,
    data: batches,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: countResult.total
    }
  });
}));

router.get('/batches/:id', asyncHandler(async (req, res) => {
  const batch = await getOne('SELECT * FROM batches WHERE id = ?', [req.params.id]);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  const samples = await getAll('SELECT * FROM sample_boxes WHERE batch_id = ?', [req.params.id]);
  
  res.json({
    success: true,
    data: { ...batch, samples }
  });
}));

router.post('/sample-boxes', asyncHandler(async (req, res) => {
  const result = await business.createSampleBox(req.body);
  res.json({
    success: true,
    status: 'stored',
    data: result,
    message: '留样盒创建成功并入库'
  });
}));

router.get('/sample-boxes', asyncHandler(async (req, res) => {
  const { status, batch_id, location_id, page = 1, limit = 20 } = req.query;
  let sql = `SELECT sb.*, b.dish_name, b.batch_no, sl.name as location_name 
              FROM sample_boxes sb
              LEFT JOIN batches b ON sb.batch_id = b.id
              LEFT JOIN storage_locations sl ON sb.location_id = sl.id
              WHERE 1=1`;
  let params = [];
  
  if (status) {
    sql += ' AND sb.status = ?';
    params.push(status);
  }
  if (batch_id) {
    sql += ' AND sb.batch_id = ?';
    params.push(batch_id);
  }
  if (location_id) {
    sql += ' AND sb.location_id = ?';
    params.push(location_id);
  }
  
  sql += ' ORDER BY sb.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const samples = await getAll(sql, params);
  
  res.json({
    success: true,
    data: samples
  });
}));

router.get('/sample-boxes/:id', asyncHandler(async (req, res) => {
  const sample = await getOne(
    `SELECT sb.*, b.dish_name, b.batch_no, sl.name as location_name 
     FROM sample_boxes sb
     LEFT JOIN batches b ON sb.batch_id = b.id
     LEFT JOIN storage_locations sl ON sb.location_id = sl.id
     WHERE sb.id = ?`,
    [req.params.id]
  );
  
  if (!sample) {
    return res.status(404).json({ success: false, message: '留样盒不存在' });
  }
  
  const inspections = await getAll('SELECT * FROM inspections WHERE sample_box_id = ?', [req.params.id]);
  const destruction = await getOne('SELECT * FROM destructions WHERE sample_box_id = ?', [req.params.id]);
  
  res.json({
    success: true,
    data: { ...sample, inspections, destruction }
  });
}));

router.post('/storage-locations', asyncHandler(async (req, res) => {
  const result = await runQuery(
    `INSERT INTO storage_locations (code, name, description, capacity, temperature_min, temperature_max)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.body.code, req.body.name, req.body.description, req.body.capacity || 100,
     req.body.temperature_min || -18, req.body.temperature_max || -10]
  );
  
  res.json({
    success: true,
    data: { id: result.lastID, code: req.body.code },
    message: '冷藏位置创建成功'
  });
}));

router.get('/storage-locations', asyncHandler(async (req, res) => {
  const locations = await getAll('SELECT * FROM storage_locations ORDER BY code');
  res.json({ success: true, data: locations });
}));

router.post('/inspections', asyncHandler(async (req, res) => {
  const result = await business.createInspection(req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.get('/inspections', asyncHandler(async (req, res) => {
  const { status, sample_box_id, page = 1, limit = 20 } = req.query;
  let sql = `SELECT i.*, sb.box_no, b.dish_name, b.batch_no
              FROM inspections i
              LEFT JOIN sample_boxes sb ON i.sample_box_id = sb.id
              LEFT JOIN batches b ON sb.batch_id = b.id
              WHERE 1=1`;
  let params = [];
  
  if (status) {
    sql += ' AND i.status = ?';
    params.push(status);
  }
  if (sample_box_id) {
    sql += ' AND i.sample_box_id = ?';
    params.push(sample_box_id);
  }
  
  sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const inspections = await getAll(sql, params);
  
  res.json({
    success: true,
    data: inspections
  });
}));

router.post('/inspections/:id/review', asyncHandler(async (req, res) => {
  const result = await business.reviewInspection(req.params.id, req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.post('/inspections/:id/apply-compensation', asyncHandler(async (req, res) => {
  const result = await business.applyCompensation(req.params.id, req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.post('/inspections/:id/confirm-compensation', asyncHandler(async (req, res) => {
  const result = await business.confirmCompensation(req.params.id, req.body.operator);
  res.json({
    success: true,
    ...result
  });
}));

router.post('/destructions/request', asyncHandler(async (req, res) => {
  const result = await business.requestDestruction(req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.post('/destructions/:id/confirm', asyncHandler(async (req, res) => {
  const result = await business.confirmDestruction(req.params.id, req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.post('/destructions/:id/cancel', asyncHandler(async (req, res) => {
  const result = await business.cancelDestruction(req.params.id, req.body);
  res.json({
    success: true,
    ...result
  });
}));

router.get('/destructions', asyncHandler(async (req, res) => {
  const { status, sample_box_id } = req.query;
  let sql = `SELECT d.*, sb.box_no, b.dish_name, b.batch_no
             FROM destructions d
             LEFT JOIN sample_boxes sb ON d.sample_box_id = sb.id
             LEFT JOIN batches b ON sb.batch_id = b.id
             WHERE 1=1`;
  let params = [];
  
  if (status) {
    sql += ' AND d.status = ?';
    params.push(status);
  }
  if (sample_box_id) {
    sql += ' AND d.sample_box_id = ?';
    params.push(sample_box_id);
  }
  
  sql += ' ORDER BY d.created_at DESC';
  
  const destructions = await getAll(sql, params);
  res.json({ success: true, data: destructions });
}));

router.get('/destructions/:id', asyncHandler(async (req, res) => {
  const destruction = await getOne(
    `SELECT d.*, sb.box_no, b.dish_name, b.batch_no
     FROM destructions d
     LEFT JOIN sample_boxes sb ON d.sample_box_id = sb.id
     LEFT JOIN batches b ON sb.batch_id = b.id
     WHERE d.id = ?`,
    [req.params.id]
  );
  
  if (!destruction) {
    return res.status(404).json({ success: false, message: '销毁记录不存在' });
  }
  
  res.json({ success: true, data: destruction });
}));

router.post('/trace-reports', asyncHandler(async (req, res) => {
  const result = await business.generateTraceReport(req.body);
  res.json({
    success: true,
    status: 'generated',
    data: result,
    message: '追溯报告生成成功'
  });
}));

router.get('/trace-reports', asyncHandler(async (req, res) => {
  const reports = await getAll('SELECT * FROM trace_reports ORDER BY created_at DESC');
  const parsedReports = reports.map(r => ({
    ...r,
    content: r.content ? JSON.parse(r.content) : null
  }));
  res.json({ success: true, data: parsedReports });
}));

router.get('/trace-reports/:id', asyncHandler(async (req, res) => {
  const report = await getOne('SELECT * FROM trace_reports WHERE id = ?', [req.params.id]);
  if (!report) {
    return res.status(404).json({ success: false, message: '报告不存在' });
  }
  
  res.json({
    success: true,
    data: {
      ...report,
      content: report.content ? JSON.parse(report.content) : null
    }
  });
}));

router.get('/exception-logs', asyncHandler(async (req, res) => {
  const logs = await getAll('SELECT * FROM exception_logs ORDER BY created_at DESC LIMIT 100');
  res.json({ success: true, data: logs });
}));

router.post('/exception-logs/:id/handle', asyncHandler(async (req, res) => {
  await runQuery(
    `UPDATE exception_logs 
     SET status = 'handled', handling_conclusion = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [req.body.conclusion, req.body.handled_by, req.params.id]
  );
  
  res.json({
    success: true,
    message: '异常已处理'
  });
}));

router.post('/manual-corrections', asyncHandler(async (req, res) => {
  const { target_table, target_id, field_name, new_value, reason, operator } = req.body;
  
  try {
    validateManualCorrection(target_table, field_name);
  } catch (validationError) {
    return res.status(400).json({
      success: false,
      status: 'validation_error',
      message: validationError.message
    });
  }
  
  const allowedFields = ALLOWED_FIELDS[target_table];
  const fieldIndex = allowedFields.indexOf(field_name);
  const safeFieldName = allowedFields[fieldIndex];
  
  const oldRecord = await getOne(
    `SELECT ${safeFieldName} as old_value FROM ${target_table} WHERE id = ?`,
    [target_id]
  );
  if (!oldRecord) {
    return res.status(404).json({ success: false, message: '目标记录不存在' });
  }
  
  await runQuery(
    `UPDATE ${target_table} SET ${safeFieldName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [new_value, target_id]
  );
  
  await runQuery(
    `INSERT INTO manual_corrections (target_table, target_id, field_name, old_value, new_value, reason, operator)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [target_table, target_id, safeFieldName, oldRecord.old_value, new_value, reason, operator]
  );
  
  res.json({
    success: true,
    message: '人工修正成功',
    data: { field_name: safeFieldName, old_value: oldRecord.old_value, new_value }
  });
}));

router.get('/manual-corrections', asyncHandler(async (req, res) => {
  const corrections = await getAll('SELECT * FROM manual_corrections ORDER BY created_at DESC');
  res.json({ success: true, data: corrections });
}));

router.get('/export/trace-report/:id', asyncHandler(async (req, res) => {
  const report = await getOne('SELECT * FROM trace_reports WHERE id = ?', [req.params.id]);
  if (!report) {
    return res.status(404).json({ success: false, message: '报告不存在' });
  }
  
  const content = report.content ? JSON.parse(report.content) : {};
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="trace-report-${report.report_no}.json`);
  res.json({
    report_no: report.report_no,
    report_type: report.report_type,
    generated_at: report.generated_at,
    generated_by: report.generated_by,
    data: content
  });
}));

router.get('/statistics/summary', asyncHandler(async (req, res) => {
  const batchCount = await getOne('SELECT COUNT(*) as count FROM batches');
  const sampleCount = await getOne('SELECT COUNT(*) as count FROM sample_boxes');
  const pendingReviewCount = await getOne('SELECT COUNT(*) as count FROM inspections WHERE status = ?', ['pending_review']);
  const destroyedCount = await getOne('SELECT COUNT(*) as count FROM sample_boxes WHERE status = ?', ['destroyed']);
  const expiredCount = await getOne('SELECT COUNT(*) as count FROM sample_boxes WHERE status = ?', ['expired']);
  
  res.json({
    success: true,
    data: {
      total_batches: batchCount.count,
      total_samples: sampleCount.count,
      pending_review: pendingReviewCount.count,
      destroyed: destroyedCount.count,
      expired: expiredCount.count
    }
  });
}));

module.exports = router;
