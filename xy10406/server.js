const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const { Parser } = require('json2csv');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  let dbData = null;
  
  if (fs.existsSync('./pharmacy.db')) {
    try {
      dbData = fs.readFileSync('./pharmacy.db');
      db = new SQL.Database(dbData);
    } catch (e) {
      console.log('读取现有数据库失败，创建新数据库');
      db = new SQL.Database();
      createTables();
      seedData();
      saveDatabase();
    }
  } else {
    db = new SQL.Database();
    createTables();
    seedData();
    saveDatabase();
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      phone TEXT,
      birth_date TEXT,
      gender TEXT,
      diseases TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      generic_name TEXT,
      category TEXT,
      manufacturer TEXT,
      specification TEXT,
      unit TEXT,
      stock INTEGER DEFAULT 0,
      price REAL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS drug_interactions (
      id TEXT PRIMARY KEY,
      medicine_id_1 TEXT NOT NULL,
      medicine_id_2 TEXT NOT NULL,
      severity TEXT DEFAULT 'moderate',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor TEXT,
      diagnosis TEXT,
      issue_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      total_refills INTEGER DEFAULT 0,
      used_refills INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      quantity INTEGER,
      dosage TEXT,
      frequency TEXT
    );

    CREATE TABLE IF NOT EXISTS refill_requests (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      request_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      reviewer_id TEXT,
      review_date TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS refill_items (
      id TEXT PRIMARY KEY,
      refill_request_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      quantity INTEGER,
      stock_snapshot INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      actor TEXT,
      timestamp TEXT
    );
  `);
}

function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync('./pharmacy.db', buffer);
  } catch (e) {
    console.error('保存数据库失败:', e);
  }
}

function seedData() {
  const patientCount = db.exec('SELECT COUNT(*) as count FROM patients');
  if (patientCount.length > 0 && patientCount[0].values[0][0] > 0) return;

  const now = new Date().toISOString();
  const today = new Date();
  const pastDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const futureDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const expiredDate = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);

  const patients = [
    { id: 'P001', name: '张三', id_card: '110101195001010001', phone: '13800138001', birth_date: '1950-01-01', gender: '男', diseases: '["高血压","2型糖尿病"]', created_at: now },
    { id: 'P002', name: '李四', id_card: '110101195505050002', phone: '13800138002', birth_date: '1955-05-05', gender: '女', diseases: '["高血压"]', created_at: now },
    { id: 'P003', name: '王五', id_card: '110101196003030003', phone: '13800138003', birth_date: '1960-03-03', gender: '男', diseases: '["2型糖尿病"]', created_at: now },
    { id: 'P004', name: '赵六', id_card: '110101194812120004', phone: '13800138004', birth_date: '1948-12-12', gender: '女', diseases: '["高血压","冠心病"]', created_at: now },
    { id: 'P005', name: '孙七', id_card: '110101195208080005', phone: '13800138005', birth_date: '1952-08-08', gender: '男', diseases: '["2型糖尿病","高脂血症"]', created_at: now }
  ];

  const medicines = [
    { id: 'M001', name: '拜新同', generic_name: '硝苯地平控释片', category: '降压药', manufacturer: '拜耳', specification: '30mg*7片', unit: '盒', stock: 50, price: 45.00, created_at: now },
    { id: 'M002', name: '代文', generic_name: '缬沙坦胶囊', category: '降压药', manufacturer: '诺华', specification: '80mg*7粒', unit: '盒', stock: 30, price: 55.00, created_at: now },
    { id: 'M003', name: '络活喜', generic_name: '氨氯地平片', category: '降压药', manufacturer: '辉瑞', specification: '5mg*7片', unit: '盒', stock: 0, price: 38.00, created_at: now },
    { id: 'M004', name: '格华止', generic_name: '二甲双胍片', category: '降糖药', manufacturer: '中美施贵宝', specification: '500mg*20片', unit: '盒', stock: 40, price: 25.00, created_at: now },
    { id: 'M005', name: '糖适平', generic_name: '格列喹酮片', category: '降糖药', manufacturer: '万辉双鹤', specification: '30mg*30片', unit: '盒', stock: 25, price: 42.00, created_at: now },
    { id: 'M006', name: '安博维', generic_name: '厄贝沙坦片', category: '降压药', manufacturer: '赛诺菲', specification: '150mg*7片', unit: '盒', stock: 15, price: 32.00, created_at: now },
    { id: 'M007', name: '西格列汀', generic_name: '捷诺维', category: '降糖药', manufacturer: '默沙东', specification: '100mg*7片', unit: '盒', stock: 5, price: 128.00, created_at: now },
    { id: 'M008', name: '阿司匹林', generic_name: '阿司匹林肠溶片', category: '抗血小板药', manufacturer: '拜耳', specification: '100mg*30片', unit: '盒', stock: 100, price: 18.00, created_at: now },
    { id: 'M009', name: '立普妥', generic_name: '阿托伐他汀钙片', category: '调血脂药', manufacturer: '辉瑞', specification: '20mg*7片', unit: '盒', stock: 20, price: 68.00, created_at: now },
    { id: 'M010', name: '舒降之', generic_name: '辛伐他汀片', category: '调血脂药', manufacturer: '默沙东', specification: '20mg*7片', unit: '盒', stock: 35, price: 35.00, created_at: now }
  ];

  const drugInteractions = [
    { id: 'I001', medicine_id_1: 'M005', medicine_id_2: 'M008', severity: 'high', description: '格列喹酮与阿司匹林合用可能增强降糖作用，增加低血糖风险' }
  ];

  const prescriptions = [
    { id: 'PR001', patient_id: 'P001', doctor: '王医生', diagnosis: '高血压、2型糖尿病', issue_date: pastDate.toISOString().split('T')[0], expiry_date: futureDate.toISOString().split('T')[0], total_refills: 6, used_refills: 2, status: 'active', created_at: now },
    { id: 'PR002', patient_id: 'P002', doctor: '李医生', diagnosis: '原发性高血压', issue_date: pastDate.toISOString().split('T')[0], expiry_date: expiredDate.toISOString().split('T')[0], total_refills: 3, used_refills: 3, status: 'expired', created_at: now },
    { id: 'PR003', patient_id: 'P003', doctor: '张医生', diagnosis: '2型糖尿病', issue_date: pastDate.toISOString().split('T')[0], expiry_date: futureDate.toISOString().split('T')[0], total_refills: 6, used_refills: 5, status: 'active', created_at: now },
    { id: 'PR004', patient_id: 'P004', doctor: '赵医生', diagnosis: '高血压、冠心病', issue_date: pastDate.toISOString().split('T')[0], expiry_date: futureDate.toISOString().split('T')[0], total_refills: 6, used_refills: 1, status: 'active', created_at: now },
    { id: 'PR005', patient_id: 'P005', doctor: '孙医生', diagnosis: '2型糖尿病、高脂血症', issue_date: pastDate.toISOString().split('T')[0], expiry_date: futureDate.toISOString().split('T')[0], total_refills: 6, used_refills: 0, status: 'active', created_at: now }
  ];

  const prescriptionItems = [
    { id: 'PI001', prescription_id: 'PR001', medicine_id: 'M001', quantity: 2, dosage: '30mg', frequency: '每日1次' },
    { id: 'PI002', prescription_id: 'PR001', medicine_id: 'M004', quantity: 2, dosage: '500mg', frequency: '每日2次' },
    { id: 'PI003', prescription_id: 'PR002', medicine_id: 'M002', quantity: 2, dosage: '80mg', frequency: '每日1次' },
    { id: 'PI004', prescription_id: 'PR003', medicine_id: 'M004', quantity: 3, dosage: '500mg', frequency: '每日2次' },
    { id: 'PI005', prescription_id: 'PR003', medicine_id: 'M005', quantity: 2, dosage: '30mg', frequency: '每日3次' },
    { id: 'PI006', prescription_id: 'PR004', medicine_id: 'M006', quantity: 2, dosage: '150mg', frequency: '每日1次' },
    { id: 'PI007', prescription_id: 'PR004', medicine_id: 'M008', quantity: 1, dosage: '100mg', frequency: '每日1次' },
    { id: 'PI008', prescription_id: 'PR005', medicine_id: 'M004', quantity: 2, dosage: '500mg', frequency: '每日2次' },
    { id: 'PI009', prescription_id: 'PR005', medicine_id: 'M005', quantity: 1, dosage: '30mg', frequency: '每日3次' },
    { id: 'PI010', prescription_id: 'PR005', medicine_id: 'M008', quantity: 1, dosage: '100mg', frequency: '每日1次' },
    { id: 'PI011', prescription_id: 'PR005', medicine_id: 'M009', quantity: 2, dosage: '20mg', frequency: '每晚1次' }
  ];

  patients.forEach(p => db.run('INSERT INTO patients (id, name, id_card, phone, birth_date, gender, diseases, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [p.id, p.name, p.id_card, p.phone, p.birth_date, p.gender, p.diseases, p.created_at]));
  medicines.forEach(m => db.run('INSERT INTO medicines (id, name, generic_name, category, manufacturer, specification, unit, stock, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [m.id, m.name, m.generic_name, m.category, m.manufacturer, m.specification, m.unit, m.stock, m.price, m.created_at]));
  drugInteractions.forEach(i => db.run('INSERT INTO drug_interactions (id, medicine_id_1, medicine_id_2, severity, description) VALUES (?, ?, ?, ?, ?)', [i.id, i.medicine_id_1, i.medicine_id_2, i.severity, i.description]));
  prescriptions.forEach(p => db.run('INSERT INTO prescriptions (id, patient_id, doctor, diagnosis, issue_date, expiry_date, total_refills, used_refills, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [p.id, p.patient_id, p.doctor, p.diagnosis, p.issue_date, p.expiry_date, p.total_refills, p.used_refills, p.status, p.created_at]));
  prescriptionItems.forEach(i => db.run('INSERT INTO prescription_items (id, prescription_id, medicine_id, quantity, dosage, frequency) VALUES (?, ?, ?, ?, ?, ?)', [i.id, i.prescription_id, i.medicine_id, i.quantity, i.dosage, i.frequency]));
}

function logAudit(action, entityType, entityId, details, actor = 'system') {
  if (!db) return;
  db.run('INSERT INTO audit_logs (id, action, entity_type, entity_id, details, actor, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    `LOG_${Date.now()}`,
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    actor,
    new Date().toISOString()
  ]);
  saveDatabase();
}

function isSameDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function queryAll(sql, params = []) {
  if (!db) return [];
  const result = db.exec(sql, params);
  if (result.length === 0) return [];
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const result = queryAll(sql, params);
  return result.length > 0 ? result[0] : null;
}

function checkDrugInteractions(medicineIds) {
  if (medicineIds.length < 2) return [];
  const interactions = [];
  
  for (let i = 0; i < medicineIds.length; i++) {
    for (let j = i + 1; j < medicineIds.length; j++) {
      const result = queryOne(`
        SELECT * FROM drug_interactions 
        WHERE (medicine_id_1 = ? AND medicine_id_2 = ?) 
        OR (medicine_id_1 = ? AND medicine_id_2 = ?)
      `, [medicineIds[i], medicineIds[j], medicineIds[j], medicineIds[i]]);
      
      if (result) {
        const med1 = queryOne('SELECT name FROM medicines WHERE id = ?', [medicineIds[i]]);
        const med2 = queryOne('SELECT name FROM medicines WHERE id = ?', [medicineIds[j]]);
        interactions.push({
          ...result,
          medicine_name_1: med1?.name || '',
          medicine_name_2: med2?.name || ''
        });
      }
    }
  }
  return interactions;
}

app.get('/api/patients', (req, res) => {
  const patients = queryAll('SELECT * FROM patients ORDER BY created_at DESC');
  patients.forEach(p => {
    p.diseases = JSON.parse(p.diseases || '[]');
  });
  res.json(patients);
});

app.post('/api/patients', (req, res) => {
  const { name, id_card, phone, birth_date, gender, diseases } = req.body;
  const id = `P${String(Date.now()).slice(-8)}`;
  const now = new Date().toISOString();
  const diseasesStr = JSON.stringify(diseases || []);
  
  try {
    db.run('INSERT INTO patients (id, name, id_card, phone, birth_date, gender, diseases, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, name, id_card, phone, birth_date, gender, diseasesStr, now]);
    saveDatabase();
    logAudit('create', 'patient', id, { name, id_card });
    res.json({ id, name, id_card, phone, birth_date, gender, diseases, created_at: now });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/medicines', (req, res) => {
  const medicines = queryAll('SELECT * FROM medicines ORDER BY name');
  res.json(medicines);
});

app.put('/api/medicines/:id/stock', (req, res) => {
  const { stock } = req.body;
  const { id } = req.params;
  const medicine = queryOne('SELECT * FROM medicines WHERE id = ?', [id]);
  if (!medicine) return res.status(404).json({ error: '药品不存在' });
  
  db.run('UPDATE medicines SET stock = ? WHERE id = ?', [stock, id]);
  saveDatabase();
  logAudit('update_stock', 'medicine', id, { old_stock: medicine.stock, new_stock: stock });
  res.json({ ...medicine, stock });
});

app.get('/api/patients/:id/prescriptions', (req, res) => {
  const prescriptions = queryAll(`
    SELECT p.*, 
      (SELECT name FROM patients WHERE id = p.patient_id) as patient_name
    FROM prescriptions p 
    WHERE p.patient_id = ? 
    ORDER BY p.issue_date DESC
  `, [req.params.id]);
  
  prescriptions.forEach(p => {
    p.items = queryAll(`
      SELECT pi.*, m.name, m.generic_name, m.stock, m.specification, m.unit
      FROM prescription_items pi
      JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ?
    `, [p.id]);
  });
  
  res.json(prescriptions);
});

app.post('/api/prescriptions', (req, res) => {
  const { patient_id, doctor, diagnosis, issue_date, expiry_date, total_refills, items } = req.body;
  const id = `PR${String(Date.now()).slice(-8)}`;
  const now = new Date().toISOString();
  
  try {
    db.run('INSERT INTO prescriptions (id, patient_id, doctor, diagnosis, issue_date, expiry_date, total_refills, used_refills, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)', [id, patient_id, doctor, diagnosis, issue_date, expiry_date, total_refills, 'active', now]);
    
    items.forEach((item, idx) => {
      db.run('INSERT INTO prescription_items (id, prescription_id, medicine_id, quantity, dosage, frequency) VALUES (?, ?, ?, ?, ?, ?)', [`PI${id}_${idx}`, id, item.medicine_id, item.quantity, item.dosage, item.frequency]);
    });
    
    saveDatabase();
    logAudit('create', 'prescription', id, { patient_id, doctor, diagnosis });
    res.json({ id, patient_id, doctor, diagnosis, issue_date, expiry_date, total_refills, used_refills: 0, status: 'active', created_at: now, items });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/refill-requests/validate', (req, res) => {
  const { prescription_id } = req.body;
  const today = new Date();
  
  const prescription = queryOne('SELECT * FROM prescriptions WHERE id = ?', [prescription_id]);
  if (!prescription) return res.status(404).json({ error: '处方不存在' });
  
  const patient = queryOne('SELECT name FROM patients WHERE id = ?', [prescription.patient_id]);
  
  const issues = [];
  const warnings = [];
  
  const expiryDate = new Date(prescription.expiry_date);
  if (expiryDate < today) {
    issues.push({ type: 'expired', message: `处方已过期（有效期至${prescription.expiry_date}）` });
  }
  
  if (prescription.used_refills >= prescription.total_refills) {
    issues.push({ type: 'refills_exhausted', message: `续配次数已用完（已使用${prescription.used_refills}/${prescription.total_refills}次）` });
  }
  
  const items = queryAll(`
    SELECT pi.*, m.name, m.generic_name, m.stock, m.specification, m.unit
    FROM prescription_items pi
    JOIN medicines m ON pi.medicine_id = m.id
    WHERE pi.prescription_id = ?
  `, [prescription_id]);
  
  const medicineIds = items.map(i => i.medicine_id);
  items.forEach(item => {
    if (item.stock < item.quantity) {
      issues.push({ 
        type: 'stock_insufficient', 
        message: `${item.name}（${item.specification}）库存不足，需求${item.quantity}${item.unit}，当前库存${item.stock}${item.unit}`,
        medicine_id: item.medicine_id
      });
    }
  });
  
  const todayRefills = queryAll(`
    SELECT * FROM refill_requests 
    WHERE prescription_id = ? AND status = 'approved'
  `, [prescription_id]);
  
  const hasTodayRefill = todayRefills.some(r => isSameDay(r.request_date, today));
  if (hasTodayRefill) {
    issues.push({ type: 'duplicate_today', message: '该处方今日已续配过' });
  }
  
  const interactions = checkDrugInteractions(medicineIds);
  interactions.forEach(interaction => {
    const message = `【${interaction.severity === 'high' ? '严重' : '中等'}】${interaction.medicine_name_1} 与 ${interaction.medicine_name_2} 存在药物相互作用：${interaction.description}`;
    if (interaction.severity === 'high') {
      issues.push({ type: 'drug_interaction', message, severity: interaction.severity });
    } else {
      warnings.push({ type: 'drug_interaction', message, severity: interaction.severity });
    }
  });
  
  const needsReview = warnings.length > 0 || issues.some(i => i.type === 'drug_interaction' && i.severity === 'high');
  
  res.json({
    prescription: { ...prescription, patient_name: patient?.name },
    items,
    can_proceed: issues.length === 0,
    needs_pharmacist_review: needsReview,
    issues,
    warnings
  });
});

app.post('/api/refill-requests', (req, res) => {
  const { prescription_id, patient_id } = req.body;
  const id = `RR${String(Date.now()).slice(-8)}`;
  const now = new Date().toISOString();
  
  const items = queryAll(`
    SELECT pi.*, m.name, m.stock
    FROM prescription_items pi
    JOIN medicines m ON pi.medicine_id = m.id
    WHERE pi.prescription_id = ?
  `, [prescription_id]);
  
  db.run('INSERT INTO refill_requests (id, prescription_id, patient_id, request_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, prescription_id, patient_id, now, 'pending', now]);
  
  items.forEach((item, idx) => {
    db.run('INSERT INTO refill_items (id, refill_request_id, medicine_id, quantity, stock_snapshot) VALUES (?, ?, ?, ?, ?)', [`RI${id}_${idx}`, id, item.medicine_id, item.quantity, item.stock]);
  });
  
  saveDatabase();
  logAudit('create', 'refill_request', id, { prescription_id, patient_id });
  res.json({ id, prescription_id, patient_id, request_date: now, status: 'pending', created_at: now });
});

app.get('/api/refill-requests', (req, res) => {
  const { status, date } = req.query;
  let query = `
    SELECT rr.*, 
      p.name as patient_name, p.id_card as patient_id_card,
      pr.doctor, pr.diagnosis, pr.expiry_date
    FROM refill_requests rr
    JOIN patients p ON rr.patient_id = p.id
    JOIN prescriptions pr ON rr.prescription_id = pr.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND rr.status = ?';
    params.push(status);
  }
  
  if (date) {
    query += ` AND DATE(rr.request_date) = DATE(?)`;
    params.push(date);
  }
  
  query += ' ORDER BY rr.request_date DESC';
  
  const requests = queryAll(query, params);
  
  requests.forEach(r => {
    r.items = queryAll(`
      SELECT ri.*, m.name, m.specification, m.unit
      FROM refill_items ri
      JOIN medicines m ON ri.medicine_id = m.id
      WHERE ri.refill_request_id = ?
    `, [r.id]);
  });
  
  res.json(requests);
});

app.get('/api/refill-requests/pending', (req, res) => {
  const requests = queryAll(`
    SELECT rr.*, 
      p.name as patient_name, p.id_card as patient_id_card, p.phone as patient_phone,
      pr.doctor, pr.diagnosis, pr.expiry_date, pr.used_refills, pr.total_refills
    FROM refill_requests rr
    JOIN patients p ON rr.patient_id = p.id
    JOIN prescriptions pr ON rr.prescription_id = pr.id
    WHERE rr.status = 'pending'
    ORDER BY rr.request_date ASC
  `);
  
  requests.forEach(r => {
    r.items = queryAll(`
      SELECT ri.*, m.name, m.specification, m.unit, m.stock as current_stock
      FROM refill_items ri
      JOIN medicines m ON ri.medicine_id = m.id
      WHERE ri.refill_request_id = ?
    `, [r.id]);
  });
  
  res.json(requests);
});

app.post('/api/refill-requests/:id/approve', (req, res) => {
  const { id } = req.params;
  const { reviewer_id = 'pharmacist' } = req.body;
  const now = new Date().toISOString();
  
  const request = queryOne('SELECT * FROM refill_requests WHERE id = ?', [id]);
  if (!request) return res.status(404).json({ error: '续配申请不存在' });
  if (request.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
  
  const items = queryAll('SELECT * FROM refill_items WHERE refill_request_id = ?', [id]);
  
  db.run('UPDATE refill_requests SET status = ?, reviewer_id = ?, review_date = ? WHERE id = ?', ['approved', reviewer_id, now, id]);
  
  db.run('UPDATE prescriptions SET used_refills = used_refills + 1 WHERE id = ?', [request.prescription_id]);
  
  items.forEach(item => {
    db.run('UPDATE medicines SET stock = stock - ? WHERE id = ?', [item.quantity, item.medicine_id]);
  });
  
  saveDatabase();
  logAudit('approve', 'refill_request', id, { reviewer_id, items_count: items.length });
  res.json({ success: true });
});

app.post('/api/refill-requests/:id/reject', (req, res) => {
  const { id } = req.params;
  const { reason, reviewer_id = 'pharmacist' } = req.body;
  const now = new Date().toISOString();
  
  const request = queryOne('SELECT * FROM refill_requests WHERE id = ?', [id]);
  if (!request) return res.status(404).json({ error: '续配申请不存在' });
  if (request.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });
  
  db.run('UPDATE refill_requests SET status = ?, rejection_reason = ?, reviewer_id = ?, review_date = ? WHERE id = ?', ['rejected', reason, reviewer_id, now, id]);
  saveDatabase();
  
  logAudit('reject', 'refill_request', id, { reviewer_id, reason });
  res.json({ success: true });
});

app.get('/api/export/daily', (req, res) => {
  const { date = new Date().toISOString().split('T')[0] } = req.query;
  
  const requests = queryAll(`
    SELECT rr.*, 
      p.name as patient_name, p.id_card as patient_id_card,
      pr.doctor, pr.diagnosis
    FROM refill_requests rr
    JOIN patients p ON rr.patient_id = p.id
    JOIN prescriptions pr ON rr.prescription_id = pr.id
    WHERE DATE(rr.request_date) = DATE(?)
    ORDER BY rr.request_date DESC
  `, [date]);
  
  requests.forEach(r => {
    r.items = queryAll(`
      SELECT ri.*, m.name, m.specification
      FROM refill_items ri
      JOIN medicines m ON ri.medicine_id = m.id
      WHERE ri.refill_request_id = ?
    `, [r.id]);
  });
  
  const approved = requests.filter(r => r.status === 'approved');
  const rejected = requests.filter(r => r.status === 'rejected');
  const pending = requests.filter(r => r.status === 'pending');
  
  const csvData = requests.map(r => ({
    '日期': new Date(r.request_date).toLocaleString('zh-CN'),
    '患者姓名': r.patient_name,
    '身份证号': r.patient_id_card,
    '诊断': r.diagnosis,
    '开具医生': r.doctor,
    '药品': r.items.map(i => `${i.name}(${i.specification}) x${i.quantity}`).join('; '),
    '状态': r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已拒绝' : '待审核',
    '拒绝原因': r.rejection_reason || '',
    '审核人': r.reviewer_id || '',
    '审核时间': r.review_date ? new Date(r.review_date).toLocaleString('zh-CN') : ''
  }));
  
  try {
    const parser = new Parser();
    const csv = parser.parse(csvData);
    
    const summary = {
      date,
      total: requests.length,
      approved: approved.length,
      rejected: rejected.length,
      pending: pending.length,
      rejection_reasons: rejected.map(r => ({
        patient: r.patient_name,
        reason: r.rejection_reason
      })),
      csv
    };
    
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/audit-logs', (req, res) => {
  const logs = queryAll('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
  logs.forEach(l => {
    try { l.details = JSON.parse(l.details); } catch (e) {}
  });
  res.json(logs);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`药店慢病处方续配台已启动: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
