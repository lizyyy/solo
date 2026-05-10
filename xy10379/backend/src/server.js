const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase, runAsync, getAsync, allAsync } = require('./database');
const XLSX = require('xlsx');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

initDatabase().then(() => {
  console.log('数据库初始化完成');
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await allAsync(`
      SELECT r.*, 
             o.id as current_order_id,
             o.guest_name,
             o.check_in_time,
             o.status as order_status
      FROM rooms r
      LEFT JOIN room_orders o ON r.id = o.room_id AND o.status = 'open'
      ORDER BY r.room_number
    `);
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  const { room_number, room_type, floor } = req.body;
  try {
    const result = await runAsync(
      'INSERT INTO rooms (room_number, room_type, floor) VALUES (?, ?, ?)',
      [room_number, room_type, floor]
    );
    res.json({ id: result.lastID });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/linen-types', async (req, res) => {
  try {
    const types = await allAsync('SELECT * FROM linen_types ORDER BY name');
    res.json(types);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await allAsync(`
      SELECT li.*, lt.name, lt.unit, lt.price
      FROM linen_inventory li
      JOIN linen_types lt ON li.linen_type_id = lt.id
      ORDER BY lt.name
    `);
    res.json(inventory);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/inventory-transactions', async (req, res) => {
  try {
    const transactions = await allAsync(`
      SELECT it.*, lt.name as linen_name, lt.unit
      FROM inventory_transactions it
      JOIN linen_types lt ON it.linen_type_id = lt.id
      ORDER BY it.created_at DESC
      LIMIT 100
    `);
    res.json(transactions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/staff', async (req, res) => {
  try {
    const staff = await allAsync('SELECT * FROM staff ORDER BY role, name');
    res.json(staff);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/room-orders', async (req, res) => {
  try {
    const orders = await allAsync(`
      SELECT o.*, r.room_number, r.room_type,
             (SELECT COUNT(*) FROM damage_reports dr WHERE dr.room_order_id = o.id) as damage_count,
             (SELECT COUNT(*) FROM compensations c WHERE c.room_order_id = o.id AND c.payment_status = 'paid') as paid_count
      FROM room_orders o
      JOIN rooms r ON o.room_id = r.id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/room-orders/:id', async (req, res) => {
  try {
    const order = await getAsync(`
      SELECT o.*, r.room_number, r.room_type
      FROM room_orders o
      JOIN rooms r ON o.room_id = r.id
      WHERE o.id = ?
    `, [req.params.id]);
    
    if (!order) {
      return res.status(404).json({ error: '房单不存在' });
    }
    
    const damages = await allAsync(`
      SELECT dr.*, lt.name as linen_name, lt.price, lt.unit,
             s.name as reporter_name,
             c.id as compensation_id, c.payment_status, c.amount as compensation_amount
      FROM damage_reports dr
      JOIN linen_types lt ON dr.linen_type_id = lt.id
      LEFT JOIN staff s ON dr.reported_by_staff_id = s.id
      LEFT JOIN compensations c ON c.damage_report_id = dr.id
      WHERE dr.room_order_id = ?
      ORDER BY dr.report_time DESC
    `, [req.params.id]);
    
    res.json({ ...order, damages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/room-orders', async (req, res) => {
  const { room_id, guest_name, check_in_time } = req.body;
  try {
    const room = await getAsync('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (!room) return res.status(404).json({ error: '客房不存在' });
    
    const openOrder = await getAsync('SELECT * FROM room_orders WHERE room_id = ? AND status = "open"', [room_id]);
    if (openOrder) return res.status(400).json({ error: '该客房已有未结账单' });
    
    const result = await runAsync(
      'INSERT INTO room_orders (room_id, guest_name, check_in_time) VALUES (?, ?, ?)',
      [room_id, guest_name, check_in_time || new Date().toISOString()]
    );
    
    await runAsync('UPDATE rooms SET status = "occupied" WHERE id = ?', [room_id]);
    res.json({ id: result.lastID });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/room-orders/:id/checkout', async (req, res) => {
  const orderId = req.params.id;
  const { should_close = true } = req.body;
  
  try {
    const order = await getAsync('SELECT * FROM room_orders WHERE id = ?', [orderId]);
    if (!order) throw new Error('房单不存在');
    
    const pendingDamages = await allAsync(`
      SELECT dr.* FROM damage_reports dr
      LEFT JOIN compensations c ON c.damage_report_id = dr.id
      WHERE dr.room_order_id = ?
      AND (c.id IS NULL OR c.payment_status != 'paid')
    `, [orderId]);
    
    if (pendingDamages.length > 0) {
      throw new Error(`存在 ${pendingDamages.length} 条未处理的报损记录，无法退房`);
    }
    
    if (should_close) {
      await runAsync('UPDATE room_orders SET status = "closed", check_out_time = ? WHERE id = ?',
        [new Date().toISOString(), orderId]);
      await runAsync('UPDATE rooms SET status = "available" WHERE id = ?', [order.room_id]);
    }
    
    res.json({ success: true, order_id: orderId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/clean-inspections', async (req, res) => {
  try {
    const inspections = await allAsync(`
      SELECT ci.*, r.room_number, o.guest_name, s.name as inspector_name
      FROM clean_inspections ci
      JOIN room_orders o ON ci.room_order_id = o.id
      JOIN rooms r ON o.room_id = r.id
      LEFT JOIN staff s ON ci.staff_id = s.id
      ORDER BY ci.inspection_time DESC
    `);
    res.json(inspections);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/clean-inspections', async (req, res) => {
  const { room_order_id, staff_id, status, notes } = req.body;
  
  try {
    const order = await getAsync('SELECT * FROM room_orders WHERE id = ?', [room_order_id]);
    if (!order) throw new Error('房单不存在');
    
    const result = await runAsync(
      'INSERT INTO clean_inspections (room_order_id, staff_id, status, notes) VALUES (?, ?, ?, ?)',
      [room_order_id, staff_id, status || 'completed', notes]
    );
    
    res.json({ id: result.lastID });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/damage-reports', async (req, res) => {
  try {
    const reports = await allAsync(`
      SELECT dr.*, r.room_number, lt.name as linen_name, lt.price, lt.unit,
             s.name as reporter_name, o.guest_name,
             c.id as compensation_id, c.payment_status, c.amount as compensation_amount
      FROM damage_reports dr
      JOIN room_orders o ON dr.room_order_id = o.id
      JOIN rooms r ON o.room_id = r.id
      JOIN linen_types lt ON dr.linen_type_id = lt.id
      LEFT JOIN staff s ON dr.reported_by_staff_id = s.id
      LEFT JOIN compensations c ON c.damage_report_id = dr.id
      ORDER BY dr.report_time DESC
    `);
    res.json(reports);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/damage-reports', async (req, res) => {
  const { room_order_id, linen_type_id, reported_by_staff_id, damage_level, description, quantity } = req.body;
  
  try {
    const order = await getAsync('SELECT * FROM room_orders WHERE id = ?', [room_order_id]);
    if (!order) throw new Error('房单不存在');
    
    if (order.status !== 'open') throw new Error('房单已关闭，无法添加报损');
    
    const existingReports = await allAsync(`
      SELECT dr.* FROM damage_reports dr
      WHERE dr.room_order_id = ? AND dr.linen_type_id = ? AND dr.status != 'cancelled'
    `, [room_order_id, linen_type_id]);
    
    const totalExisting = existingReports.reduce((sum, r) => sum + r.quantity, 0);
    
    if (totalExisting > 0) {
      throw new Error(`该布草已存在 ${totalExisting} 件报损记录，防止重复报损`);
    }
    
    const linen = await getAsync('SELECT * FROM linen_types WHERE id = ?', [linen_type_id]);
    if (!linen) throw new Error('布草类型不存在');
    
    const result = await runAsync(`
      INSERT INTO damage_reports 
      (room_order_id, linen_type_id, reported_by_staff_id, damage_level, description, quantity, status, is_repeat_check)
      VALUES (?, ?, ?, ?, ?, ?, 'reported', 'yes')
    `, [room_order_id, linen_type_id, reported_by_staff_id, damage_level, description, quantity || 1]);
    
    res.json({ 
      id: result.lastID,
      message: '报损登记成功，请安排复核'
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/damage-reports/:id/confirm', async (req, res) => {
  const { confirmed_by_staff_id, notes } = req.body;
  const reportId = req.params.id;
  
  try {
    const report = await getAsync('SELECT * FROM damage_reports WHERE id = ?', [reportId]);
    if (!report) throw new Error('报损记录不存在');
    
    if (report.status === 'confirmed') {
      throw new Error('报损已确认，不能重复操作');
    }
    
    await runAsync(`
      UPDATE damage_reports 
      SET status = 'confirmed'
      WHERE id = ?
    `, [reportId]);
    
    const linen = await getAsync('SELECT * FROM linen_types WHERE id = ?', [report.linen_type_id]);
    const inventory = await getAsync('SELECT * FROM linen_inventory WHERE linen_type_id = ?', [report.linen_type_id]);
    
    let compensationAmount = linen.price * report.quantity;
    
    if (inventory) {
      const damageQty = Math.min(report.quantity, inventory.available_quantity);
      
      await runAsync(`
        UPDATE linen_inventory 
        SET in_use_quantity = in_use_quantity - ?,
            damaged_quantity = damaged_quantity + ?,
            available_quantity = available_quantity - ?
        WHERE linen_type_id = ?
      `, [damageQty, damageQty, damageQty, report.linen_type_id]);
      
      await runAsync(`
        INSERT INTO inventory_transactions 
        (linen_type_id, change_quantity, transaction_type, reference_id, notes)
        VALUES (?, ?, 'damage', ?, ?)
      `, [report.linen_type_id, -damageQty, reportId, `报损确认: ${report.description || '布草损坏'}`]);
    }
    
    const existingComp = await getAsync('SELECT * FROM compensations WHERE damage_report_id = ?', [reportId]);
    
    if (!existingComp) {
      const order = await getAsync('SELECT * FROM room_orders WHERE id = ?', [report.room_order_id]);
      await runAsync(`
        INSERT INTO compensations 
        (damage_report_id, room_order_id, guest_name, amount, payment_status)
        VALUES (?, ?, ?, ?, 'unpaid')
      `, [reportId, report.room_order_id, order.guest_name, compensationAmount]);
    }
    
    res.json({ 
      success: true, 
      compensation_amount: compensationAmount,
      message: '报损已确认，库存已调整，待赔付'
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/damage-reports/:id/cancel', async (req, res) => {
  const reportId = req.params.id;
  
  try {
    const report = await getAsync('SELECT * FROM damage_reports WHERE id = ?', [reportId]);
    if (!report) return res.status(404).json({ error: '报损记录不存在' });
    
    if (report.status === 'confirmed') {
      return res.status(400).json({ error: '已确认的报损不能取消' });
    }
    
    await runAsync('UPDATE damage_reports SET status = "cancelled" WHERE id = ?', [reportId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/compensations', async (req, res) => {
  try {
    const compensations = await allAsync(`
      SELECT c.*, r.room_number, lt.name as linen_name, lt.price, lt.unit,
             dr.quantity, dr.damage_level, dr.description
      FROM compensations c
      JOIN room_orders o ON c.room_order_id = o.id
      JOIN rooms r ON o.room_id = r.id
      JOIN damage_reports dr ON c.damage_report_id = dr.id
      JOIN linen_types lt ON dr.linen_type_id = lt.id
      ORDER BY c.created_at DESC
    `);
    res.json(compensations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/compensations/:id/pay', async (req, res) => {
  const compId = req.params.id;
  
  try {
    const comp = await getAsync('SELECT * FROM compensations WHERE id = ?', [compId]);
    if (!comp) throw new Error('赔付记录不存在');
    
    if (comp.payment_status === 'paid') throw new Error('已支付');
    
    await runAsync(`
      UPDATE compensations 
      SET payment_status = 'paid', payment_time = ?
      WHERE id = ?
    `, [new Date().toISOString(), compId]);
    
    res.json({ success: true, message: '赔付完成' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/export/daily-report', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const orders = await allAsync(`
      SELECT o.*, r.room_number, o.guest_name, o.check_in_time, o.check_out_time, o.status,
             (SELECT COUNT(*) FROM damage_reports dr WHERE dr.room_order_id = o.id) as damage_count,
             (SELECT COUNT(*) FROM compensations c WHERE c.room_order_id = o.id AND c.payment_status = 'paid') as paid_count,
             COALESCE((SELECT SUM(c.amount) FROM compensations c WHERE c.room_order_id = o.id), 0) as total_amount,
             COALESCE((SELECT SUM(c.amount) FROM compensations c WHERE c.room_order_id = o.id AND c.payment_status = 'paid'), 0) as paid_amount
      FROM room_orders o
      JOIN rooms r ON o.room_id = r.id
      WHERE DATE(o.created_at) = ? OR DATE(o.check_out_time) = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [targetDate, targetDate]);
    
    const transactions = await allAsync(`
      SELECT it.*, lt.name as linen_name, lt.unit,
             DATE(it.created_at) as trans_date
      FROM inventory_transactions it
      JOIN linen_types lt ON it.linen_type_id = lt.id
      WHERE DATE(it.created_at) = ?
      ORDER BY it.created_at DESC
    `, [targetDate]);
    
    const compensations = await allAsync(`
      SELECT c.*, r.room_number, lt.name as linen_name, dr.quantity, c.amount, c.payment_status, c.payment_time
      FROM compensations c
      JOIN room_orders o ON c.room_order_id = o.id
      JOIN rooms r ON o.room_id = r.id
      JOIN damage_reports dr ON c.damage_report_id = dr.id
      JOIN linen_types lt ON dr.linen_type_id = lt.id
      WHERE DATE(c.created_at) = ? OR DATE(c.payment_time) = ?
      ORDER BY c.created_at DESC
    `, [targetDate, targetDate]);
    
    const wb = XLSX.utils.book_new();
    
    const ordersData = [
      ['房号', '客人', '入住时间', '退房时间', '状态', '报损数', '已赔付数', '总金额', '已收金额'],
      ...orders.map(o => [
        o.room_number,
        o.guest_name,
        o.check_in_time,
        o.check_out_time,
        o.status,
        o.damage_count,
        o.paid_count,
        o.total_amount,
        o.paid_amount
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersData), '今日房单');
    
    const compData = [
      ['房号', '客人', '布草类型', '数量', '金额', '支付状态', '支付时间'],
      ...compensations.map(c => [
        c.room_number,
        c.guest_name,
        c.linen_name,
        c.quantity,
        c.amount,
        c.payment_status,
        c.payment_time
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(compData), '赔付记录');
    
    const transData = [
      ['布草类型', '变化数量', '类型', '时间', '备注'],
      ...transactions.map(t => [
        t.linen_name,
        t.change_quantity,
        t.transaction_type,
        t.created_at,
        t.notes
      ])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(transData), '库存变动');
    
    const summaryData = [
      ['日期', targetDate],
      ['今日房单数', orders.length],
      ['报损总数', orders.reduce((s, o) => s + o.damage_count, 0)],
      ['已赔付金额', orders.reduce((s, o) => s + o.paid_amount, 0)],
      ['待收金额', orders.reduce((s, o) => s + (o.total_amount - o.paid_amount), 0)]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '汇总');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=hotel-linen-report-${targetDate}.xlsx`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const rooms = await getAsync('SELECT COUNT(*) as count FROM rooms');
    const occupied = await getAsync('SELECT COUNT(*) as count FROM rooms WHERE status = "occupied"');
    const openOrders = await getAsync('SELECT COUNT(*) as count FROM room_orders WHERE status = "open"');
    const pendingDamages = await getAsync(`
      SELECT COUNT(*) as count FROM damage_reports dr
      LEFT JOIN compensations c ON c.damage_report_id = dr.id
      WHERE dr.status != "cancelled" AND (c.id IS NULL OR c.payment_status != "paid")
    `);
    const todayTrans = await getAsync(`
      SELECT COUNT(*) as count FROM inventory_transactions 
      WHERE DATE(created_at) = DATE('now')
    `);
    
    res.json({
      rooms: rooms.count,
      occupied_rooms: occupied.count,
      open_orders: openOrders.count,
      pending_damages: pendingDamages.count,
      today_transactions: todayTrans.count
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`酒店布草报损赔付台后端运行在 http://localhost:${PORT}`);
});
