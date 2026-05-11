const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const {
  DuplicateSubmissionError,
  NotFoundError,
  StatusConflictError,
  ValidationError,
  SourceRecordMissingError
} = require('../utils/errors');
const { SPECIMEN_STATUS, validateTransition } = require('../utils/statusMachine');
const statusHistoryService = require('./statusHistoryService');

async function createSpecimen(data) {
  const {
    barcode,
    patient_name,
    patient_id,
    specimen_type,
    collection_time,
    source_department,
    destination_lab
  } = data;

  if (!barcode || barcode.trim() === '') {
    throw new ValidationError('标本条码不能为空', 'barcode', barcode);
  }
  if (!patient_name || patient_name.trim() === '') {
    throw new ValidationError('患者姓名不能为空', 'patient_name', patient_name);
  }
  if (!patient_id || patient_id.trim() === '') {
    throw new ValidationError('患者ID不能为空', 'patient_id', patient_id);
  }
  if (!specimen_type || specimen_type.trim() === '') {
    throw new ValidationError('标本类型不能为空', 'specimen_type', specimen_type);
  }
  if (!collection_time) {
    throw new ValidationError('采集时间不能为空', 'collection_time', collection_time);
  }

  const existing = await get('SELECT id FROM specimens WHERE barcode = ?', [barcode]);
  if (existing) {
    throw new DuplicateSubmissionError('标本条码', barcode, { existingId: existing.id });
  }

  const id = uuidv4();
  const status = SPECIMEN_STATUS.CREATED;

  await run(
    `INSERT INTO specimens (id, barcode, patient_name, patient_id, specimen_type, collection_time, source_department, destination_lab, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, barcode, patient_name, patient_id, specimen_type, collection_time, source_department, destination_lab, status]
  );

  await statusHistoryService.recordStatusChange('specimen', id, null, status);

  return getSpecimenById(id);
}

async function getSpecimenById(id) {
  return get(
    `SELECT s.*, 
            b.batch_number, b.status as batch_status,
            r.report_number, r.status as report_status
     FROM specimens s
     LEFT JOIN batches b ON s.batch_id = b.id
     LEFT JOIN reports r ON s.id = r.specimen_id
     WHERE s.id = ?`,
    [id]
  );
}

async function getSpecimenByBarcode(barcode) {
  const specimen = await get(
    `SELECT s.*, 
            b.batch_number, b.status as batch_status,
            r.report_number, r.status as report_status
     FROM specimens s
     LEFT JOIN batches b ON s.batch_id = b.id
     LEFT JOIN reports r ON s.id = r.specimen_id
     WHERE s.barcode = ?`,
    [barcode]
  );

  if (!specimen) {
    throw new NotFoundError('标本条码', barcode);
  }

  return specimen;
}

async function getAllSpecimens(filters = {}) {
  let sql = `SELECT s.*, b.batch_number FROM specimens s LEFT JOIN batches b ON s.batch_id = b.id WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ' AND s.status = ?';
    params.push(filters.status);
  }
  if (filters.patient_id) {
    sql += ' AND s.patient_id = ?';
    params.push(filters.patient_id);
  }
  if (filters.batch_id) {
    sql += ' AND s.batch_id = ?';
    params.push(filters.batch_id);
  }
  if (filters.destination_lab) {
    sql += ' AND s.destination_lab = ?';
    params.push(filters.destination_lab);
  }

  sql += ' ORDER BY s.created_at DESC';

  return all(sql, params);
}

async function updateSpecimenStatus(specimenId, newStatus, operator = null, reason = null) {
  const specimen = await getSpecimenById(specimenId);

  if (!specimen) {
    throw new NotFoundError('标本', specimenId);
  }

  const currentStatus = specimen.status;

  if (currentStatus === newStatus) {
    return specimen;
  }

  validateTransition('specimen', currentStatus, newStatus);

  await run(
    'UPDATE specimens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, specimenId]
  );

  await statusHistoryService.recordStatusChange('specimen', specimenId, currentStatus, newStatus, operator, reason);

  return getSpecimenById(specimenId);
}

async function addToBatch(specimenId, batchId, operator = null) {
  const specimen = await getSpecimenById(specimenId);
  if (!specimen) {
    throw new NotFoundError('标本', specimenId);
  }

  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new SourceRecordMissingError('批次', batchId, '标本', specimenId);
  }

  if (specimen.status !== SPECIMEN_STATUS.CREATED) {
    throw new StatusConflictError(
      '标本',
      specimenId,
      specimen.status,
      [SPECIMEN_STATUS.CREATED],
      '加入批次'
    );
  }

  if (batch.status !== 'created' && batch.status !== 'ready') {
    throw new StatusConflictError(
      '批次',
      batchId,
      batch.status,
      ['created', 'ready'],
      '添加标本'
    );
  }

  if (specimen.destination_lab && batch.destination_lab && 
      specimen.destination_lab !== batch.destination_lab) {
    throw new ValidationError(
      `标本目标实验室 [${specimen.destination_lab}] 与批次目标实验室 [${batch.destination_lab}] 不一致`,
      'destination_lab',
      batch.destination_lab
    );
  }

  await run(
    'UPDATE specimens SET batch_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [batchId, specimenId]
  );

  return updateSpecimenStatus(specimenId, SPECIMEN_STATUS.IN_BATCH, operator, `加入批次 ${batch.batch_number}`);
}

async function removeFromBatch(specimenId, operator = null) {
  const specimen = await getSpecimenById(specimenId);
  if (!specimen) {
    throw new NotFoundError('标本', specimenId);
  }

  if (!specimen.batch_id) {
    throw new ValidationError('标本不在任何批次中', 'batch_id', null);
  }

  const batch = await get('SELECT * FROM batches WHERE id = ?', [specimen.batch_id]);
  if (batch && (batch.status !== 'created' && batch.status !== 'ready')) {
    throw new StatusConflictError(
      '批次',
      specimen.batch_id,
      batch.status,
      ['created', 'ready'],
      '移除标本'
    );
  }

  await run(
    'UPDATE specimens SET batch_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SPECIMEN_STATUS.CREATED, specimenId]
  );

  await statusHistoryService.recordStatusChange(
    'specimen',
    specimenId,
    SPECIMEN_STATUS.IN_BATCH,
    SPECIMEN_STATUS.CREATED,
    operator,
    `从批次 ${batch ? batch.batch_number : specimen.batch_id} 移除`
  );

  return getSpecimenById(specimenId);
}

module.exports = {
  createSpecimen,
  getSpecimenById,
  getSpecimenByBarcode,
  getAllSpecimens,
  updateSpecimenStatus,
  addToBatch,
  removeFromBatch
};
