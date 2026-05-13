const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const TimelineService = require('../services/timelineService');
const BusinessRulesService = require('../services/businessRulesService');

router.post('/', async (req, res) => {
  try {
    const { checkin_id, ayi_id, req_id, overall_rating, attitude_rating, skill_rating, punctuality_rating, comments, operator } = req.body;
    const evalId = `EVAL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO customer_evaluations 
       (eval_id, checkin_id, ayi_id, req_id, overall_rating, attitude_rating, skill_rating, punctuality_rating, comments, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [evalId, checkin_id, ayi_id, req_id, overall_rating, attitude_rating, skill_rating, punctuality_rating, comments, 'submitted']
    );

    await TimelineService.record(
      'evaluation_create',
      'evaluation',
      evalId,
      'success',
      'success',
      `创建客户评价`,
      operator || 'system',
      { checkin_id, overall_rating }
    );

    const abnormalResult = await BusinessRulesService.detectAbnormalEvaluation(evalId);

    if (abnormalResult.isAbnormal) {
      res.json({ 
        success: true, 
        eval_id: evalId,
        warning: '检测到异常评价，已标记待人工审核',
        abnormal_reasons: abnormalResult.reasons
      });
    } else {
      res.json({ success: true, eval_id: evalId });
    }
  } catch (err) {
    await TimelineService.record(
      'evaluation_create',
      'evaluation',
      null,
      'failed',
      'failed',
      '创建客户评价失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:evalId/review', async (req, res) => {
  try {
    const { status, reviewed_by, comments } = req.body;
    
    await run(
      `UPDATE customer_evaluations 
       SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE eval_id = ?`,
      [status, reviewed_by, req.params.evalId]
    );

    await TimelineService.record(
      'evaluation_review',
      'evaluation',
      req.params.evalId,
      'success',
      'manual_correction',
      `客户评价审核${status === 'approved' ? '通过' : '拒绝'}: ${comments}`,
      reviewed_by,
      req.body
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { ayi_id, req_id, is_abnormal, status, limit, offset } = req.query;
    let sql = 'SELECT * FROM customer_evaluations WHERE 1=1';
    const params = [];

    if (ayi_id) {
      sql += ' AND ayi_id = ?';
      params.push(ayi_id);
    }

    if (req_id) {
      sql += ' AND req_id = ?';
      params.push(req_id);
    }

    if (is_abnormal !== undefined) {
      sql += ' AND is_abnormal = ?';
      params.push(is_abnormal === 'true' ? 1 : 0);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const evaluations = await all(sql, params);
    res.json({ success: true, data: evaluations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;