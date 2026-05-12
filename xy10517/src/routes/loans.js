const express = require('express');
const router = express.Router();
const { idempotencyMiddleware } = require('../utils/idempotency');
const loanService = require('../services/loanService');
const { getAuditLogs } = require('../utils/audit');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.post('/', idempotencyMiddleware, (req, res) => {
  try {
    const { part_id, engineer_id, quantity, loan_reason, expected_return_days, work_order_id } = req.body;
    
    if (!part_id || !engineer_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: '备件ID、工程师ID和借用数量不能为空'
      });
    }
    
    const loan = loanService.createLoan({
      part_id,
      engineer_id,
      quantity: parseInt(quantity),
      loan_reason,
      expected_return_days: expected_return_days ? parseInt(expected_return_days) : 7,
      work_order_id
    }, getOperator(req));
    
    res.status(201).json({
      success: true,
      data: loan
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const { status, engineer_id, part_id, work_order_id } = req.query;
    const loans = loanService.listLoans({ status, engineer_id, part_id, work_order_id });
    
    res.json({
      success: true,
      data: loans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/unreturned', (req, res) => {
  try {
    const loans = loanService.getUnreturnedLoans();
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/code/:code', (req, res) => {
  try {
    const loan = loanService.getLoanByCode(req.params.code);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: '借用记录不存在'
      });
    }
    const detail = loanService.getLoanDetail(loan.id);
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const loan = loanService.getLoanDetail(req.params.id);
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: '借用记录不存在'
      });
    }
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/bind-workorder', idempotencyMiddleware, (req, res) => {
  try {
    const { work_order_id, reason } = req.body;
    if (!work_order_id) {
      return res.status(400).json({ success: false, error: '请提供工单ID' });
    }
    
    const loan = loanService.bindWorkOrder(
      req.params.id,
      work_order_id,
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/unbind-workorder', idempotencyMiddleware, (req, res) => {
  try {
    const loan = loanService.unbindWorkOrder(
      req.params.id,
      getOperator(req),
      req.body?.reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/return', idempotencyMiddleware, (req, res) => {
  try {
    const { quantity, reason } = req.body;
    if (!quantity) {
      return res.status(400).json({ success: false, error: '请提供归还数量' });
    }
    
    const loan = loanService.returnPart(
      req.params.id,
      parseInt(quantity),
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/consume', idempotencyMiddleware, (req, res) => {
  try {
    const { quantity, reason } = req.body;
    if (!quantity) {
      return res.status(400).json({ success: false, error: '请提供消耗数量' });
    }
    
    const loan = loanService.consumePart(
      req.params.id,
      parseInt(quantity),
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/damage', idempotencyMiddleware, (req, res) => {
  try {
    const { quantity, damage_level, compensation_amount, reason } = req.body;
    if (!quantity || !damage_level) {
      return res.status(400).json({ success: false, error: '请提供损坏数量和损坏等级' });
    }
    
    const loan = loanService.reportDamage(
      req.params.id,
      parseInt(quantity),
      damage_level,
      compensation_amount ? parseFloat(compensation_amount) : 0,
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/compensate', idempotencyMiddleware, (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (amount === undefined) {
      return res.status(400).json({ success: false, error: '请提供赔偿金额' });
    }
    
    const loan = loanService.processCompensation(
      req.params.id,
      parseFloat(amount),
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/manual-correct', (req, res) => {
  try {
    const { correction, reason } = req.body;
    if (!correction) {
      return res.status(400).json({ success: false, error: '请提供修正内容' });
    }
    
    const loan = loanService.manualCorrect(
      req.params.id,
      correction,
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/resolve-exception', idempotencyMiddleware, (req, res) => {
  try {
    const { new_status, reason } = req.body;
    if (!new_status) {
      return res.status(400).json({ success: false, error: '请提供新状态' });
    }
    
    const loan = loanService.resolveException(
      req.params.id,
      { new_status },
      getOperator(req),
      reason
    );
    
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/check-overdue', (req, res) => {
  try {
    const count = loanService.checkOverdue();
    res.json({ success: true, data: { overdue_count: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/check-workorder-closed', (req, res) => {
  try {
    const count = loanService.checkWorkOrderClosed();
    res.json({ success: true, data: { affected_count: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/items', (req, res) => {
  try {
    const items = loanService.getLoanItems(req.params.id);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req, res) => {
  try {
    const logs = getAuditLogs('loan', req.params.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
