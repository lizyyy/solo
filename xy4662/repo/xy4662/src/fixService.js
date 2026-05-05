const db = require('./database');
const utils = require('./utils');
const importService = require('./importService');

const markAsFixed = (rejectedRecordId, fixedContent, fixedBy, notes = '') => {
  const rejectedRecord = db.prepare('SELECT * FROM rejected_records WHERE id = ?').get(rejectedRecordId);
  
  if (!rejectedRecord) {
    throw new Error('未找到该隔离记录');
  }
  
  if (rejectedRecord.is_fixed) {
    throw new Error('该记录已被标记为已修复');
  }
  
  const risk = utils.calculateRiskScore(
    rejectedRecord.error_reason,
    fixedContent || rejectedRecord.original_content
  );
  
  db.prepare(`
    UPDATE rejected_records SET
      is_fixed = 1,
      fixed_by = ?,
      fixed_at = CURRENT_TIMESTAMP,
      fixed_content = ?,
      risk_level = ?,
      risk_score = ?
    WHERE id = ?
  `).run(fixedBy || 'system', fixedContent || rejectedRecord.original_content, risk.level, risk.score, rejectedRecordId);
  
  const assessmentId = utils.generateId();
  db.prepare(`
    INSERT INTO risk_assessments
    (id, rejected_record_id, assessment_criteria, risk_level, risk_score, assessed_by, notes)
    VALUES (?, ?, 'manual_fix', ?, ?, ?, ?)
  `).run(assessmentId, rejectedRecordId, risk.level, risk.score, fixedBy || 'system', notes);
  
  return {
    success: true,
    rejectedRecordId,
    riskLevel: risk.level,
    riskScore: risk.score
  };
};

const recalculateRisk = (rejectedRecordId, newCriteria = {}) => {
  const rejectedRecord = db.prepare('SELECT * FROM rejected_records WHERE id = ?').get(rejectedRecordId);
  
  if (!rejectedRecord) {
    throw new Error('未找到该隔离记录');
  }
  
  let risk = utils.calculateRiskScore(
    rejectedRecord.error_reason,
    rejectedRecord.fixed_content || rejectedRecord.original_content
  );
  
  if (newCriteria.manualOverride) {
    risk = {
      level: newCriteria.riskLevel || 'medium',
      score: newCriteria.riskScore || 3
    };
  }
  
  db.prepare(`
    UPDATE rejected_records SET
      risk_level = ?,
      risk_score = ?
    WHERE id = ?
  `).run(risk.level, risk.score, rejectedRecordId);
  
  const assessmentId = utils.generateId();
  db.prepare(`
    INSERT INTO risk_assessments
    (id, rejected_record_id, assessment_criteria, risk_level, risk_score, assessed_by, notes)
    VALUES (?, ?, 'recalculation', ?, ?, ?, ?)
  `).run(
    assessmentId, 
    rejectedRecordId, 
    risk.level, 
    risk.score, 
    newCriteria.assessedBy || 'system',
    newCriteria.notes || ''
  );
  
  return {
    success: true,
    rejectedRecordId,
    riskLevel: risk.level,
    riskScore: risk.score
  };
};

const processFixedRecord = async (rejectedRecordId) => {
  const rejectedRecord = db.prepare('SELECT * FROM rejected_records WHERE id = ?').get(rejectedRecordId);
  
  if (!rejectedRecord) {
    throw new Error('未找到该隔离记录');
  }
  
  if (!rejectedRecord.is_fixed) {
    throw new Error('该记录尚未标记为已修复，请先标记修复');
  }
  
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(rejectedRecord.batch_id);
  
  if (!batch) {
    throw new Error('未找到关联的批次');
  }
  
  let record;
  try {
    record = JSON.parse(rejectedRecord.fixed_content || rejectedRecord.original_content);
  } catch (error) {
    throw new Error('修复后的内容无法解析为有效的JSON');
  }
  
  let result;
  const originalContent = rejectedRecord.fixed_content || rejectedRecord.original_content;
  
  switch (rejectedRecord.record_type) {
    case 'water_sample': {
      const validation = utils.validateSampleData(record);
      if (!validation.valid) {
        throw new Error(`修复后的数据仍然无效: ${validation.errors.join('; ')}`);
      }
      
      const contentHash = utils.calculateContentHash(record, 'water_sample');
      const duplicate = importService.checkDuplicate('water_sample', batch.batch_number, record.bottle_code || record.sample_code, contentHash);
      
      if (duplicate) {
        throw new Error(`修复后的数据与现有记录重复，记录ID: ${duplicate.record_id}`);
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
        sampleId, batch.id, record.sample_code || record.bottle_code, 
        record.bottle_code || record.sample_code, samplingPointId,
        record.sampling_time || null, record.collector || null, record.sample_type || null,
        record.temperature ? parseFloat(record.temperature) : null,
        record.ph ? parseFloat(record.ph) : null
      );
      
      const hashId = utils.generateId();
      db.prepare(`
        INSERT INTO record_hashes 
        (id, record_type, batch_number, bottle_code, content_hash, record_id, created_at)
        VALUES (?, 'water_sample', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(hashId, batch.batch_number, record.bottle_code || record.sample_code, contentHash, sampleId);
      
      result = { status: 'success', recordId: sampleId, recordType: 'water_sample' };
      break;
    }
    
    case 'instrument_reading': {
      const validation = utils.validateReadingData(record);
      if (!validation.valid) {
        throw new Error(`修复后的数据仍然无效: ${validation.errors.join('; ')}`);
      }
      
      const contentHash = utils.calculateContentHash(record, 'instrument_reading');
      const bottleCode = record.bottle_code || record.sample_code;
      const duplicate = importService.checkDuplicate('instrument_reading', batch.batch_number, bottleCode, contentHash);
      
      if (duplicate) {
        throw new Error(`修复后的数据与现有记录重复，记录ID: ${duplicate.record_id}`);
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
      
      result = { status: 'success', recordId: readingId, recordType: 'instrument_reading' };
      break;
    }
    
    case 'recheck_note': {
      const validation = utils.validateRecheckData(record);
      if (!validation.valid) {
        throw new Error(`修复后的数据仍然无效: ${validation.errors.join('; ')}`);
      }
      
      const contentHash = utils.calculateContentHash(record, 'recheck_note');
      const bottleCode = record.bottle_code || record.sample_code;
      const duplicate = importService.checkDuplicate('recheck_note', batch.batch_number, bottleCode, contentHash);
      
      if (duplicate) {
        throw new Error(`修复后的数据与现有记录重复，记录ID: ${duplicate.record_id}`);
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
      
      result = { status: 'success', recordId: recheckId, recordType: 'recheck_note' };
      break;
    }
    
    case 'sampling_point': {
      if (!record.point_code) {
        throw new Error('修复后的数据仍然缺少采样点编码');
      }
      
      const existing = db.prepare('SELECT id FROM sampling_points WHERE point_code = ?').get(record.point_code);
      
      if (existing) {
        db.prepare(`
          UPDATE sampling_points SET
            point_name = ?, location = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE point_code = ?
        `).run(record.point_name || null, record.location || null, record.description || null, record.point_code);
        
        result = { status: 'updated', recordId: existing.id, recordType: 'sampling_point' };
      } else {
        const pointId = utils.generateId();
        db.prepare(`
          INSERT INTO sampling_points 
          (id, point_code, point_name, location, description, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(pointId, record.point_code, record.point_name || null, record.location || null, record.description || null);
        
        result = { status: 'success', recordId: pointId, recordType: 'sampling_point' };
      }
      break;
    }
    
    case 'instrument': {
      if (!record.instrument_code) {
        throw new Error('修复后的数据仍然缺少仪器编码');
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
        
        result = { status: 'updated', recordId: existing.id, recordType: 'instrument' };
      } else {
        const instrumentId = utils.generateId();
        db.prepare(`
          INSERT INTO instruments 
          (id, instrument_code, instrument_name, model, last_calibration, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          instrumentId, record.instrument_code, record.instrument_name || null, 
          record.model || null, record.last_calibration || null, record.status || 'active'
        );
        
        result = { status: 'success', recordId: instrumentId, recordType: 'instrument' };
      }
      break;
    }
    
    default:
      throw new Error(`未知的记录类型: ${rejectedRecord.record_type}`);
  }
  
  return result;
};

const getRiskAssessmentHistory = (rejectedRecordId) => {
  return db.prepare(`
    SELECT * FROM risk_assessments 
    WHERE rejected_record_id = ? 
    ORDER BY assessed_at DESC
  `).all(rejectedRecordId);
};

const bulkRecalculateRisk = (options = {}) => {
  const { riskLevel, batchNumber, recordType } = options;
  
  let query = `SELECT id, error_reason, original_content, fixed_content FROM rejected_records WHERE is_fixed = 0`;
  const params = [];
  
  if (riskLevel) {
    query += ` AND risk_level = ?`;
    params.push(riskLevel);
  }
  
  if (batchNumber) {
    query += ` AND batch_id IN (SELECT id FROM batches WHERE batch_number = ?)`;
    params.push(batchNumber);
  }
  
  if (recordType) {
    query += ` AND record_type = ?`;
    params.push(recordType);
  }
  
  const records = db.prepare(query).all(...params);
  const results = [];
  
  for (const record of records) {
    try {
      const risk = utils.calculateRiskScore(
        record.error_reason,
        record.fixed_content || record.original_content
      );
      
      db.prepare(`
        UPDATE rejected_records SET
          risk_level = ?,
          risk_score = ?
        WHERE id = ?
      `).run(risk.level, risk.score, record.id);
      
      results.push({
        rejectedRecordId: record.id,
        success: true,
        riskLevel: risk.level,
        riskScore: risk.score
      });
    } catch (error) {
      results.push({
        rejectedRecordId: record.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    total: records.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    details: results
  };
};

module.exports = {
  markAsFixed,
  recalculateRisk,
  processFixedRecord,
  getRiskAssessmentHistory,
  bulkRecalculateRisk
};
