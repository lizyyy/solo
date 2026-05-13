const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5001;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function generateReferralNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ZZ${year}${month}${day}${random}`;
}

function asyncQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function asyncRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/patients', async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 10 } = req.query;
    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR id_card LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await asyncQuery(countSql, params);
    const total = countResult[0].total;

    sql += ' ORDER BY create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const patients = await asyncQuery(sql, params);
    res.json({ success: true, data: patients, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const { name, id_card, gender, age, phone, address } = req.body;
    const id = uuidv4();
    await asyncRun(
      'INSERT INTO patients (id, name, id_card, gender, age, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, id_card, gender, age, phone, address]
    );
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/referral-orders', async (req, res) => {
  try {
    const { keyword, status, source_hospital, target_hospital, date_range, page = 1, pageSize = 10 } = req.query;
    let sql = `
      SELECT ro.*, p.name as patient_name, p.phone as patient_phone, p.gender as patient_gender, p.age as patient_age
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ' AND (ro.referral_no LIKE ? OR p.name LIKE ? OR p.phone LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }
    if (status) {
      sql += ' AND ro.status = ?';
      params.push(status);
    }
    if (source_hospital) {
      sql += ' AND ro.source_hospital = ?';
      params.push(source_hospital);
    }
    if (target_hospital) {
      sql += ' AND ro.target_hospital = ?';
      params.push(target_hospital);
    }
    if (date_range && date_range.length === 2) {
      sql += ' AND ro.create_time BETWEEN ? AND ?';
      params.push(date_range[0], date_range[1]);
    }

    const countSql = sql.replace(/SELECT[^FROM]+FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await asyncQuery(countSql, params);
    const total = countResult[0].total;

    sql += ' ORDER BY ro.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const orders = await asyncQuery(sql, params);
    res.json({ success: true, data: orders, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/referral-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await asyncQuery(
      `SELECT ro.*, p.name as patient_name, p.phone as patient_phone, p.gender as patient_gender, p.age as patient_age, p.address as patient_address, p.id_card as patient_id_card
       FROM referral_orders ro
       LEFT JOIN patients p ON ro.patient_id = p.id
       WHERE ro.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '转诊单不存在' });
    }

    const order = orders[0];
    const appointments = await asyncQuery('SELECT * FROM appointments WHERE referral_order_id = ? ORDER BY create_time DESC', [id]);
    const examResults = await asyncQuery('SELECT * FROM exam_results WHERE referral_order_id = ? ORDER BY create_time DESC', [id]);
    const exceptions = await asyncQuery('SELECT * FROM exceptions WHERE referral_order_id = ? ORDER BY create_time DESC', [id]);
    const logs = await asyncQuery('SELECT * FROM operation_logs WHERE referral_order_id = ? ORDER BY create_time DESC', [id]);

    res.json({
      success: true,
      data: {
        ...order,
        appointments,
        examResults,
        exceptions,
        logs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/referral-orders', async (req, res) => {
  try {
    const {
      patient_id, patient_info,
      source_hospital, source_department, source_doctor,
      target_hospital, target_department, target_doctor,
      referral_reason, initial_diagnosis, referral_time
    } = req.body;

    let patientId = patient_id;
    if (!patientId && patient_info) {
      patientId = uuidv4();
      await asyncRun(
        'INSERT INTO patients (id, name, id_card, gender, age, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [patientId, patient_info.name, patient_info.id_card, patient_info.gender, patient_info.age, patient_info.phone, patient_info.address]
      );
    }

    const id = uuidv4();
    const referralNo = generateReferralNo();

    await asyncRun(
      `INSERT INTO referral_orders 
       (id, patient_id, referral_no, source_hospital, source_department, source_doctor, 
        target_hospital, target_department, target_doctor, referral_reason, initial_diagnosis, 
        status, referral_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, patientId, referralNo, source_hospital, source_department, source_doctor,
        target_hospital, target_department, target_doctor, referral_reason, initial_diagnosis,
        'pending', referral_time]
    );

    await asyncRun(
      'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, 'create', '创建转诊单', '系统']
    );

    res.json({ success: true, data: { id, referral_no: referralNo } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/referral-orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, visit_time, check_time, report_time, close_time } = req.body;

    const currentOrders = await asyncQuery('SELECT * FROM referral_orders WHERE id = ?', [id]);
    if (currentOrders.length === 0) {
      return res.status(404).json({ success: false, message: '转诊单不存在' });
    }
    const currentOrder = currentOrders[0];

    if (status) {
      const statusFlow = {
        'pending': ['accepted', 'cancelled'],
        'accepted': ['checking', 'cancelled'],
        'checking': ['reported', 'cancelled'],
        'reported': ['closed', 'cancelled'],
        'closed': [],
        'cancelled': []
      };

      const validNextStatuses = statusFlow[currentOrder.status] || [];
      if (!validNextStatuses.includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `状态流转不合法：当前状态为"${currentOrder.status}"，不允许直接变更为"${status}"` 
        });
      }

      if (status === 'checking') {
        const appointments = await asyncQuery(
          'SELECT COUNT(*) as count FROM appointments WHERE referral_order_id = ? AND status IN ("scheduled", "ongoing", "completed")',
          [id]
        );
        if (appointments[0].count === 0) {
          return res.status(400).json({ 
            success: false, 
            message: '必须先创建预约才能进入检查中状态' 
          });
        }
      }

      if (status === 'reported') {
        const exams = await asyncQuery(
          'SELECT COUNT(*) as count FROM exam_results WHERE referral_order_id = ?',
          [id]
        );
        if (exams[0].count === 0) {
          return res.status(400).json({ 
            success: false, 
            message: '必须上传检查结果才能进入已出报告状态' 
          });
        }
      }

      if (status === 'closed') {
        const exams = await asyncQuery(
          'SELECT COUNT(*) as count FROM exam_results WHERE referral_order_id = ?',
          [id]
        );
        if (exams[0].count === 0) {
          return res.status(400).json({ 
            success: false, 
            message: '必须有检查结果才能闭环' 
          });
        }

        const unhandledExceptions = await asyncQuery(
          'SELECT COUNT(*) as count FROM exceptions WHERE referral_order_id = ? AND handled = 0',
          [id]
        );
        if (unhandledExceptions[0].count > 0) {
          return res.status(400).json({ 
            success: false, 
            message: '存在未处理的异常，请先处理所有异常后再闭环' 
          });
        }
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (visit_time) {
      updateFields.push('visit_time = ?');
      updateValues.push(visit_time);
    }
    if (check_time) {
      updateFields.push('check_time = ?');
      updateValues.push(check_time);
    }
    if (report_time) {
      updateFields.push('report_time = ?');
      updateValues.push(report_time);
    }
    if (close_time) {
      updateFields.push('close_time = ?');
      updateValues.push(close_time);
    }

    updateFields.push('update_time = CURRENT_TIMESTAMP');
    updateValues.push(id);

    await asyncRun(`UPDATE referral_orders SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    const statusText = {
      'pending': '待接诊',
      'accepted': '已接诊',
      'checking': '检查中',
      'reported': '已出报告',
      'closed': '已闭环',
      'cancelled': '已取消'
    };

    await asyncRun(
      'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), id, 'status_change', `状态变更为：${statusText[status] || status}`, '系统']
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/appointments/check-conflict', async (req, res) => {
  try {
    const { dept_name, appointment_time, bed_no, exclude_id } = req.query;
    
    if (!dept_name || !appointment_time) {
      return res.json({ success: true, data: { hasConflict: false } });
    }

    const appointmentDate = new Date(appointment_time);
    const startDate = new Date(appointmentDate.getTime() - 30 * 60 * 1000);
    const endDate = new Date(appointmentDate.getTime() + 30 * 60 * 1000);

    let sql = `
      SELECT a.*, ro.referral_no, p.name as patient_name
      FROM appointments a
      LEFT JOIN referral_orders ro ON a.referral_order_id = ro.id
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE a.dept_name = ? 
        AND a.appointment_time BETWEEN ? AND ?
        AND a.status != 'cancelled'
    `;
    const params = [dept_name, startDate.toISOString(), endDate.toISOString()];

    if (exclude_id) {
      sql += ' AND a.id != ?';
      params.push(exclude_id);
    }

    if (bed_no) {
      sql += ' AND a.bed_no = ?';
      params.push(bed_no);
    }

    const conflicts = await asyncQuery(sql, params);

    res.json({ 
      success: true, 
      data: { 
        hasConflict: conflicts.length > 0,
        conflicts 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const { referral_order_id, status, page = 1, pageSize = 10 } = req.query;
    let sql = `
      SELECT a.*, ro.referral_no, p.name as patient_name
      FROM appointments a
      LEFT JOIN referral_orders ro ON a.referral_order_id = ro.id
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (referral_order_id) {
      sql += ' AND a.referral_order_id = ?';
      params.push(referral_order_id);
    }
    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    const countSql = sql.replace(/SELECT[^FROM]+FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await asyncQuery(countSql, params);
    const total = countResult[0].total;

    sql += ' ORDER BY a.appointment_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const appointments = await asyncQuery(sql, params);
    res.json({ success: true, data: appointments, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { referral_order_id, appointment_time, check_type, check_item, dept_name, bed_no } = req.body;

    if (!referral_order_id || !appointment_time || !check_type || !check_item || !dept_name) {
      return res.status(400).json({ success: false, message: '必填参数不完整' });
    }

    const appointmentDate = new Date(appointment_time);
    const startDate = new Date(appointmentDate.getTime() - 30 * 60 * 1000);
    const endDate = new Date(appointmentDate.getTime() + 30 * 60 * 1000);

    let conflictSql = `
      SELECT a.*, ro.referral_no, p.name as patient_name
      FROM appointments a
      LEFT JOIN referral_orders ro ON a.referral_order_id = ro.id
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE a.dept_name = ? 
        AND a.appointment_time BETWEEN ? AND ?
        AND a.status != 'cancelled'
        AND a.referral_order_id != ?
    `;
    let conflictParams = [dept_name, startDate.toISOString(), endDate.toISOString(), referral_order_id];

    if (bed_no) {
      conflictSql += ' AND a.bed_no = ?';
      conflictParams.push(bed_no);
    }

    const conflicts = await asyncQuery(conflictSql, conflictParams);
    if (conflicts.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `该时间段存在预约冲突，冲突患者：${conflicts[0].patient_name} (${conflicts[0].referral_no})`,
        conflicts
      });
    }

    const id = uuidv4();
    await asyncRun(
      `INSERT INTO appointments 
       (id, referral_order_id, appointment_time, check_type, check_item, dept_name, bed_no, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, referral_order_id, appointment_time, check_type, check_item, dept_name, bed_no, 'scheduled']
    );

    await asyncRun(
      'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), referral_order_id, 'appointment_create', `预约${check_type}：${check_item}，时间：${appointment_time}`, '系统']
    );

    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/exam-results/upload', upload.single('report_file'), async (req, res) => {
  try {
    const { referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, abnormal_flag, abnormal_desc } = req.body;
    const report_file = req.file ? `/uploads/${req.file.filename}` : null;

    if (!referral_order_id || !exam_type || !exam_name || !exam_time || !exam_doctor) {
      return res.status(400).json({ success: false, message: '必填参数不完整' });
    }

    if (!exam_result && !report_file) {
      return res.status(400).json({ success: false, message: '请填写检查结果或上传报告文件' });
    }

    const id = uuidv4();
    await asyncRun(
      `INSERT INTO exam_results 
       (id, referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, report_file, abnormal_flag, abnormal_desc) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, report_file, parseInt(abnormal_flag || 0), abnormal_desc]
    );

    await asyncRun(
      'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), referral_order_id, 'exam_upload', `上传${exam_type}：${exam_name}${report_file ? '（含报告文件）' : ''}`, '系统']
    );

    if (parseInt(abnormal_flag) === 1) {
      await asyncRun(
        `INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) 
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), referral_order_id, 'exam_abnormal', 'warning', abnormal_desc || '检查结果异常']
      );
    }

    res.json({ success: true, data: { id, report_file } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, check_result, report_url } = req.body;

    const updateFields = ['status = ?', 'update_time = CURRENT_TIMESTAMP'];
    const updateValues = [status];

    if (check_result) {
      updateFields.push('check_result = ?');
      updateValues.push(check_result);
    }
    if (report_url) {
      updateFields.push('report_url = ?');
      updateValues.push(report_url);
    }

    updateValues.push(id);

    await asyncRun(`UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

    const appointments = await asyncQuery('SELECT referral_order_id FROM appointments WHERE id = ?', [id]);
    if (appointments.length > 0) {
      const statusText = {
        'scheduled': '已预约',
        'ongoing': '进行中',
        'completed': '已完成',
        'cancelled': '已取消'
      };

      await asyncRun(
        'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), appointments[0].referral_order_id, 'appointment_status', `预约状态变更为：${statusText[status] || status}`, '系统']
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/exam-results', async (req, res) => {
  try {
    const { referral_order_id, abnormal_flag, page = 1, pageSize = 10 } = req.query;
    let sql = `
      SELECT er.*, ro.referral_no, p.name as patient_name
      FROM exam_results er
      LEFT JOIN referral_orders ro ON er.referral_order_id = ro.id
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (referral_order_id) {
      sql += ' AND er.referral_order_id = ?';
      params.push(referral_order_id);
    }
    if (abnormal_flag !== undefined) {
      sql += ' AND er.abnormal_flag = ?';
      params.push(parseInt(abnormal_flag));
    }

    const countSql = sql.replace(/SELECT[^FROM]+FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await asyncQuery(countSql, params);
    const total = countResult[0].total;

    sql += ' ORDER BY er.exam_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const results = await asyncQuery(sql, params);
    res.json({ success: true, data: results, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/exam-results', async (req, res) => {
  try {
    const { referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, report_file, abnormal_flag, abnormal_desc } = req.body;
    const id = uuidv4();

    await asyncRun(
      `INSERT INTO exam_results 
       (id, referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, report_file, abnormal_flag, abnormal_desc) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, referral_order_id, exam_type, exam_name, exam_time, exam_doctor, exam_result, report_file, parseInt(abnormal_flag || 0), abnormal_desc]
    );

    await asyncRun(
      'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), referral_order_id, 'exam_upload', `上传${exam_type}：${exam_name}`, '系统']
    );

    if (parseInt(abnormal_flag) === 1) {
      await asyncRun(
        `INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) 
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), referral_order_id, 'exam_abnormal', 'warning', abnormal_desc || '检查结果异常']
      );
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/exceptions', async (req, res) => {
  try {
    const { referral_order_id, handled, page = 1, pageSize = 10 } = req.query;
    let sql = `
      SELECT e.*, ro.referral_no, p.name as patient_name
      FROM exceptions e
      LEFT JOIN referral_orders ro ON e.referral_order_id = ro.id
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (referral_order_id) {
      sql += ' AND e.referral_order_id = ?';
      params.push(referral_order_id);
    }
    if (handled !== undefined) {
      sql += ' AND e.handled = ?';
      params.push(parseInt(handled));
    }

    const countSql = sql.replace(/SELECT[^FROM]+FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await asyncQuery(countSql, params);
    const total = countResult[0].total;

    sql += ' ORDER BY e.create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const exceptions = await asyncQuery(sql, params);
    res.json({ success: true, data: exceptions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/exceptions/:id/handle', async (req, res) => {
  try {
    const { id } = req.params;
    const { handle_user, handle_result } = req.body;

    await asyncRun(
      'UPDATE exceptions SET handled = 1, handle_time = CURRENT_TIMESTAMP, handle_user = ?, handle_result = ?, update_time = CURRENT_TIMESTAMP WHERE id = ?',
      [handle_user, handle_result, id]
    );

    const exceptions = await asyncQuery('SELECT referral_order_id FROM exceptions WHERE id = ?', [id]);
    if (exceptions.length > 0) {
      await asyncRun(
        'INSERT INTO operation_logs (id, referral_order_id, operation_type, operation_content, operator) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), exceptions[0].referral_order_id, 'exception_handle', `异常处理：${handle_result}`, handle_user]
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/patient-history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;

    const countSql = 'SELECT COUNT(*) as total FROM referral_orders WHERE patient_id = ?';
    const countResult = await asyncQuery(countSql, [patientId]);
    const total = countResult[0].total;

    const orders = await asyncQuery(
      `SELECT * FROM referral_orders WHERE patient_id = ? ORDER BY create_time DESC LIMIT ? OFFSET ?`,
      [patientId, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)]
    );

    res.json({ success: true, data: orders, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let dateFilter = '1=1';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'create_time BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const totalOrders = await asyncQuery(`SELECT COUNT(*) as count FROM referral_orders WHERE ${dateFilter}`, params);
    const statusCounts = await asyncQuery(`SELECT status, COUNT(*) as count FROM referral_orders WHERE ${dateFilter} GROUP BY status`, params);
    const sourceHospitalCounts = await asyncQuery(`SELECT source_hospital, COUNT(*) as count FROM referral_orders WHERE ${dateFilter} GROUP BY source_hospital`, params);
    const targetHospitalCounts = await asyncQuery(`SELECT target_hospital, COUNT(*) as count FROM referral_orders WHERE ${dateFilter} GROUP BY target_hospital`, params);
    const departmentCounts = await asyncQuery(`SELECT target_department, COUNT(*) as count FROM referral_orders WHERE ${dateFilter} GROUP BY target_department`, params);

    const pendingOrders = statusCounts.find(s => s.status === 'pending')?.count || 0;
    const acceptedOrders = statusCounts.find(s => s.status === 'accepted')?.count || 0;
    const checkingOrders = statusCounts.find(s => s.status === 'checking')?.count || 0;
    const reportedOrders = statusCounts.find(s => s.status === 'reported')?.count || 0;
    const closedOrders = statusCounts.find(s => s.status === 'closed')?.count || 0;

    const unhandledExceptions = await asyncQuery('SELECT COUNT(*) as count FROM exceptions WHERE handled = 0', []);
    const exceptionCounts = await asyncQuery('SELECT exception_type, COUNT(*) as count FROM exceptions GROUP BY exception_type', []);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalOrders[0].count,
          pending: pendingOrders,
          accepted: acceptedOrders,
          checking: checkingOrders,
          reported: reportedOrders,
          closed: closedOrders,
          unhandled_exceptions: unhandledExceptions[0].count,
          closure_rate: totalOrders[0].count > 0 ? ((closedOrders / totalOrders[0].count) * 100).toFixed(1) : 0
        },
        by_status: statusCounts,
        by_source_hospital: sourceHospitalCounts,
        by_target_hospital: targetHospitalCounts,
        by_department: departmentCounts,
        by_exception_type: exceptionCounts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/export/referral-orders', async (req, res) => {
  try {
    const { keyword, status, source_hospital, target_hospital, date_range, format = 'csv' } = req.query;
    let sql = `
      SELECT ro.referral_no, p.name as patient_name, p.gender, p.age, p.phone,
             ro.source_hospital, ro.source_department, ro.target_hospital, ro.target_department,
             ro.referral_reason, ro.initial_diagnosis, ro.status, ro.referral_time,
             ro.visit_time, ro.check_time, ro.report_time, ro.close_time, ro.create_time
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (keyword) {
      sql += ' AND (ro.referral_no LIKE ? OR p.name LIKE ? OR p.phone LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }
    if (status) {
      sql += ' AND ro.status = ?';
      params.push(status);
    }
    if (source_hospital) {
      sql += ' AND ro.source_hospital = ?';
      params.push(source_hospital);
    }
    if (target_hospital) {
      sql += ' AND ro.target_hospital = ?';
      params.push(target_hospital);
    }
    if (date_range && date_range.length === 2) {
      sql += ' AND ro.create_time BETWEEN ? AND ?';
      params.push(date_range[0], date_range[1]);
    }

    sql += ' ORDER BY ro.create_time DESC';

    const data = await asyncQuery(sql, params);

    const statusMap = {
      'pending': '待接诊',
      'accepted': '已接诊',
      'checking': '检查中',
      'reported': '已出报告',
      'closed': '已闭环',
      'cancelled': '已取消'
    };

    data.forEach(item => {
      item.status = statusMap[item.status] || item.status;
    });

    if (format === 'csv') {
      const fields = [
        'referral_no', 'patient_name', 'gender', 'age', 'phone',
        'source_hospital', 'source_department', 'target_hospital', 'target_department',
        'referral_reason', 'initial_diagnosis', 'status', 'referral_time',
        'visit_time', 'check_time', 'report_time', 'close_time', 'create_time'
      ];
      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=referral_orders_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, '转诊单数据');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=referral_orders_${Date.now()}.xlsx`);
      res.send(buffer);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/import/referral-orders', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    const statusMap = {
      '待接诊': 'pending',
      '已接诊': 'accepted',
      '检查中': 'checking',
      '已出报告': 'reported',
      '已闭环': 'closed',
      '已取消': 'cancelled'
    };

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const row of data) {
      try {
        const patientId = uuidv4();
        await asyncRun(
          'INSERT OR IGNORE INTO patients (id, name, id_card, gender, age, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [patientId, row.patient_name, row.id_card, row.gender, row.age, row.phone, row.address]
        );

        const orderId = uuidv4();
        const referralNo = generateReferralNo();

        await asyncRun(
          `INSERT INTO referral_orders 
           (id, patient_id, referral_no, source_hospital, source_department, source_doctor,
            target_hospital, target_department, target_doctor, referral_reason, initial_diagnosis,
            status, referral_time) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, patientId, referralNo, row.source_hospital, row.source_department, row.source_doctor || '',
            row.target_hospital, row.target_department, row.target_doctor || '', row.referral_reason,
            row.initial_diagnosis, statusMap[row.status] || 'pending', row.referral_time]
        );

        successCount++;
      } catch (e) {
        failCount++;
        errors.push(`行 ${successCount + failCount}: ${e.message}`);
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({ success: true, data: { successCount, failCount, errors } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today} 00:00:00`;
    const todayEnd = `${today} 23:59:59`;

    const todayOrders = await asyncQuery(
      'SELECT COUNT(*) as count FROM referral_orders WHERE create_time BETWEEN ? AND ?',
      [todayStart, todayEnd]
    );

    const pendingOrders = await asyncQuery(
      "SELECT COUNT(*) as count FROM referral_orders WHERE status = 'pending'",
      []
    );

    const checkingOrders = await asyncQuery(
      "SELECT COUNT(*) as count FROM referral_orders WHERE status = 'checking'",
      []
    );

    const unhandledExceptions = await asyncQuery(
      'SELECT COUNT(*) as count FROM exceptions WHERE handled = 0',
      []
    );

    const recentExceptions = await asyncQuery(
      `SELECT e.*, ro.referral_no, p.name as patient_name
       FROM exceptions e
       LEFT JOIN referral_orders ro ON e.referral_order_id = ro.id
       LEFT JOIN patients p ON ro.patient_id = p.id
       WHERE e.handled = 0
       ORDER BY e.create_time DESC
       LIMIT 5`,
      []
    );

    const recentOrders = await asyncQuery(
      `SELECT ro.*, p.name as patient_name
       FROM referral_orders ro
       LEFT JOIN patients p ON ro.patient_id = p.id
       ORDER BY ro.create_time DESC
       LIMIT 10`,
      []
    );

    res.json({
      success: true,
      data: {
        today_orders: todayOrders[0].count,
        pending_orders: pendingOrders[0].count,
        checking_orders: checkingOrders[0].count,
        unhandled_exceptions: unhandledExceptions[0].count,
        recent_exceptions: recentExceptions,
        recent_orders: recentOrders
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function checkExceptions() {
  console.log('[系统] 开始检查异常...');
  const now = new Date();
  
  try {
    const pendingVisitOrders = await asyncQuery(`
      SELECT ro.*, p.name as patient_name
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE ro.status = 'pending' 
        AND ro.referral_time IS NOT NULL
        AND ro.referral_time < ?
    `, [new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()]);

    for (const order of pendingVisitOrders) {
      const existing = await asyncQuery(
        'SELECT * FROM exceptions WHERE referral_order_id = ? AND exception_type = ? AND handled = 0',
        [order.id, 'no_visit']
      );
      
      if (existing.length === 0) {
        await asyncRun(
          'INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), order.id, 'no_visit', 'danger', 
            `转诊单超过24小时未接诊，请确认患者${order.patient_name}是否到诊（转诊单号：${order.referral_no}）`]
        );
        console.log(`[异常] 未接诊预警: ${order.referral_no} - ${order.patient_name}`);
      }
    }

    const acceptedOrders = await asyncQuery(`
      SELECT ro.*, p.name as patient_name
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE ro.status = 'accepted' 
        AND ro.visit_time IS NOT NULL
        AND ro.visit_time < ?
    `, [new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()]);

    for (const order of acceptedOrders) {
      const existing = await asyncQuery(
        'SELECT * FROM exceptions WHERE referral_order_id = ? AND exception_type = ? AND handled = 0',
        [order.id, 'no_exam']
      );
      
      if (existing.length === 0) {
        await asyncRun(
          'INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), order.id, 'no_exam', 'warning', 
            `接诊已超过72小时未安排检查，患者${order.patient_name}（转诊单号：${order.referral_no}）`]
        );
        console.log(`[异常] 未检查预警: ${order.referral_no} - ${order.patient_name}`);
      }
    }

    const checkingOrders = await asyncQuery(`
      SELECT ro.*, p.name as patient_name
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE ro.status = 'checking' 
        AND ro.check_time IS NOT NULL
        AND ro.check_time < ?
    `, [new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString()]);

    for (const order of checkingOrders) {
      const existing = await asyncQuery(
        'SELECT * FROM exceptions WHERE referral_order_id = ? AND exception_type = ? AND handled = 0',
        [order.id, 'no_report']
      );
      
      if (existing.length === 0) {
        await asyncRun(
          'INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), order.id, 'no_report', 'danger', 
            `检查已超过5天未回传报告，患者${order.patient_name}（转诊单号：${order.referral_no}），请联系上级医院追要报告`]
        );
        console.log(`[异常] 未回传预警: ${order.referral_no} - ${order.patient_name}`);
      }
    }

    const timeoutOrders = await asyncQuery(`
      SELECT ro.*, p.name as patient_name
      FROM referral_orders ro
      LEFT JOIN patients p ON ro.patient_id = p.id
      WHERE ro.status IN ('pending', 'accepted', 'checking', 'reported') 
        AND ro.create_time < ?
    `, [new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()]);

    for (const order of timeoutOrders) {
      const existing = await asyncQuery(
        'SELECT * FROM exceptions WHERE referral_order_id = ? AND exception_type = ? AND handled = 0',
        [order.id, 'timeout']
      );
      
      if (existing.length === 0) {
        await asyncRun(
          'INSERT INTO exceptions (id, referral_order_id, exception_type, exception_level, exception_content) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), order.id, 'timeout', 'warning', 
            `转诊单已创建超过30天未闭环，患者${order.patient_name}（转诊单号：${order.referral_no}），请及时跟进处理`]
        );
        console.log(`[异常] 超时预警: ${order.referral_no} - ${order.patient_name}`);
      }
    }

    console.log('[系统] 异常检查完成');
  } catch (error) {
    console.error('[系统] 异常检查出错:', error.message);
  }
}

app.post('/api/exception-check/run', async (req, res) => {
  try {
    await checkExceptions();
    res.json({ success: true, message: '异常检查完成' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/exception-rules', (req, res) => {
  res.json({
    success: true,
    data: [
      { type: 'no_visit', name: '未到诊', level: 'danger', desc: '转诊超过24小时未接诊', timeout_hours: 24 },
      { type: 'no_exam', name: '未检查', level: 'warning', desc: '接诊超过72小时未安排检查', timeout_hours: 72 },
      { type: 'no_report', name: '未回传', level: 'danger', desc: '检查超过5天未回传报告', timeout_hours: 120 },
      { type: 'timeout', name: '超时断链', level: 'warning', desc: '创建超过30天未闭环', timeout_hours: 720 },
      { type: 'exam_abnormal', name: '检查异常', level: 'warning', desc: '检查结果异常' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  checkExceptions();
  setInterval(checkExceptions, 30 * 60 * 1000);
});
