const express = require('express');
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
const { db, initDatabase, seedData, saveDatabase, resultToObjects } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function startServer() {
  await initDatabase();
  seedData();
  
  function recordOperation(orderId, type, detail, operator = '系统管理员') {
    db.run(`
      INSERT INTO order_operations (order_id, operation_type, operation_detail, operator, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [orderId, type, detail, operator]);
    saveDatabase();
  }

  function queryAll(sql, params = []) {
    const result = db.exec(sql, params);
    return resultToObjects(result);
  }

  function queryOne(sql, params = []) {
    const result = queryAll(sql, params);
    return result.length > 0 ? result[0] : null;
  }

  function getLastInsertId() {
    return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  }

  app.get('/api/elders', (req, res) => {
    const elders = queryAll(`
      SELECT e.*, 
        GROUP_CONCAT(i.name) as forbidden_ingredients
      FROM elders e
      LEFT JOIN elder_forbidden_ingredients efi ON e.id = efi.elder_id
      LEFT JOIN ingredients i ON efi.ingredient_id = i.id
      GROUP BY e.id
    `);
    res.json(elders);
  });

  app.get('/api/elders/:id', (req, res) => {
    const elder = queryOne(`
      SELECT e.*, 
        GROUP_CONCAT(i.name) as forbidden_ingredients
      FROM elders e
      LEFT JOIN elder_forbidden_ingredients efi ON e.id = efi.elder_id
      LEFT JOIN ingredients i ON efi.ingredient_id = i.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [req.params.id]);
    
    if (!elder) {
      return res.status(404).json({ error: '老人档案不存在' });
    }
    
    const orders = queryAll(`
      SELECT o.*, mp.name as package_name, r.name as route_name
      FROM orders o
      LEFT JOIN meal_packages mp ON o.package_id = mp.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE o.elder_id = ?
      ORDER BY o.order_date DESC, o.created_at DESC
    `, [req.params.id]);
    
    res.json({ ...elder, orders });
  });

  app.get('/api/packages', (req, res) => {
    const packages = queryAll('SELECT * FROM meal_packages WHERE is_active = 1');
    res.json(packages);
  });

  app.get('/api/routes', (req, res) => {
    const routes = queryAll('SELECT * FROM routes WHERE is_active = 1');
    res.json(routes);
  });

  app.get('/api/orders', (req, res) => {
    const { date, status, routeId } = req.query;
    
    let query = `
      SELECT o.*, 
        e.name as elder_name, e.address as elder_address, e.phone as elder_phone,
        mp.name as package_name,
        r.name as route_name
      FROM orders o
      JOIN elders e ON o.elder_id = e.id
      JOIN meal_packages mp ON o.package_id = mp.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE 1=1
    `;
    const params = [];
    
    if (date) {
      query += ' AND o.order_date = ?';
      params.push(date);
    }
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    if (routeId) {
      query += ' AND o.route_id = ?';
      params.push(routeId);
    }
    
    query += ' ORDER BY o.order_date DESC, o.created_at DESC';
    
    const orders = queryAll(query, params);
    res.json(orders);
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = queryOne(`
      SELECT o.*, 
        e.name as elder_name, e.address as elder_address, e.phone as elder_phone,
        e.dietary_preferences, e.notes,
        GROUP_CONCAT(i.name) as elder_forbidden_ingredients,
        mp.name as package_name, mp.ingredients as package_ingredients,
        r.name as route_name
      FROM orders o
      JOIN elders e ON o.elder_id = e.id
      JOIN meal_packages mp ON o.package_id = mp.id
      LEFT JOIN routes r ON o.route_id = r.id
      LEFT JOIN elder_forbidden_ingredients efi ON e.id = efi.elder_id
      LEFT JOIN ingredients i ON efi.ingredient_id = i.id
      WHERE o.id = ?
      GROUP BY o.id
    `, [req.params.id]);
    
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const operations = queryAll(`
      SELECT * FROM order_operations WHERE order_id = ? ORDER BY created_at DESC
    `, [req.params.id]);
    
    res.json({ ...order, operations });
  });

  function checkForbiddenConflict(elderId, packageId) {
    const elder = queryOne(`
      SELECT GROUP_CONCAT(i.name) as forbidden_ingredients
      FROM elders e
      LEFT JOIN elder_forbidden_ingredients efi ON e.id = efi.elder_id
      LEFT JOIN ingredients i ON efi.ingredient_id = i.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [elderId]);
    
    const pkg = queryOne('SELECT ingredients FROM meal_packages WHERE id = ?', [packageId]);
    
    if (!elder || !pkg || !elder.forbidden_ingredients || !pkg.ingredients) {
      return null;
    }
    
    const forbidden = elder.forbidden_ingredients.split(',').map(i => i.trim());
    const packageIngredients = pkg.ingredients.split(',').map(i => i.trim());
    
    const conflicts = forbidden.filter(f => 
      packageIngredients.some(pi => pi.includes(f) || f.includes(pi))
    );
    
    return conflicts.length > 0 ? conflicts : null;
  }

  app.post('/api/orders', (req, res) => {
    const { elder_id, package_id, order_date } = req.body;
    
    if (!elder_id || !package_id || !order_date) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const existingOrder = queryOne(`
      SELECT * FROM orders WHERE elder_id = ? AND order_date = ?
    `, [elder_id, order_date]);
    
    if (existingOrder) {
      return res.status(400).json({ 
        error: '同一天不能重复下单',
        code: 'DUPLICATE_ORDER'
      });
    }
    
    const conflicts = checkForbiddenConflict(elder_id, package_id);
    if (conflicts) {
      return res.status(400).json({ 
        error: `套餐包含禁忌食材: ${conflicts.join(', ')}`,
        code: 'FORBIDDEN_INGREDIENT',
        conflicts
      });
    }
    
    db.run(`
      INSERT INTO orders (elder_id, package_id, order_date, status, created_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `, [elder_id, package_id, order_date]);
    
    const orderId = getLastInsertId();
    recordOperation(orderId, '创建订单', `创建订单，套餐ID: ${package_id}`);
    
    res.json({ id: orderId, message: '订单创建成功' });
  });

  app.post('/api/orders/force-create', (req, res) => {
    const { elder_id, package_id, order_date, force_reason } = req.body;
    
    if (!elder_id || !package_id || !order_date) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    if (!force_reason) {
      return res.status(400).json({ error: '需要说明强制创建的原因' });
    }
    
    db.run(`
      INSERT INTO orders (elder_id, package_id, order_date, status, created_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `, [elder_id, package_id, order_date]);
    
    const orderId = getLastInsertId();
    recordOperation(orderId, '强制创建订单', `强制创建订单，原因: ${force_reason}`);
    
    res.json({ id: orderId, message: '订单创建成功（强制）' });
  });

  app.put('/api/orders/:id/assign-route', (req, res) => {
    const { route_id } = req.body;
    
    if (!route_id) {
      return res.status(400).json({ error: '缺少路线ID' });
    }
    
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    const route = queryOne('SELECT * FROM routes WHERE id = ?', [route_id]);
    if (!route) {
      return res.status(400).json({ error: '路线不存在' });
    }
    
    db.run('UPDATE orders SET route_id = ?, status = ? WHERE id = ?', [route_id, 'assigned', req.params.id]);
    saveDatabase();
    
    recordOperation(req.params.id, '分配路线', `分配路线: ${route.name}`);
    
    res.json({ message: '路线分配成功' });
  });

  app.put('/api/orders/:id/sign', (req, res) => {
    const { sign_by } = req.body;
    
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    if (order.status === 'signed') {
      return res.status(400).json({ error: '订单已签收' });
    }
    
    db.run(`
      UPDATE orders 
      SET status = 'signed', sign_time = datetime('now'), sign_by = ?
      WHERE id = ?
    `, [sign_by || '配送员', req.params.id]);
    saveDatabase();
    
    recordOperation(req.params.id, '签收', `签收人: ${sign_by || '配送员'}`);
    
    res.json({ message: '签收成功' });
  });

  app.put('/api/orders/:id/exception', (req, res) => {
    const { exception_reason } = req.body;
    
    if (!exception_reason) {
      return res.status(400).json({ error: '缺少异常原因' });
    }
    
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    if (order.status === 'signed') {
      return res.status(400).json({ error: '已签收订单不能标记异常' });
    }
    
    db.run(`
      UPDATE orders 
      SET status = 'exception', exception_reason = ?
      WHERE id = ?
    `, [exception_reason, req.params.id]);
    saveDatabase();
    
    recordOperation(req.params.id, '异常', `异常原因: ${exception_reason}`);
    
    res.json({ message: '已标记异常' });
  });

  app.put('/api/orders/:id/redeliver', (req, res) => {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    if (order.status === 'signed') {
      return res.status(400).json({ error: '已签收订单不能补送' });
    }
    
    db.run(`
      UPDATE orders 
      SET status = 'pending', exception_reason = NULL, follow_up = '补送'
      WHERE id = ?
    `, [req.params.id]);
    saveDatabase();
    
    recordOperation(req.params.id, '补送', '安排补送');
    
    res.json({ message: '已安排补送' });
  });

  app.put('/api/orders/:id/refund', (req, res) => {
    const { reason } = req.body;
    
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    if (order.status === 'signed') {
      return res.status(400).json({ 
        error: '已签收订单不能随意退款，请联系管理员',
        code: 'SIGNED_ORDER_REFUND'
      });
    }
    
    if (order.is_refunded) {
      return res.status(400).json({ error: '订单已退款' });
    }
    
    db.run(`
      UPDATE orders 
      SET status = 'refunded', is_refunded = 1, refund_time = datetime('now'), follow_up = '退款'
      WHERE id = ?
    `, [req.params.id]);
    saveDatabase();
    
    recordOperation(req.params.id, '退款', `退款原因: ${reason || '用户申请'}`);
    
    res.json({ message: '退款成功' });
  });

  app.get('/api/operations', (req, res) => {
    const operations = queryAll(`
      SELECT oo.*, 
        o.id as order_id, o.order_date,
        e.name as elder_name
      FROM order_operations oo
      JOIN orders o ON oo.order_id = o.id
      JOIN elders e ON o.elder_id = e.id
      ORDER BY oo.created_at DESC
      LIMIT 100
    `);
    res.json(operations);
  });

  app.get('/api/dashboard/stats', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const total = queryOne(`SELECT COUNT(*) as count FROM orders WHERE order_date = ?`, [today]).count;
    const signed = queryOne(`SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND status = 'signed'`, [today]).count;
    const pending = queryOne(`SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND status IN ('pending', 'assigned')`, [today]).count;
    const exception = queryOne(`SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND status = 'exception'`, [today]).count;
    const refunded = queryOne(`SELECT COUNT(*) as count FROM orders WHERE order_date = ? AND status = 'refunded'`, [today]).count;
    
    res.json({
      total,
      signed,
      pending,
      exception,
      refunded
    });
  });

  app.get('/api/export/daily-report', async (req, res) => {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    
    const orders = queryAll(`
      SELECT o.*, 
        e.name as elder_name, e.address as elder_address, e.phone as elder_phone,
        mp.name as package_name,
        r.name as route_name
      FROM orders o
      JOIN elders e ON o.elder_id = e.id
      JOIN meal_packages mp ON o.package_id = mp.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE o.order_date = ?
      ORDER BY o.route_id, o.created_at
    `, [reportDate]);
    
    const stats = {
      total: orders.length,
      signed: orders.filter(o => o.status === 'signed').length,
      pending: orders.filter(o => ['pending', 'assigned'].includes(o.status)).length,
      exception: orders.filter(o => o.status === 'exception').length,
      refunded: orders.filter(o => o.status === 'refunded').length
    };
    
    const exceptionReasons = orders
      .filter(o => o.exception_reason)
      .reduce((acc, o) => {
        acc[o.exception_reason] = (acc[o.exception_reason] || 0) + 1;
        return acc;
      }, {});
    
    const followUpActions = orders
      .filter(o => o.follow_up)
      .reduce((acc, o) => {
        acc[o.follow_up] = (acc[o.follow_up] || 0) + 1;
        return acc;
      }, {});
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '养老助餐配送系统';
    workbook.created = new Date();
    
    const summarySheet = workbook.addWorksheet('汇总');
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 20 },
      { header: '数量', key: 'count', width: 15 },
      { header: '占比', key: 'percentage', width: 15 }
    ];
    
    summarySheet.addRow({ item: '配送日期', count: reportDate });
    summarySheet.addRow({ item: '总订单数', count: stats.total, percentage: '100%' });
    summarySheet.addRow({ item: '正常签收', count: stats.signed, percentage: stats.total > 0 ? `${Math.round(stats.signed/stats.total*100)}%` : '0%' });
    summarySheet.addRow({ item: '待配送/配送中', count: stats.pending, percentage: stats.total > 0 ? `${Math.round(stats.pending/stats.total*100)}%` : '0%' });
    summarySheet.addRow({ item: '异常订单', count: stats.exception, percentage: stats.total > 0 ? `${Math.round(stats.exception/stats.total*100)}%` : '0%' });
    summarySheet.addRow({ item: '已退款', count: stats.refunded, percentage: stats.total > 0 ? `${Math.round(stats.refunded/stats.total*100)}%` : '0%' });
    
    summarySheet.addRow({});
    summarySheet.addRow({ item: '异常原因统计', count: '' });
    Object.entries(exceptionReasons).forEach(([reason, count]) => {
      summarySheet.addRow({ item: reason, count });
    });
    
    summarySheet.addRow({});
    summarySheet.addRow({ item: '后续动作统计', count: '' });
    Object.entries(followUpActions).forEach(([action, count]) => {
      summarySheet.addRow({ item: action, count });
    });
    
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    const detailSheet = workbook.addWorksheet('订单明细');
    detailSheet.columns = [
      { header: '订单ID', key: 'id', width: 10 },
      { header: '老人姓名', key: 'elder_name', width: 12 },
      { header: '联系电话', key: 'elder_phone', width: 15 },
      { header: '配送地址', key: 'elder_address', width: 30 },
      { header: '套餐', key: 'package_name', width: 20 },
      { header: '配送路线', key: 'route_name', width: 20 },
      { header: '订单状态', key: 'status', width: 12 },
      { header: '签收时间', key: 'sign_time', width: 20 },
      { header: '签收人', key: 'sign_by', width: 12 },
      { header: '异常原因', key: 'exception_reason', width: 25 },
      { header: '后续动作', key: 'follow_up', width: 15 },
      { header: '是否退款', key: 'is_refunded', width: 10 }
    ];
    
    orders.forEach(order => {
      detailSheet.addRow({
        id: order.id,
        elder_name: order.elder_name,
        elder_phone: order.elder_phone,
        elder_address: order.elder_address,
        package_name: order.package_name,
        route_name: order.route_name || '未分配',
        status: getStatusText(order.status),
        sign_time: order.sign_time || '',
        sign_by: order.sign_by || '',
        exception_reason: order.exception_reason || '',
        follow_up: order.follow_up || '',
        is_refunded: order.is_refunded ? '是' : '否'
      });
    });
    
    detailSheet.getRow(1).font = { bold: true };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=daily-report-${reportDate}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  });

  function getStatusText(status) {
    const statusMap = {
      'pending': '待分配',
      'assigned': '已分配',
      'signed': '已签收',
      'exception': '异常',
      'refunded': '已退款'
    };
    return statusMap[status] || status;
  }

  app.listen(PORT, () => {
    console.log(`养老助餐配送签收台系统已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('服务器启动失败:', err);
});
