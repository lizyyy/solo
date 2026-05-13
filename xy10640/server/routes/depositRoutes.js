const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const TimelineService = require('../services/timelineService');
const BusinessRulesService = require('../services/businessRulesService');
const IdempotencyService = require('../services/idempotencyService');

router.post('/', async (req, res) => {
  try {
    const { ayi_id, amount, payment_method, payment_date, receipt_number, operator, idempotency_key } = req.body;
    
    if (idempotency_key) {
      const existingResult = await BusinessRulesService.checkDuplicateOperation(idempotency_key, 'deposit_create');
      if (existingResult) {
        await TimelineService.record(
          'deposit_create',
          'deposit',
          existingResult.deposit_id,
          'duplicate',
          'duplicate',
          `重复提交保证金，幂等校验命中`,
          operator || 'system',
          req.body,
          null,
          idempotency_key
        );
        return res.json({ 
          success: true, 
          ...existingResult,
          warning: '检测到重复提交，返回已有结果'
        });
      }
    }

    const depositId = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    await run(
      `INSERT INTO deposits 
       (deposit_id, ayi_id, amount, payment_method, payment_date, receipt_number, idempotency_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [depositId, ayi_id, amount, payment_method, payment_date, receipt_number, idempotency_key]
    );

    const resultData = { success: true, deposit_id: depositId };
    
    if (idempotency_key) {
      await IdempotencyService.checkAndSet(idempotency_key, 'deposit_create', resultData);
    }

    await TimelineService.record(
      'deposit_create',
      'deposit',
      depositId,
      'success',
      'success',
      `创建保证金记录: ¥${amount}`,
      operator || 'system',
      { ayi_id, amount },
      null,
      idempotency_key
    );

    res.json(resultData);
  } catch (err) {
    await TimelineService.record(
      'deposit_create',
      'deposit',
      null,
      'failed',
      'failed',
      '创建保证金失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:depositId/review', async (req, res) => {
  try {
    const { review_status, reviewed_by, comments } = req.body;
    
    const result = await BusinessRulesService.reviewDeposit(
      req.params.depositId,
      review_status,
      reviewed_by,
      comments
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { ayi_id, status, review_status, limit, offset } = req.query;
    let sql = 'SELECT * FROM deposits WHERE 1=1';
    const params = [];

    if (ayi_id) {
      sql += ' AND ayi_id = ?';
      params.push(ayi_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (review_status) {
      sql += ' AND review_status = ?';
      params.push(review_status);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const deposits = await all(sql, params);
    res.json({ success: true, data: deposits });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;