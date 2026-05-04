const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');

class ValidationViolation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.violation_type = data.violation_type;
    this.severity = data.severity || 'high';
    this.related_entity_type = data.related_entity_type;
    this.related_entity_id = data.related_entity_id;
    this.description = data.description;
    this.detected_at = data.detected_at;
    this.status = data.status || 'open';
    this.reviewed_by = data.reviewed_by;
    this.reviewed_at = data.reviewed_at;
    this.review_comments = data.review_comments;
    this.resolution_notes = data.resolution_notes;
    this.resolved_at = data.resolved_at;
  }

  static async create(data) {
    const violation = new ValidationViolation(data);

    await runAsync(
      `INSERT INTO validation_violations 
       (id, violation_type, severity, related_entity_type, related_entity_id, 
        description, detected_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [violation.id, violation.violation_type, violation.severity, 
       violation.related_entity_type, violation.related_entity_id,
       violation.description, violation.detected_at || new Date().toISOString(), 
       violation.status]
    );

    return violation;
  }

  static async update(violationId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'status', 'reviewed_by', 'reviewed_at', 'review_comments',
      'resolution_notes', 'resolved_at'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    values.push(violationId);

    await runAsync(
      `UPDATE validation_violations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async findById(violationId) {
    const row = await getAsync(
      'SELECT * FROM validation_violations WHERE id = ?',
      [violationId]
    );
    return row ? new ValidationViolation(row) : null;
  }

  static async findAll(options = {}) {
    const { status, violation_type, severity, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM validation_violations WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (violation_type) {
      sql += ' AND violation_type = ?';
      params.push(violation_type);
    }
    
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }

    sql += ' ORDER BY detected_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new ValidationViolation(row));
  }

  static async getOpenViolations() {
    const rows = await allAsync(
      `SELECT vv.*, rd.decision, rd.comments as review_decision
       FROM validation_violations vv
       LEFT JOIN review_decisions rd ON vv.id = rd.violation_id
       WHERE vv.status = 'open'
       ORDER BY 
         CASE vv.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           ELSE 4 
         END,
         vv.detected_at ASC`
    );
    return rows.map(row => new ValidationViolation(row));
  }

  static async addReviewDecision(violationId, decisionData) {
    const { reviewer, decision, comments, action_items } = decisionData;
    const decisionId = uuidv4();
    const now = new Date().toISOString();

    await runAsync(
      `INSERT INTO review_decisions 
       (id, violation_id, reviewer, decision, comments, action_items, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [decisionId, violationId, reviewer, decision, comments, 
       action_items ? JSON.stringify(action_items) : null, now]
    );

    let newStatus = 'reviewed';
    if (decision === 'dismiss') {
      newStatus = 'dismissed';
    } else if (decision === 'resolve') {
      newStatus = 'resolved';
    }

    await ValidationViolation.update(violationId, {
      status: newStatus,
      reviewed_by: reviewer,
      reviewed_at: now,
      review_comments: comments
    });

    return decisionId;
  }

  static async getViolationSummary() {
    const rows = await allAsync(
      `SELECT 
        violation_type,
        severity,
        status,
        COUNT(*) as count
       FROM validation_violations
       GROUP BY violation_type, severity, status
       ORDER BY violation_type, severity`
    );
    return rows;
  }

  static async getByRelatedEntity(entityType, entityId) {
    const rows = await allAsync(
      `SELECT * FROM validation_violations 
       WHERE related_entity_type = ? AND related_entity_id = ?
       ORDER BY detected_at DESC`,
      [entityType, entityId]
    );
    return rows.map(row => new ValidationViolation(row));
  }

  static async resolveViolation(violationId, resolutionNotes, resolvedBy) {
    const now = new Date().toISOString();
    
    await ValidationViolation.update(violationId, {
      status: 'resolved',
      resolution_notes: resolutionNotes,
      resolved_at: now
    });

    await runAsync(
      `INSERT INTO review_decisions 
       (id, violation_id, reviewer, decision, comments, created_at)
       VALUES (?, ?, ?, 'resolve', ?, ?)`,
      [uuidv4(), violationId, resolvedBy, resolutionNotes, now]
    );
  }

  static async getStatistics() {
    const [openCount, resolvedCount, dismissedCount] = await Promise.all([
      getAsync(`SELECT COUNT(*) as count FROM validation_violations WHERE status = 'open'`),
      getAsync(`SELECT COUNT(*) as count FROM validation_violations WHERE status = 'resolved'`),
      getAsync(`SELECT COUNT(*) as count FROM validation_violations WHERE status = 'dismissed'`)
    ]);

    const byType = await allAsync(
      `SELECT violation_type, COUNT(*) as count 
       FROM validation_violations 
       GROUP BY violation_type`
    );

    const bySeverity = await allAsync(
      `SELECT severity, COUNT(*) as count 
       FROM validation_violations 
       WHERE status = 'open'
       GROUP BY severity`
    );

    return {
      total: {
        open: openCount ? openCount.count : 0,
        resolved: resolvedCount ? resolvedCount.count : 0,
        dismissed: dismissedCount ? dismissedCount.count : 0
      },
      by_type: byType,
      by_severity_open: bySeverity
    };
  }
}

module.exports = ValidationViolation;
