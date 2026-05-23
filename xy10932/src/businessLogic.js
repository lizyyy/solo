const { getOne, runQuery, getAll } = require('./database');

const SAMPLE_STATUSES = {
  STORED: 'stored',
  INSPECTED: 'inspected',
  PENDING_DESTRUCTION: 'pending_destruction',
  DESTROYED: 'destroyed',
  EXPIRED: 'expired'
};

const DESTRUCTION_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled'
};

const INSPECTION_STATUSES = {
  PENDING_REVIEW: 'pending_review',
  REVIEW_PASSED: 'review_passed',
  REVIEW_REJECTED: 'review_rejected',
  COMPENSATED: 'compensated',
  COMPENSATION_PENDING: 'compensation_pending'
};

const BATCH_STATUSES = {
  PRODUCED: 'produced',
  SAMPLED: 'sampled',
  INSPECTION_COMPLETED: 'inspection_completed',
  DESTROYED: 'destroyed'
};

const generateBatchNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `B${dateStr}${random}`;
};

const generateBoxNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `S${dateStr}${random}`;
};

const generateReportNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `R${dateStr}${random}`;
};

const calculateExpiryTime = (sampleTime, shelfLifeDays = 48) => {
  const expiry = new Date(sampleTime);
  expiry.setHours(expiry.getHours() + shelfLifeDays * 24);
  return expiry.toISOString();
};

const isSampleExpired = (expiryTime) => {
  return new Date() > new Date(expiryTime);
};

const createBatch = async (batchData) => {
  const batchNo = batchData.batch_no || generateBatchNo();
  const result = await runQuery(
    `INSERT INTO batches (batch_no, dish_name, production_date, production_line, chef, quantity, shelf_life_days, ingredients, supplier, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchNo, batchData.dish_name, batchData.production_date, batchData.production_line, 
     batchData.chef, batchData.quantity, batchData.shelf_life_days || 48, 
     batchData.ingredients, batchData.supplier, batchData.remarks]
  );
  return { id: result.lastID, batch_no: batchNo };
};

const createSampleBox = async (sampleData) => {
  const batch = await getOne('SELECT * FROM batches WHERE id = ?', [sampleData.batch_id]);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const boxNo = sampleData.box_no || generateBoxNo();
  const sampleTime = sampleData.sample_time || new Date().toISOString();
  const expiryTime = calculateExpiryTime(sampleTime, batch.shelf_life_days);

  if (sampleData.location_id) {
    const location = await getOne('SELECT * FROM storage_locations WHERE id = ?', [sampleData.location_id]);
    if (!location || location.status !== 'active') {
      throw new Error('冷藏位置无效或未启用');
    }
    if (location.current_count >= location.capacity) {
      throw new Error('冷藏位置已满');
    }
    await runQuery(
      'UPDATE storage_locations SET current_count = current_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sampleData.location_id]
    );
  }

  const result = await runQuery(
    `INSERT INTO sample_boxes (box_no, batch_id, location_id, sample_weight, sample_time, expiry_time, operator, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [boxNo, sampleData.batch_id, sampleData.location_id, sampleData.sample_weight,
     sampleTime, expiryTime, sampleData.operator, sampleData.remarks]
  );

  await runQuery(
    'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [BATCH_STATUSES.SAMPLED, sampleData.batch_id]
  );

  return { id: result.lastID, box_no: boxNo, expiry_time: expiryTime };
};

const createInspection = async (inspectionData) => {
  const sampleBox = await getOne('SELECT * FROM sample_boxes WHERE id = ?', [inspectionData.sample_box_id]);
  if (!sampleBox) {
    throw new Error('留样盒不存在');
  }
  if (sampleBox.status !== SAMPLE_STATUSES.STORED && sampleBox.status !== SAMPLE_STATUSES.INSPECTED) {
    throw new Error('留样盒状态不允许抽检');
  }

  const result = await runQuery(
    `INSERT INTO inspections (sample_box_id, inspector, temperature, appearance, smell, taste, microorganism_result, result, conclusion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inspectionData.sample_box_id, inspectionData.inspector, inspectionData.temperature,
     inspectionData.appearance, inspectionData.smell, inspectionData.taste,
     inspectionData.microorganism_result, inspectionData.result || 'pending',
     inspectionData.conclusion]
  );

  await runQuery(
    'UPDATE sample_boxes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SAMPLE_STATUSES.INSPECTED, inspectionData.sample_box_id]
  );

  return { 
    id: result.lastID, 
    status: INSPECTION_STATUSES.PENDING_REVIEW,
    message: '抽检记录已创建，待复核'
  };
};

const reviewInspection = async (inspectionId, reviewData) => {
  const inspection = await getOne('SELECT * FROM inspections WHERE id = ?', [inspectionId]);
  if (!inspection) {
    throw new Error('抽检记录不存在');
  }
  if (inspection.status !== INSPECTION_STATUSES.PENDING_REVIEW) {
    throw new Error('该抽检记录不处于待复核状态');
  }

  const newStatus = reviewData.passed ? INSPECTION_STATUSES.REVIEW_PASSED : INSPECTION_STATUSES.REVIEW_REJECTED;
  
  await runQuery(
    `UPDATE inspections 
     SET status = ?, reviewer = ?, review_time = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [newStatus, reviewData.reviewer, reviewData.comment, inspectionId]
  );

  const statusMessages = {
    [INSPECTION_STATUSES.REVIEW_PASSED]: '已通过复核',
    [INSPECTION_STATUSES.REVIEW_REJECTED]: '已驳回'
  };

  return { id: inspectionId, status: newStatus, message: statusMessages[newStatus] };
};

const applyCompensation = async (inspectionId, compensationData) => {
  const inspection = await getOne('SELECT * FROM inspections WHERE id = ?', [inspectionId]);
  if (!inspection) {
    throw new Error('抽检记录不存在');
  }
  if (inspection.status !== INSPECTION_STATUSES.REVIEW_REJECTED) {
    throw new Error('只有驳回的抽检记录可以申请补偿');
  }

  await runQuery(
    `UPDATE inspections 
     SET status = ?, compensation_applied = 1, compensation_details = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [INSPECTION_STATUSES.COMPENSATION_PENDING, compensationData.details, inspectionId]
  );

  return { 
    id: inspectionId, 
    status: INSPECTION_STATUSES.COMPENSATION_PENDING,
    message: '补偿申请已提交'
  };
};

const confirmCompensation = async (inspectionId, operator) => {
  const inspection = await getOne('SELECT * FROM inspections WHERE id = ?', [inspectionId]);
  if (!inspection) {
    throw new Error('抽检记录不存在');
  }
  if (inspection.status !== INSPECTION_STATUSES.COMPENSATION_PENDING) {
    throw new Error('该抽检记录不处于补偿待确认状态');
  }

  await runQuery(
    'UPDATE inspections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [INSPECTION_STATUSES.COMPENSATED, inspectionId]
  );

  return { 
    id: inspectionId, 
    status: INSPECTION_STATUSES.COMPENSATED,
    message: '已补偿'
  };
};

const requestDestruction = async (requestData) => {
  const sampleBox = await getOne('SELECT * FROM sample_boxes WHERE id = ?', [requestData.sample_box_id]);
  if (!sampleBox) {
    throw new Error('留样盒不存在');
  }

  const allowedStatuses = [SAMPLE_STATUSES.STORED, SAMPLE_STATUSES.INSPECTED, SAMPLE_STATUSES.EXPIRED];
  if (!allowedStatuses.includes(sampleBox.status)) {
    throw new Error(`留样盒状态不允许申请销毁，当前状态: ${sampleBox.status}`);
  }

  const pendingDestruction = await getOne(
    'SELECT * FROM destructions WHERE sample_box_id = ? AND status = ?',
    [requestData.sample_box_id, DESTRUCTION_STATUSES.PENDING]
  );
  if (pendingDestruction) {
    throw new Error('该留样盒已有待确认的销毁申请');
  }

  const result = await runQuery(
    `INSERT INTO destructions (sample_box_id, operator, destruction_method, reason, status, first_operator)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestData.sample_box_id, requestData.operator, requestData.destruction_method,
     requestData.reason, DESTRUCTION_STATUSES.PENDING, requestData.operator]
  );

  await runQuery(
    'UPDATE sample_boxes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SAMPLE_STATUSES.PENDING_DESTRUCTION, requestData.sample_box_id]
  );

  return { 
    id: result.lastID, 
    status: DESTRUCTION_STATUSES.PENDING, 
    message: '销毁申请已提交，待双人确认' 
  };
};

const confirmDestruction = async (destructionId, confirmData) => {
  const destruction = await getOne('SELECT * FROM destructions WHERE id = ?', [destructionId]);
  if (!destruction) {
    throw new Error('销毁记录不存在');
  }
  if (destruction.status !== DESTRUCTION_STATUSES.PENDING) {
    throw new Error(`该销毁申请不处于待确认状态，当前状态: ${destruction.status}`);
  }
  if (!confirmData.witness || !confirmData.witness.trim()) {
    throw new Error('必须提供确认人信息（双人复核）');
  }
  if (destruction.first_operator === confirmData.witness) {
    throw new Error('申请人和确认人不能为同一人（双人复核要求）');
  }

  const sampleBox = await getOne('SELECT * FROM sample_boxes WHERE id = ?', [destruction.sample_box_id]);
  if (!sampleBox) {
    throw new Error('留样盒不存在');
  }

  if (sampleBox.location_id) {
    await runQuery(
      'UPDATE storage_locations SET current_count = current_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sampleBox.location_id]
    );
  }

  await runQuery(
    `UPDATE destructions 
     SET status = ?, witness = ?, destruction_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [DESTRUCTION_STATUSES.CONFIRMED, confirmData.witness, destructionId]
  );

  await runQuery(
    'UPDATE sample_boxes SET status = ?, location_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SAMPLE_STATUSES.DESTROYED, destruction.sample_box_id]
  );

  const batchSamples = await getAll('SELECT * FROM sample_boxes WHERE batch_id = ? AND status != ?', 
    [sampleBox.batch_id, SAMPLE_STATUSES.DESTROYED]);
  if (batchSamples.length === 0) {
    await runQuery(
      'UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [BATCH_STATUSES.DESTROYED, sampleBox.batch_id]
    );
  }

  return { 
    id: destructionId, 
    status: DESTRUCTION_STATUSES.CONFIRMED, 
    message: '销毁已双人确认完成' 
  };
};

const cancelDestruction = async (destructionId, cancelData) => {
  const destruction = await getOne('SELECT * FROM destructions WHERE id = ?', [destructionId]);
  if (!destruction) {
    throw new Error('销毁记录不存在');
  }
  if (destruction.status !== DESTRUCTION_STATUSES.PENDING) {
    throw new Error(`该销毁申请不处于待确认状态，当前状态: ${destruction.status}`);
  }

  await runQuery(
    `UPDATE destructions 
     SET status = ?, cancel_reason = ?, cancelled_by = ?, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [DESTRUCTION_STATUSES.CANCELLED, cancelData.reason, cancelData.operator, destructionId]
  );

  await runQuery(
    'UPDATE sample_boxes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SAMPLE_STATUSES.STORED, destruction.sample_box_id]
  );

  return { 
    id: destructionId, 
    status: DESTRUCTION_STATUSES.CANCELLED, 
    message: '销毁申请已取消，留样已恢复库存状态' 
  };
};

const generateTraceReport = async (reportData) => {
  const reportNo = generateReportNo();
  let content = {};

  if (reportData.batch_id) {
    const batch = await getOne('SELECT * FROM batches WHERE id = ?', [reportData.batch_id]);
    const samples = await getAll('SELECT * FROM sample_boxes WHERE batch_id = ?', [reportData.batch_id]);
    
    content.batch = batch;
    content.samples = [];
    
    for (const sample of samples) {
      const inspections = await getAll('SELECT * FROM inspections WHERE sample_box_id = ?', [sample.id]);
      const destruction = await getOne('SELECT * FROM destructions WHERE sample_box_id = ?', [sample.id]);
      content.samples.push({ sample, inspections, destruction });
    }
  } else if (reportData.sample_box_id) {
    const sample = await getOne('SELECT * FROM sample_boxes WHERE id = ?', [reportData.sample_box_id]);
    const batch = await getOne('SELECT * FROM batches WHERE id = ?', [sample.batch_id]);
    const inspections = await getAll('SELECT * FROM inspections WHERE sample_box_id = ?', [sample.id]);
    const destruction = await getOne('SELECT * FROM destructions WHERE sample_box_id = ?', [sample.id]);
    
    content = { batch, sample, inspections, destruction };
  }

  const result = await runQuery(
    `INSERT INTO trace_reports (report_no, batch_id, sample_box_id, report_type, generated_by, content)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [reportNo, reportData.batch_id, reportData.sample_box_id, reportData.report_type,
     reportData.generated_by, JSON.stringify(content)]
  );

  return { id: result.lastID, report_no: reportNo, content };
};

const checkAndUpdateExpiredSamples = async () => {
  const now = new Date().toISOString();
  const expiredSamples = await getAll(
    `SELECT * FROM sample_boxes 
     WHERE status = ? AND expiry_time < ?`,
    [SAMPLE_STATUSES.STORED, now]
  );

  for (const sample of expiredSamples) {
    await runQuery(
      'UPDATE sample_boxes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [SAMPLE_STATUSES.EXPIRED, sample.id]
    );
  }

  return expiredSamples.length;
};

module.exports = {
  SAMPLE_STATUSES,
  INSPECTION_STATUSES,
  BATCH_STATUSES,
  DESTRUCTION_STATUSES,
  generateBatchNo,
  generateBoxNo,
  generateReportNo,
  calculateExpiryTime,
  isSampleExpired,
  createBatch,
  createSampleBox,
  createInspection,
  reviewInspection,
  applyCompensation,
  confirmCompensation,
  requestDestruction,
  confirmDestruction,
  cancelDestruction,
  generateTraceReport,
  checkAndUpdateExpiredSamples
};
