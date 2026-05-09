const { stringify } = require('csv-stringify/sync');
const {
  generateId,
  nowIso,
  generateOrderNo,
  generateComplaintNo,
  canTransition
} = require('./utils');
const { checkIdempotency, recordIdempotency, requireFields } = require('./middleware');
const {
  analyzeDecibelRecords,
  calculateCompensation,
  evaluateEvidenceQuality,
  requiresReview
} = require('./decibel-service');

function registerRoutes(app, db) {

  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      service: 'bnb-noise-complaint-api',
      version: '1.0.0',
      timestamp: nowIso()
    });
  });

  app.post('/api/orders',
    checkIdempotency(db, 'order'),
    requireFields(['property_id', 'property_name', 'guest_name', 'check_in_date', 'check_out_date', 'total_amount']),
    (req, res) => {
      const id = generateId();
      const orderNo = req.body.order_no || generateOrderNo();
      const now = nowIso();

      try {
        db.prepare(`
          INSERT INTO orders (
            id, idempotency_key, order_no, property_id, property_name,
            guest_name, guest_phone, check_in_date, check_out_date,
            total_amount, status, room_no, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
        `).run(
          id,
          req.idempotencyKey || null,
          orderNo,
          req.body.property_id,
          req.body.property_name,
          req.body.guest_name,
          req.body.guest_phone || null,
          req.body.check_in_date,
          req.body.check_out_date,
          req.body.total_amount,
          req.body.room_no || null,
          now,
          now
        );

        recordIdempotency(db, req.idempotencyKey, 'order', id, req.body);

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        res.status(201).json({
          success: true,
          data: order
        });
      } catch (e) {
        if (e.message.includes('UNIQUE constraint') && e.message.includes('order_no')) {
          return res.status(409).json({
            success: false,
            error: 'DUPLICATE_ORDER_NO',
            message: '订单号已存在'
          });
        }
        throw e;
      }
    }
  );

  app.get('/api/orders/:id', (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '订单不存在'
      });
    }
    res.json({ success: true, data: order });
  });

  app.get('/api/orders', (req, res) => {
    const { property_id, status, guest_name } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (property_id) {
      sql += ' AND property_id = ?';
      params.push(property_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (guest_name) {
      sql += ' AND guest_name LIKE ?';
      params.push(`%${guest_name}%`);
    }

    const orders = db.prepare(sql).all(...params);
    res.json({ success: true, data: orders, total: orders.length });
  });

  app.post('/api/decibel-records',
    checkIdempotency(db, 'decibel'),
    requireFields(['order_id', 'property_id', 'record_time', 'db_value']),
    (req, res) => {
      const id = generateId();
      const now = nowIso();

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: '关联订单不存在'
        });
      }

      db.prepare(`
        INSERT INTO decibel_records (
          id, idempotency_key, order_id, property_id, record_time,
          db_value, duration_seconds, location, source, raw_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.idempotencyKey || null,
        req.body.order_id,
        req.body.property_id,
        req.body.record_time,
        req.body.db_value,
        req.body.duration_seconds || 60,
        req.body.location || null,
        req.body.source || null,
        req.body.raw_data ? JSON.stringify(req.body.raw_data) : null,
        now
      );

      recordIdempotency(db, req.idempotencyKey, 'decibel', id, req.body);

      const record = db.prepare('SELECT * FROM decibel_records WHERE id = ?').get(id);
      res.status(201).json({
        success: true,
        data: record
      });
    }
  );

  app.get('/api/decibel-records/:id', (req, res) => {
    const record = db.prepare('SELECT * FROM decibel_records WHERE id = ?').get(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '分贝记录不存在'
      });
    }
    res.json({ success: true, data: record });
  });

  app.post('/api/complaints',
    checkIdempotency(db, 'complaint'),
    requireFields(['order_id', 'property_id', 'reporter_type', 'reporter_name', 'complaint_time', 'description']),
    (req, res) => {
      const id = generateId();
      const complaintNo = req.body.complaint_no || generateComplaintNo();
      const now = nowIso();

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.body.order_id);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: '关联订单不存在'
        });
      }

      const validReporterTypes = ['guest', 'neighbor', 'staff'];
      if (!validReporterTypes.includes(req.body.reporter_type)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REPORTER_TYPE',
          message: '投诉人类型必须是: guest, neighbor, staff',
          allowed_types: validReporterTypes
        });
      }

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO complaints (
            id, idempotency_key, order_id, property_id, complaint_no,
            reporter_type, reporter_name, reporter_phone, complaint_time,
            description, status, priority, assigned_to, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        `).run(
          id,
          req.idempotencyKey || null,
          req.body.order_id,
          req.body.property_id,
          complaintNo,
          req.body.reporter_type,
          req.body.reporter_name,
          req.body.reporter_phone || null,
          req.body.complaint_time,
          req.body.description,
          req.body.priority || 'medium',
          req.body.assigned_to || null,
          now,
          now
        );

        db.prepare(`
          INSERT INTO process_history (id, complaint_id, action, from_status, to_status, operator, remark, created_at)
          VALUES (?, ?, 'create', NULL, 'pending', ?, ?, ?)
        `).run(
          generateId(),
          id,
          req.body.operator || 'system',
          `投诉创建，投诉人: ${req.body.reporter_name}`,
          now
        );
      });

      tx();

      recordIdempotency(db, req.idempotencyKey, 'complaint', id, req.body);

      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
      res.status(201).json({
        success: true,
        data: complaint
      });
    }
  );

  app.get('/api/complaints/:id', (req, res) => {
    const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '投诉单不存在'
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(complaint.order_id);
    const decibelRecords = db.prepare('SELECT * FROM decibel_records WHERE order_id = ? ORDER BY record_time').all(complaint.order_id);
    const evidenceSegments = db.prepare('SELECT * FROM evidence_segments WHERE complaint_id = ? ORDER BY segment_time').all(complaint.id);
    const history = db.prepare('SELECT * FROM process_history WHERE complaint_id = ? ORDER BY created_at').all(complaint.id);

    const rules = db.prepare('SELECT * FROM compensation_rules WHERE is_active = 1').all();
    const analysis = analyzeDecibelRecords(decibelRecords, rules);
    const evidenceQuality = evaluateEvidenceQuality(evidenceSegments);
    const compensation = calculateCompensation(analysis, order, rules);
    const review = requiresReview(analysis, evidenceQuality, complaint);

    res.json({
      success: true,
      data: {
        complaint,
        order,
        decibel_records: decibelRecords,
        evidence_segments: evidenceSegments,
        process_history: history,
        analysis: {
          decibel_analysis: analysis,
          evidence_quality: evidenceQuality,
          compensation_calculation: compensation,
          review_required: review
        }
      }
    });
  });

  app.post('/api/complaints/:id/advance',
    requireFields(['to_status', 'operator']),
    (req, res) => {
      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '投诉单不存在'
        });
      }

      const fromStatus = complaint.status;
      const toStatus = req.body.to_status;

      if (!canTransition(fromStatus, toStatus)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_STATUS_TRANSITION',
          message: `无法从 ${fromStatus} 转换到 ${toStatus}`,
          from_status: fromStatus,
          to_status: toStatus
        });
      }

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(complaint.order_id);
      const decibelRecords = db.prepare('SELECT * FROM decibel_records WHERE order_id = ? ORDER BY record_time').all(complaint.order_id);
      const evidenceSegments = db.prepare('SELECT * FROM evidence_segments WHERE complaint_id = ? ORDER BY segment_time').all(complaint.id);
      const rules = db.prepare('SELECT * FROM compensation_rules WHERE is_active = 1').all();

      const analysis = analyzeDecibelRecords(decibelRecords, rules);
      const evidenceQuality = evaluateEvidenceQuality(evidenceSegments);
      const compensation = calculateCompensation(analysis, order, rules);
      const review = requiresReview(analysis, evidenceQuality, complaint);

      if (toStatus === 'verifying' && !analysis.hasEvidence) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_EVIDENCE',
          message: '缺少有效噪音证据，无法进入验证阶段',
          issues: ['请先上传分贝记录或证据片段']
        });
      }

      if (toStatus === 'approved' && review.required) {
        return res.status(400).json({
          success: false,
          error: 'REVIEW_REQUIRED',
          message: '需要人工复核才能审批',
          review_reasons: review.reasons
        });
      }

      if (toStatus === 'pending_review' && !review.required) {
        return res.status(400).json({
          success: false,
          error: 'NO_REVIEW_NEEDED',
          message: '当前情况无需人工复核，可直接推进到 approved'
        });
      }

      let compensationAmount = complaint.compensation_amount;
      let compensationDecision = complaint.compensation_decision;
      let decisionReason = complaint.decision_reason;
      const now = nowIso();

      if (toStatus === 'approved' && compensation.eligible) {
        compensationAmount = compensation.amount;
        compensationDecision = 'approve';
        decisionReason = compensation.reason;
      } else if (toStatus === 'approved' && !compensation.eligible) {
        compensationAmount = 0;
        compensationDecision = 'reject';
        decisionReason = '不符合赔付条件';
      }

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE complaints SET
            status = ?,
            compensation_amount = ?,
            compensation_decision = ?,
            decision_reason = ?,
            updated_at = ?,
            closed_at = ?
          WHERE id = ?
        `).run(
          toStatus,
          compensationAmount,
          compensationDecision,
          decisionReason,
          now,
          (toStatus === 'completed' || toStatus === 'rejected' || toStatus === 'withdrawn') ? now : complaint.closed_at,
          complaint.id
        );

        db.prepare(`
          INSERT INTO process_history (id, complaint_id, action, from_status, to_status, operator, remark, change_data, created_at)
          VALUES (?, ?, 'advance', ?, ?, ?, ?, ?, ?)
        `).run(
          generateId(),
          complaint.id,
          fromStatus,
          toStatus,
          req.body.operator,
          req.body.remark || null,
          JSON.stringify({
            compensation_amount: compensationAmount,
            compensation_decision: compensationDecision,
            decision_reason: decisionReason,
            analysis_summary: {
              has_evidence: analysis.hasEvidence,
              max_db: analysis.maxDb,
              evidence_quality_level: evidenceQuality.level
            }
          }),
          now
        );
      });

      tx();

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      res.json({
        success: true,
        data: updated,
        analysis: {
          decibel_analysis: analysis,
          evidence_quality: evidenceQuality,
          compensation_calculation: compensation
        }
      });
    }
  );

  app.post('/api/complaints/:id/withdraw',
    requireFields(['operator']),
    (req, res) => {
      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '投诉单不存在'
        });
      }

      const terminalStatuses = ['completed', 'rejected', 'withdrawn'];
      if (terminalStatuses.includes(complaint.status)) {
        return res.status(400).json({
          success: false,
          error: 'ALREADY_TERMINAL',
          message: `投诉单已处于终态 ${complaint.status}，无法撤回`
        });
      }

      const now = nowIso();
      const fromStatus = complaint.status;

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE complaints SET
            status = 'withdrawn',
            updated_at = ?,
            closed_at = ?
          WHERE id = ?
        `).run(now, now, complaint.id);

        db.prepare(`
          INSERT INTO process_history (id, complaint_id, action, from_status, to_status, operator, remark, created_at)
          VALUES (?, ?, 'withdraw', ?, 'withdrawn', ?, ?, ?)
        `).run(
          generateId(),
          complaint.id,
          fromStatus,
          req.body.operator,
          req.body.remark || '投诉人撤回',
          now
        );
      });

      tx();

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      res.json({ success: true, data: updated });
    }
  );

  app.post('/api/complaints/:id/amend',
    requireFields(['operator', 'changes']),
    (req, res) => {
      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '投诉单不存在'
        });
      }

      const terminalStatuses = ['completed', 'rejected', 'withdrawn'];
      if (terminalStatuses.includes(complaint.status)) {
        return res.status(400).json({
          success: false,
          error: 'ALREADY_TERMINAL',
          message: `投诉单已处于终态 ${complaint.status}，无法修正`
        });
      }

      const allowedFields = ['description', 'priority', 'assigned_to', 'reporter_phone'];
      const changes = req.body.changes;
      const updateFields = [];
      const updateValues = [];

      for (const field of allowedFields) {
        if (changes[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(changes[field]);
        }
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'NO_VALID_CHANGES',
          message: '没有可修正的字段',
          allowed_fields: allowedFields
        });
      }

      const now = nowIso();
      updateValues.push(now);
      updateValues.push(complaint.id);

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE complaints SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?
        `).run(...updateValues);

        db.prepare(`
          INSERT INTO process_history (id, complaint_id, action, from_status, to_status, operator, remark, change_data, created_at)
          VALUES (?, ?, 'amend', ?, ?, ?, ?, ?, ?)
        `).run(
          generateId(),
          complaint.id,
          complaint.status,
          complaint.status,
          req.body.operator,
          req.body.remark || '修正投诉信息',
          JSON.stringify(changes),
          now
        );
      });

      tx();

      const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.params.id);
      res.json({ success: true, data: updated });
    }
  );

  app.post('/api/evidence-segments',
    checkIdempotency(db, 'evidence'),
    requireFields(['complaint_id', 'segment_type', 'segment_time']),
    (req, res) => {
      const id = generateId();
      const now = nowIso();

      const complaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(req.body.complaint_id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          error: 'COMPLAINT_NOT_FOUND',
          message: '关联投诉单不存在'
        });
      }

      const validTypes = ['audio', 'video', 'decibel', 'photo', 'text', 'neighbor_feedback', 'staff_note'];
      if (!validTypes.includes(req.body.segment_type)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_SEGMENT_TYPE',
          message: '证据类型无效',
          allowed_types: validTypes
        });
      }

      db.prepare(`
        INSERT INTO evidence_segments (
          id, idempotency_key, complaint_id, segment_type, segment_time,
          duration_seconds, db_avg, db_max, db_min, evidence_data,
          file_url, description, is_verified, verified_by, verified_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.idempotencyKey || null,
        req.body.complaint_id,
        req.body.segment_type,
        req.body.segment_time,
        req.body.duration_seconds || null,
        req.body.db_avg || null,
        req.body.db_max || null,
        req.body.db_min || null,
        req.body.evidence_data ? JSON.stringify(req.body.evidence_data) : null,
        req.body.file_url || null,
        req.body.description || null,
        req.body.is_verified ? 1 : 0,
        req.body.verified_by || null,
        req.body.verified_at || null,
        now
      );

      recordIdempotency(db, req.idempotencyKey, 'evidence', id, req.body);

      const segment = db.prepare('SELECT * FROM evidence_segments WHERE id = ?').get(id);
      res.status(201).json({ success: true, data: segment });
    }
  );

  app.get('/api/evidence-segments/:id', (req, res) => {
    const segment = db.prepare('SELECT * FROM evidence_segments WHERE id = ?').get(req.params.id);
    if (!segment) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '证据片段不存在'
      });
    }
    res.json({ success: true, data: segment });
  });

  app.post('/api/evidence-segments/:id/verify',
    requireFields(['operator']),
    (req, res) => {
      const segment = db.prepare('SELECT * FROM evidence_segments WHERE id = ?').get(req.params.id);
      if (!segment) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '证据片段不存在'
        });
      }

      const now = nowIso();
      db.prepare(`
        UPDATE evidence_segments SET
          is_verified = 1,
          verified_by = ?,
          verified_at = ?
        WHERE id = ?
      `).run(req.body.operator, now, segment.id);

      const updated = db.prepare('SELECT * FROM evidence_segments WHERE id = ?').get(req.params.id);
      res.json({ success: true, data: updated });
    }
  );

  app.get('/api/rules', (req, res) => {
    const { property_id, is_active } = req.query;
    let sql = 'SELECT * FROM compensation_rules WHERE 1=1';
    const params = [];

    if (property_id) {
      sql += ' AND property_id = ?';
      params.push(property_id);
    } else {
      sql += ' AND property_id IS NULL';
    }

    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY priority DESC';

    const rules = db.prepare(sql).all(...params);
    res.json({ success: true, data: rules });
  });

  app.post('/api/rules',
    requireFields(['rule_name', 'db_threshold', 'duration_threshold_seconds', 'compensation_type', 'compensation_value']),
    (req, res) => {
      const id = req.body.id || generateId();
      const now = nowIso();

      if (req.body.compensation_type !== 'percent' && req.body.compensation_type !== 'fixed') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_COMPENSATION_TYPE',
          message: '赔付类型必须是 percent 或 fixed'
        });
      }

      const existing = db.prepare('SELECT * FROM compensation_rules WHERE id = ?').get(id);

      if (existing) {
        db.prepare(`
          UPDATE compensation_rules SET
            rule_name = ?, db_threshold = ?, time_slot_start = ?, time_slot_end = ?,
            duration_threshold_seconds = ?, compensation_type = ?, compensation_value = ?,
            is_active = ?, priority = ?, updated_at = ?
          WHERE id = ?
        `).run(
          req.body.rule_name,
          req.body.db_threshold,
          req.body.time_slot_start || null,
          req.body.time_slot_end || null,
          req.body.duration_threshold_seconds,
          req.body.compensation_type,
          req.body.compensation_value,
          req.body.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0),
          req.body.priority || 0,
          now,
          id
        );
      } else {
        db.prepare(`
          INSERT INTO compensation_rules (
            id, property_id, rule_name, db_threshold, time_slot_start, time_slot_end,
            duration_threshold_seconds, compensation_type, compensation_value,
            is_active, priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          req.body.property_id || null,
          req.body.rule_name,
          req.body.db_threshold,
          req.body.time_slot_start || null,
          req.body.time_slot_end || null,
          req.body.duration_threshold_seconds,
          req.body.compensation_type,
          req.body.compensation_value,
          req.body.is_active === undefined ? 1 : (req.body.is_active ? 1 : 0),
          req.body.priority || 0,
          now,
          now
        );
      }

      const rule = db.prepare('SELECT * FROM compensation_rules WHERE id = ?').get(id);
      res.status(existing ? 200 : 201).json({ success: true, data: rule });
    }
  );

  app.get('/api/complaints', (req, res) => {
    const { property_id, status, reporter_type, assigned_to, priority } = req.query;
    let sql = 'SELECT * FROM complaints WHERE 1=1';
    const params = [];

    if (property_id) {
      sql += ' AND property_id = ?';
      params.push(property_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (reporter_type) {
      sql += ' AND reporter_type = ?';
      params.push(reporter_type);
    }
    if (assigned_to) {
      sql += ' AND assigned_to = ?';
      params.push(assigned_to);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC';

    const complaints = db.prepare(sql).all(...params);

    const statusSummary = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM complaints
      ${property_id ? 'WHERE property_id = ?' : ''}
      GROUP BY status
    `).all(...(property_id ? [property_id] : []));

    const summary = {
      total: complaints.length,
      by_status: statusSummary.reduce((acc, s) => {
        acc[s.status] = s.count;
        return acc;
      }, {})
    };

    res.json({
      success: true,
      data: complaints,
      summary
    });
  });

  app.get('/api/process-history/:complaintId', (req, res) => {
    const history = db.prepare(`
      SELECT * FROM process_history 
      WHERE complaint_id = ? 
      ORDER BY created_at ASC
    `).all(req.params.complaintId);

    res.json({ success: true, data: history });
  });

  app.get('/api/export/complaints', (req, res) => {
    const { property_id, status, format = 'csv' } = req.query;
    let sql = `
      SELECT 
        c.complaint_no,
        c.status,
        c.priority,
        c.reporter_type,
        c.reporter_name,
        c.complaint_time,
        c.description,
        c.compensation_amount,
        c.compensation_decision,
        c.decision_reason,
        c.created_at,
        c.closed_at,
        o.order_no,
        o.property_name,
        o.guest_name,
        o.check_in_date,
        o.check_out_date,
        o.total_amount
      FROM complaints c
      LEFT JOIN orders o ON c.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (property_id) {
      sql += ' AND c.property_id = ?';
      params.push(property_id);
    }
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC';

    const rows = db.prepare(sql).all(...params);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=complaints_${Date.now()}.json`);
      return res.json(rows);
    }

    const csv = stringify(rows, {
      header: true,
      columns: [
        'complaint_no', 'status', 'priority', 'reporter_type', 'reporter_name',
        'complaint_time', 'description', 'compensation_amount', 'compensation_decision',
        'decision_reason', 'created_at', 'closed_at', 'order_no', 'property_name',
        'guest_name', 'check_in_date', 'check_out_date', 'total_amount'
      ]
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=complaints_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  });

  app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误'
    });
  });
}

module.exports = { registerRoutes };
