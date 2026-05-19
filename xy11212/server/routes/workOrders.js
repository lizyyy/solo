const express = require('express');
const Joi = require('joi');
const moment = require('moment');
const { allQuery, getQuery, runQuery } = require('../config/database');
const { logAudit } = require('../config/logger');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

const generateOrderNo = () => {
  return 'WO' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
};

const workOrderSchema = Joi.object({
  type: Joi.string().valid('巡检异常', '传感器告警', '设备报修', '其他').required(),
  source_id: Joi.number().optional(),
  title: Joi.string().required(),
  description: Joi.string().optional(),
  pump_room_no: Joi.string().required(),
  priority: Joi.string().valid('低', '中', '高', '紧急').required(),
  reporter_name: Joi.string().required(),
  reporter_phone: Joi.string().optional()
});

router.get('/', requirePermission('workOrders:read'), async (req, res) => {
  try {
    const { status, priority, pump_room_no } = req.query;
    let sql = 'SELECT * FROM work_orders WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }
    if (pump_room_no) {
      sql += ' AND pump_room_no = ?';
      params.push(pump_room_no);
    }
    sql += ' ORDER BY created_at DESC, id DESC';

    const workOrders = await allQuery(sql, params);
    res.json(workOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requirePermission('workOrders:read'), async (req, res) => {
  try {
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requirePermission('workOrders:create'), async (req, res) => {
  try {
    const { error, value } = workOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const order_no = generateOrderNo();
    const result = await runQuery(
      `INSERT INTO work_orders (order_no, type, source_id, title, description, pump_room_no, priority, reporter_name, reporter_phone, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_no, value.type, value.source_id, value.title, value.description, value.pump_room_no, 
       value.priority, value.reporter_name, value.reporter_phone, req.user.id]
    );

    await logAudit(req.user.id, req.user.name, '创建工单', 'work_orders', result.lastID, value);

    const newWorkOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [result.lastID]);
    res.status(201).json(newWorkOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/assign', requirePermission('workOrders:assign'), async (req, res) => {
  try {
    const { assigned_to } = req.body;
    
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    if (workOrder.status !== '待派工') {
      return res.status(400).json({ error: '只有待派工的工单才能派工' });
    }

    const user = await getQuery('SELECT * FROM users WHERE id = ?', [assigned_to]);
    if (!user) {
      return res.status(400).json({ error: '指定的处理人不存在' });
    }

    await runQuery(
      'UPDATE work_orders SET status = ?, assigned_to = ?, assigned_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['已派工', assigned_to, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '派工', 'work_orders', req.params.id, { assigned_to });

    const updated = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/arrive', requirePermission('workOrders:arrive'), async (req, res) => {
  try {
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    if (workOrder.status !== '已派工') {
      return res.status(400).json({ error: '只有已派工的工单才能签到到场' });
    }

    await runQuery(
      'UPDATE work_orders SET status = ?, arrived_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['已到场', req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '到场签到', 'work_orders', req.params.id, {});

    const updated = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/process', requirePermission('workOrders:process'), async (req, res) => {
  try {
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    if (!['已到场', '处理中'].includes(workOrder.status)) {
      return res.status(400).json({ error: '工单状态不允许处理' });
    }

    await runQuery(
      'UPDATE work_orders SET status = ? WHERE id = ?',
      ['处理中', req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '处理工单', 'work_orders', req.params.id, {});

    const updated = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/recheck', requirePermission('workOrders:recheck'), async (req, res) => {
  try {
    const { recheck_result } = req.body;
    
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    if (workOrder.status !== '处理中') {
      return res.status(400).json({ error: '只有处理中的工单才能申请复测' });
    }

    await runQuery(
      'UPDATE work_orders SET status = ?, rechecked_at = CURRENT_TIMESTAMP, recheck_result = ? WHERE id = ?',
      ['待复测', recheck_result, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '申请复测', 'work_orders', req.params.id, { recheck_result });

    const updated = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/close', requirePermission('workOrders:close'), async (req, res) => {
  try {
    const { closing_remarks } = req.body;
    
    const workOrder = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    if (!workOrder) {
      return res.status(404).json({ error: '工单不存在' });
    }
    if (workOrder.status !== '待复测') {
      return res.status(400).json({ error: '只有待复测的工单才能关闭' });
    }

    await runQuery(
      'UPDATE work_orders SET status = ?, closed_at = CURRENT_TIMESTAMP, closing_remarks = ? WHERE id = ?',
      ['已关闭', closing_remarks, req.params.id]
    );

    await logAudit(req.user.id, req.user.name, '关闭工单', 'work_orders', req.params.id, { closing_remarks });

    const updated = await getQuery('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
