const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const { upsertFactRecord, findExistingFact } = require('../utils/idempotency');
const { classifyDirtyRecord, createDirtyRecord, DIRTY_TYPES } = require('../utils/dirtyRecordClassifier');
const { addToQueue } = require('./compensationQueue');
const { recordOperation } = require('./operationHistory');

function receiveAppointment(data) {
  const db = getDatabase();
  
  const appointmentNo = data.appointment_no || `APT${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
  
  const relatedRecords = getRelatedRecords(appointmentNo, null, null);
  
  const issues = classifyDirtyRecord('appointment', { ...data, appointment_no: appointmentNo }, relatedRecords);
  const hasDirtyIssues = issues.length > 0;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO visitor_appointments (
        appointment_no, visitor_name, visitor_phone, id_card, license_plate,
        visit_date, visit_time_start, visit_time_end, visit_reason,
        visitor_company, host_department, host_name, status, source, source_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(appointment_no) DO UPDATE SET
        visitor_name = COALESCE(EXCLUDED.visitor_name, visitor_name),
        visitor_phone = COALESCE(EXCLUDED.visitor_phone, visitor_phone),
        id_card = COALESCE(EXCLUDED.id_card, id_card),
        license_plate = COALESCE(EXCLUDED.license_plate, license_plate),
        visit_date = COALESCE(EXCLUDED.visit_date, visit_date),
        visit_time_start = COALESCE(EXCLUDED.visit_time_start, visit_time_start),
        visit_time_end = COALESCE(EXCLUDED.visit_time_end, visit_time_end),
        visit_reason = COALESCE(EXCLUDED.visit_reason, visit_reason),
        visitor_company = COALESCE(EXCLUDED.visitor_company, visitor_company),
        host_department = COALESCE(EXCLUDED.host_department, host_department),
        host_name = COALESCE(EXCLUDED.host_name, host_name),
        updated_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(
      appointmentNo,
      data.visitor_name,
      data.visitor_phone,
      data.id_card,
      data.license_plate,
      data.visit_date,
      data.visit_time_start,
      data.visit_time_end,
      data.visit_reason,
      data.visitor_company,
      data.host_department,
      data.host_name,
      data.source || 'api',
      data.source_id || appointmentNo
    );
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint failed')) {
      throw e;
    }
  }
  
  const factResult = upsertFactRecord({
    appointment_no: appointmentNo,
    visitor_name: data.visitor_name,
    license_plate: data.license_plate,
    visit_date: data.visit_date,
    data_sources: [{ source: data.source || 'api', type: 'appointment', source_id: appointmentNo }]
  });
  
  if (hasDirtyIssues) {
    for (const issue of issues) {
      createDirtyRecord('appointment', appointmentNo, issue, data, factResult.fact_id);
    }
    addToQueue('appointment', appointmentNo, factResult.fact_id, {
      priority: hasDirtyIssues ? 8 : 5,
      createdBy: data.source || 'api'
    });
  }
  
  recordOperation(
    factResult.fact_id,
    null,
    null,
    'appointment_received',
    data.source || 'api',
    null,
    { appointment_no: appointmentNo, ...data },
    hasDirtyIssues ? '收到预约记录，存在数据质量问题' : '收到预约记录'
  );
  
  return {
    appointment_no: appointmentNo,
    fact_id: factResult.fact_id,
    is_new: factResult.is_new,
    has_dirty_issues: hasDirtyIssues,
    dirty_issues: issues
  };
}

function receiveGateRecord(data) {
  const db = getDatabase();
  
  const recordNo = data.record_no || `GATE${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
  
  const relatedRecords = getRelatedRecords(data.appointment_no, recordNo, null);
  
  const issues = classifyDirtyRecord('gate', { ...data, record_no: recordNo }, relatedRecords);
  const hasDirtyIssues = issues.length > 0;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO gate_records (
        record_no, gate_no, gate_name, visitor_name, license_plate,
        id_card, pass_time, pass_direction, pass_type, snapshot_url,
        temperature, health_code_status, source, source_id, appointment_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_no) DO UPDATE SET
        visitor_name = COALESCE(EXCLUDED.visitor_name, visitor_name),
        license_plate = COALESCE(EXCLUDED.license_plate, license_plate),
        pass_time = COALESCE(EXCLUDED.pass_time, pass_time),
        appointment_no = COALESCE(EXCLUDED.appointment_no, appointment_no)
    `);
    
    stmt.run(
      recordNo,
      data.gate_no,
      data.gate_name,
      data.visitor_name,
      data.license_plate,
      data.id_card,
      data.pass_time,
      data.pass_direction,
      data.pass_type,
      data.snapshot_url,
      data.temperature,
      data.health_code_status,
      data.source || 'api',
      data.source_id || recordNo,
      data.appointment_no
    );
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint failed')) {
      throw e;
    }
  }
  
  const factResult = upsertFactRecord({
    appointment_no: data.appointment_no,
    gate_record_no: recordNo,
    visitor_name: data.visitor_name,
    license_plate: data.license_plate,
    pass_time: data.pass_time,
    data_sources: [{ source: data.source || 'api', type: 'gate', source_id: recordNo }]
  });
  
  if (hasDirtyIssues) {
    for (const issue of issues) {
      createDirtyRecord('gate', recordNo, issue, data, factResult.fact_id);
    }
    addToQueue('gate', recordNo, factResult.fact_id, {
      priority: hasDirtyIssues ? 8 : 5,
      createdBy: data.source || 'api'
    });
  }
  
  recordOperation(
    factResult.fact_id,
    null,
    null,
    'gate_record_received',
    data.source || 'api',
    null,
    { record_no: recordNo, ...data },
    hasDirtyIssues ? '收到闸机记录，存在数据质量问题' : '收到闸机记录'
  );
  
  return {
    record_no: recordNo,
    fact_id: factResult.fact_id,
    is_new: factResult.is_new,
    has_dirty_issues: hasDirtyIssues,
    dirty_issues: issues
  };
}

function receiveScreenshot(data) {
  const db = getDatabase();
  
  const screenshotNo = data.screenshot_no || `SCR${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
  
  const relatedRecords = getRelatedRecords(data.appointment_no, data.gate_record_no, screenshotNo);
  
  const issues = classifyDirtyRecord('screenshot', { ...data, screenshot_no: screenshotNo }, relatedRecords);
  const hasDirtyIssues = issues.length > 0;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO license_plate_screenshots (
        screenshot_no, license_plate, recognized_plate, confidence,
        capture_time, capture_gate, image_url, ocr_result,
        appointment_no, gate_record_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(screenshot_no) DO UPDATE SET
        license_plate = COALESCE(EXCLUDED.license_plate, license_plate),
        recognized_plate = COALESCE(EXCLUDED.recognized_plate, recognized_plate),
        capture_time = COALESCE(EXCLUDED.capture_time, capture_time),
        is_correct = CASE
          WHEN EXCLUDED.license_plate = EXCLUDED.recognized_plate THEN 1
          ELSE 0
        END
    `);
    
    stmt.run(
      screenshotNo,
      data.license_plate,
      data.recognized_plate,
      data.confidence,
      data.capture_time,
      data.capture_gate,
      data.image_url,
      data.ocr_result,
      data.appointment_no,
      data.gate_record_no
    );
  } catch (e) {
    if (!e.message.includes('UNIQUE constraint failed')) {
      throw e;
    }
  }
  
  const factResult = upsertFactRecord({
    appointment_no: data.appointment_no,
    gate_record_no: data.gate_record_no,
    screenshot_no: screenshotNo,
    license_plate: data.license_plate || data.recognized_plate,
    visit_date: data.capture_time ? data.capture_time.split(' ')[0] : null,
    data_sources: [{ source: data.source || 'api', type: 'screenshot', source_id: screenshotNo }]
  });
  
  if (hasDirtyIssues) {
    for (const issue of issues) {
      createDirtyRecord('screenshot', screenshotNo, issue, data, factResult.fact_id);
    }
    addToQueue('screenshot', screenshotNo, factResult.fact_id, {
      priority: hasDirtyIssues ? 8 : 5,
      createdBy: data.source || 'api'
    });
  }
  
  recordOperation(
    factResult.fact_id,
    null,
    null,
    'screenshot_received',
    data.source || 'api',
    null,
    { screenshot_no: screenshotNo, ...data },
    hasDirtyIssues ? '收到车牌截图，存在数据质量问题' : '收到车牌截图'
  );
  
  return {
    screenshot_no: screenshotNo,
    fact_id: factResult.fact_id,
    is_new: factResult.is_new,
    has_dirty_issues: hasDirtyIssues,
    dirty_issues: issues
  };
}

function getRelatedRecords(appointmentNo, gateRecordNo, screenshotNo) {
  const db = getDatabase();
  const records = [];
  
  if (appointmentNo) {
    const apt = db.prepare(`SELECT * FROM visitor_appointments WHERE appointment_no = ?`).get(appointmentNo);
    if (apt) records.push(apt);
  }
  
  if (gateRecordNo) {
    const gate = db.prepare(`SELECT * FROM gate_records WHERE record_no = ?`).get(gateRecordNo);
    if (gate) records.push(gate);
  }
  
  if (screenshotNo) {
    const scr = db.prepare(`SELECT * FROM license_plate_screenshots WHERE screenshot_no = ?`).get(screenshotNo);
    if (scr) records.push(scr);
  }
  
  const fact = findExistingFact(appointmentNo, gateRecordNo, screenshotNo);
  if (fact) {
    if (fact.appointment_no && fact.appointment_no !== appointmentNo) {
      const apt = db.prepare(`SELECT * FROM visitor_appointments WHERE appointment_no = ?`).get(fact.appointment_no);
      if (apt) records.push(apt);
    }
    if (fact.gate_record_no && fact.gate_record_no !== gateRecordNo) {
      const gate = db.prepare(`SELECT * FROM gate_records WHERE record_no = ?`).get(fact.gate_record_no);
      if (gate) records.push(gate);
    }
  }
  
  return records;
}

module.exports = {
  receiveAppointment,
  receiveGateRecord,
  receiveScreenshot
};
