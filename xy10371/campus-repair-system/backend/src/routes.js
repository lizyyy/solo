const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { prepare, transaction } = require('./database');

const db = {
  prepare: prepare
};

const router = express.Router();

const URGENCY_PRIORITY = {
  urgent: 3,
  normal: 2,
  low: 1
};

router.get('/students', (req, res) => {
  const students = db.prepare('SELECT * FROM students').all();
  res.json(students);
});

router.get('/workers', (req, res) => {
  const workers = db.prepare('SELECT * FROM workers').all();
  res.json(workers);
});

router.get('/materials', (req, res) => {
  const materials = db.prepare('SELECT * FROM materials').all();
  res.json(materials);
});

router.get('/orders', (req, res) => {
  const { status, building } = req.query;
  let sql = `
    SELECT o.*, s.name as student_name, w.name as worker_name
    FROM repair_orders o
    LEFT JOIN students s ON o.student_id = s.id
    LEFT JOIN workers w ON o.worker_id = w.id
  `;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (building) {
    conditions.push('o.building = ?');
    params.push(building);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY o.created_at DESC';

  const orders = db.prepare(sql).all(...params);

  const ordersWithDetails = orders.map(order => {
    const usages = db.prepare(`
      SELECT mu.*, m.name as material_name, m.unit as material_unit
      FROM material_usages mu
      JOIN materials m ON mu.material_id = m.id
      WHERE mu.order_id = ?
    `).all(order.id);

    const logs = db.prepare(`
      SELECT al.*, w.name as worker_name
      FROM assignment_logs al
      LEFT JOIN workers w ON al.worker_id = w.id
      WHERE al.order_id = ?
      ORDER BY al.timestamp DESC
    `).all(order.id);

    return { ...order, material_usages: usages, assignment_logs: logs };
  });

  res.json(ordersWithDetails);
});

router.post('/orders', (req, res) => {
  const { student_id, building, room, category, description, urgency } = req.body;

  if (!student_id || !building || !room || !category || !description || !urgency) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const existingOrder = db.prepare(`
    SELECT * FROM repair_orders 
    WHERE student_id = ? 
      AND building = ? 
      AND room = ? 
      AND category = ? 
      AND status IN ('pending', 'assigned', 'in_progress')
      AND created_at >= ?
  `).get(
    student_id,
    building,
    room,
    category,
    dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  );

  if (existingOrder) {
    return res.status(400).json({ 
      error: '重复报修', 
      message: '同一宿舍同一类型的报修在24小时内已有进行中的工单，请耐心等待' 
    });
  }

  const id = 'o' + uuidv4().slice(0, 8);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.prepare(`
    INSERT INTO repair_orders 
    (id, student_id, building, room, category, description, urgency, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, student_id, building, room, category, description, urgency, now);

  const newOrder = db.prepare(`
    SELECT o.*, s.name as student_name
    FROM repair_orders o
    LEFT JOIN students s ON o.student_id = s.id
    WHERE o.id = ?
  `).get(id);

  res.status(201).json({ ...newOrder, material_usages: [], assignment_logs: [] });
});

router.post('/orders/:id/assign', (req, res) => {
  const { id } = req.params;
  const { worker_id } = req.body;

  if (!worker_id) {
    return res.status(400).json({ error: '缺少worker_id' });
  }

  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '只有待派工状态的工单才能派工' });
  }

  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(worker_id);
  if (!worker) {
    return res.status(404).json({ error: '维修师傅不存在' });
  }

  if (worker.status !== 'available') {
    return res.status(400).json({ error: '该维修师傅当前不可用' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const logId = 'log' + uuidv4().slice(0, 8);

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE repair_orders 
      SET status = 'assigned', worker_id = ?, assigned_at = ?
      WHERE id = ?
    `).run(worker_id, now, id);

    db.prepare(`
      UPDATE workers 
      SET status = 'busy'
      WHERE id = ?
    `).run(worker_id);

    db.prepare(`
      INSERT INTO assignment_logs (id, order_id, action, worker_id, timestamp)
      VALUES (?, ?, 'assigned', ?, ?)
    `).run(logId, id, worker_id, now);
  });

  transaction();

  res.json({ message: '派工成功' });
});

router.post('/orders/:id/skip', (req, res) => {
  const { id } = req.params;
  const { worker_id, reason } = req.body;

  if (!worker_id || !reason) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({ error: '只有待派工状态的工单才能跳过' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const logId = 'log' + uuidv4().slice(0, 8);

  db.prepare(`
    INSERT INTO assignment_logs (id, order_id, action, worker_id, reason, timestamp)
    VALUES (?, ?, 'skipped', ?, ?, ?)
  `).run(logId, id, worker_id, reason, now);

  res.json({ message: '已记录跳过原因' });
});

router.post('/orders/:id/materials', (req, res) => {
  const { id } = req.params;
  const { materials } = req.body;

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    return res.status(400).json({ error: '缺少材料列表' });
  }

  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (order.status === 'completed') {
    return res.status(400).json({ error: '已完工的工单不能再领用材料' });
  }

  if (order.status !== 'assigned' && order.status !== 'in_progress') {
    return res.status(400).json({ error: '只有已派工或进行中的工单才能领用材料' });
  }

  const insufficientMaterials = [];

  for (const item of materials) {
    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(item.material_id);
    if (!material) {
      return res.status(404).json({ error: `材料不存在: ${item.material_id}` });
    }
    if (material.stock < item.quantity) {
      insufficientMaterials.push({
        id: material.id,
        name: material.name,
        requested: item.quantity,
        available: material.stock
      });
    }
  }

  if (insufficientMaterials.length > 0) {
    return res.status(400).json({ 
      error: '材料库存不足', 
      insufficient: insufficientMaterials 
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const transaction = db.transaction(() => {
    if (order.status === 'assigned') {
      db.prepare(`UPDATE repair_orders SET status = 'in_progress' WHERE id = ?`).run(id);
    }

    for (const item of materials) {
      const usageId = 'mu' + uuidv4().slice(0, 8);
      
      db.prepare(`
        INSERT INTO material_usages (id, order_id, material_id, quantity, used_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(usageId, id, item.material_id, item.quantity, now);

      db.prepare(`
        UPDATE materials 
        SET stock = stock - ?
        WHERE id = ?
      `).run(item.quantity, item.material_id);
    }
  });

  transaction();

  res.json({ message: '材料领用成功' });
});

router.post('/orders/:id/complete', (req, res) => {
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (order.status !== 'assigned' && order.status !== 'in_progress') {
    return res.status(400).json({ error: '只有已派工或进行中的工单才能完工' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE repair_orders 
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, id);

    if (order.worker_id) {
      db.prepare(`
        UPDATE workers 
        SET status = 'available'
        WHERE id = ?
      `).run(order.worker_id);
    }
  });

  transaction();

  res.json({ message: '完工成功' });
});

router.post('/orders/:id/rate', (req, res) => {
  const { id } = req.params;
  const { satisfaction } = req.body;

  if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
    return res.status(400).json({ error: '满意度必须为1-5的整数' });
  }

  const order = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }

  if (order.status !== 'completed') {
    return res.status(400).json({ error: '只有已完工的工单才能评价' });
  }

  db.prepare('UPDATE repair_orders SET satisfaction = ? WHERE id = ?').run(satisfaction, id);

  res.json({ message: '评价成功' });
});

router.get('/assign-board', (req, res) => {
  const pendingOrders = db.prepare(`
    SELECT o.*, s.name as student_name, s.dormitory as student_dormitory
    FROM repair_orders o
    LEFT JOIN students s ON o.student_id = s.id
    WHERE o.status = 'pending'
    ORDER BY 
      CASE o.urgency 
        WHEN 'urgent' THEN 1 
        WHEN 'normal' THEN 2 
        ELSE 3 
      END,
      o.created_at ASC
  `).all();

  const availableWorkers = db.prepare(`
    SELECT w.*,
      (SELECT COUNT(*) FROM repair_orders 
       WHERE worker_id = w.id AND status IN ('assigned', 'in_progress')) as current_tasks
    FROM workers w
    WHERE w.status = 'available'
    ORDER BY current_tasks ASC
  `).all();

  const buildings = db.prepare(`
    SELECT DISTINCT building 
    FROM repair_orders 
    ORDER BY building
  `).all().map(b => b.building);

  const urgentWaiting = pendingOrders.filter(o => 
    o.urgency === 'urgent' && 
    dayjs().diff(dayjs(o.created_at), 'hour') > 2
  );

  res.json({
    pendingOrders,
    availableWorkers,
    buildings,
    urgentOverdue: urgentWaiting
  });
});

router.get('/statistics', (req, res) => {
  const buildingStats = db.prepare(`
    SELECT 
      building,
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      AVG(CASE WHEN status = 'completed' AND assigned_at IS NOT NULL AND completed_at IS NOT NULL 
          THEN julianday(completed_at) - julianday(assigned_at) 
          ELSE NULL END) * 24 as avg_processing_hours
    FROM repair_orders
    GROUP BY building
    ORDER BY building
  `).all();

  const materialStats = db.prepare(`
    SELECT 
      m.id,
      m.name,
      m.unit,
      SUM(mu.quantity) as total_used,
      m.stock as current_stock
    FROM materials m
    LEFT JOIN material_usages mu ON m.id = mu.material_id
    GROUP BY m.id
    ORDER BY total_used DESC
  `).all();

  const urgencyStats = db.prepare(`
    SELECT 
      urgency,
      COUNT(*) as count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM repair_orders
    GROUP BY urgency
  `).all();

  const overallStats = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'assigned' OR status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      AVG(CASE WHEN satisfaction IS NOT NULL THEN satisfaction ELSE NULL END) as avg_satisfaction
    FROM repair_orders
  `).get();

  res.json({
    buildingStats,
    materialStats,
    urgencyStats,
    overallStats
  });
});

router.get('/alerts', (req, res) => {
  const alerts = [];

  const urgentOverdue = db.prepare(`
    SELECT * FROM repair_orders 
    WHERE status = 'pending' 
      AND urgency = 'urgent'
      AND created_at <= ?
    ORDER BY created_at ASC
  `).all(dayjs().subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'));

  if (urgentOverdue.length > 0) {
    alerts.push({
      type: 'urgent_overdue',
      level: 'high',
      message: `有 ${urgentOverdue.length} 个紧急工单超过2小时未派工`,
      details: urgentOverdue
    });
  }

  const lowStock = db.prepare(`
    SELECT * FROM materials 
    WHERE stock < 10
    ORDER BY stock ASC
  `).all();

  if (lowStock.length > 0) {
    alerts.push({
      type: 'low_stock',
      level: 'medium',
      message: `有 ${lowStock.length} 种材料库存不足10`,
      details: lowStock
    });
  }

  res.json(alerts);
});

module.exports = router;
