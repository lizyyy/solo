const db = require('./database');

const getBatches = (options = {}) => {
  const { limit = 100, offset = 0, status } = options;
  let query = `SELECT * FROM batches WHERE 1=1`;
  const params = [];
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY import_time DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getBatchByNumber = (batchNumber) => {
  return db.prepare('SELECT * FROM batches WHERE batch_number = ?').get(batchNumber);
};

const getRejectedRecords = (options = {}) => {
  const { 
    batchId, 
    batchNumber, 
    isFixed, 
    riskLevel, 
    recordType,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `
    SELECT rr.*, b.batch_number, b.import_time as batch_import_time
    FROM rejected_records rr
    JOIN batches b ON rr.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (batchId) {
    query += ` AND rr.batch_id = ?`;
    params.push(batchId);
  }
  
  if (batchNumber) {
    query += ` AND b.batch_number = ?`;
    params.push(batchNumber);
  }
  
  if (isFixed !== undefined && isFixed !== null) {
    query += ` AND rr.is_fixed = ?`;
    params.push(isFixed ? 1 : 0);
  }
  
  if (riskLevel) {
    query += ` AND rr.risk_level = ?`;
    params.push(riskLevel);
  }
  
  if (recordType) {
    query += ` AND rr.record_type = ?`;
    params.push(recordType);
  }
  
  query += ` ORDER BY rr.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getRejectedRecordById = (id) => {
  return db.prepare(`
    SELECT rr.*, b.batch_number, b.import_time as batch_import_time
    FROM rejected_records rr
    JOIN batches b ON rr.batch_id = b.id
    WHERE rr.id = ?
  `).get(id);
};

const getDuplicateRecords = (options = {}) => {
  const { 
    batchNumber, 
    bottleCode, 
    recordType,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `SELECT * FROM duplicate_records WHERE 1=1`;
  const params = [];
  
  if (batchNumber) {
    query += ` AND batch_number = ?`;
    params.push(batchNumber);
  }
  
  if (bottleCode) {
    query += ` AND bottle_code = ?`;
    params.push(bottleCode);
  }
  
  if (recordType) {
    query += ` AND record_type = ?`;
    params.push(recordType);
  }
  
  query += ` ORDER BY detected_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getWaterSamples = (options = {}) => {
  const { 
    batchId, 
    batchNumber, 
    bottleCode,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `
    SELECT ws.*, sp.point_name, sp.point_code, b.batch_number
    FROM water_samples ws
    LEFT JOIN sampling_points sp ON ws.sampling_point_id = sp.id
    JOIN batches b ON ws.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (batchId) {
    query += ` AND ws.batch_id = ?`;
    params.push(batchId);
  }
  
  if (batchNumber) {
    query += ` AND b.batch_number = ?`;
    params.push(batchNumber);
  }
  
  if (bottleCode) {
    query += ` AND ws.bottle_code = ?`;
    params.push(bottleCode);
  }
  
  query += ` ORDER BY ws.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getInstrumentReadings = (options = {}) => {
  const { 
    sampleId, 
    batchId,
    readingType,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `
    SELECT ir.*, i.instrument_name, i.instrument_code, ws.bottle_code, b.batch_number
    FROM instrument_readings ir
    LEFT JOIN instruments i ON ir.instrument_id = i.id
    LEFT JOIN water_samples ws ON ir.sample_id = ws.id
    JOIN batches b ON ir.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (sampleId) {
    query += ` AND ir.sample_id = ?`;
    params.push(sampleId);
  }
  
  if (batchId) {
    query += ` AND ir.batch_id = ?`;
    params.push(batchId);
  }
  
  if (readingType) {
    query += ` AND ir.reading_type = ?`;
    params.push(readingType);
  }
  
  query += ` ORDER BY ir.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getRecheckNotes = (options = {}) => {
  const { 
    sampleId, 
    batchId,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `
    SELECT rn.*, ws.bottle_code, b.batch_number
    FROM recheck_notes rn
    LEFT JOIN water_samples ws ON rn.sample_id = ws.id
    JOIN batches b ON rn.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];
  
  if (sampleId) {
    query += ` AND rn.sample_id = ?`;
    params.push(sampleId);
  }
  
  if (batchId) {
    query += ` AND rn.batch_id = ?`;
    params.push(batchId);
  }
  
  query += ` ORDER BY rn.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getSamplingPoints = (options = {}) => {
  const { 
    pointCode,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `SELECT * FROM sampling_points WHERE 1=1`;
  const params = [];
  
  if (pointCode) {
    query += ` AND point_code = ?`;
    params.push(pointCode);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getInstruments = (options = {}) => {
  const { 
    instrumentCode,
    status,
    limit = 100, 
    offset = 0 
  } = options;
  
  let query = `SELECT * FROM instruments WHERE 1=1`;
  const params = [];
  
  if (instrumentCode) {
    query += ` AND instrument_code = ?`;
    params.push(instrumentCode);
  }
  
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
};

const getStatistics = () => {
  const totalSamples = db.prepare('SELECT COUNT(*) as count FROM water_samples').get().count;
  const totalReadings = db.prepare('SELECT COUNT(*) as count FROM instrument_readings').get().count;
  const totalRechecks = db.prepare('SELECT COUNT(*) as count FROM recheck_notes').get().count;
  const totalBatches = db.prepare('SELECT COUNT(*) as count FROM batches').get().count;
  
  const rejectedByRisk = db.prepare(`
    SELECT risk_level, COUNT(*) as count 
    FROM rejected_records 
    GROUP BY risk_level
  `).all();
  
  const fixedStats = db.prepare(`
    SELECT 
      COUNT(*) as total_rejected,
      SUM(CASE WHEN is_fixed = 1 THEN 1 ELSE 0 END) as fixed_count,
      SUM(CASE WHEN is_fixed = 0 THEN 1 ELSE 0 END) as pending_count
    FROM rejected_records
  `).get();
  
  const duplicatesByType = db.prepare(`
    SELECT record_type, COUNT(*) as count 
    FROM duplicate_records 
    GROUP BY record_type
  `).all();
  
  return {
    totalSamples,
    totalReadings,
    totalRechecks,
    totalBatches,
    rejectedByRisk,
    fixedStats,
    duplicatesByType
  };
};

module.exports = {
  getBatches,
  getBatchByNumber,
  getRejectedRecords,
  getRejectedRecordById,
  getDuplicateRecords,
  getWaterSamples,
  getInstrumentReadings,
  getRecheckNotes,
  getSamplingPoints,
  getInstruments,
  getStatistics
};
