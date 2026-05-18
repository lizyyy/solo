const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
app.use(bodyParser.json());

const generateTransactionNo = () => {
  const date = new Date();
  const prefix = 'MED' + date.getFullYear() + 
    String(date.getMonth() + 1).padStart(2, '0') + 
    String(date.getDate()).padStart(2, '0');
  const stmt = db.prepare('SELECT COUNT(*) as count FROM medicine_transactions WHERE transaction_no LIKE ?');
  const result = stmt.get(prefix + '%');
  return prefix + String(result.count + 1).padStart(4, '0');
};

const getCurrentTime = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

const recordHistory = (transactionId, transactionNo, action, operator, options = {}) => {
  const stmt = db.prepare(`
    INSERT INTO medicine_history (
      transaction_id, transaction_no, action, operator, operate_time,
      before_status, after_status, before_quantity, after_quantity,
      before_remark, after_remark, remark, change_content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    transactionId, transactionNo, action, operator, getCurrentTime(),
    options.before_status, options.after_status,
    options.before_quantity, options.after_quantity,
    options.before_remark, options.after_remark,
    options.remark, options.change_content
  );
};

const getStock = (stockType, locationCode, medicineCode, batchNo) => {
  const stmt = db.prepare(`
    SELECT quantity FROM medicine_stock 
    WHERE stock_type = ? AND location_code = ? AND medicine_code = ? AND batch_no = ?
  `);
  const result = stmt.get(stockType, locationCode, medicineCode, batchNo);
  return result ? result.quantity : 0;
};

const updateStock = (stockType, locationCode, locationName, medicineCode, medicineName, batchNo, quantity, unit) => {
  const existing = db.prepare(`
    SELECT id FROM medicine_stock 
    WHERE stock_type = ? AND location_code = ? AND medicine_code = ? AND batch_no = ?
  `).get(stockType, locationCode, medicineCode, batchNo);

  if (existing) {
    db.prepare(`
      UPDATE medicine_stock 
      SET quantity = ?, last_update_time = ?
      WHERE id = ?
    `).run(quantity, getCurrentTime(), existing.id);
  } else {
    db.prepare(`
      INSERT INTO medicine_stock (
        stock_type, location_code, location_name, medicine_code, 
        medicine_name, batch_no, quantity, unit, last_update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(stockType, locationCode, locationName, medicineCode, medicineName, batchNo, quantity, unit, getCurrentTime());
  }
};

app.get('/api/transactions', (req, res) => {
  const { vehicle_no, site_code, status, page = 1, page_size = 20 } = req.query;
  let sql = 'SELECT * FROM medicine_transactions WHERE 1=1';
  const params = [];

  if (vehicle_no) {
    sql += ' AND vehicle_no = ?';
    params.push(vehicle_no);
  }
  if (site_code) {
    sql += ' AND site_code = ?';
    params.push(site_code);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const stmt = db.prepare(sql);
  const list = stmt.all(...params);

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM medicine_transactions WHERE 1=1' + 
    (vehicle_no ? ' AND vehicle_no = ?' : '') + 
    (site_code ? ' AND site_code = ?' : '') + 
    (status ? ' AND status = ?' : ''));
  const countParams = [];
  if (vehicle_no) countParams.push(vehicle_no);
  if (site_code) countParams.push(site_code);
  if (status) countParams.push(status);
  const { total } = countStmt.get(...countParams);

  res.json({ code: 0, data: { list, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

app.get('/api/transactions/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?');
  const transaction = stmt.get(req.params.id);
  
  if (!transaction) {
    return res.json({ code: 1, message: '记录不存在' });
  }

  res.json({ code: 0, data: transaction });
});

app.get('/api/transactions/:id/history', (req, res) => {
  const stmt = db.prepare('SELECT * FROM medicine_history WHERE transaction_id = ? ORDER BY created_at DESC');
  const history = stmt.all(req.params.id);
  res.json({ code: 0, data: history });
});

app.post('/api/transactions', (req, res) => {
  const {
    vehicle_no, vehicle_name, site_code, site_name,
    medicine_code, medicine_name, batch_no, manufacture_date,
    expiry_date, specification, unit, quantity,
    flow_type, operator, remark
  } = req.body;

  const transaction_no = generateTransactionNo();
  const vehicle_stock_before = getStock('VEHICLE', vehicle_no, medicine_code, batch_no);
  const site_stock_before = getStock('SITE', site_code, medicine_code, batch_no);

  let vehicle_stock_after = vehicle_stock_before;
  let site_stock_after = site_stock_before;

  if (flow_type === 'VEHICLE_TO_SITE') {
    vehicle_stock_after = vehicle_stock_before - quantity;
    site_stock_after = site_stock_before + quantity;
  } else if (flow_type === 'SITE_TO_VEHICLE') {
    vehicle_stock_after = vehicle_stock_before + quantity;
    site_stock_after = site_stock_before - quantity;
  }

  const stmt = db.prepare(`
    INSERT INTO medicine_transactions (
      transaction_no, vehicle_no, vehicle_name, site_code, site_name,
      medicine_code, medicine_name, batch_no, manufacture_date, expiry_date,
      specification, unit, quantity, vehicle_stock_before, vehicle_stock_after,
      site_stock_before, site_stock_after, flow_type, operator, operate_time,
      status, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    transaction_no, vehicle_no, vehicle_name, site_code, site_name,
    medicine_code, medicine_name, batch_no, manufacture_date, expiry_date,
    specification, unit, quantity, vehicle_stock_before, vehicle_stock_after,
    site_stock_before, site_stock_after, flow_type, operator, getCurrentTime(),
    'DRAFT', remark
  );

  const transactionId = result.lastInsertRowid;
  recordHistory(transactionId, transaction_no, 'CREATE', operator, {
    after_status: 'DRAFT',
    after_quantity: quantity,
    after_remark: remark,
    change_content: '创建药品流转记录'
  });

  res.json({ code: 0, data: { id: transactionId, transaction_no } });
});

app.put('/api/transactions/:id', (req, res) => {
  const { quantity, remark, operator } = req.body;
  const transactionId = req.params.id;

  const existing = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?').get(transactionId);
  if (!existing) {
    return res.json({ code: 1, message: '记录不存在' });
  }
  if (existing.status !== 'DRAFT') {
    return res.json({ code: 1, message: '只有草稿状态可以修改' });
  }

  const changes = [];
  if (quantity !== undefined && quantity !== existing.quantity) {
    changes.push(`数量: ${existing.quantity} -> ${quantity}`);
  }
  if (remark !== undefined && remark !== existing.remark) {
    changes.push(`备注: ${existing.remark || '空'} -> ${remark || '空'}`);
  }

  let vehicle_stock_after = existing.vehicle_stock_before;
  let site_stock_after = existing.site_stock_before;

  if (existing.flow_type === 'VEHICLE_TO_SITE') {
    vehicle_stock_after = existing.vehicle_stock_before - (quantity || existing.quantity);
    site_stock_after = existing.site_stock_before + (quantity || existing.quantity);
  } else if (existing.flow_type === 'SITE_TO_VEHICLE') {
    vehicle_stock_after = existing.vehicle_stock_before + (quantity || existing.quantity);
    site_stock_after = existing.site_stock_before - (quantity || existing.quantity);
  }

  db.prepare(`
    UPDATE medicine_transactions 
    SET quantity = ?, remark = ?, vehicle_stock_after = ?, site_stock_after = ?, updated_at = ?
    WHERE id = ?
  `).run(
    quantity || existing.quantity,
    remark !== undefined ? remark : existing.remark,
    vehicle_stock_after, site_stock_after,
    getCurrentTime(), transactionId
  );

  recordHistory(transactionId, existing.transaction_no, 'UPDATE', operator, {
    before_quantity: existing.quantity,
    after_quantity: quantity || existing.quantity,
    before_remark: existing.remark,
    after_remark: remark !== undefined ? remark : existing.remark,
    change_content: changes.join('; ')
  });

  res.json({ code: 0, message: '修改成功' });
});

app.post('/api/transactions/:id/submit', (req, res) => {
  const { operator } = req.body;
  const transactionId = req.params.id;

  const existing = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?').get(transactionId);
  if (!existing) {
    return res.json({ code: 1, message: '记录不存在' });
  }
  if (existing.status !== 'DRAFT') {
    return res.json({ code: 1, message: '只有草稿状态可以提交' });
  }

  db.prepare(`
    UPDATE medicine_transactions 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run('SUBMITTED', getCurrentTime(), transactionId);

  updateStock(
    'VEHICLE', existing.vehicle_no, existing.vehicle_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    existing.vehicle_stock_after, existing.unit
  );
  updateStock(
    'SITE', existing.site_code, existing.site_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    existing.site_stock_after, existing.unit
  );

  recordHistory(transactionId, existing.transaction_no, 'SUBMIT', operator, {
    before_status: 'DRAFT',
    after_status: 'SUBMITTED',
    change_content: '提交药品流转记录'
  });

  res.json({ code: 0, message: '提交成功' });
});

app.post('/api/transactions/:id/withdraw', (req, res) => {
  const { operator, remark } = req.body;
  const transactionId = req.params.id;

  const existing = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?').get(transactionId);
  if (!existing) {
    return res.json({ code: 1, message: '记录不存在' });
  }
  if (existing.status !== 'SUBMITTED') {
    return res.json({ code: 1, message: '只有已提交状态可以撤回' });
  }

  const vehicle_stock_before = getStock('VEHICLE', existing.vehicle_no, existing.medicine_code, existing.batch_no);
  const site_stock_before = getStock('SITE', existing.site_code, existing.medicine_code, existing.batch_no);

  let vehicle_restored = vehicle_stock_before;
  let site_restored = site_stock_before;

  if (existing.flow_type === 'VEHICLE_TO_SITE') {
    vehicle_restored = vehicle_stock_before + existing.quantity;
    site_restored = site_stock_before - existing.quantity;
  } else if (existing.flow_type === 'SITE_TO_VEHICLE') {
    vehicle_restored = vehicle_stock_before - existing.quantity;
    site_restored = site_stock_before + existing.quantity;
  }

  db.prepare(`
    UPDATE medicine_transactions 
    SET status = ?, vehicle_stock_before = ?, vehicle_stock_after = ?,
        site_stock_before = ?, site_stock_after = ?, updated_at = ?
    WHERE id = ?
  `).run('WITHDRAWN', vehicle_stock_before, vehicle_restored, site_stock_before, site_restored, getCurrentTime(), transactionId);

  updateStock(
    'VEHICLE', existing.vehicle_no, existing.vehicle_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    vehicle_restored, existing.unit
  );
  updateStock(
    'SITE', existing.site_code, existing.site_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    site_restored, existing.unit
  );

  recordHistory(transactionId, existing.transaction_no, 'WITHDRAW', operator, {
    before_status: 'SUBMITTED',
    after_status: 'WITHDRAWN',
    remark: remark,
    change_content: '撤回药品流转记录'
  });

  res.json({ code: 0, message: '撤回成功' });
});

app.post('/api/transactions/:id/manual', (req, res) => {
  const { operator, manual_remark, action } = req.body;
  const transactionId = req.params.id;

  const existing = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?').get(transactionId);
  if (!existing) {
    return res.json({ code: 1, message: '记录不存在' });
  }

  const newRemark = (existing.remark ? existing.remark + '\n' : '') + 
    `[人工处理 ${getCurrentTime()} - ${operator}] ${manual_remark}`;

  db.prepare(`
    UPDATE medicine_transactions 
    SET remark = ?, updated_at = ?
    WHERE id = ?
  `).run(newRemark, getCurrentTime(), transactionId);

  recordHistory(transactionId, existing.transaction_no, 'MANUAL_PROCESS', operator, {
    before_remark: existing.remark,
    after_remark: newRemark,
    remark: manual_remark,
    change_content: `人工处理: ${manual_remark}`
  });

  res.json({ code: 0, message: '人工处理完成' });
});

app.post('/api/transactions/:id/resubmit', (req, res) => {
  const { operator, quantity, remark } = req.body;
  const transactionId = req.params.id;

  const existing = db.prepare('SELECT * FROM medicine_transactions WHERE id = ?').get(transactionId);
  if (!existing) {
    return res.json({ code: 1, message: '记录不存在' });
  }
  if (existing.status !== 'WITHDRAWN') {
    return res.json({ code: 1, message: '只有已撤回状态可以重新提交' });
  }

  const finalQuantity = quantity || existing.quantity;
  const vehicle_stock_before = getStock('VEHICLE', existing.vehicle_no, existing.medicine_code, existing.batch_no);
  const site_stock_before = getStock('SITE', existing.site_code, existing.medicine_code, existing.batch_no);

  let vehicle_stock_after = vehicle_stock_before;
  let site_stock_after = site_stock_before;

  if (existing.flow_type === 'VEHICLE_TO_SITE') {
    vehicle_stock_after = vehicle_stock_before - finalQuantity;
    site_stock_after = site_stock_before + finalQuantity;
  } else if (existing.flow_type === 'SITE_TO_VEHICLE') {
    vehicle_stock_after = vehicle_stock_before + finalQuantity;
    site_stock_after = site_stock_before - finalQuantity;
  }

  const finalRemark = remark ? ((existing.remark || '') + '\n[重新提交备注] ' + remark) : existing.remark;

  db.prepare(`
    UPDATE medicine_transactions 
    SET quantity = ?, vehicle_stock_before = ?, vehicle_stock_after = ?,
        site_stock_before = ?, site_stock_after = ?, status = ?,
        remark = ?, updated_at = ?
    WHERE id = ?
  `).run(
    finalQuantity, vehicle_stock_before, vehicle_stock_after,
    site_stock_before, site_stock_after, 'SUBMITTED',
    finalRemark, getCurrentTime(), transactionId
  );

  updateStock(
    'VEHICLE', existing.vehicle_no, existing.vehicle_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    vehicle_stock_after, existing.unit
  );
  updateStock(
    'SITE', existing.site_code, existing.site_name,
    existing.medicine_code, existing.medicine_name, existing.batch_no,
    site_stock_after, existing.unit
  );

  recordHistory(transactionId, existing.transaction_no, 'RESUBMIT', operator, {
    before_status: 'WITHDRAWN',
    after_status: 'SUBMITTED',
    before_quantity: existing.quantity,
    after_quantity: finalQuantity,
    before_remark: existing.remark,
    after_remark: finalRemark,
    change_content: '重新提交药品流转记录' + (quantity ? `，调整数量为${finalQuantity}` : '')
  });

  res.json({ code: 0, message: '重新提交成功' });
});

app.get('/api/stock', (req, res) => {
  const { stock_type, location_code, medicine_code, page = 1, page_size = 20 } = req.query;
  let sql = 'SELECT * FROM medicine_stock WHERE 1=1';
  const params = [];

  if (stock_type) {
    sql += ' AND stock_type = ?';
    params.push(stock_type);
  }
  if (location_code) {
    sql += ' AND location_code = ?';
    params.push(location_code);
  }
  if (medicine_code) {
    sql += ' AND medicine_code = ?';
    params.push(medicine_code);
  }

  sql += ' ORDER BY last_update_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), (parseInt(page) - 1) * parseInt(page_size));

  const stmt = db.prepare(sql);
  const list = stmt.all(...params);

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM medicine_stock WHERE 1=1' + 
    (stock_type ? ' AND stock_type = ?' : '') + 
    (location_code ? ' AND location_code = ?' : '') + 
    (medicine_code ? ' AND medicine_code = ?' : ''));
  const countParams = [];
  if (stock_type) countParams.push(stock_type);
  if (location_code) countParams.push(location_code);
  if (medicine_code) countParams.push(medicine_code);
  const { total } = countStmt.get(...countParams);

  res.json({ code: 0, data: { list, total, page: parseInt(page), page_size: parseInt(page_size) } });
});

app.get('/api/stock/check-consistency', (req, res) => {
  const vehicleStocks = db.prepare(`
    SELECT medicine_code, batch_no, SUM(quantity) as vehicle_total
    FROM medicine_stock 
    WHERE stock_type = 'VEHICLE'
    GROUP BY medicine_code, batch_no
  `).all();

  const siteStocks = db.prepare(`
    SELECT medicine_code, batch_no, SUM(quantity) as site_total
    FROM medicine_stock 
    WHERE stock_type = 'SITE'
    GROUP BY medicine_code, batch_no
  `).all();

  const inconsistencies = [];
  
  for (const vs of vehicleStocks) {
    const ss = siteStocks.find(s => s.medicine_code === vs.medicine_code && s.batch_no === vs.batch_no);
    if (ss && vs.vehicle_total !== ss.site_total) {
      inconsistencies.push({
        medicine_code: vs.medicine_code,
        batch_no: vs.batch_no,
        vehicle_total: vs.vehicle_total,
        site_total: ss.site_total,
        diff: vs.vehicle_total - ss.site_total
      });
    }
  }

  res.json({ 
    code: 0, 
    data: { 
      consistent: inconsistencies.length === 0,
      inconsistencies,
      vehicle_count: vehicleStocks.length,
      site_count: siteStocks.length
    } 
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`社区诊疗车流动诊疗药品 API 服务已启动: http://localhost:${PORT}`);
});

module.exports = app;
