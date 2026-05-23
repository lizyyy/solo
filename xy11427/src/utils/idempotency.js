const crypto = require('crypto');
const { getDatabase } = require('../config/database');

function generateFactId(recordType, keyFields) {
  const sortedKeys = Object.keys(keyFields).sort();
  const keyString = sortedKeys.map(k => `${k}:${keyFields[k] || ''}`).join('|');
  const hash = crypto.createHash('sha256').update(`${recordType}|${keyString}`).digest('hex');
  return `fact_${hash.substring(0, 16)}`;
}

function findExistingFact(appointmentNo, gateRecordNo, screenshotNo) {
  const db = getDatabase();
  
  const conditions = [];
  const params = [];
  
  if (appointmentNo) {
    conditions.push('appointment_no = ?');
    params.push(appointmentNo);
  }
  if (gateRecordNo) {
    conditions.push('gate_record_no = ?');
    params.push(gateRecordNo);
  }
  if (screenshotNo) {
    conditions.push('screenshot_no = ?');
    params.push(screenshotNo);
  }
  
  if (conditions.length === 0) return null;
  
  const stmt = db.prepare(`
    SELECT * FROM fact_records 
    WHERE ${conditions.join(' OR ')}
    LIMIT 1
  `);
  
  return stmt.get(...params);
}

function upsertFactRecord(factData) {
  const db = getDatabase();
  const existing = findExistingFact(
    factData.appointment_no,
    factData.gate_record_no,
    factData.screenshot_no
  );
  
  const now = new Date().toISOString();
  
  if (existing) {
    const updatedSources = mergeDataSources(
      existing.data_sources ? JSON.parse(existing.data_sources) : [],
      factData.data_sources || []
    );
    
    const stmt = db.prepare(`
      UPDATE fact_records 
      SET appointment_no = COALESCE(?, appointment_no),
          gate_record_no = COALESCE(?, gate_record_no),
          screenshot_no = COALESCE(?, screenshot_no),
          visitor_name = COALESCE(?, visitor_name),
          license_plate = COALESCE(?, license_plate),
          visit_date = COALESCE(?, visit_date),
          pass_time = COALESCE(?, pass_time),
          data_sources = ?,
          latest_snapshot = ?,
          updated_at = ?
      WHERE fact_id = ?
    `);
    
    stmt.run(
      factData.appointment_no || existing.appointment_no,
      factData.gate_record_no || existing.gate_record_no,
      factData.screenshot_no || existing.screenshot_no,
      factData.visitor_name || existing.visitor_name,
      factData.license_plate || existing.license_plate,
      factData.visit_date || existing.visit_date,
      factData.pass_time || existing.pass_time,
      JSON.stringify(updatedSources),
      JSON.stringify({ ...factData, updated_at: now }),
      now,
      existing.fact_id
    );
    
    return { ...existing, is_new: false };
  } else {
    const factId = generateFactId('visitor', {
      appointment_no: factData.appointment_no,
      gate_record_no: factData.gate_record_no,
      screenshot_no: factData.screenshot_no
    });
    
    const stmt = db.prepare(`
      INSERT INTO fact_records (
        fact_id, appointment_no, gate_record_no, screenshot_no,
        visitor_name, license_plate, visit_date, pass_time,
        data_sources, latest_snapshot, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      factId,
      factData.appointment_no,
      factData.gate_record_no,
      factData.screenshot_no,
      factData.visitor_name,
      factData.license_plate,
      factData.visit_date,
      factData.pass_time,
      JSON.stringify(factData.data_sources || []),
      JSON.stringify({ ...factData, created_at: now }),
      now,
      now
    );
    
    return { fact_id: factId, is_new: true };
  }
}

function mergeDataSources(existing, newSources) {
  const merged = [...existing];
  for (const source of newSources) {
    if (!merged.find(s => s.source === source.source && s.source_id === source.source_id)) {
      merged.push(source);
    }
  }
  return merged;
}

module.exports = {
  generateFactId,
  findExistingFact,
  upsertFactRecord
};
