const express = require('express');
const router = express.Router();
const db = require('./database');
const moment = require('moment');
const XLSX = require('xlsx');

const calculateLateFee = (checkoutTime, expectedTime) => {
  const rule = db.prepare('SELECT * FROM late_fee_rules WHERE is_active = 1').get();
  const checkout = moment(checkoutTime, 'HH:mm');
  const expected = moment(expectedTime, 'HH:mm');
  
  if (checkout.isSameOrBefore(expected)) {
    return { isLate: false, minutes: 0, fee: 0 };
  }
  
  const diffMinutes = checkout.diff(expected, 'minutes');
  if (diffMinutes <= rule.grace_minutes) {
    return { isLate: false, minutes: diffMinutes, fee: 0 };
  }
  
  const chargeableMinutes = diffMinutes - rule.grace_minutes;
  const fee = Math.min(chargeableMinutes * rule.fee_per_minute, rule.max_fee);
  
  return {
    isLate: true,
    minutes: diffMinutes,
    fee: fee
  };
};

router.get('/children', (req, res) => {
  const { status, class_name, keyword } = req.query;
  let query = 'SELECT * FROM children WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (class_name) {
    query += ' AND class_name = ?';
    params.push(class_name);
  }
  if (keyword) {
    query += ' AND (name LIKE ? OR parent_name LIKE ? OR parent_phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  
  query += ' ORDER BY created_at DESC';
  const children = db.prepare(query).all(...params);
  res.json(children);
});

router.get('/children/:id', (req, res) => {
  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id);
  if (!child) {
    return res.status(404).json({ error: '儿童不存在' });
  }
  
  const authorizedPersons = db.prepare('SELECT * FROM authorized_persons WHERE child_id = ?').all(req.params.id);
  const tempAuths = db.prepare(`
    SELECT ta.*, ap.name as authorized_person_name 
    FROM temp_authorizations ta 
    LEFT JOIN authorized_persons ap ON ta.authorized_person_id = ap.id 
    WHERE ta.child_id = ?
  `).all(req.params.id);
  
  res.json({ ...child, authorizedPersons, tempAuths });
});

router.post('/children', (req, res) => {
  const { name, gender, birth_date, class_name, parent_name, parent_phone, address } = req.body;
  const result = db.prepare(`
    INSERT INTO children (name, gender, birth_date, class_name, parent_name, parent_phone, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, gender, birth_date, class_name, parent_name, parent_phone, address);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.get('/authorized-persons', (req, res) => {
  const { child_id } = req.query;
  let query = 'SELECT * FROM authorized_persons WHERE 1=1';
  const params = [];
  
  if (child_id) {
    query += ' AND child_id = ?';
    params.push(child_id);
  }
  
  const persons = db.prepare(query).all(...params);
  res.json(persons);
});

router.post('/authorized-persons', (req, res) => {
  const { child_id, name, relation, phone, id_card, photo_path, is_primary } = req.body;
  const result = db.prepare(`
    INSERT INTO authorized_persons (child_id, name, relation, phone, id_card, photo_path, is_primary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(child_id, name, relation, phone, id_card, photo_path, is_primary ? 1 : 0);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.get('/temp-authorizations', (req, res) => {
  const { child_id, status, date } = req.query;
  let query = `
    SELECT ta.*, c.name as child_name, ap.name as authorized_person_name
    FROM temp_authorizations ta
    LEFT JOIN children c ON ta.child_id = c.id
    LEFT JOIN authorized_persons ap ON ta.authorized_person_id = ap.id
    WHERE 1=1
  `;
  const params = [];
  
  if (child_id) {
    query += ' AND ta.child_id = ?';
    params.push(child_id);
  }
  if (status) {
    query += ' AND ta.status = ?';
    params.push(status);
  }
  if (date) {
    query += ' AND ? BETWEEN ta.start_date AND ta.end_date';
    params.push(date);
  }
  
  query += ' ORDER BY ta.created_at DESC';
  const auths = db.prepare(query).all(...params);
  res.json(auths);
});

router.post('/temp-authorizations', (req, res) => {
  const { child_id, authorized_person_id, authorized_name, authorized_phone, relation, start_date, end_date, reason, created_by } = req.body;
  const result = db.prepare(`
    INSERT INTO temp_authorizations (child_id, authorized_person_id, authorized_name, authorized_phone, relation, start_date, end_date, reason, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(child_id, authorized_person_id || null, authorized_name, authorized_phone, relation, start_date, end_date, reason, created_by);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.put('/temp-authorizations/:id', (req, res) => {
  const { id } = req.params;
  const oldData = db.prepare('SELECT * FROM temp_authorizations WHERE id = ?').get(id);
  if (!oldData) {
    return res.status(404).json({ error: '授权不存在' });
  }
  
  const fields = ['authorized_name', 'authorized_phone', 'relation', 'start_date', 'end_date', 'reason', 'status'];
  const changedBy = req.body.changed_by || 'system';
  
  fields.forEach(field => {
    if (req.body[field] !== undefined && req.body[field] !== oldData[field]) {
      db.prepare(`
        INSERT INTO temp_auth_changes (temp_auth_id, field_name, old_value, new_value, changed_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, field, oldData[field] || '', req.body[field] || '', changedBy);
    }
  });
  
  const updates = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => req.body[f] !== undefined ? req.body[f] : oldData[f]);
  values.push(id);
  
  db.prepare(`UPDATE temp_authorizations SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  
  const updated = db.prepare('SELECT * FROM temp_authorizations WHERE id = ?').get(id);
  res.json(updated);
});

router.get('/temp-authorizations/:id/changes', (req, res) => {
  const changes = db.prepare('SELECT * FROM temp_auth_changes WHERE temp_auth_id = ? ORDER BY changed_at DESC').all(req.params.id);
  res.json(changes);
});

router.get('/pickup-records', (req, res) => {
  const { child_id, start_date, end_date, is_late, status } = req.query;
  let query = `
    SELECT pr.*, c.name as child_name, c.class_name, ap.name as authorized_person_name
    FROM pickup_records pr
    LEFT JOIN children c ON pr.child_id = c.id
    LEFT JOIN authorized_persons ap ON pr.authorized_person_id = ap.id
    WHERE 1=1
  `;
  const params = [];
  
  if (child_id) {
    query += ' AND pr.child_id = ?';
    params.push(child_id);
  }
  if (start_date) {
    query += ' AND pr.pickup_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND pr.pickup_date <= ?';
    params.push(end_date);
  }
  if (is_late === 'true') {
    query += ' AND pr.is_late = 1';
  }
  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY pr.pickup_date DESC, pr.pickup_time DESC';
  const records = db.prepare(query).all(...params);
  res.json(records);
});

router.post('/pickup-records', (req, res) => {
  const { child_id, pickup_date, pickup_time, authorized_person_id, temp_auth_id, pickup_person_name, pickup_person_phone, checkout_time, expected_checkout_time } = req.body;
  
  let lateInfo = { isLate: false, minutes: 0, fee: 0 };
  if (checkout_time && expected_checkout_time) {
    lateInfo = calculateLateFee(checkout_time, expected_checkout_time);
  }
  
  const result = db.prepare(`
    INSERT INTO pickup_records (child_id, pickup_date, pickup_time, authorized_person_id, temp_auth_id, pickup_person_name, pickup_person_phone, checkout_time, expected_checkout_time, is_late, late_minutes, late_fee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    child_id, pickup_date, pickup_time, authorized_person_id || null, temp_auth_id || null,
    pickup_person_name, pickup_person_phone, checkout_time || null, expected_checkout_time || null,
    lateInfo.isLate ? 1 : 0, lateInfo.minutes, lateInfo.fee
  );
  
  if (lateInfo.isLate) {
    db.prepare(`
      INSERT INTO pickup_exceptions (pickup_record_id, child_id, exception_type, exception_level, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, child_id, 'late_pickup', 'warning', `迟接 ${lateInfo.minutes} 分钟，费用 ${lateInfo.fee} 元`);
  }
  
  res.json({ id: result.lastInsertRowid, ...req.body, is_late: lateInfo.isLate, late_minutes: lateInfo.minutes, late_fee: lateInfo.fee });
});

router.get('/pickup-exceptions', (req, res) => {
  const { status, child_id, exception_type, handler, start_date, end_date } = req.query;
  let query = `
    SELECT pe.*, c.name as child_name, c.class_name, pr.pickup_date, pr.pickup_time, pr.late_minutes, pr.late_fee
    FROM pickup_exceptions pe
    LEFT JOIN children c ON pe.child_id = c.id
    LEFT JOIN pickup_records pr ON pe.pickup_record_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND pe.status = ?';
    params.push(status);
  }
  if (child_id) {
    query += ' AND pe.child_id = ?';
    params.push(child_id);
  }
  if (exception_type) {
    query += ' AND pe.exception_type = ?';
    params.push(exception_type);
  }
  if (handler) {
    query += ' AND pe.handler = ?';
    params.push(handler);
  }
  if (start_date) {
    query += ' AND pr.pickup_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND pr.pickup_date <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY pe.created_at DESC';
  const exceptions = db.prepare(query).all(...params);
  res.json(exceptions);
});

router.put('/pickup-exceptions/:id', (req, res) => {
  const { id } = req.params;
  const { status, handler, handle_result, handle_notes, handled_by } = req.body;
  
  db.prepare(`
    UPDATE pickup_exceptions 
    SET status = ?, handler = ?, handle_result = ?, handle_notes = ?, handle_time = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, handler, handle_result, handle_notes, id);
  
  res.json({ success: true });
});

router.post('/exception-handover', (req, res) => {
  const { exception_id, from_handler, to_handler, handover_notes } = req.body;
  const result = db.prepare(`
    INSERT INTO exception_handover (exception_id, from_handler, to_handler, handover_notes)
    VALUES (?, ?, ?, ?)
  `).run(exception_id, from_handler, to_handler, handover_notes);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.post('/manual-adjustments', (req, res) => {
  const { pickup_record_id, exception_id, child_id, adjustment_type, field_name, old_value, new_value, reason, adjusted_by } = req.body;
  const result = db.prepare(`
    INSERT INTO manual_adjustments (pickup_record_id, exception_id, child_id, adjustment_type, field_name, old_value, new_value, reason, adjusted_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pickup_record_id || null, exception_id || null, child_id || null, adjustment_type, field_name, old_value, new_value, reason, adjusted_by);
  
  res.json({ id: result.lastInsertRowid, ...req.body });
});

router.get('/manual-adjustments', (req, res) => {
  const adjustments = db.prepare(`
    SELECT ma.*, c.name as child_name
    FROM manual_adjustments ma
    LEFT JOIN children c ON ma.child_id = c.id
    ORDER BY ma.adjusted_at DESC
  `).all();
  res.json(adjustments);
});

router.get('/dashboard/stats', (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  const totalChildren = db.prepare('SELECT COUNT(*) as count FROM children WHERE status = "active"').get().count;
  const pendingExceptions = db.prepare('SELECT COUNT(*) as count FROM pickup_exceptions WHERE status = "pending"').get().count;
  const todayLate = db.prepare('SELECT COUNT(*) as count FROM pickup_records WHERE pickup_date = ? AND is_late = 1').get(today).count;
  const totalLateFee = db.prepare('SELECT SUM(late_fee) as total FROM pickup_records WHERE is_late = 1').get().total || 0;
  
  res.json({
    totalChildren,
    pendingExceptions,
    todayLate,
    totalLateFee
  });
});

router.get('/export/exceptions', (req, res) => {
  const { status, handler, start_date, end_date, child_id } = req.query;
  let query = `
    SELECT 
      pe.id as 异常ID,
      c.name as 儿童姓名,
      c.class_name as 班级,
      pe.exception_type as 异常类型,
      pe.exception_level as 异常级别,
      pe.description as 异常描述,
      pe.status as 状态,
      pe.handler as 责任人,
      pe.handle_time as 处理时间,
      pe.handle_result as 处理结果,
      pe.handle_notes as 处理备注,
      pr.pickup_date as 接送日期,
      pr.pickup_time as 接送时间,
      pr.late_minutes as 迟接分钟,
      pr.late_fee as 迟接费用
    FROM pickup_exceptions pe
    LEFT JOIN children c ON pe.child_id = c.id
    LEFT JOIN pickup_records pr ON pe.pickup_record_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND pe.status = ?';
    params.push(status);
  }
  if (handler) {
    query += ' AND pe.handler = ?';
    params.push(handler);
  }
  if (start_date) {
    query += ' AND pr.pickup_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND pr.pickup_date <= ?';
    params.push(end_date);
  }
  if (child_id) {
    query += ' AND pe.child_id = ?';
    params.push(child_id);
  }
  
  query += ' ORDER BY pe.created_at DESC';
  const data = db.prepare(query).all(...params);
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '异常记录');
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=异常记录_${moment().format('YYYYMMDD')}.xlsx`);
  res.send(buffer);
});

router.post('/demo/init', (req, res) => {
  const children = [
    { name: '张小明', gender: '男', birth_date: '2020-03-15', class_name: '小班A', parent_name: '张伟', parent_phone: '13800138001', address: '北京市朝阳区' },
    { name: '李小红', gender: '女', birth_date: '2020-07-22', class_name: '小班A', parent_name: '李芳', parent_phone: '13800138002', address: '北京市海淀区' },
    { name: '王小刚', gender: '男', birth_date: '2019-11-08', class_name: '中班B', parent_name: '王强', parent_phone: '13800138003', address: '北京市西城区' },
    { name: '赵小美', gender: '女', birth_date: '2020-01-30', class_name: '小班A', parent_name: '赵敏', parent_phone: '13800138004', address: '北京市东城区' },
    { name: '陈小宇', gender: '男', birth_date: '2019-05-12', class_name: '中班B', parent_name: '陈杰', parent_phone: '13800138005', address: '北京市丰台区' }
  ];
  
  const childIds = [];
  children.forEach(child => {
    const result = db.prepare(`
      INSERT INTO children (name, gender, birth_date, class_name, parent_name, parent_phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(child.name, child.gender, child.birth_date, child.class_name, child.parent_name, child.parent_phone, child.address);
    childIds.push(result.lastInsertRowid);
  });
  
  const authorizedPersons = [
    { child_id: childIds[0], name: '张伟', relation: '父亲', phone: '13800138001', is_primary: 1 },
    { child_id: childIds[0], name: '王兰', relation: '母亲', phone: '13800138006', is_primary: 0 },
    { child_id: childIds[1], name: '李芳', relation: '母亲', phone: '13800138002', is_primary: 1 },
    { child_id: childIds[2], name: '王强', relation: '父亲', phone: '13800138003', is_primary: 1 },
    { child_id: childIds[2], name: '王奶奶', relation: '奶奶', phone: '13800138007', is_primary: 0 },
    { child_id: childIds[3], name: '赵敏', relation: '母亲', phone: '13800138004', is_primary: 1 },
    { child_id: childIds[4], name: '陈杰', relation: '父亲', phone: '13800138005', is_primary: 1 }
  ];
  
  authorizedPersons.forEach(person => {
    db.prepare(`
      INSERT INTO authorized_persons (child_id, name, relation, phone, is_primary)
      VALUES (?, ?, ?, ?, ?)
    `).run(person.child_id, person.name, person.relation, person.phone, person.is_primary);
  });
  
  const tempAuths = [
    { child_id: childIds[0], authorized_name: '刘叔叔', authorized_phone: '13800138008', relation: '同事', start_date: '2024-01-10', end_date: '2024-01-15', reason: '家长出差', created_by: '管理员' },
    { child_id: childIds[2], authorized_name: '张爷爷', authorized_phone: '13800138009', relation: '邻居', start_date: '2024-01-12', end_date: '2024-01-12', reason: '临时帮忙', created_by: '管理员' }
  ];
  
  tempAuths.forEach(auth => {
    db.prepare(`
      INSERT INTO temp_authorizations (child_id, authorized_name, authorized_phone, relation, start_date, end_date, reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(auth.child_id, auth.authorized_name, auth.authorized_phone, auth.relation, auth.start_date, auth.end_date, auth.reason, auth.created_by);
  });
  
  const today = moment();
  const pickupRecords = [];
  
  for (let i = 0; i < 30; i++) {
    const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const childIndex = i % childIds.length;
    
    const expectedTime = '17:00';
    const checkoutMinutes = 17 * 60 + Math.floor(Math.random() * 60);
    const checkoutTime = `${Math.floor(checkoutMinutes / 60).toString().padStart(2, '0')}:${(checkoutMinutes % 60).toString().padStart(2, '0')}`;
    
    let lateInfo = { isLate: false, minutes: 0, fee: 0 };
    if (checkoutMinutes > 17 * 60 + 15) {
      const diff = checkoutMinutes - 17 * 60;
      lateInfo = {
        isLate: true,
        minutes: diff,
        fee: Math.min((diff - 15) * 2, 100)
      };
    }
    
    const result = db.prepare(`
      INSERT INTO pickup_records (child_id, pickup_date, pickup_time, authorized_person_id, pickup_person_name, checkout_time, expected_checkout_time, is_late, late_minutes, late_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      childIds[childIndex], date, '08:00', childIndex + 1, `家长${childIndex + 1}`, checkoutTime, expectedTime,
      lateInfo.isLate ? 1 : 0, lateInfo.minutes, lateInfo.fee
    );
    
    if (lateInfo.isLate) {
      db.prepare(`
        INSERT INTO pickup_exceptions (pickup_record_id, child_id, exception_type, exception_level, description, status, handler, handle_time, handle_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        result.lastInsertRowid, childIds[childIndex], 'late_pickup', 'warning',
        `迟接 ${lateInfo.minutes} 分钟，费用 ${lateInfo.fee} 元`,
        i < 5 ? 'pending' : 'resolved',
        i < 5 ? null : '张老师',
        i < 5 ? null : date,
        i < 5 ? null : '已联系家长，费用已确认'
      );
    }
  }
  
  res.json({ success: true, message: '演示数据初始化完成' });
});

module.exports = router;
