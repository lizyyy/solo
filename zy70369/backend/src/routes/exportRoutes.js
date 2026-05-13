const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { promisify } = require('util');
const { Parser } = require('json2csv');

const allAsync = promisify(db.all.bind(db));

const EXCEPTION_TYPES = {
  INVENTORY_FAILURE: '库存扣减失败',
  LOGISTICS_CANCEL: '物流取消',
  DISCOUNT_EXCEPTION: '优惠异常'
};

const ACTION_TYPES = {
  REFUND: '退款',
  RESEND: '补发',
  CLOSE: '关闭',
  CONTINUE_FULFILLMENT: '继续履约',
  ROLLBACK_FAILED: '回滚失败'
};

router.get('/arbitration/csv', async (req, res) => {
  try {
    const { status, start_date, end_date } = req.query;
    
    let query = `
      SELECT oe.*, o.order_no, o.user_id, o.total_amount, o.status as order_status,
             op.name as locked_by_name,
             op2.name as resolved_by_name
      FROM order_exceptions oe
      LEFT JOIN orders o ON oe.order_id = o.id
      LEFT JOIN operators op ON oe.locked_by = op.id
      LEFT JOIN operators op2 ON oe.resolved_at IS NOT NULL AND op2.id = (
        SELECT executed_by FROM arbitration_actions aa 
        WHERE aa.order_exception_id = oe.id 
        ORDER BY aa.executed_at DESC LIMIT 1
      )
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND oe.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      query += ' AND oe.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND oe.created_at <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY oe.created_at DESC';
    
    const exceptions = await allAsync(query, params);
    
    const enrichedData = await Promise.all(exceptions.map(async (exc) => {
      const actions = await allAsync(
        `SELECT aa.*, op.name as executed_by_name
         FROM arbitration_actions aa
         LEFT JOIN operators op ON aa.executed_by = op.id
         WHERE aa.order_exception_id = ?
         ORDER BY aa.created_at`,
        [exc.id]
      );
      
      const latestAction = actions[actions.length - 1];
      
      return {
        异常ID: exc.id,
        订单号: exc.order_no,
        用户ID: exc.user_id,
        订单金额: exc.total_amount,
        异常类型: EXCEPTION_TYPES[exc.exception_type] || exc.exception_type,
        异常状态: exc.status === 'PENDING' ? '待处理' : '已完成',
        锁定人: exc.locked_by_name || '-',
        锁定时间: exc.locked_at || '-',
        处理方案: exc.resolution || '-',
        仲裁原因: exc.resolution_reason || '-',
        完成时间: exc.resolved_at || '-',
        最后补偿动作: latestAction ? ACTION_TYPES[latestAction.action_type] || latestAction.action_type : '-',
        补偿结果: latestAction ? (latestAction.status === 'SUCCESS' ? '成功' : '失败') : '-',
        失败原因: latestAction ? (latestAction.last_error || '-') : '-',
        创建时间: exc.created_at
      };
    }));
    
    const fields = [
      '异常ID', '订单号', '用户ID', '订单金额', '异常类型', '异常状态',
      '锁定人', '锁定时间', '处理方案', '仲裁原因', '完成时间',
      '最后补偿动作', '补偿结果', '失败原因', '创建时间'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(enrichedData);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=arbitration_records_${Date.now()}.csv`);
    res.setHeader('Pragma', 'public');
    res.setHeader('Cache-Control', 'max-age=0');
    
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/arbitration/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    
    const exception = await allAsync(`
      SELECT oe.*, o.order_no, o.user_id, o.total_amount, o.status as order_status,
             op.name as locked_by_name
      FROM order_exceptions oe
      LEFT JOIN orders o ON oe.order_id = o.id
      LEFT JOIN operators op ON oe.locked_by = op.id
      WHERE oe.id = ?
    `, [id]);
    
    if (exception.length === 0) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    
    const exc = exception[0];
    
    const actions = await allAsync(
      `SELECT aa.*, op.name as executed_by_name
       FROM arbitration_actions aa
       LEFT JOIN operators op ON aa.executed_by = op.id
       WHERE aa.order_exception_id = ?
       ORDER BY aa.created_at`,
      [id]
    );
    
    const timeline = await allAsync(
      `SELECT ot.*, op.name as operator_name
       FROM order_timeline ot
       LEFT JOIN operators op ON ot.operator = op.id
       WHERE ot.order_id = ?
       ORDER BY ot.created_at`,
      [exc.order_id]
    );
    
    const details = {
      basic_info: {
        异常ID: exc.id,
        订单号: exc.order_no,
        用户ID: exc.user_id,
        订单金额: `${exc.total_amount}元`,
        异常类型: EXCEPTION_TYPES[exc.exception_type] || exc.exception_type,
        异常状态: exc.status === 'PENDING' ? '待处理' : '已完成',
        证据缺口: exc.evidence_gap || '无',
        创建时间: exc.created_at
      },
      arbitration: {
        锁定人: exc.locked_by_name || '-',
        锁定时间: exc.locked_at || '-',
        处理方案: exc.resolution || '-',
        仲裁原因: exc.resolution_reason || '-',
        完成时间: exc.resolved_at || '-'
      },
      compensation_actions: actions.map((action, index) => ({
        序号: index + 1,
        动作类型: ACTION_TYPES[action.action_type] || action.action_type,
        执行人: action.executed_by_name || action.executed_by,
        执行时间: action.executed_at || action.created_at,
        执行结果: action.status === 'SUCCESS' ? '成功' : (action.status === 'FAILED' ? '失败' : '处理中'),
        重试次数: action.retry_count,
        失败原因: action.last_error || '-'
      })),
      timeline: timeline.map((event, index) => ({
        序号: index + 1,
        时间: event.created_at,
        事件类型: event.event_type,
        操作者: event.operator_name || event.operator,
        详情: JSON.parse(event.event_data || '{}').message || '-'
      }))
    };
    
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
