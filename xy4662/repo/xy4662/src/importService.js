const db = require('./database');
const utils = require('./utils');
const fs = require('fs');
const path = require('path');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const csv = require('csv-parser');
    const results = [];
    const stream = fs.createReadStream(filePath);
    
    stream
      .on('error', reject)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const getOrCreateBatch = (batchNumber, originalFilename) => {
  let batch = db.prepare('SELECT * FROM batches WHERE batch_number = ?').get(batchNumber);
  
  if (!batch) {
    const batchId = utils.generateId();
    db.prepare(`
      INSERT INTO batches (id, batch_number, import_time, original_filename, status)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, 'active')
    `).run(batchId, batchNumber, originalFilename);
    batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  }
  
  return batch;
};

const checkDuplicate = (recordType, batchNumber, bottleCode, contentHash) => {
  const existing = db.prepare(`
    SELECT rh.*, 
      CASE WHEN ws.id IS NOT NULL THEN 'water_sample'
           WHEN ir.id IS NOT NULL THEN 'instrument_reading'
           WHEN rn.id IS NOT NULL THEN 'recheck_note'
           ELSE 'unknown' END as actual_type
    FROM record_hashes rh
    LEFT JOIN water_samples ws ON rh.record_id = ws.id AND rh.record_type = 'water_sample'
    LEFT JOIN instrument_readings ir ON rh.record_id = ir.id AND rh.record_type = 'instrument_reading'
    LEFT JOIN recheck_notes rn ON rh.record_id = rn.id AND rh.record_type = 'recheck_note'
    WHERE rh.record_type = ? 
      AND rh.batch_number = ? 
      AND rh.content_hash = ?
  `).get(recordType, batchNumber, contentHash);
  
  return existing || null;
};

const logDuplicate = (batchNumber, bottleCode, recordType, existingRecordId, newImportId, hashMatch) => {
  const duplicateId = utils.generateId();
  db.prepare(`
    INSERT INTO duplicate_records 
    (id, batch_number, bottle_code, record_type, existing_record_id, new_import_id, detected_at, hash_match)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `).run(duplicateId, batchNumber, bottleCode, recordType, existingRecordId, newImportId, hashMatch ? 1 : 0);
};

const importWaterSample = (record, batch, lineNumber, originalContent) => {
  const validation = utils.validateSampleData(record);
  const bottleCode = record.bottle_code || record.sample_code;
  
  if (!validation.valid) {
    const risk = utils.calculateRiskScore(validation.errors.join('; '), originalContent);
    const rejectedId = utils.generateId();
    db.prepare(`
      INSERT INTO rejected_records 
      (id, batch_id, original_filename, line_number, record_type, original_content, 
       error_reason, error_details, bottle_code, risk_level, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejectedId, batch.id, batch.original_filename, lineNumber, 'water_sample',
      originalContent, validation.errors.join('; '), JSON.stringify(validation.errors),
      bottleCode, risk.level, risk.score
    );
    return { status: 'rejected', recordId: rejectedId, errors: validation.errors };
  }
  
  const contentHash = utils.calculateContentHash(record, 'water_sample');
  const duplicate = checkDuplicate('water_sample', batch.batch_number, bottleCode, contentHash);
  
  if (duplicate) {
    logDuplicate(batch.batch_number, bottleCode, 'water_sample', duplicate.record_id, null, true);
    return { status: 'duplicate', recordId: duplicate.record_id };
  }
  
  let samplingPointId = null;
  if (record.sampling_point_code) {
    const point = db.prepare('SELECT id FROM sampling_points WHERE point_code = ?').get(record.sampling_point_code);
    if (point) {
      samplingPointId = point.id;
    }
  }
  
  const sampleId = utils.generateId();
  db.prepare(`
    INSERT INTO water_samples 
    (id, batch_id, sample_code, bottle_code, sampling_point_id, sampling_time, 
     collector, sample_type, temperature, ph, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    sampleId, batch.id, record.sample_code || record.bottle_code, bottleCode, samplingPointId,
    record.sampling_time || null, record.collector || null, record.sample_type || null,
    record.temperature ? parseFloat(record.temperature) : null,
    record.ph ? parseFloat(record.ph) : null
  );
  
  const hashId = utils.generateId();
  db.prepare(`
    INSERT INTO record_hashes 
    (id, record_type, batch_number, bottle_code, content_hash, record_id, created_at)
    VALUES (?, 'water_sample', ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(hashId, batch.batch_number, bottleCode, contentHash, sampleId);
  
  return { status: 'success', recordId: sampleId };
};

const importInstrumentReading = (record, batch, lineNumber, originalContent) => {
  const validation = utils.validateReadingData(record);
  const bottleCode = record.bottle_code || record.sample_code;
  
  if (!validation.valid) {
    const risk = utils.calculateRiskScore(validation.errors.join('; '), originalContent);
    const rejectedId = utils.generateId();
    db.prepare(`
      INSERT INTO rejected_records 
      (id, batch_id, original_filename, line_number, record_type, original_content, 
       error_reason, error_details, bottle_code, risk_level, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejectedId, batch.id, batch.original_filename, lineNumber, 'instrument_reading',
      originalContent, validation.errors.join('; '), JSON.stringify(validation.errors),
      bottleCode, risk.level, risk.score
    );
    return { status: 'rejected', recordId: rejectedId, errors: validation.errors };
  }
  
  const contentHash = utils.calculateContentHash(record, 'instrument_reading');
  const duplicate = checkDuplicate('instrument_reading', batch.batch_number, bottleCode, contentHash);
  
  if (duplicate) {
    logDuplicate(batch.batch_number, bottleCode, 'instrument_reading', duplicate.record_id, null, true);
    return { status: 'duplicate', recordId: duplicate.record_id };
  }
  
  let sampleId = null;
  if (bottleCode) {
    const sample = db.prepare('SELECT id FROM water_samples WHERE bottle_code = ? OR sample_code = ?').get(bottleCode, bottleCode);
    if (sample) {
      sampleId = sample.id;
    }
  }
  
  let instrumentId = null;
  if (record.instrument_code) {
    const instrument = db.prepare('SELECT id FROM instruments WHERE instrument_code = ?').get(record.instrument_code);
    if (instrument) {
      instrumentId = instrument.id;
    }
  }
  
  const readingId = utils.generateId();
  db.prepare(`
    INSERT INTO instrument_readings 
    (id, sample_id, instrument_id, reading_type, reading_value, reading_unit, 
     reading_time, operator, batch_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    readingId, sampleId, instrumentId, record.reading_type,
    parseFloat(record.reading_value), record.reading_unit || null,
    record.reading_time || null, record.operator || null, batch.id
  );
  
  const hashId = utils.generateId();
  db.prepare(`
    INSERT INTO record_hashes 
    (id, record_type, batch_number, bottle_code, content_hash, record_id, created_at)
    VALUES (?, 'instrument_reading', ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(hashId, batch.batch_number, bottleCode, contentHash, readingId);
  
  return { status: 'success', recordId: readingId };
};

const importRecheckNote = (record, batch, lineNumber, originalContent) => {
  const validation = utils.validateRecheckData(record);
  const bottleCode = record.bottle_code || record.sample_code;
  
  if (!validation.valid) {
    const risk = utils.calculateRiskScore(validation.errors.join('; '), originalContent);
    const rejectedId = utils.generateId();
    db.prepare(`
      INSERT INTO rejected_records 
      (id, batch_id, original_filename, line_number, record_type, original_content, 
       error_reason, error_details, bottle_code, risk_level, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejectedId, batch.id, batch.original_filename, lineNumber, 'recheck_note',
      originalContent, validation.errors.join('; '), JSON.stringify(validation.errors),
      bottleCode, risk.level, risk.score
    );
    return { status: 'rejected', recordId: rejectedId, errors: validation.errors };
  }
  
  const contentHash = utils.calculateContentHash(record, 'recheck_note');
  const duplicate = checkDuplicate('recheck_note', batch.batch_number, bottleCode, contentHash);
  
  if (duplicate) {
    logDuplicate(batch.batch_number, bottleCode, 'recheck_note', duplicate.record_id, null, true);
    return { status: 'duplicate', recordId: duplicate.record_id };
  }
  
  let sampleId = null;
  if (bottleCode) {
    const sample = db.prepare('SELECT id FROM water_samples WHERE bottle_code = ? OR sample_code = ?').get(bottleCode, bottleCode);
    if (sample) {
      sampleId = sample.id;
    }
  }
  
  const recheckId = utils.generateId();
  db.prepare(`
    INSERT INTO recheck_notes 
    (id, sample_id, recheck_reason, recheck_operator, recheck_time, 
     original_value, recheck_value, conclusion, batch_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    recheckId, sampleId, record.recheck_reason, record.recheck_operator || null,
    record.recheck_time || null, 
    record.original_value ? parseFloat(record.original_value) : null,
    record.recheck_value ? parseFloat(record.recheck_value) : null,
    record.conclusion || null, batch.id
  );
  
  const hashId = utils.generateId();
  db.prepare(`
    INSERT INTO record_hashes 
    (id, record_type, batch_number, bottle_code, content_hash, record_id, created_at)
    VALUES (?, 'recheck_note', ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(hashId, batch.batch_number, bottleCode, contentHash, recheckId);
  
  return { status: 'success', recordId: recheckId };
};

const importSamplingPoint = (record, batch, lineNumber, originalContent) => {
  if (!record.point_code) {
    const risk = utils.calculateRiskScore('缺少采样点编码', originalContent);
    const rejectedId = utils.generateId();
    db.prepare(`
      INSERT INTO rejected_records 
      (id, batch_id, original_filename, line_number, record_type, original_content, 
       error_reason, error_details, risk_level, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejectedId, batch.id, batch.original_filename, lineNumber, 'sampling_point',
      originalContent, '缺少采样点编码', JSON.stringify(['缺少采样点编码']),
      risk.level, risk.score
    );
    return { status: 'rejected', recordId: rejectedId, errors: ['缺少采样点编码'] };
  }
  
  const existing = db.prepare('SELECT id FROM sampling_points WHERE point_code = ?').get(record.point_code);
  
  if (existing) {
    db.prepare(`
      UPDATE sampling_points SET
        point_name = ?, location = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE point_code = ?
    `).run(record.point_name || null, record.location || null, record.description || null, record.point_code);
    
    return { status: 'updated', recordId: existing.id };
  }
  
  const pointId = utils.generateId();
  db.prepare(`
    INSERT INTO sampling_points 
    (id, point_code, point_name, location, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(pointId, record.point_code, record.point_name || null, record.location || null, record.description || null);
  
  return { status: 'success', recordId: pointId };
};

const importInstrument = (record, batch, lineNumber, originalContent) => {
  if (!record.instrument_code) {
    const risk = utils.calculateRiskScore('缺少仪器编码', originalContent);
    const rejectedId = utils.generateId();
    db.prepare(`
      INSERT INTO rejected_records 
      (id, batch_id, original_filename, line_number, record_type, original_content, 
       error_reason, error_details, risk_level, risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rejectedId, batch.id, batch.original_filename, lineNumber, 'instrument',
      originalContent, '缺少仪器编码', JSON.stringify(['缺少仪器编码']),
      risk.level, risk.score
    );
    return { status: 'rejected', recordId: rejectedId, errors: ['缺少仪器编码'] };
  }
  
  const existing = db.prepare('SELECT id FROM instruments WHERE instrument_code = ?').get(record.instrument_code);
  
  if (existing) {
    db.prepare(`
      UPDATE instruments SET
        instrument_name = ?, model = ?, last_calibration = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE instrument_code = ?
    `).run(
      record.instrument_name || null, record.model || null, 
      record.last_calibration || null, record.status || 'active',
      record.instrument_code
    );
    
    return { status: 'updated', recordId: existing.id };
  }
  
  const instrumentId = utils.generateId();
  db.prepare(`
    INSERT INTO instruments 
    (id, instrument_code, instrument_name, model, last_calibration, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    instrumentId, record.instrument_code, record.instrument_name || null, 
    record.model || null, record.last_calibration || null, record.status || 'active'
  );
  
  return { status: 'success', recordId: instrumentId };
};

const importFromCSV = async (filePath, recordType, batchNumber, originalFilename) => {
  const records = await parseCSV(filePath);
  const batch = getOrCreateBatch(batchNumber, originalFilename);
  
  const results = {
    total: records.length,
    success: 0,
    updated: 0,
    duplicate: 0,
    rejected: 0,
    details: []
  };
  
  let importFunction;
  switch (recordType) {
    case 'water_sample':
      importFunction = importWaterSample;
      break;
    case 'instrument_reading':
      importFunction = importInstrumentReading;
      break;
    case 'recheck_note':
      importFunction = importRecheckNote;
      break;
    case 'sampling_point':
      importFunction = importSamplingPoint;
      break;
    case 'instrument':
      importFunction = importInstrument;
      break;
    default:
      throw new Error(`未知的记录类型: ${recordType}`);
  }
  
  for (let i = 0; i < records.length; i++) {
    const lineNumber = i + 2;
    const record = records[i];
    const originalContent = JSON.stringify(record);
    
    try {
      const result = importFunction(record, batch, lineNumber, originalContent);
      results.details.push({ lineNumber, ...result, originalContent });
      
      if (result.status === 'success') results.success++;
      else if (result.status === 'updated') results.updated++;
      else if (result.status === 'duplicate') results.duplicate++;
      else if (result.status === 'rejected') results.rejected++;
    } catch (error) {
      const risk = utils.calculateRiskScore(error.message, originalContent);
      const rejectedId = utils.generateId();
      db.prepare(`
        INSERT INTO rejected_records 
        (id, batch_id, original_filename, line_number, record_type, original_content, 
         error_reason, error_details, bottle_code, risk_level, risk_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rejectedId, batch.id, originalFilename, lineNumber, recordType,
        originalContent, '导入异常', error.message,
        record.bottle_code || record.sample_code, risk.level, risk.score
      );
      
      results.details.push({ lineNumber, status: 'rejected', recordId: rejectedId, error: error.message });
      results.rejected++;
    }
  }
  
  return results;
};

module.exports = {
  importFromCSV,
  getOrCreateBatch,
  checkDuplicate
};
