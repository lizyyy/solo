const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const TimelineService = require('../services/timelineService');
const BusinessRulesService = require('../services/businessRulesService');

router.post('/', async (req, res) => {
  try {
    const { ayi_id, req_id, scheduled_date, scheduled_time, operator } = req.body;
    const checkinId = `CHK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO trial_checkins 
       (checkin_id, ayi_id, req_id, scheduled_date, scheduled_time, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [checkinId, ayi_id, req_id, scheduled_date, scheduled_time, 'scheduled']
    );

    await TimelineService.record(
      'checkin_create',
      'checkin',
      checkinId,
      'success',
      'success',
      `创建试工签到安排`,
      operator || 'system',
      { ayi_id, req_id, scheduled_date }
    );

    res.json({ success: true, checkin_id: checkinId });
  } catch (err) {
    await TimelineService.record(
      'checkin_create',
      'checkin',
      null,
      'failed',
      'failed',
      '创建试工签到失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:checkinId/checkin', async (req, res) => {
  try {
    const { actual_checkin, operator } = req.body;
    await run(
      `UPDATE trial_checkins SET actual_checkin = ?, status = ? WHERE checkin_id = ?`,
      [actual_checkin, 'in_progress', req.params.checkinId]
    );

    await TimelineService.record(
      'checkin_actual',
      'checkin',
      req.params.checkinId,
      'success',
      'success',
      `阿姨签到`,
      operator || 'system',
      { actual_checkin }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:checkinId/checkout', async (req, res) => {
  try {
    const { actual_checkout, operator } = req.body;
    await run(
      `UPDATE trial_checkins SET actual_checkout = ?, status = ? WHERE checkin_id = ?`,
      [actual_checkout, 'completed', req.params.checkinId]
    );

    await TimelineService.record(
      'checkout_actual',
      'checkin',
      req.params.checkinId,
      'success',
      'success',
      `阿姨签退`,
      operator || 'system',
      { actual_checkout }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:checkinId/change', async (req, res) => {
  try {
    const { scheduled_date, scheduled_time, change_reason, operator } = req.body;
    
    const validation = await BusinessRulesService.validateCheckinChange(
      req.params.checkinId,
      { scheduled_date, scheduled_time },
      operator
    );

    if (!validation.valid) {
      await TimelineService.record(
        'checkin_change',
        'checkin',
        req.params.checkinId,
        'blocked',
        'blocked',
        `试工签到变更被拦截: ${validation.reason}`,
        operator || 'system',
        req.body,
        validation.reason
      );
      return res.status(400).json({ success: false, error: validation.reason });
    }

    await run(
      `UPDATE trial_checkins 
       SET scheduled_date = ?, scheduled_time = ?, change_reason = ?, changed_by = ?, changed_at = CURRENT_TIMESTAMP
       WHERE checkin_id = ?`,
      [scheduled_date, scheduled_time, change_reason, operator, req.params.checkinId]
    );

    await TimelineService.record(
      'checkin_change',
      'checkin',
      req.params.checkinId,
      'success',
      'manual_correction',
      `试工签到已变更: ${validation.changes.join('; ')}`,
      operator || 'system',
      { ...req.body, oldData: validation.oldData, changes: validation.changes }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { ayi_id, req_id, status, date_from, date_to, limit, offset } = req.query;
    let sql = 'SELECT * FROM trial_checkins WHERE 1=1';
    const params = [];

    if (ayi_id) {
      sql += ' AND ayi_id = ?';
      params.push(ayi_id);
    }

    if (req_id) {
      sql += ' AND req_id = ?';
      params.push(req_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (date_from) {
      sql += ' AND scheduled_date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND scheduled_date <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const checkins = await all(sql, params);
    res.json({ success: true, data: checkins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;