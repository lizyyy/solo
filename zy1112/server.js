const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { initDB, getDB, closeDB } = require('./db');
const orderService = require('./services/orderService');
const exportService = require('./services/exportService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });

initDB();

function formatDateTime(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

// 客户管理 API
app.get('/api/customers', (req, res) => {
  const db = getDB();
  const customers = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
  res.json({ success: true, data: customers });
});

app.get('/api/customers/:id', (req, res) => {
  const db = getDB();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ success: false, message: '客户不存在' });
  }
  res.json({ success: true, data: customer });
});

app.post('/api/customers', (req, res) => {
  const db = getDB();
  const { name, phone, wechat, address, notes } = req.body;
  
  const result = db.prepare(`
    INSERT INTO customers (name, phone, wechat, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, phone || null, wechat || null, address || null, notes || null);
  
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: customer });
});

app.put('/api/customers/:id', (req, res) => {
  const db = getDB();
  const { name, phone, wechat, address, notes } = req.body;
  
  db.prepare(`
    UPDATE customers SET name = ?, phone = ?, wechat = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, phone || null, wechat || null, address || null, notes || null, req.params.id);
  
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: customer });
});

// 规格模板 API
app.get('/api/spec-templates', (req, res) => {
  const db = getDB();
  const templates = db.prepare('SELECT * FROM spec_templates ORDER BY product_type, name').all();
  res.json({ success: true, data: templates });
});

app.get('/api/spec-templates/:id', (req, res) => {
  const db = getDB();
  const template = db.prepare('SELECT * FROM spec_templates WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: template });
});

app.post('/api/spec-templates', (req, res) => {
  const db = getDB();
  const { name, product_type, width, height, unit, bleed, resolution, color_mode, 
          default_quantity, sheet_size, sheets_per_sheet, waste_rate, process_ids, notes } = req.body;
  
  const result = db.prepare(`
    INSERT INTO spec_templates 
    (name, product_type, width, height, unit, bleed, resolution, color_mode, 
     default_quantity, sheet_size, sheets_per_sheet, waste_rate, process_ids, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, product_type, width, height, unit || 'mm', bleed || 0, resolution || 300, 
         color_mode || 'CMYK', default_quantity || 100, sheet_size || null, 
         sheets_per_sheet || 1, waste_rate || 0.05, 
         process_ids ? JSON.stringify(process_ids) : null, notes || null);
  
  const template = db.prepare('SELECT * FROM spec_templates WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: template });
});

// 纸张耗材 API
app.get('/api/paper-stock', (req, res) => {
  const db = getDB();
  const papers = db.prepare(`
    SELECT ps.*,
      (SELECT SUM(sl.quantity) FROM stock_locks sl WHERE sl.paper_id = ps.id AND sl.is_released = 0) as locked_qty
    FROM paper_stock ps
    ORDER BY ps.name
  `).all();
  
  const result = papers.map(p => ({
    ...p,
    available: p.stock_qty - (p.locked_qty || 0),
    needs_restock: (p.stock_qty - (p.locked_qty || 0)) <= p.min_stock
  }));
  
  res.json({ success: true, data: result });
});

app.get('/api/paper-stock/:id', (req, res) => {
  const db = getDB();
  const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: paper });
});

app.post('/api/paper-stock', (req, res) => {
  const db = getDB();
  const { name, type, size, weight, color, unit_price, stock_qty, min_stock, supplier, notes } = req.body;
  
  const result = db.prepare(`
    INSERT INTO paper_stock (name, type, size, weight, color, unit_price, stock_qty, min_stock, supplier, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, type || null, size || null, weight || null, color || null, 
         unit_price || 0, stock_qty || 0, min_stock || 50, supplier || null, notes || null);
  
  const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: paper });
});

app.put('/api/paper-stock/:id/adjust', (req, res) => {
  const db = getDB();
  const { quantity, reason } = req.body;
  const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(req.params.id);
  
  if (!paper) {
    return res.status(404).json({ success: false, message: '纸张不存在' });
  }
  
  const newQty = paper.stock_qty + parseFloat(quantity);
  db.prepare('UPDATE paper_stock SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(newQty, req.params.id);
  
  const updated = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated, message: `库存调整: ${quantity > 0 ? '+' : ''}${quantity}` });
});

// 工序 API
app.get('/api/processes', (req, res) => {
  const db = getDB();
  const processes = db.prepare('SELECT * FROM processes ORDER BY type, name').all();
  res.json({ success: true, data: processes });
});

// 机器设备 API
app.get('/api/machines', (req, res) => {
  const db = getDB();
  const machines = db.prepare('SELECT * FROM machines ORDER BY type, name').all();
  res.json({ success: true, data: machines });
});

// 订单 API
app.get('/api/orders', (req, res) => {
  const db = getDB();
  const { status, customer_id, date_from, date_to } = req.query;
  
  let sql = `
    SELECT o.*, c.name as customer_name, p.name as paper_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN paper_stock p ON o.paper_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    sql += ' AND o.status = ?';
    params.push(status);
  }
  if (customer_id) {
    sql += ' AND o.customer_id = ?';
    params.push(parseInt(customer_id));
  }
  if (date_from) {
    sql += ' AND o.created_at >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND o.created_at <= ?';
    params.push(date_to);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  const orders = db.prepare(sql).all(...params);
  
  const result = orders.map(o => ({
    ...o,
    status_name: orderService.STATUS_NAMES[o.status] || o.status,
    process_ids: o.process_ids ? JSON.parse(o.process_ids) : null
  }));
  
  res.json({ success: true, data: result });
});

app.get('/api/orders/:id', (req, res) => {
  const db = getDB();
  const order = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.wechat as customer_wechat,
           p.name as paper_name, p.unit_price as paper_price
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN paper_stock p ON o.paper_id = p.id
    WHERE o.id = ?
  `).get(req.params.id);
  
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  order.status_name = orderService.STATUS_NAMES[order.status] || order.status;
  order.process_ids = order.process_ids ? JSON.parse(order.process_ids) : null;
  
  const files = db.prepare('SELECT * FROM upload_files WHERE order_id = ?').all(order.id);
  const issues = db.prepare('SELECT * FROM precheck_issues WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  const changes = db.prepare('SELECT * FROM order_changes WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  const schedule = db.prepare(`
    SELECT se.*, m.name as machine_name
    FROM schedule_entries se
    LEFT JOIN machines m ON se.machine_id = m.id
    WHERE se.order_id = ?
    ORDER BY se.start_time
  `).all(order.id);
  
  res.json({ 
    success: true, 
    data: {
      order,
      files,
      issues: issues.map(i => ({ ...i, issue_name: orderService.ISSUE_NAMES[i.issue_type] || i.issue_type })),
      history: history.map(h => ({ 
        ...h, 
        from_status_name: h.from_status ? orderService.STATUS_NAMES[h.from_status] : null,
        to_status_name: orderService.STATUS_NAMES[h.to_status] || h.to_status
      })),
      changes,
      schedule
    }
  });
});

app.post('/api/orders', (req, res) => {
  try {
    const orderData = {
      ...req.body,
      pickup_time: req.body.pickup_time ? formatDateTime(req.body.pickup_time) : null
    };
    
    const order = orderService.createOrder(orderData);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  try {
    const { status, reason, operator } = req.body;
    const orderId = parseInt(req.params.id);
    
    if (status === 'paid') {
      const { paid_amount } = req.body;
      const db = getDB();
      db.prepare('UPDATE orders SET paid_amount = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(paid_amount || 0, orderId);
    }
    
    if (status === 'locked') {
      orderService.lockStock(orderId);
    }
    
    if (status === 'cancelled') {
      orderService.releaseStock(orderId);
    }
    
    const order = orderService.updateOrderStatus(orderId, status, reason || '', operator || 'system');
    order.status_name = orderService.STATUS_NAMES[order.status];
    
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.put('/api/orders/:id', (req, res) => {
  const db = getDB();
  const orderId = parseInt(req.params.id);
  const oldOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  
  if (!oldOrder) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  
  const { quantity, paper_id, pickup_time, notes, reason, operator } = req.body;
  
  let needsRecalc = false;
  if (quantity !== undefined && quantity !== oldOrder.quantity) needsRecalc = true;
  if (paper_id !== undefined && paper_id !== oldOrder.paper_id) needsRecalc = true;
  
  if (needsRecalc) {
    if (oldOrder.status === 'locked') {
      orderService.releaseStock(orderId);
    }
    
    const newQuantity = quantity !== undefined ? quantity : oldOrder.quantity;
    const newPaperId = paper_id !== undefined ? paper_id : oldOrder.paper_id;
    
    const spec = {
      width: oldOrder.width,
      height: oldOrder.height,
      sheets_per_sheet: 1,
      waste_rate: 0.05
    };
    const paperUsage = orderService.calculatePaperUsage(spec, newQuantity);
    
    db.prepare(`
      UPDATE orders SET 
        quantity = ?, paper_id = ?, paper_qty_est = ?,
        pickup_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newQuantity, newPaperId, paperUsage.sheets, 
           pickup_time ? formatDateTime(pickup_time) : oldOrder.pickup_time, 
           notes || oldOrder.notes, orderId);
    
    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const paper = db.prepare('SELECT * FROM paper_stock WHERE id = ?').get(newPaperId);
    const pricing = orderService.calculatePrice(updatedOrder, paper);
    
    db.prepare('UPDATE orders SET total_cost = ?, total_price = ? WHERE id = ?')
      .run(pricing.totalCost, pricing.totalPrice, orderId);
    
    if (oldOrder.status === 'locked') {
      try {
        orderService.lockStock(orderId);
      } catch (e) {
        orderService.updateOrderStatus(orderId, 'paid', '改单后库存不足，需重新锁料', operator || 'system');
      }
    }
    
    orderService.recordOrderChange(orderId, 'modify', 'quantity', oldOrder.quantity, newQuantity, reason || '改单', operator || 'system');
    
    const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    finalOrder.status_name = orderService.STATUS_NAMES[finalOrder.status];
    
    res.json({ success: true, data: finalOrder, message: '订单已更新' });
  } else {
    db.prepare(`
      UPDATE orders SET pickup_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(pickup_time ? formatDateTime(pickup_time) : oldOrder.pickup_time, notes || oldOrder.notes, orderId);
    
    const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    finalOrder.status_name = orderService.STATUS_NAMES[finalOrder.status];
    
    res.json({ success: true, data: finalOrder });
  }
});

// 文件上传 API
app.post('/api/orders/:id/upload', upload.single('file'), (req, res) => {
  const db = getDB();
  const orderId = parseInt(req.params.id);
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传文件' });
  }
  
  const result = db.prepare(`
    INSERT INTO upload_files (order_id, original_name, file_path, file_size, file_type)
    VALUES (?, ?, ?, ?, ?)
  `).run(orderId, req.file.originalname, req.file.path, req.file.size, req.file.mimetype);
  
  const file = db.prepare('SELECT * FROM upload_files WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: file });
});

// 预检 API
app.post('/api/orders/:id/precheck', (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const issues = orderService.simulatePrecheck(orderId);
    res.json({ success: true, data: issues, count: issues.length });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/precheck-issues', (req, res) => {
  const db = getDB();
  const { status, order_id } = req.query;
  
  let sql = `
    SELECT pi.*, o.order_no, c.name as customer_name
    FROM precheck_issues pi
    JOIN orders o ON pi.order_id = o.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    sql += ' AND pi.status = ?';
    params.push(status);
  }
  if (order_id) {
    sql += ' AND pi.order_id = ?';
    params.push(parseInt(order_id));
  }
  
  sql += ' ORDER BY pi.created_at DESC';
  
  const issues = db.prepare(sql).all(...params);
  
  res.json({ 
    success: true, 
    data: issues.map(i => ({ 
      ...i, 
      issue_name: orderService.ISSUE_NAMES[i.issue_type] || i.issue_type 
    }))
  });
});

app.put('/api/precheck-issues/:id/resolve', (req, res) => {
  try {
    const { resolution, operator } = req.body;
    const issue = orderService.resolvePrecheckIssue(parseInt(req.params.id), resolution || '已处理', operator || 'system');
    res.json({ success: true, data: issue });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 排产 API
app.get('/api/schedule', (req, res) => {
  const db = getDB();
  const { date_from, date_to, machine_id } = req.query;
  
  let sql = `
    SELECT se.*, o.order_no, c.name as customer_name, m.name as machine_name
    FROM schedule_entries se
    JOIN orders o ON se.order_id = o.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN machines m ON se.machine_id = m.id
    WHERE 1=1
  `;
  const params = [];
  
  if (date_from) {
    sql += ' AND se.start_time >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND se.start_time <= ?';
    params.push(date_to);
  }
  if (machine_id) {
    sql += ' AND se.machine_id = ?';
    params.push(parseInt(machine_id));
  }
  
  sql += ' ORDER BY se.start_time';
  
  const entries = db.prepare(sql).all(...params);
  res.json({ success: true, data: entries });
});

app.post('/api/schedule', (req, res) => {
  try {
    const { order_id, machine_id, process_type, start_time, end_time, quantity, notes } = req.body;
    
    const result = orderService.createScheduleEntry({
      orderId: order_id,
      machineId: machine_id,
      processType: process_type,
      startTime: formatDateTime(start_time),
      endTime: formatDateTime(end_time),
      quantity,
      notes
    });
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 导出 API
app.get('/api/export/today-production', (req, res) => {
  const { format = 'json' } = req.query;
  const orders = exportService.getTodayProduction();
  
  switch (format.toLowerCase()) {
    case 'markdown':
    case 'md':
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=today-production.md');
      res.send(exportService.toMarkdown_TodayProduction(orders));
      break;
    case 'html':
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(exportService.toHTML_TodayProduction(orders));
      break;
    case 'csv':
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=today-production.csv');
      res.send('\uFEFF' + exportService.toCSV_TodayProduction(orders));
      break;
    default:
      res.json({ success: true, data: orders });
  }
});

app.get('/api/export/pickup-list', (req, res) => {
  const { format = 'json' } = req.query;
  const orders = exportService.getPickupList();
  
  switch (format.toLowerCase()) {
    case 'markdown':
    case 'md':
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=pickup-list.md');
      res.send(exportService.toMarkdown_PickupList(orders));
      break;
    case 'csv':
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=pickup-list.csv');
      res.send('\uFEFF' + exportService.toCSV_PickupList(orders));
      break;
    default:
      res.json({ success: true, data: orders });
  }
});

app.get('/api/export/restock-list', (req, res) => {
  const { format = 'json' } = req.query;
  const papers = exportService.getPaperRestockList();
  
  switch (format.toLowerCase()) {
    case 'markdown':
    case 'md':
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=restock-list.md');
      res.send(exportService.toMarkdown_RestockList(papers));
      break;
    case 'csv':
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=restock-list.csv');
      res.send('\uFEFF' + exportService.toCSV_RestockList(papers));
      break;
    default:
      res.json({ success: true, data: papers });
  }
});

// 仪表盘统计 API
app.get('/api/dashboard/stats', (req, res) => {
  const db = getDB();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  
  const orderStats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM orders
    GROUP BY status
  `).all();
  
  const statsMap = {};
  orderStats.forEach(s => { statsMap[s.status] = s.count; });
  
  const todayPickup = db.prepare(`
    SELECT COUNT(*) as count
    FROM orders
    WHERE status IN ('scheduled', 'ready')
    AND pickup_time >= ? AND pickup_time < ?
  `).get(startOfDay, endOfDay);
  
  const pendingIssues = db.prepare(`
    SELECT COUNT(*) as count FROM precheck_issues WHERE status = 'pending'
  `).get();
  
  const lowStock = db.prepare(`
    SELECT COUNT(*) as count
    FROM (
      SELECT ps.id
      FROM paper_stock ps
      LEFT JOIN stock_locks sl ON ps.id = sl.paper_id AND sl.is_released = 0
      GROUP BY ps.id
      HAVING (ps.stock_qty - COALESCE(SUM(sl.quantity), 0)) <= ps.min_stock
    )
  `).get();
  
  const todayRevenue = db.prepare(`
    SELECT COALESCE(SUM(paid_amount), 0) as total
    FROM orders
    WHERE paid_at >= ? AND paid_at < ?
  `).get(startOfDay, endOfDay);
  
  res.json({
    success: true,
    data: {
      order_stats: statsMap,
      status_names: orderService.STATUS_NAMES,
      today_pickup: todayPickup.count,
      pending_issues: pendingIssues.count,
      low_stock: lowStock.count,
      today_revenue: todayRevenue.total
    }
  });
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`印务店管理系统已启动`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`API 文档: http://localhost:${PORT}/api`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  closeDB();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = app;
