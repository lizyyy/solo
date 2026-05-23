const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const accessControlService = require('./accessControlService');
const exceptionService = require('./exceptionService');

class GateEventService {
  createEvent(eventData) {
    const id = uuidv4();
    const eventNo = `EVT-${Date.now()}`;
    const transactionId = uuidv4();

    let validationResult;
    try {
      validationResult = accessControlService.validateAccess(eventData);
    } catch (error) {
      exceptionService.logException({
        transaction_id: transactionId,
        api_endpoint: '/api/gate-events',
        raw_input: eventData,
        error_type: 'VALIDATION_ERROR',
        error_message: error.message,
        processing_result: { success: false, error: error.message }
      });
      throw error;
    }

    const dedupHash = accessControlService.generateDedupHash(
      eventData.id_card,
      eventData.gate_no,
      eventData.direction,
      eventData.event_time
    );

    const stmt = db.prepare(`
      INSERT INTO gate_events (
        id, event_no, personnel_id, visitor_application_id, person_type,
        name, id_card, gate_no, direction, event_time, access_result,
        access_reason, photo_captured, temperature, mask_detected, dedup_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      eventNo,
      eventData.personnel_id || null,
      eventData.visitor_application_id || null,
      eventData.person_type,
      eventData.name || null,
      eventData.id_card || null,
      eventData.gate_no,
      eventData.direction,
      eventData.event_time,
      validationResult.allowed ? 'allowed' : 'denied',
      validationResult.reason,
      eventData.photo_captured || null,
      eventData.temperature || null,
      eventData.mask_detected ? 1 : 0,
      dedupHash
    );

    if (!validationResult.allowed) {
      exceptionService.logException({
        transaction_id: transactionId,
        api_endpoint: '/api/gate-events',
        raw_input: eventData,
        error_type: 'ACCESS_DENIED',
        error_message: validationResult.reason,
        processing_result: { 
          success: false, 
          access_denied: true, 
          reason: validationResult.reason,
          validation_details: validationResult 
        },
        related_gate_event_id: id,
        related_personnel_id: eventData.personnel_id || null
      });
    }

    return {
      id,
      event_no: eventNo,
      transaction_id: transactionId,
      access_result: validationResult.allowed ? 'allowed' : 'denied',
      access_reason: validationResult.reason,
      validation_details: validationResult
    };
  }

  getEventById(id) {
    const stmt = db.prepare(`
      SELECT 
        ge.*,
        p.employee_id,
        p.department,
        p.status as personnel_status,
        t.status as training_status,
        t.expiry_date as training_expiry,
        b.id as blacklist_id,
        b.reason as blacklist_reason,
        va.status as visitor_status,
        va.scheduled_start,
        va.scheduled_end
      FROM gate_events ge
      LEFT JOIN personnel p ON ge.personnel_id = p.id
      LEFT JOIN training_status t ON ge.personnel_id = t.personnel_id
      LEFT JOIN blacklist b ON (ge.personnel_id = b.personnel_id OR ge.id_card = b.id_card)
      LEFT JOIN visitor_applications va ON ge.visitor_application_id = va.id
      WHERE ge.id = ?
    `);
    return stmt.get(id);
  }

  getEvents(filters = {}) {
    let sql = `
      SELECT 
        ge.*,
        p.employee_id,
        p.department,
        va.visitor_company
      FROM gate_events ge
      LEFT JOIN personnel p ON ge.personnel_id = p.id
      LEFT JOIN visitor_applications va ON ge.visitor_application_id = va.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.person_type) {
      sql += ' AND ge.person_type = ?';
      params.push(filters.person_type);
    }

    if (filters.access_result) {
      sql += ' AND ge.access_result = ?';
      params.push(filters.access_result);
    }

    if (filters.start_time) {
      sql += ' AND ge.event_time >= ?';
      params.push(filters.start_time);
    }

    if (filters.end_time) {
      sql += ' AND ge.event_time <= ?';
      params.push(filters.end_time);
    }

    sql += ' ORDER BY ge.event_time DESC LIMIT ? OFFSET ?';
    params.push(filters.limit || 100);
    params.push(filters.offset || 0);

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  getEventTrace(eventId) {
    const event = this.getEventById(eventId);
    if (!event) return null;

    const trace = {
      event,
      related: {}
    };

    const exceptionStmt = db.prepare(`
      SELECT * FROM exception_logs 
      WHERE related_gate_event_id = ?
    `);
    trace.related.exceptions = exceptionStmt.all(eventId);

    const correctionStmt = db.prepare(`
      SELECT * FROM manual_corrections 
      WHERE target_record_id = ? AND target_table = 'gate_events'
      ORDER BY created_at DESC
    `);
    trace.related.corrections = correctionStmt.all(eventId);

    return trace;
  }
}

module.exports = new GateEventService();
