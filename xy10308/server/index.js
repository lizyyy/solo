const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { initDatabase, seedData, saveDatabase, getRows, getOne, getDb } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function logHistory(orderId, action, details, fieldChanged, oldValue, newValue, operator) {
  const db = getDb();
  const timestamp = formatDate(new Date());
  const params = [
    orderId,
    action,
    fieldChanged || null,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    operator || '系统管理员',
    timestamp,
    details || ''
  ];
  db.run('INSERT INTO history_logs (order_id, action, field_changed, old_value, new_value, operator, timestamp, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', params);
  saveDatabase();
}

function generateOrderNo() {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
                 (date.getMonth() + 1).toString().padStart(2, '0') +
                 date.getDate().toString().padStart(2, '0');
  const db = getDb();
  const result = db.exec('SELECT COUNT(*) as count FROM orders WHERE order_no LIKE ?', [dateStr + '%']);
  const count = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : 0;
  return dateStr + (count + 1).toString().padStart(4, '0');
}

app.get('/api/orders', (req, res) => {
  const { status } = req.query;
  const db = getDb();
  let query = `SELECT o.*, p.name as photographer_name, e.name as editor_name, (SELECT COUNT(*) FROM photos WHERE order_id = o.id AND is_selected = 1) as selected_photos_count, (SELECT COUNT(*) FROM photos WHERE order_id = o.id) as total_photos_count FROM orders o LEFT JOIN photographers p ON o.photographer_id = p.id LEFT JOIN editors e ON o.editor_id = e.id`;
  let params = [];
  if (status) {
    query += ' WHERE o.status = ?';
    params.push(status);
  }
  query += ' ORDER BY o.is_urgent DESC, o.priority DESC, o.created_at DESC';
  const orders = getRows(db.exec(query, params));
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const db = getDb();
  const orderId = req.params.id;
  const orderResult = db.exec(`SELECT o.*, p.name as photographer_name, e.name as editor_name FROM orders o LEFT JOIN photographers p ON o.photographer_id = p.id LEFT JOIN editors e ON o.editor_id = e.id WHERE o.id = ?`, [orderId]);
  const order = getOne(orderResult);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  const photos = getRows(db.exec('SELECT * FROM photos WHERE order_id = ? ORDER BY photo_no', [orderId]));
  const history = getRows(db.exec('SELECT * FROM history_logs WHERE order_id = ? ORDER BY timestamp DESC', [orderId]));
  const reminders = getRows(db.exec('SELECT * FROM reminders WHERE order_id = ? ORDER BY created_at DESC', [orderId]));
  res.json({ order, photos, history, reminders });
});

app.post('/api/orders', (req, res) => {
  const { customer_name, customer_phone, shoot_date, shoot_location, photographer_id, package_name, base_photos, base_price, additional_price_per_photo, is_urgent, priority, photo_count, notes } = req.body;
  const db = getDb();
  const order_no = generateOrderNo();
  const now = formatDate(new Date());
  db.run(`INSERT INTO orders (order_no, customer_name, customer_phone, shoot_date, shoot_location, photographer_id, package_name, base_photos, base_price, additional_price_per_photo, is_urgent, priority, total_price, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [order_no, customer_name, customer_phone || '', shoot_date, shoot_location || '', photographer_id || null, package_name || '', base_photos || 0, base_price || 0, additional_price_per_photo || 0, is_urgent ? 1 : 0, priority || 0, base_price || 0, notes || '', now, now]);
  saveDatabase();
  const orderResult = db.exec('SELECT last_insert_rowid() as id');
  const orderId = orderResult[0].values[0][0];
  if (photo_count && photo_count > 0) {
    for (let i = 1; i <= photo_count; i++) {
      db.run('INSERT INTO photos (order_id, photo_no) VALUES (?, ?)', [orderId, 'IMG-' + i.toString().padStart(4, '0')]);
    }
    saveDatabase();
  }
  logHistory(orderId, '创建订单', `创建订单：${order_no}，客户：${customer_name}`);
  res.json({ id: orderId, order_no });
});

app.post('/api/orders/:id/select-photos', (req, res) => {
  const orderId = req.params.id;
  const { selectedPhotos, additionalPhotos, total_additional_price } = req.body;
  const db = getDb();
  const now = formatDate(new Date());
  const orderResult = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = getOne(orderResult);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  if (order.status === 'delivered') {
    return res.status(400).json({ error: '已交付订单不能修改选片' });
  }
  const allPhotos = getRows(db.exec('SELECT * FROM photos WHERE order_id = ?', [orderId]));
  const validPhotoNos = allPhotos.map(p => p.photo_no);
  for (const photoNo of selectedPhotos) {
    if (!validPhotoNos.includes(photoNo)) {
      return res.status(400).json({ error: '照片编号 ' + photoNo + ' 不存在' });
    }
  }
  for (const photoNo of additionalPhotos) {
    if (!validPhotoNos.includes(photoNo)) {
      return res.status(400).json({ error: '加修照片编号 ' + photoNo + ' 不存在' });
    }
    if (!selectedPhotos.includes(photoNo)) {
      return res.status(400).json({ error: '加修照片 ' + photoNo + ' 必须先被选为精修' });
    }
  }
  const duplicates = additionalPhotos.filter((item, index) => additionalPhotos.indexOf(item) !== index);
  if (duplicates.length > 0) {
    return res.status(400).json({ error: '存在重复的加修照片：' + duplicates.join(', ') });
  }
  const existingAdditional = getRows(db.exec('SELECT photo_no FROM photos WHERE order_id = ? AND is_additional = 1', [orderId])).map(p => p.photo_no);
  const duplicateWithExisting = additionalPhotos.filter(p => existingAdditional.includes(p));
  if (duplicateWithExisting.length > 0) {
    return res.status(400).json({ error: '照片 ' + duplicateWithExisting.join(', ') + ' 已经是加修照片' });
  }
  const basePhotos = order.base_photos || 0;
  const additionalPhotoCount = additionalPhotos.length;
  const expectedAdditionalPrice = additionalPhotoCount * (order.additional_price_per_photo || 0);
  if (Math.abs((total_additional_price || 0) - expectedAdditionalPrice) > 0.01) {
    return res.status(400).json({ error: '加修费用与数量不一致', expected: expectedAdditionalPrice, actual: total_additional_price, additionalCount: additionalPhotoCount, pricePerPhoto: order.additional_price_per_photo });
  }
  db.run('UPDATE photos SET is_selected = 0, is_additional = 0, selected_at = NULL WHERE order_id = ?', [orderId]);
  for (const photoNo of selectedPhotos) {
    db.run('UPDATE photos SET is_selected = 1, selected_at = ? WHERE order_id = ? AND photo_no = ?', [now, orderId, photoNo]);
  }
  if (additionalPhotos.length > 0) {
    for (const photoNo of additionalPhotos) {
      db.run('UPDATE photos SET is_additional = 1 WHERE order_id = ? AND photo_no = ?', [orderId, photoNo]);
    }
  }
  const totalPrice = (order.base_price || 0) + (total_additional_price || 0);
  db.run(`UPDATE orders SET status = ?, selected_count = ?, total_additional_photos = ?, total_additional_price = ?, total_price = ?, updated_at = ? WHERE id = ?`, ['selection_completed', selectedPhotos.length, additionalPhotoCount, total_additional_price, totalPrice, now, orderId]);
  saveDatabase();
  logHistory(orderId, '完成选片', '选片完成：共选 ' + selectedPhotos.length + ' 张，加修 ' + additionalPhotoCount + ' 张，加修费用 ' + total_additional_price + ' 元', 'status', order.status, 'selection_completed');
  res.json({ success: true, selected_count: selectedPhotos.length, additional_count: additionalPhotoCount });
});

app.post('/api/orders/:id/schedule', (req, res) => {
  const orderId = req.params.id;
  const { editor_id, scheduled_date, priority, operator } = req.body;
  const db = getDb();
  const now = formatDate(new Date());
  const orderResult = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = getOne(orderResult);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  if (order.status === 'delivered') {
    return res.status(400).json({ error: '已交付订单不能再次排程' });
  }
  if (order.status === 'pending_selection') {
    return res.status(400).json({ error: '请先完成选片' });
  }
  db.run(`INSERT INTO schedule_records (order_id, editor_id, scheduled_date, priority, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [orderId, editor_id, scheduled_date, priority || 0, operator || '系统管理员', now]);
  db.run(`UPDATE orders SET editor_id = ?, scheduled_date = ?, priority = ?, status = ?, updated_at = ? WHERE id = ?`, [editor_id, scheduled_date, priority || 0, 'scheduled', now, orderId]);
  saveDatabase();
  const editorResult = db.exec('SELECT name FROM editors WHERE id = ?', [editor_id]);
  const editor = getOne(editorResult);
  logHistory(orderId, '排程', '排程给 ' + (editor?.name || '未知修图师') + '，排期：' + scheduled_date + '，优先级：' + (priority || 0), 'scheduled_date', order.scheduled_date, scheduled_date, operator || '系统管理员');
  res.json({ success: true });
});

app.post('/api/orders/:id/start-editing', (req, res) => {
  const orderId = req.params.id;
  const db = getDb();
  const now = formatDate(new Date());
  const orderResult = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = getOne(orderResult);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'delivered') return res.status(400).json({ error: '已交付订单' });
  db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', ['editing', now, orderId]);
  saveDatabase();
  logHistory(orderId, '开始修图', '修图师开始修图', 'status', order.status, 'editing');
  res.json({ success: true });
});

app.post('/api/orders/:id/complete-editing', (req, res) => {
  const orderId = req.params.id;
  const db = getDb();
  const now = formatDate(new Date());
  const orderResult = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = getOne(orderResult);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'delivered') return res.status(400).json({ error: '已交付订单' });
  db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', ['ready_for_delivery', now, orderId]);
  saveDatabase();
  logHistory(orderId, '修图完成', '修图完成，等待交付', 'status', order.status, 'ready_for_delivery');
  res.json({ success: true });
});

app.post('/api/orders/:id/deliver', (req, res) => {
  const orderId = req.params.id;
  const { delivery_method, remarks, delivered_by } = req.body;
  const db = getDb();
  const now = formatDate(new Date());
  const orderResult = db.exec('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = getOne(orderResult);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'delivered') return res.status(400).json({ error: '订单已交付' });
  const deliveryDate = new Date().toISOString().split('T')[0];
  db.run(`INSERT INTO delivery_records (order_id, delivery_date, delivered_by, delivery_method, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [orderId, deliveryDate, delivered_by || '系统管理员', delivery_method || '网盘', remarks || '', now]);
  db.run(`UPDATE orders SET status = ?, delivery_date = ?, updated_at = ? WHERE id = ?`, ['delivered', deliveryDate, now, orderId]);
  saveDatabase();
  logHistory(orderId, '交付完成', '通过 ' + (delivery_method || '网盘') + ' 交付，备注：' + (remarks || '无'), 'status', order.status, 'delivered');
  res.json({ success: true, delivery_date: deliveryDate });
});

app.post('/api/orders/:id/reminder', (req, res) => {
  const orderId = req.params.id;
  const { reminder_type, reminder_text, created_by } = req.body;
  const db = getDb();
  const now = formatDate(new Date());
  db.run(`INSERT INTO reminders (order_id, reminder_type, reminder_text, created_by, created_at) VALUES (?, ?, ?, ?, ?)`, [orderId, reminder_type, reminder_text, created_by || '系统管理员', now]);
  saveDatabase();
  logHistory(orderId, '添加催单', reminder_type + '：' + reminder_text);
  res.json({ success: true });
});

app.get('/api/orders/:id/reminders', (req, res) => {
  const db = getDb();
  const reminders = getRows(db.exec('SELECT * FROM reminders WHERE order_id = ? ORDER BY created_at DESC', [req.params.id]));
  res.json(reminders);
});

app.get('/api/photographers', (req, res) => {
  const db = getDb();
  const photographers = getRows(db.exec('SELECT * FROM photographers WHERE is_active = 1'));
  res.json(photographers);
});

app.get('/api/editors', (req, res) => {
  const db = getDb();
  const editors = getRows(db.exec('SELECT * FROM editors WHERE is_active = 1'));
  res.json(editors);
});

app.get('/api/history/:orderId', (req, res) => {
  const db = getDb();
  const history = getRows(db.exec('SELECT * FROM history_logs WHERE order_id = ? ORDER BY timestamp DESC', [req.params.orderId]));
  res.json(history);
});

app.get('/api/weekly-delivery', (req, res) => {
  const db = getDb();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const deliveries = getRows(db.exec(`SELECT o.*, p.name as photographer_name, e.name as editor_name, dr.delivery_method, dr.remarks as delivery_remarks FROM orders o LEFT JOIN photographers p ON o.photographer_id = p.id LEFT JOIN editors e ON o.editor_id = e.id LEFT JOIN delivery_records dr ON o.id = dr.order_id WHERE o.delivery_date BETWEEN ? AND ? ORDER BY o.delivery_date DESC`, [weekStartStr, weekEndStr]));
  res.json({ weekStart: weekStartStr, weekEnd: weekEndStr, deliveries });
});

app.get('/api/stats', (req, res) => {
  const db = getDb();
  const pending_selection = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE status = "pending_selection"'));
  const scheduled = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE status = "scheduled"'));
  const editing = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE status = "editing"'));
  const ready_for_delivery = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE status = "ready_for_delivery"'));
  const delivered = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE status = "delivered"'));
  const urgent = getOne(db.exec('SELECT COUNT(*) as count FROM orders WHERE is_urgent = 1 AND status != "delivered"'));
  const total_revenue = getOne(db.exec('SELECT SUM(total_price) as total FROM orders WHERE status = "delivered"'));
  const stats = {
    pending_selection: pending_selection?.count || 0,
    scheduled: scheduled?.count || 0,
    editing: editing?.count || 0,
    ready_for_delivery: ready_for_delivery?.count || 0,
    delivered: delivered?.count || 0,
    urgent: urgent?.count || 0,
    total_revenue: total_revenue?.total || 0
  };
  res.json(stats);
});

app.get('/api/schedule-board', (req, res) => {
  const { date } = req.query;
  const db = getDb();
  let query = `SELECT o.*, e.name as editor_name, (SELECT COUNT(*) FROM photos WHERE order_id = o.id AND is_selected = 1) as selected_count, (SELECT COUNT(*) FROM photos WHERE order_id = o.id AND is_additional = 1) as additional_count FROM orders o LEFT JOIN editors e ON o.editor_id = e.id WHERE o.status IN ('scheduled', 'editing', 'ready_for_delivery')`;
  let params = [];
  if (date) {
    query += ' AND o.scheduled_date = ?';
    params.push(date);
  }
  query += ' ORDER BY o.is_urgent DESC, o.priority DESC, o.scheduled_date ASC';
  const orders = getRows(db.exec(query, params));
  res.json(orders);
});

app.post('/api/seed-samples', (req, res) => {
  const sampleOrders = [
    {
      customer_name: '张小明家庭',
      customer_phone: '13800138001',
      shoot_date: '2026-05-08',
      shoot_location: '室内棚拍A区',
      photographer_id: 1,
      package_name: '亲子基础套餐',
      base_photos: 20,
      base_price: 1999,
      additional_price_per_photo: 100,
      is_urgent: 0,
      priority: 2,
      photo_count: 150,
      status: 'pending_selection',
      notes: '客户喜欢小清新风格'
    },
    {
      customer_name: '李娜家庭',
      customer_phone: '13900139002',
      shoot_date: '2026-05-09',
      shoot_location: '公园外景',
      photographer_id: 2,
      package_name: '家庭豪华套餐',
      base_photos: 30,
      base_price: 3999,
      additional_price_per_photo: 150,
      is_urgent: 1,
      priority: 5,
      photo_count: 200,
      status: 'selection_completed',
      notes: '加急单，下周三要',
      selected_count: 45,
      additional_photos: ['IMG-0012', 'IMG-0025', 'IMG-0038', 'IMG-0056', 'IMG-0078', 'IMG-0089', 'IMG-0102', 'IMG-0115', 'IMG-0128', 'IMG-0145', 'IMG-0156', 'IMG-0167', 'IMG-0178', 'IMG-0189', 'IMG-0200'],
      selected_photos: ['IMG-0005', 'IMG-0012', 'IMG-0018', 'IMG-0025', 'IMG-0032', 'IMG-0038', 'IMG-0045', 'IMG-0052', 'IMG-0056', 'IMG-0063', 'IMG-0070', 'IMG-0078', 'IMG-0085', 'IMG-0089', 'IMG-0096', 'IMG-0102', 'IMG-0108', 'IMG-0115', 'IMG-0122', 'IMG-0128', 'IMG-0135', 'IMG-0142', 'IMG-0145', 'IMG-0150', 'IMG-0156', 'IMG-0162', 'IMG-0167', 'IMG-0173', 'IMG-0178', 'IMG-0184', 'IMG-0189', 'IMG-0194', 'IMG-0200', 'IMG-0010', 'IMG-0020', 'IMG-0030', 'IMG-0040', 'IMG-0050', 'IMG-0060', 'IMG-0070', 'IMG-0080', 'IMG-0090', 'IMG-0100', 'IMG-0110', 'IMG-0130']
    },
    {
      customer_name: '王芳家庭',
      customer_phone: '13700137003',
      shoot_date: '2026-05-07',
      shoot_location: '新生儿家庭上门',
      photographer_id: 3,
      package_name: '新生儿尊享套餐',
      base_photos: 25,
      base_price: 2999,
      additional_price_per_photo: 120,
      is_urgent: 0,
      priority: 1,
      photo_count: 0,
      status: 'pending_selection',
      notes: '异常订单：拍摄后未上传照片'
    }
  ];
  const db = getDb();
  const now = formatDate(new Date());
  for (const sample of sampleOrders) {
    const order_no = generateOrderNo();
    db.run(`INSERT INTO orders (order_no, customer_name, customer_phone, shoot_date, shoot_location, photographer_id, package_name, base_photos, base_price, additional_price_per_photo, is_urgent, priority, total_price, status, selected_count, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [order_no, sample.customer_name, sample.customer_phone, sample.shoot_date, sample.shoot_location, sample.photographer_id, sample.package_name, sample.base_photos, sample.base_price, sample.additional_price_per_photo, sample.is_urgent ? 1 : 0, sample.priority, sample.base_price, sample.status, sample.selected_count || 0, sample.notes, now, now]);
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid() as id');
    const orderId = result[0].values[0][0];
    if (sample.photo_count > 0) {
      for (let i = 1; i <= sample.photo_count; i++) {
        const photoNo = 'IMG-' + i.toString().padStart(4, '0');
        const isSelected = sample.selected_photos && sample.selected_photos.includes(photoNo) ? 1 : 0;
        const isAdditional = sample.additional_photos && sample.additional_photos.includes(photoNo) ? 1 : 0;
        db.run('INSERT INTO photos (order_id, photo_no, is_selected, is_additional) VALUES (?, ?, ?, ?)', [orderId, photoNo, isSelected, isAdditional]);
      }
      saveDatabase();
      if (sample.status === 'selection_completed' && sample.additional_photos) {
        const additionalPrice = sample.additional_photos.length * sample.additional_price_per_photo;
        const totalPrice = sample.base_price + additionalPrice;
        db.run(`UPDATE orders SET total_additional_photos = ?, total_additional_price = ?, total_price = ? WHERE id = ?`, [sample.additional_photos.length, additionalPrice, totalPrice, orderId]);
        saveDatabase();
      }
      if (sample.status === 'selection_completed') {
        logHistory(orderId, '创建订单', '创建样例订单：' + order_no + '（' + (sample.is_urgent ? '加急' : '普通') + '）');
        logHistory(orderId, '完成选片', '选片完成：共选 ' + sample.selected_count + ' 张，加修 ' + (sample.additional_photos ? sample.additional_photos.length : 0) + ' 张');
      } else {
        logHistory(orderId, '创建订单', '创建样例订单：' + order_no + '（' + (sample.photo_count === 0 ? '异常-无照片' : '待选片') + '）');
      }
    }
  }
  res.json({ success: true, message: '样例数据已创建' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function startServer() {
  await initDatabase();
  seedData();
  app.listen(PORT, () => {
    console.log('亲子摄影选片修图排程台运行在 http://localhost:' + PORT);
  });
}

startServer();
