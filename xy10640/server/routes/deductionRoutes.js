const express = require('express');
const router = express.Router();
const { get, run, all } = require('../database/db');
const TimelineService = require('../services/timelineService');
const IdempotencyService = require('../services/idempotencyService');

router.post('/', async (req, res) => {
  try {
    const { deposit_id, ayi_id, req_id, contract_id, deduction_amount, deduction_date, operator, idempotency_key } = req.body;
    
    if (idempotency_key) {
      const existingResult = await IdempotencyService.getResult(idempotency_key);
      if (existingResult) {
        await TimelineService.record(
          'deduction_create',
          'deduction',
          existingResult.deduction_id,
          'duplicate',
          'duplicate',
          `重复提交抵扣，幂等校验命中`,
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

    const deposit = await get('SELECT * FROM deposits WHERE deposit_id = ?', [deposit_id]);
    if (!deposit) {
      return res.status(400).json({ success: false, error: '保证金记录不存在' });
    }

    if (deposit.status !== 'confirmed') {
      return res.status(400).json({ success: false, error: '保证金未确认，无法抵扣' });
    }

    const totalDeducted = await get(
      'SELECT SUM(deduction_amount) as total FROM contract_deductions WHERE deposit_id = ?',
      [deposit_id]
    );
    const remaining = deposit.amount - (totalDeducted.total || 0);
    
    if (remaining < deduction_amount) {
      return res.status(400).json({ success: false, error: '保证金余额不足' });
    }

    const deductionId = `DED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newRemaining = remaining - deduction_amount;
    
    await run(
      `INSERT INTO contract_deductions 
       (deduction_id, deposit_id, ayi_id, req_id, contract_id, deduction_amount, remaining_amount, deduction_date, idempotency_key) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deductionId, deposit_id, ayi_id, req_id, contract_id, deduction_amount, newRemaining, deduction_date, idempotency_key]
    );

    const resultData = { success: true, deduction_id: deductionId, remaining_amount: newRemaining };
    
    if (idempotency_key) {
      await IdempotencyService.checkAndSet(idempotency_key, 'deduction_create', resultData);
    }

    await TimelineService.record(
      'deduction_create',
      'deduction',
      deductionId,
      'success',
      'success',
      `签约抵扣: ¥${deduction_amount}，剩余保证金: ¥${newRemaining}`,
      operator || 'system',
      { deposit_id, deduction_amount, newRemaining },
      null,
      idempotency_key
    );

    res.json(resultData);
  } catch (err) {
    await TimelineService.record(
      'deduction_create',
      'deduction',
      null,
      'failed',
      'failed',
      '签约抵扣失败',
      'system',
      req.body,
      err.message
    );
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { ayi_id, deposit_id, limit, offset } = req.query;
    let sql = 'SELECT * FROM contract_deductions WHERE 1=1';
    const params = [];

    if (ayi_id) {
      sql += ' AND ayi_id = ?';
      params.push(ayi_id);
    }

    if (deposit_id) {
      sql += ' AND deposit_id = ?';
      params.push(deposit_id);
    }

    sql += ' ORDER BY created_at DESC';

    if (limit) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset) || 0);
    }

    const deductions = await all(sql, params);
    res.json({ success: true, data: deductions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;