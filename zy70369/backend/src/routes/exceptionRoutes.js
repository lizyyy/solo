const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const { canPerformAction, checkConcurrency, getEvidenceGaps, addTimelineEvent } = require('../rules/arbitrationRules');

const allAsync = promisify(db.all.bind(db));
const runAsync = promisify(db.run.bind(db));
const getAsync = promisify(db.get.bind(db));

const EXCEPTION_TYPES = {
  INVENTORY_FAILURE: '库存扣减失败',
  LOGISTICS_CANCEL: '物流取消',
  DISCOUNT_EXCEPTION: '优惠异常'
};

router.get('/', async (req, res) => {
  try {
    const exceptions = await allAsync(`
      SELECT oe.*, o.order_no, o.user_id, o.total_amount, o.status as order_status,
             op.name as operator_name
      FROM order_exceptions oe
      LEFT JOIN orders o ON oe.order_id = o.id
      LEFT JOIN operators op ON oe.locked_by = op.id
      ORDER BY oe.created_at DESC
    `);
    
    res.json(exceptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const exception = await getAsync(`
      SELECT oe.*, o.order_no, o.user_id, o.total_amount, o.status as order_status,
             op.name as operator_name
      FROM order_exceptions oe
      LEFT JOIN orders o ON oe.order_id = o.id
      LEFT JOIN operators op ON oe.locked_by = op.id
      WHERE oe.id = ?
    `, [id]);
    
    if (!exception) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    
    const evidences = await allAsync(
      'SELECT * FROM order_evidence WHERE order_exception_id = ? ORDER BY created_at',
      [id]
    );
    
    const actions = await allAsync(`
      SELECT aa.*, op.name as executed_by_name
      FROM arbitration_actions aa
      LEFT JOIN operators op ON aa.executed_by = op.id
      WHERE aa.order_exception_id = ?
      ORDER BY aa.created_at DESC
    `, [id]);
    
    const timeline = await allAsync(`
      SELECT ot.*, op.name as operator_name
      FROM order_timeline ot
      LEFT JOIN operators op ON ot.operator = op.id
      WHERE ot.order_id = ?
      ORDER BY ot.created_at DESC
    `, [exception.order_id]);
    
    const evidenceGaps = getEvidenceGaps(exception, evidences);
    
    res.json({
      exception,
      evidences: evidences.map(e => ({ ...e, evidence_data: JSON.parse(e.evidence_data) })),
      actions: actions.map(a => ({ ...a, action_data: a.action_data ? JSON.parse(a.action_data) : null })),
      timeline: timeline.map(t => ({ ...t, event_data: t.event_data ? JSON.parse(t.event_data) : null })),
      evidence_gaps: evidenceGaps
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/lock', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id } = req.body;
    
    if (!operator_id) {
      return res.status(400).json({ error: '缺少操作员ID' });
    }
    
    const result = await checkConcurrency(id, operator_id);
    
    if (!result.success) {
      return res.status(409).json({ error: result.reason });
    }
    
    const operator = await getAsync('SELECT * FROM operators WHERE id = ?', [operator_id]);
    const exception = await getAsync('SELECT * FROM order_exceptions WHERE id = ?', [id]);
    
    await addTimelineEvent(
      exception.order_id,
      'EXCEPTION_LOCKED',
      { message: `客服${operator?.name || operator_id}锁定订单` },
      operator_id
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id } = req.body;
    
    if (!operator_id) {
      return res.status(400).json({ error: '缺少操作员ID' });
    }
    
    const exception = await getAsync('SELECT * FROM order_exceptions WHERE id = ?', [id]);
    
    if (!exception) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    
    if (exception.locked_by && exception.locked_by !== operator_id) {
      return res.status(403).json({ error: '无权解锁他人锁定的订单' });
    }
    
    const now = new Date().toISOString();
    await runAsync(
      'UPDATE order_exceptions SET locked_by = NULL, locked_at = NULL, updated_at = ? WHERE id = ?',
      [now, id]
    );
    
    const operator = await getAsync('SELECT * FROM operators WHERE id = ?', [operator_id]);
    
    await addTimelineEvent(
      exception.order_id,
      'EXCEPTION_UNLOCKED',
      { message: `客服${operator?.name || operator_id}解锁订单` },
      operator_id
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/actions', async (req, res) => {
  try {
    const { id } = req.params;
    const { action_type, action_data, operator_id, reason } = req.body;
    
    if (!action_type || !operator_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const permission = await canPerformAction(id, operator_id, action_type);
    
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }
    
    const exception = await getAsync('SELECT * FROM order_exceptions WHERE id = ?', [id]);
    
    const actionId = uuidv4();
    const now = new Date().toISOString();
    
    let actionStatus = 'PENDING';
    let lastError = null;
    let executedAt = null;
    
    if (action_type === 'REFUND') {
      try {
        const order = await getAsync('SELECT * FROM orders WHERE id = ?', [exception.order_id]);
        
        const refundSuccess = Math.random() > 0.3;
        
        if (refundSuccess) {
          actionStatus = 'SUCCESS';
          executedAt = now;
          
          await addTimelineEvent(
            exception.order_id,
            'REFUND_SUCCESS',
            { 
              message: `退款成功，金额：${order.total_amount}元`,
              action_id: actionId,
              refund_amount: order.total_amount
            },
            operator_id
          );
        } else {
          actionStatus = 'FAILED';
          lastError = '支付网关超时，退款失败';
          
          await addTimelineEvent(
            exception.order_id,
            'REFUND_FAILED',
            { 
              message: `退款失败：${lastError}`,
              action_id: actionId,
              retry_available: true
            },
            operator_id
          );
        }
      } catch (err) {
        actionStatus = 'FAILED';
        lastError = err.message;
        
        await addTimelineEvent(
          exception.order_id,
          'REFUND_FAILED',
          { 
            message: `退款失败：${err.message}`,
            action_id: actionId,
            retry_available: true
          },
          operator_id
        );
      }
    } else if (action_type === 'RESEND') {
      actionStatus = 'SUCCESS';
      executedAt = now;
      
      await addTimelineEvent(
        exception.order_id,
        'RESEND_INITIATED',
        { 
          message: '补发流程已启动',
          action_id: actionId
        },
        operator_id
      );
    } else if (action_type === 'CLOSE') {
      actionStatus = 'SUCCESS';
      executedAt = now;
      
      await addTimelineEvent(
        exception.order_id,
        'EXCEPTION_CLOSED',
        { 
          message: `异常关闭，原因：${reason || '无'}`,
          action_id: actionId
        },
        operator_id
      );
    } else if (action_type === 'CONTINUE_FULFILLMENT') {
      actionStatus = 'SUCCESS';
      executedAt = now;
      
      await addTimelineEvent(
        exception.order_id,
        'FULFILLMENT_CONTINUED',
        { 
          message: '继续履约流程已启动',
          action_id: actionId
        },
        operator_id
      );
    } else if (action_type === 'ROLLBACK_FAILED') {
      actionStatus = 'SUCCESS';
      executedAt = now;
      
      await addTimelineEvent(
        exception.order_id,
        'FAILED_ROLLED_BACK',
        { 
          message: '回滚失败操作已执行',
          action_id: actionId
        },
        operator_id
      );
    }
    
    await runAsync(
      `INSERT INTO arbitration_actions 
       (id, order_exception_id, action_type, action_data, status, executed_by, executed_at, retry_count, last_error, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        actionId,
        id,
        action_type,
        action_data ? JSON.stringify(action_data) : null,
        actionStatus,
        operator_id,
        executedAt,
        lastError,
        now
      ]
    );
    
    res.json({ 
      success: actionStatus === 'SUCCESS', 
      action_id: actionId,
      status: actionStatus,
      message: actionStatus === 'SUCCESS' ? '动作执行成功' : (lastError || '动作执行失败')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/actions/:actionId/retry', async (req, res) => {
  try {
    const { id, actionId } = req.params;
    const { operator_id } = req.body;
    
    if (!operator_id) {
      return res.status(400).json({ error: '缺少操作员ID' });
    }
    
    const action = await getAsync(
      'SELECT * FROM arbitration_actions WHERE id = ? AND order_exception_id = ?',
      [actionId, id]
    );
    
    if (!action) {
      return res.status(404).json({ error: '动作记录不存在' });
    }
    
    if (action.status === 'SUCCESS') {
      return res.status(400).json({ error: '成功的动作不可重试' });
    }
    
    const permission = await canPerformAction(id, operator_id, action.action_type);
    
    if (!permission.allowed) {
      return res.status(403).json({ error: permission.reason });
    }
    
    const exception = await getAsync('SELECT * FROM order_exceptions WHERE id = ?', [id]);
    const now = new Date().toISOString();
    const newRetryCount = action.retry_count + 1;
    
    let newStatus = action.status;
    let newError = action.last_error;
    let executedAt = action.executed_at;
    
    if (action.action_type === 'REFUND') {
      const order = await getAsync('SELECT * FROM orders WHERE id = ?', [exception.order_id]);
      
      const refundSuccess = Math.random() > 0.3;
      
      if (refundSuccess) {
        newStatus = 'SUCCESS';
        executedAt = now;
        newError = null;
        
        await addTimelineEvent(
          exception.order_id,
          'REFUND_SUCCESS',
          { 
            message: `重试退款成功，金额：${order.total_amount}元`,
            action_id: actionId,
            refund_amount: order.total_amount,
            retry_count: newRetryCount
          },
          operator_id
        );
      } else {
        newStatus = 'FAILED';
        newError = `支付网关超时，退款失败（重试${newRetryCount}次）`;
        
        await addTimelineEvent(
          exception.order_id,
          'REFUND_FAILED',
          { 
            message: `重试退款失败：${newError}`,
            action_id: actionId,
            retry_count: newRetryCount,
            retry_available: true
          },
          operator_id
        );
      }
    }
    
    await runAsync(
      `UPDATE arbitration_actions 
       SET status = ?, executed_at = ?, retry_count = ?, last_error = ? 
       WHERE id = ?`,
      [newStatus, executedAt, newRetryCount, newError, actionId]
    );
    
    res.json({ 
      success: newStatus === 'SUCCESS', 
      action_id: actionId,
      status: newStatus,
      retry_count: newRetryCount,
      message: newStatus === 'SUCCESS' ? '重试成功' : (newError || '重试失败')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, resolution_reason, operator_id } = req.body;
    
    if (!resolution || !operator_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const exception = await getAsync('SELECT * FROM order_exceptions WHERE id = ?', [id]);
    
    if (!exception) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    
    if (exception.status === 'RESOLVED') {
      return res.status(400).json({ error: '订单已完成仲裁' });
    }
    
    if (exception.locked_by && exception.locked_by !== operator_id) {
      return res.status(403).json({ error: '订单已被其他客服锁定' });
    }
    
    const now = new Date().toISOString();
    
    await runAsync(
      `UPDATE order_exceptions 
       SET status = 'RESOLVED', resolution = ?, resolution_reason = ?, resolved_at = ?, updated_at = ? 
       WHERE id = ?`,
      [resolution, resolution_reason || '', now, now, id]
    );
    
    const operator = await getAsync('SELECT * FROM operators WHERE id = ?', [operator_id]);
    
    await addTimelineEvent(
      exception.order_id,
      'EXCEPTION_RESOLVED',
      { 
        message: `仲裁完成，处理方案：${resolution}，原因：${resolution_reason || '无'}`,
        resolution,
        resolution_reason
      },
      operator_id
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/operators/list', async (req, res) => {
  try {
    const operators = await allAsync('SELECT * FROM operators ORDER BY created_at');
    res.json(operators);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
