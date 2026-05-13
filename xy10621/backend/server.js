const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get('/api/lenses', (req, res) => {
  const lenses = db.prepare('SELECT * FROM lenses').all();
  res.json(lenses);
});

app.get('/api/light-stands', (req, res) => {
  const stands = db.prepare('SELECT * FROM light_stands').all();
  res.json(stands);
});

app.get('/api/rentals', (req, res) => {
  const rentals = db.prepare(`
    SELECT r.*, l.lens_code, l.name as lens_name 
    FROM rentals r 
    JOIN lenses l ON r.lens_id = l.id 
    ORDER BY r.created_at DESC
  `).all();
  
  rentals.forEach(r => {
    if (r.light_stand_ids) {
      const ids = JSON.parse(r.light_stand_ids);
      r.light_stands = db.prepare('SELECT * FROM light_stands WHERE id IN (' + ids.map(() => '?').join(',') + ')').all(ids);
    }
  });
  
  res.json(rentals);
});

app.get('/api/rentals/:id', (req, res) => {
  const rental = db.prepare(`
    SELECT r.*, l.lens_code, l.name as lens_name 
    FROM rentals r 
    JOIN lenses l ON r.lens_id = l.id 
    WHERE r.id = ?
  `).get(req.params.id);
  
  if (!rental) {
    return res.status(404).json({ error: '租借记录不存在' });
  }
  
  if (rental.light_stand_ids) {
    const ids = JSON.parse(rental.light_stand_ids);
    rental.light_stands = db.prepare('SELECT * FROM light_stands WHERE id IN (' + ids.map(() => '?').join(',') + ')').all(ids);
  }
  
  rental.timeline = db.prepare('SELECT * FROM rental_timeline WHERE rental_id = ? ORDER BY created_at ASC').all(req.params.id);
  rental.modification_history = db.prepare('SELECT * FROM modification_history WHERE rental_id = ? ORDER BY created_at ASC').all(req.params.id);
  rental.inspection = db.prepare('SELECT * FROM inspection_records WHERE rental_id = ?').get(req.params.id);
  rental.repair_quotes = db.prepare('SELECT * FROM repair_quotes WHERE rental_id = ?').all(req.params.id);
  
  res.json(rental);
});

app.post('/api/rentals', (req, res) => {
  const { lens_id, light_stand_ids, customer_name, customer_phone, start_date, end_date, deposit_amount, operator } = req.body;
  
  const conflicts = db.prepare(`
    SELECT * FROM rentals 
    WHERE lens_id = ? 
    AND status NOT IN ('cancelled', 'completed')
    AND (
      (start_date <= ? AND end_date >= ?) OR
      (start_date <= ? AND end_date >= ?) OR
      (start_date >= ? AND end_date <= ?)
    )
  `).all(lens_id, start_date, start_date, end_date, end_date, start_date, end_date);
  
  if (conflicts.length > 0) {
    return res.status(400).json({ error: '档期冲突', conflicts });
  }
  
  const id = uuidv4();
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  db.prepare(`
    INSERT INTO rentals (id, lens_id, light_stand_ids, customer_name, customer_phone, start_date, end_date, deposit_amount, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(id, lens_id, JSON.stringify(light_stand_ids || []), customer_name, customer_phone, start_date, end_date, deposit_amount || 0, operator, now, now);
  
  db.prepare(`
    INSERT INTO rental_timeline (id, rental_id, action, status, operator, created_at)
    VALUES (?, ?, '创建订单', 'pending', ?, ?)
  `).run(uuidv4(), id, operator, now);
  
  res.json({ id, message: '创建成功' });
});

app.post('/api/rentals/:id/action', (req, res) => {
  const { action, operator, remark, data } = req.body;
  const rentalId = req.params.id;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(rentalId);
  if (!rental) {
    return res.status(404).json({ error: '租借记录不存在' });
  }
  
  let newStatus = rental.status;
  let timelineAction = action;
  
  switch (action) {
    case 'confirm':
      newStatus = 'confirmed';
      timelineAction = '确认订单';
      break;
    case 'freeze_deposit':
      if (data && data.transaction_id) {
        const processed = db.prepare('SELECT * FROM processed_callbacks WHERE transaction_id = ?').get(data.transaction_id);
        if (processed) {
          return res.status(400).json({ error: '该交易已处理，不重复扣减' });
        }
        
        db.prepare(`
          INSERT INTO processed_callbacks (id, transaction_id, rental_id, amount)
          VALUES (?, ?, ?, ?)
        `).run(uuidv4(), data.transaction_id, rentalId, rental.deposit_amount);
        
        db.prepare('UPDATE rentals SET deposit_status = ?, deposit_transaction_id = ?, updated_at = ? WHERE id = ?').run('frozen', data.transaction_id, now, rentalId);
        newStatus = 'deposit_frozen';
        timelineAction = '押金冻结成功';
      }
      break;
    case 'pickup':
      newStatus = 'in_use';
      timelineAction = '器材出库';
      break;
    case 'inspect_return':
      newStatus = 'inspecting';
      timelineAction = '归还验收中';
      
      if (data && data.inspection) {
        db.prepare(`
          INSERT INTO inspection_records (id, rental_id, inspector, lens_condition, light_stand_conditions, issues_found, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), rentalId, operator, data.inspection.lens_condition, JSON.stringify(data.inspection.light_stand_conditions || []), data.inspection.issues_found, now);
        
        if (data.inspection.issues_found) {
          newStatus = 'repair_pending';
          timelineAction = '归还验收-发现问题待维修';
        }
      }
      break;
    case 'create_quote':
      if (data && data.quote) {
        db.prepare(`
          INSERT INTO repair_quotes (id, rental_id, issue_description, estimated_cost, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), rentalId, data.quote.issue_description, data.quote.estimated_cost, operator, now);
        timelineAction = '创建维修报价';
      }
      break;
    case 'approve_quote':
      if (data && data.quote_id) {
        db.prepare('UPDATE repair_quotes SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?').run('approved', operator, now, data.quote_id);
        timelineAction = '审批维修报价';
      }
      break;
    case 'complete_repair':
      newStatus = 'repair_completed';
      timelineAction = '维修完成';
      break;
    case 'complete':
      newStatus = 'completed';
      timelineAction = '订单完成';
      db.prepare('UPDATE rentals SET deposit_status = ?, updated_at = ? WHERE id = ?').run('released', now, rentalId);
      break;
    case 'review':
      timelineAction = '复核操作';
      break;
    case 'cancel':
      newStatus = 'cancelled';
      timelineAction = '取消订单';
      break;
  }
  
  if (newStatus !== rental.status) {
    db.prepare('UPDATE rentals SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, rentalId);
  }
  
  db.prepare(`
    INSERT INTO rental_timeline (id, rental_id, action, status, operator, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), rentalId, timelineAction, newStatus, operator, remark || '', now);
  
  res.json({ message: '操作成功', status: newStatus });
});

app.put('/api/rentals/:id/modify', (req, res) => {
  const { field, value, operator } = req.body;
  const rentalId = req.params.id;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  const rental = db.prepare('SELECT * FROM rentals WHERE id = ?').get(rentalId);
  if (!rental) {
    return res.status(404).json({ error: '租借记录不存在' });
  }
  
  let oldValue = rental[field];
  if (field === 'light_stand_ids' && Array.isArray(value)) {
    oldValue = JSON.stringify(JSON.parse(oldValue || '[]'));
    value = JSON.stringify(value);
  }
  
  if (oldValue !== value) {
    db.prepare('UPDATE rentals SET ' + field + ' = ?, updated_at = ? WHERE id = ?').run(value, now, rentalId);
    
    db.prepare(`
      INSERT INTO modification_history (id, rental_id, field_name, old_value, new_value, modified_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), rentalId, field, String(oldValue), String(value), operator, now);
    
    db.prepare(`
      INSERT INTO rental_timeline (id, rental_id, action, status, operator, created_at)
      VALUES (?, ?, '修改${field}', ?, ?, ?)
    `).run(uuidv4(), rentalId, rental.status, operator, now);
  }
  
  res.json({ message: '修改成功' });
});

app.get('/api/report', (req, res) => {
  const { operator, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      r.id,
      r.customer_name,
      l.lens_code,
      l.name as lens_name,
      r.status,
      r.created_at,
      rt.action,
      rt.operator,
      rt.created_at as action_time,
      rt.remark
    FROM rentals r
    JOIN lenses l ON r.lens_id = l.id
    JOIN rental_timeline rt ON r.id = rt.rental_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (operator) {
    query += ' AND rt.operator = ?';
    params.push(operator);
  }
  
  if (start_date) {
    query += ' AND rt.created_at >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND rt.created_at <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY rt.created_at DESC';
  
  const reportData = db.prepare(query).all(params);
  
  const modifications = db.prepare(`
    SELECT rental_id, field_name, old_value, new_value, modified_by, created_at 
    FROM modification_history
  `).all();
  
  res.json({ reportData, modifications });
});

app.get('/api/operators', (req, res) => {
  const operators = db.prepare('SELECT DISTINCT operator FROM rental_timeline UNION SELECT DISTINCT modified_by FROM modification_history').all();
  res.json(operators.map(o => o.operator || o.modified_by).filter(Boolean));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
