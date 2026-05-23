const { getDatabase } = require('../config/database');
const { getFactHistory, getFactNotes } = require('./operationHistory');

function getFactById(factId) {
  const db = getDatabase();
  
  const fact = db.prepare(`
    SELECT * FROM fact_records WHERE fact_id = ?
  `).get(factId);
  
  if (!fact) return null;
  
  return enrichFactWithDetails(fact);
}

function getFactByAppointment(appointmentNo) {
  const db = getDatabase();
  
  const fact = db.prepare(`
    SELECT * FROM fact_records WHERE appointment_no = ?
  `).get(appointmentNo);
  
  if (!fact) return null;
  
  return enrichFactWithDetails(fact);
}

function enrichFactWithDetails(fact) {
  const db = getDatabase();
  
  const appointment = fact.appointment_no ? db.prepare(`
    SELECT * FROM visitor_appointments WHERE appointment_no = ?
  `).get(fact.appointment_no) : null;
  
  const gateRecord = fact.gate_record_no ? db.prepare(`
    SELECT * FROM gate_records WHERE record_no = ?
  `).get(fact.gate_record_no) : null;
  
  const screenshot = fact.screenshot_no ? db.prepare(`
    SELECT * FROM license_plate_screenshots WHERE screenshot_no = ?
  `).get(fact.screenshot_no) : null;
  
  const queueItems = db.prepare(`
    SELECT * FROM compensation_queue WHERE fact_id = ?
    ORDER BY created_at DESC
  `).all(fact.fact_id);
  
  const dirtyRecords = db.prepare(`
    SELECT * FROM dirty_records WHERE fact_id = ?
    ORDER BY created_at DESC
  `).all(fact.fact_id).map(r => ({
    ...r,
    original_data: JSON.parse(r.original_data)
  }));
  
  const history = getFactHistory(fact.fact_id);
  const notes = getFactNotes(fact.fact_id);
  
  return {
    ...fact,
    data_sources: fact.data_sources ? JSON.parse(fact.data_sources) : [],
    latest_snapshot: fact.latest_snapshot ? JSON.parse(fact.latest_snapshot) : null,
    appointment,
    gate_record: gateRecord,
    screenshot,
    queue_items: queueItems,
    dirty_records: dirtyRecords,
    operation_history: history,
    manual_notes: notes
  };
}

function listFacts(options = {}) {
  const db = getDatabase();
  const {
    status = 'active',
    has_dirty = null,
    page = 1,
    page_size = 20,
    start_date = null,
    end_date = null
  } = options;
  
  let whereClause = 'WHERE 1=1';
  const params = [];
  
  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  
  if (has_dirty !== null) {
    whereClause += has_dirty 
      ? ' AND EXISTS (SELECT 1 FROM dirty_records dr WHERE dr.fact_id = fact_records.fact_id AND dr.status = "pending")'
      : ' AND NOT EXISTS (SELECT 1 FROM dirty_records dr WHERE dr.fact_id = fact_records.fact_id AND dr.status = "pending")';
  }
  
  if (start_date) {
    whereClause += ' AND visit_date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    whereClause += ' AND visit_date <= ?';
    params.push(end_date);
  }
  
  const offset = (page - 1) * page_size;
  
  const facts = db.prepare(`
    SELECT * FROM fact_records
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, page_size, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM fact_records ${whereClause}
  `).get(...params).count;
  
  return {
    facts: facts.map(f => ({
      ...f,
      data_sources: f.data_sources ? JSON.parse(f.data_sources) : []
    })),
    pagination: {
      page,
      page_size,
      total,
      total_pages: Math.ceil(total / page_size)
    }
  };
}

function updateFactConsistency(factId) {
  const db = getDatabase();
  
  const fact = getFactById(factId);
  if (!fact) return false;
  
  let consistencyScore = 100;
  const issues = [];
  
  if (fact.appointment && fact.gate_record) {
    if (fact.appointment.visitor_name !== fact.gate_record.visitor_name) {
      consistencyScore -= 20;
      issues.push('访客姓名不一致');
    }
    
    if (fact.appointment.license_plate && fact.gate_record.license_plate &&
        fact.appointment.license_plate !== fact.gate_record.license_plate) {
      consistencyScore -= 25;
      issues.push('车牌号码不一致');
    }
  }
  
  if (fact.screenshot && fact.appointment) {
    if (fact.appointment.license_plate && fact.screenshot.recognized_plate &&
        fact.appointment.license_plate !== fact.screenshot.recognized_plate) {
      consistencyScore -= 20;
      issues.push('预约车牌与识别车牌不一致');
    }
  }
  
  if (fact.dirty_records && fact.dirty_records.some(d => d.status === 'pending')) {
    consistencyScore -= 15;
    issues.push('存在未处理的脏数据');
  }
  
  consistencyScore = Math.max(0, consistencyScore);
  
  db.prepare(`
    UPDATE fact_records
    SET is_consistent = ?,
        consistency_score = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE fact_id = ?
  `).run(consistencyScore >= 80 ? 1 : 0, consistencyScore, factId);
  
  return {
    fact_id: factId,
    consistency_score: consistencyScore,
    is_consistent: consistencyScore >= 80,
    issues
  };
}

function handleDirtyRecord(dirtyRecordId, action, handler, notes = '') {
  const db = getDatabase();
  
  const dirtyRecord = db.prepare(`
    SELECT * FROM dirty_records WHERE record_id = ?
  `).get(dirtyRecordId);
  
  if (!dirtyRecord) {
    throw new Error('脏记录不存在');
  }
  
  let status = 'handled';
  if (action === 'ignore') status = 'ignored';
  if (action === 'fix') status = 'fixed';
  
  db.prepare(`
    UPDATE dirty_records
    SET status = ?,
        handled_by = ?,
        handled_at = CURRENT_TIMESTAMP,
        handling_notes = ?
    WHERE record_id = ?
  `).run(status, handler, notes, dirtyRecordId);
  
  if (dirtyRecord.fact_id) {
    updateFactConsistency(dirtyRecord.fact_id);
  }
  
  return true;
}

module.exports = {
  getFactById,
  getFactByAppointment,
  enrichFactWithDetails,
  listFacts,
  updateFactConsistency,
  handleDirtyRecord
};
