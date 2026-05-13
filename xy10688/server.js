const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

function logOperation(consultationId, operator, operatorId, action, details, ipAddress) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO operation_logs (id, consultation_id, operator, operator_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), consultationId, operator, operatorId, action, JSON.stringify(details), ipAddress],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function recordChange(recordType, recordId, fieldName, oldValue, newValue, changedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO change_history (id, record_type, record_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), recordType, recordId, fieldName, oldValue, newValue, changedBy],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runInsert(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

app.get('/api/consultations', async (req, res) => {
  try {
    const consultations = await runQuery('SELECT * FROM consultation_records ORDER BY created_at DESC');
    res.json(consultations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/consultations/:id', async (req, res) => {
  try {
    const consultation = await runQuery('SELECT * FROM consultation_records WHERE id = ?', [req.params.id]);
    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    res.json(consultation[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/consultations', async (req, res) => {
  const { patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis } = req.body;
  const id = uuidv4();
  
  try {
    await runInsert(
      'INSERT INTO consultation_records (id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, 'created']
    );
    
    await logOperation(id, doctor_name, doctor_id, 'create_consultation', req.body, req.ip);
    
    const consultation = await runQuery('SELECT * FROM consultation_records WHERE id = ?', [id]);
    res.status(201).json(consultation[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/consultations/:id', async (req, res) => {
  const { patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status } = req.body;
  const consultationId = req.params.id;
  
  try {
    const oldConsultation = await runQuery('SELECT * FROM consultation_records WHERE id = ?', [consultationId]);
    if (oldConsultation.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    const oldData = oldConsultation[0];
    const fields = { patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status };
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && oldData[key] !== value) {
        await recordChange('consultation', consultationId, key, oldData[key], value, doctor_name || 'system');
      }
    }
    
    await runInsert(
      'UPDATE consultation_records SET patient_name = ?, patient_id = ?, doctor_name = ?, doctor_id = ?, department = ?, symptoms = ?, diagnosis = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [patient_name || oldData.patient_name, patient_id || oldData.patient_id, doctor_name || oldData.doctor_name, doctor_id || oldData.doctor_id, department || oldData.department, symptoms || oldData.symptoms, diagnosis || oldData.diagnosis, status || oldData.status, consultationId]
    );
    
    await logOperation(consultationId, doctor_name || oldData.doctor_name, doctor_id || oldData.doctor_id, 'update_consultation', req.body, req.ip);
    
    const consultation = await runQuery('SELECT * FROM consultation_records WHERE id = ?', [consultationId]);
    res.json(consultation[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prescriptions', async (req, res) => {
  try {
    const prescriptions = await runQuery(`
      SELECT pv.*, cr.patient_name, cr.doctor_name 
      FROM prescription_versions pv 
      JOIN consultation_records cr ON pv.consultation_id = cr.id 
      ORDER BY pv.created_at DESC
    `);
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prescriptions', async (req, res) => {
  const { consultation_id, medicines, dosage, notes, created_by } = req.body;
  const id = uuidv4();
  
  try {
    const existingVersions = await runQuery('SELECT MAX(version) as max_version FROM prescription_versions WHERE consultation_id = ?', [consultation_id]);
    const version = (existingVersions[0].max_version || 0) + 1;
    
    await runInsert(
      'INSERT INTO prescription_versions (id, consultation_id, version, medicines, dosage, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, consultation_id, version, JSON.stringify(medicines), dosage, notes, created_by]
    );
    
    await logOperation(consultation_id, created_by, 'doc_001', 'create_prescription', { version, medicines }, req.ip);
    await recordChange('prescription', id, 'created', null, 'true', created_by);
    
    const prescription = await runQuery('SELECT * FROM prescription_versions WHERE id = ?', [id]);
    res.status(201).json({ ...prescription[0], medicines: JSON.parse(prescription[0].medicines) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pharmacist-reviews', async (req, res) => {
  try {
    const reviews = await runQuery(`
      SELECT pr.*, pv.version, cr.patient_name 
      FROM pharmacist_reviews pr 
      JOIN prescription_versions pv ON pr.prescription_id = pv.id 
      JOIN consultation_records cr ON pv.consultation_id = cr.id 
      ORDER BY pr.created_at DESC
    `);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pharmacist-reviews', async (req, res) => {
  const { prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes } = req.body;
  const id = uuidv4();
  
  try {
    const prescription = await runQuery('SELECT * FROM prescription_versions WHERE id = ?', [prescription_id]);
    if (prescription.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }
    
    await runInsert(
      'INSERT INTO pharmacist_reviews (id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, review_result]
    );
    
    await recordChange('pharmacist_review', id, 'status', 'pending', review_result, pharmacist_name);
    await logOperation(prescription[0].consultation_id, pharmacist_name, pharmacist_id, 'pharmacist_review', { review_result, review_notes }, req.ip);
    
    const review = await runQuery('SELECT * FROM pharmacist_reviews WHERE id = ?', [id]);
    res.status(201).json(review[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pharmacist-reviews/:id/review', async (req, res) => {
  const { review_result, review_notes, pharmacist_name, pharmacist_id } = req.body;
  const reviewId = req.params.id;
  
  try {
    const oldReview = await runQuery('SELECT * FROM pharmacist_reviews WHERE id = ?', [reviewId]);
    if (oldReview.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    await recordChange('pharmacist_review', reviewId, 'status', oldReview[0].status, review_result, pharmacist_name);
    await recordChange('pharmacist_review', reviewId, 'review_notes', oldReview[0].review_notes, review_notes, pharmacist_name);
    
    await runInsert(
      'UPDATE pharmacist_reviews SET review_result = ?, review_notes = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [review_result, review_notes, review_result, reviewId]
    );
    
    const prescription = await runQuery('SELECT * FROM prescription_versions WHERE id = ?', [oldReview[0].prescription_id]);
    await logOperation(prescription[0].consultation_id, pharmacist_name, pharmacist_id, 'review_update', { review_result, review_notes }, req.ip);
    
    const review = await runQuery('SELECT * FROM pharmacist_reviews WHERE id = ?', [reviewId]);
    res.json(review[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const payments = await runQuery(`
      SELECT po.*, cr.patient_name 
      FROM payment_orders po 
      JOIN consultation_records cr ON po.consultation_id = cr.id 
      ORDER BY po.created_at DESC
    `);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { consultation_id, amount, payment_method } = req.body;
  const id = uuidv4();
  
  try {
    await runInsert(
      'INSERT INTO payment_orders (id, consultation_id, amount, payment_method, payment_status) VALUES (?, ?, ?, ?, ?)',
      [id, consultation_id, amount, payment_method, 'pending']
    );
    
    await logOperation(consultation_id, 'system', 'sys_001', 'create_payment', { amount, payment_method }, req.ip);
    
    const payment = await runQuery('SELECT * FROM payment_orders WHERE id = ?', [id]);
    res.status(201).json(payment[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/:id/confirm', async (req, res) => {
  const paymentId = req.params.id;
  const { transaction_id, operator_name, operator_id } = req.body;
  
  try {
    const oldPayment = await runQuery('SELECT * FROM payment_orders WHERE id = ?', [paymentId]);
    if (oldPayment.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    await recordChange('payment', paymentId, 'payment_status', 'pending', 'paid', operator_name);
    await recordChange('payment', paymentId, 'transaction_id', null, transaction_id, operator_name);
    
    await runInsert(
      'UPDATE payment_orders SET payment_status = ?, transaction_id = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['paid', transaction_id, paymentId]
    );
    
    await logOperation(oldPayment[0].consultation_id, operator_name, operator_id, 'confirm_payment', { transaction_id }, req.ip);
    
    const payment = await runQuery('SELECT * FROM payment_orders WHERE id = ?', [paymentId]);
    res.json(payment[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventory-replacements', async (req, res) => {
  try {
    const replacements = await runQuery(`
      SELECT ir.*, cr.patient_name 
      FROM inventory_replacements ir 
      JOIN prescription_versions pv ON ir.prescription_id = pv.id 
      JOIN consultation_records cr ON pv.consultation_id = cr.id 
      ORDER BY ir.created_at DESC
    `);
    res.json(replacements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory-replacements', async (req, res) => {
  const { prescription_id, original_medicine, replacement_medicine, reason } = req.body;
  const id = uuidv4();
  
  try {
    await runInsert(
      'INSERT INTO inventory_replacements (id, prescription_id, original_medicine, replacement_medicine, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, prescription_id, original_medicine, replacement_medicine, reason, 'pending']
    );
    
    const prescription = await runQuery('SELECT * FROM prescription_versions WHERE id = ?', [prescription_id]);
    await logOperation(prescription[0].consultation_id, 'pharmacist', 'pharm_001', 'create_replacement', { original_medicine, replacement_medicine }, req.ip);
    
    const replacement = await runQuery('SELECT * FROM inventory_replacements WHERE id = ?', [id]);
    res.status(201).json(replacement[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory-replacements/:id/approve', async (req, res) => {
  const replacementId = req.params.id;
  const { approved_by } = req.body;
  
  try {
    const oldReplacement = await runQuery('SELECT * FROM inventory_replacements WHERE id = ?', [replacementId]);
    if (oldReplacement.length === 0) {
      return res.status(404).json({ error: 'Replacement not found' });
    }
    
    await recordChange('inventory_replacement', replacementId, 'status', 'pending', 'approved', approved_by);
    
    await runInsert(
      'UPDATE inventory_replacements SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', approved_by, replacementId]
    );
    
    const prescription = await runQuery('SELECT * FROM prescription_versions WHERE id = ?', [oldReplacement[0].prescription_id]);
    await logOperation(prescription[0].consultation_id, approved_by, 'doc_001', 'approve_replacement', { replacementId }, req.ip);
    
    const replacement = await runQuery('SELECT * FROM inventory_replacements WHERE id = ?', [replacementId]);
    res.json(replacement[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/delivery', async (req, res) => {
  try {
    const deliveries = await runQuery(`
      SELECT ds.*, cr.patient_name 
      FROM delivery_status ds 
      JOIN consultation_records cr ON ds.consultation_id = cr.id 
      ORDER BY ds.created_at DESC
    `);
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/delivery', async (req, res) => {
  const { consultation_id, courier, tracking_number, estimated_delivery, idempotency_key } = req.body;
  const id = uuidv4();
  
  try {
    const existingDelivery = await runQuery('SELECT * FROM delivery_status WHERE idempotency_key = ?', [idempotency_key]);
    if (existingDelivery.length > 0) {
      return res.json({ message: 'Duplicate request, delivery already created', delivery: existingDelivery[0] });
    }
    
    await runInsert(
      'INSERT INTO delivery_status (id, consultation_id, status, courier, tracking_number, estimated_delivery, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, consultation_id, 'preparing', courier, tracking_number, estimated_delivery, idempotency_key]
    );
    
    await logOperation(consultation_id, 'system', 'sys_001', 'create_delivery', { courier, tracking_number }, req.ip);
    
    const delivery = await runQuery('SELECT * FROM delivery_status WHERE id = ?', [id]);
    res.status(201).json(delivery[0]);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed: delivery_status.idempotency_key')) {
      const existingDelivery = await runQuery('SELECT * FROM delivery_status WHERE idempotency_key = ?', [idempotency_key]);
      return res.json({ message: 'Duplicate request, delivery already created', delivery: existingDelivery[0] });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/delivery/:id/status', async (req, res) => {
  const deliveryId = req.params.id;
  const { status, operator_name, operator_id, idempotency_key } = req.body;
  
  try {
    const oldDelivery = await runQuery('SELECT * FROM delivery_status WHERE id = ?', [deliveryId]);
    if (oldDelivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    if (oldDelivery[0].status === status) {
      return res.json({ message: 'Status already up to date', delivery: oldDelivery[0] });
    }
    
    await recordChange('delivery', deliveryId, 'status', oldDelivery[0].status, status, operator_name);
    
    const updateParams = [status, deliveryId];
    let updateSql = 'UPDATE delivery_status SET status = ?, updated_at = CURRENT_TIMESTAMP';
    
    if (status === 'delivered') {
      updateSql += ', delivered_at = CURRENT_TIMESTAMP';
    }
    
    updateSql += ' WHERE id = ?';
    
    await runInsert(updateSql, updateParams);
    await logOperation(oldDelivery[0].consultation_id, operator_name, operator_id, 'update_delivery_status', { status }, req.ip);
    
    const delivery = await runQuery('SELECT * FROM delivery_status WHERE id = ?', [deliveryId]);
    res.json(delivery[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await runQuery('SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/change-history', async (req, res) => {
  try {
    const history = await runQuery('SELECT * FROM change_history ORDER BY changed_at DESC LIMIT 100');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export', async (req, res) => {
  const { operator, start_date, end_date } = req.query;
  
  try {
    let sql = `
      SELECT 
        cr.id as consultation_id,
        cr.patient_name,
        cr.doctor_name,
        cr.diagnosis,
        cr.status as consultation_status,
        pv.version as prescription_version,
        pr.pharmacist_name,
        pr.review_result,
        po.amount as payment_amount,
        po.payment_status,
        ds.status as delivery_status,
        ol.operator,
        ol.action,
        ol.created_at as operation_time
      FROM consultation_records cr
      LEFT JOIN prescription_versions pv ON cr.id = pv.consultation_id
      LEFT JOIN pharmacist_reviews pr ON pv.id = pr.prescription_id
      LEFT JOIN payment_orders po ON cr.id = po.consultation_id
      LEFT JOIN delivery_status ds ON cr.id = ds.consultation_id
      LEFT JOIN operation_logs ol ON cr.id = ol.consultation_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (operator) {
      sql += ' AND ol.operator = ?';
      params.push(operator);
    }
    
    if (start_date) {
      sql += ' AND ol.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND ol.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    sql += ' ORDER BY ol.created_at DESC';
    
    const data = await runQuery(sql, params);
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`prescription_report_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/operators', async (req, res) => {
  try {
    const operators = await runQuery('SELECT DISTINCT operator FROM operation_logs ORDER BY operator');
    res.json(operators.map(o => o.operator));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/summary/:consultationId', async (req, res) => {
  const consultationId = req.params.consultationId;
  
  try {
    const consultation = await runQuery('SELECT * FROM consultation_records WHERE id = ?', [consultationId]);
    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    const prescriptions = await runQuery('SELECT * FROM prescription_versions WHERE consultation_id = ? ORDER BY version DESC', [consultationId]);
    const reviews = await runQuery('SELECT * FROM pharmacist_reviews pr JOIN prescription_versions pv ON pr.prescription_id = pv.id WHERE pv.consultation_id = ? ORDER BY pr.created_at DESC', [consultationId]);
    const payments = await runQuery('SELECT * FROM payment_orders WHERE consultation_id = ?', [consultationId]);
    const replacements = await runQuery('SELECT * FROM inventory_replacements ir JOIN prescription_versions pv ON ir.prescription_id = pv.id WHERE pv.consultation_id = ?', [consultationId]);
    const deliveries = await runQuery('SELECT * FROM delivery_status WHERE consultation_id = ?', [consultationId]);
    const logs = await runQuery('SELECT * FROM operation_logs WHERE consultation_id = ? ORDER BY created_at DESC', [consultationId]);
    const history = await runQuery('SELECT * FROM change_history WHERE record_id = ? ORDER BY changed_at DESC', [consultationId]);
    
    res.json({
      consultation: consultation[0],
      prescriptions: prescriptions.map(p => ({ ...p, medicines: JSON.parse(p.medicines) })),
      reviews,
      payments,
      replacements,
      deliveries,
      logs,
      history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function insertSampleData() {
  const consultations = await runQuery('SELECT COUNT(*) as count FROM consultation_records');
  if (consultations[0].count > 0) return;
  
  const consultId1 = uuidv4();
  const consultId2 = uuidv4();
  const consultId3 = uuidv4();
  const consultId4 = uuidv4();
  
  await runInsert(
    'INSERT INTO consultation_records (id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [consultId1, '张三', 'P001', '李医生', 'D001', '内科', '发热、咳嗽', '上呼吸道感染', 'completed']
  );
  
  await runInsert(
    'INSERT INTO consultation_records (id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [consultId2, '李四', 'P002', '王医生', 'D002', '皮肤科', '皮肤瘙痒、红疹', '过敏性皮炎', 'reviewing']
  );
  
  await runInsert(
    'INSERT INTO consultation_records (id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [consultId3, '王五', 'P003', '张医生', 'D003', '骨科', '腰痛、活动受限', '腰椎间盘突出', 'blocked']
  );
  
  await runInsert(
    'INSERT INTO consultation_records (id, patient_name, patient_id, doctor_name, doctor_id, department, symptoms, diagnosis, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [consultId4, '赵六', 'P004', '刘医生', 'D004', '消化科', '胃痛、反酸', '慢性胃炎', 'delivered']
  );
  
  const prescId1 = uuidv4();
  const prescId2 = uuidv4();
  const prescId3 = uuidv4();
  const prescId4 = uuidv4();
  
  await runInsert(
    'INSERT INTO prescription_versions (id, consultation_id, version, medicines, dosage, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [prescId1, consultId1, 1, JSON.stringify([{ name: '阿莫西林', dosage: '0.5g', frequency: '每日3次' }]), '口服', '饭后服用', '李医生']
  );
  
  await runInsert(
    'INSERT INTO prescription_versions (id, consultation_id, version, medicines, dosage, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [prescId2, consultId2, 1, JSON.stringify([{ name: '氯雷他定', dosage: '10mg', frequency: '每日1次' }]), '口服', '睡前服用', '王医生']
  );
  
  await runInsert(
    'INSERT INTO prescription_versions (id, consultation_id, version, medicines, dosage, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [prescId3, consultId3, 1, JSON.stringify([{ name: '布洛芬', dosage: '0.3g', frequency: '每日2次' }]), '口服', '疼痛时服用', '张医生']
  );
  
  await runInsert(
    'INSERT INTO prescription_versions (id, consultation_id, version, medicines, dosage, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [prescId4, consultId4, 1, JSON.stringify([{ name: '奥美拉唑', dosage: '20mg', frequency: '每日1次' }]), '口服', '早餐前服用', '刘医生']
  );
  
  await runInsert(
    'INSERT INTO pharmacist_reviews (id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), prescId1, '陈药师', 'PH001', 'approved', '处方合规，用药合理', 'approved']
  );
  
  await runInsert(
    'INSERT INTO pharmacist_reviews (id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), prescId2, '周药师', 'PH002', 'reviewing', '正在复核中', 'pending']
  );
  
  await runInsert(
    'INSERT INTO pharmacist_reviews (id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), prescId3, '吴药师', 'PH003', 'rejected', '用药剂量过大，需要调整', 'rejected']
  );
  
  await runInsert(
    'INSERT INTO pharmacist_reviews (id, prescription_id, pharmacist_name, pharmacist_id, review_result, review_notes, status, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), prescId4, '郑药师', 'PH004', 'approved', '处方合规', 'approved']
  );
  
  await runInsert(
    'INSERT INTO payment_orders (id, consultation_id, amount, payment_method, payment_status, transaction_id, paid_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), consultId1, 58.50, 'wechat', 'paid', 'TXN20240115001']
  );
  
  await runInsert(
    'INSERT INTO payment_orders (id, consultation_id, amount, payment_method, payment_status) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), consultId2, 42.00, 'alipay', 'pending']
  );
  
  await runInsert(
    'INSERT INTO payment_orders (id, consultation_id, amount, payment_method, payment_status) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), consultId3, 35.00, 'wechat', 'pending']
  );
  
  await runInsert(
    'INSERT INTO payment_orders (id, consultation_id, amount, payment_method, payment_status, transaction_id, paid_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [uuidv4(), consultId4, 68.00, 'alipay', 'paid', 'TXN20240115004']
  );
  
  await runInsert(
    'INSERT INTO inventory_replacements (id, prescription_id, original_medicine, replacement_medicine, reason, approved_by, approved_at, status) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
    [uuidv4(), prescId4, '奥美拉唑原研', '奥美拉唑仿制药', '库存不足，药效相同', '刘医生', 'approved']
  );
  
  await runInsert(
    'INSERT INTO inventory_replacements (id, prescription_id, original_medicine, replacement_medicine, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), prescId2, '氯雷他定片', '氯雷他定胶囊', '片剂缺货', 'pending']
  );
  
  await runInsert(
    'INSERT INTO delivery_status (id, consultation_id, status, courier, tracking_number, estimated_delivery, delivered_at, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
    [uuidv4(), consultId1, 'delivered', '顺丰速运', 'SF1234567890', '2024-01-16', 'IDEMP_001']
  );
  
  await runInsert(
    'INSERT INTO delivery_status (id, consultation_id, status, courier, tracking_number, estimated_delivery, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), consultId4, 'shipping', '京东物流', 'JD9876543210', '2024-01-17', 'IDEMP_004']
  );
  
  await runInsert(
    'INSERT INTO delivery_status (id, consultation_id, status, idempotency_key) VALUES (?, ?, ?, ?)',
    [uuidv4(), consultId2, 'pending', 'IDEMP_002']
  );
  
  await runInsert(
    'INSERT INTO operation_logs (id, consultation_id, operator, operator_id, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), consultId1, '李医生', 'D001', 'create_consultation', JSON.stringify({ patient: '张三', diagnosis: '上呼吸道感染' })]
  );
  
  await runInsert(
    'INSERT INTO operation_logs (id, consultation_id, operator, operator_id, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), consultId1, '陈药师', 'PH001', 'pharmacist_review', JSON.stringify({ result: 'approved', notes: '处方合规' })]
  );
  
  await runInsert(
    'INSERT INTO operation_logs (id, consultation_id, operator, operator_id, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), consultId1, 'system', 'sys_001', 'confirm_payment', JSON.stringify({ amount: 58.50, method: 'wechat' })]
  );
  
  await runInsert(
    'INSERT INTO operation_logs (id, consultation_id, operator, operator_id, action, details) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), consultId3, '吴药师', 'PH003', 'pharmacist_review', JSON.stringify({ result: 'rejected', notes: '剂量过大' })]
  );
  
  await runInsert(
    'INSERT INTO change_history (id, record_type, record_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'pharmacist_review', prescId1, 'status', 'pending', 'approved', '陈药师']
  );
  
  await runInsert(
    'INSERT INTO change_history (id, record_type, record_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'pharmacist_review', prescId3, 'status', 'pending', 'rejected', '吴药师']
  );
  
  await runInsert(
    'INSERT INTO change_history (id, record_type, record_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), 'consultation', consultId1, 'status', 'created', 'completed', 'system']
  );
}

initDatabase().then(() => {
  return insertSampleData();
}).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
