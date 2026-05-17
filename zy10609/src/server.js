const express = require('express');
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');
const { db, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function generateApplicationNo() {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RA${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${timestamp}${random}`;
}

function checkTemplatesConflict(phone, restoreTemplates) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT template_type FROM unsubscribe_records 
      WHERE phone = ? 
      GROUP BY template_type
    `, [phone], (err, rows) => {
      if (err) return reject(err);
      
      const existingTemplates = rows.map(r => r.template_type);
      const requestTemplates = restoreTemplates.split(',');
      
      const hasMarketing = existingTemplates.includes('MARKETING');
      const onlyRequestVerification = requestTemplates.length === 1 && requestTemplates[0] === 'VERIFICATION';
      
      if (hasMarketing && onlyRequestVerification) {
        resolve({
          conflict: true,
          reason: `该号码(${phone})同时退订了【验证码短信】和【营销短信】，仅申请恢复验证码短信将导致营销短信仍被拦截。如需完整恢复请同时申请所有模板类型，或确认只需恢复验证码。`,
          existingTemplates,
          requestTemplates
        });
      } else {
        resolve({ conflict: false });
      }
    });
  });
}

function createHistoryRecord(applicationNo, operationType, operator, beforeStatus, afterStatus, remark = '') {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO operation_history (application_no, operation_type, operator, operation_time, before_status, after_status, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [applicationNo, operationType, operator, new Date().toISOString(), beforeStatus, afterStatus, remark], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

app.post('/api/restore/apply', async (req, res) => {
  try {
    const { phone, restore_templates, certificate_type, certificate_no, applicant, apply_time } = req.body;
    
    if (!phone || !restore_templates || !certificate_type || !applicant) {
      return res.status(400).json({ error: '缺少必要参数: phone, restore_templates, certificate_type, applicant' });
    }

    const conflictCheck = await checkTemplatesConflict(phone, restore_templates);
    
    const applicationNo = generateApplicationNo();
    const status = conflictCheck.conflict ? 'PENDING_MANUAL' : 'PENDING';
    
    db.run(`
      INSERT INTO restore_applications (application_no, phone, restore_templates, certificate_type, certificate_no, applicant, apply_time, status, conflict_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [applicationNo, phone, restore_templates, certificate_type, certificate_no || '', applicant, apply_time || new Date().toISOString(), status, conflictCheck.reason || ''], async function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      await createHistoryRecord(applicationNo, 'CREATE', applicant, null, status, conflictCheck.conflict ? '检测到模板冲突，转入人工处理' : '创建恢复申请');

      res.json({
        success: true,
        data: {
          id: this.lastID,
          application_no: applicationNo,
          phone,
          status,
          conflict: conflictCheck.conflict,
          conflict_reason: conflictCheck.reason
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/restore/review', (req, res) => {
  const { application_no, action, reviewer, remark } = req.body;
  
  if (!application_no || !action || !reviewer) {
    return res.status(400).json({ error: '缺少必要参数: application_no, action, reviewer' });
  }

  const validActions = ['APPROVE', 'REJECT'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'action 必须是 APPROVE 或 REJECT' });
  }

  db.get(`SELECT * FROM restore_applications WHERE application_no = ?`, [application_no], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '申请记录不存在' });
    if (row.status !== 'PENDING' && row.status !== 'PENDING_MANUAL') {
      return res.status(400).json({ error: '当前状态不允许审核' });
    }

    const newStatus = action === 'APPROVE' ? 'RESTORED' : 'REJECTED';
    
    db.run(`
      UPDATE restore_applications 
      SET status = ?, reviewer = ?, review_time = ?, review_remark = ?
      WHERE application_no = ?
    `, [newStatus, reviewer, new Date().toISOString(), remark || '', application_no], async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      await createHistoryRecord(application_no, action, reviewer, row.status, newStatus, remark || '');

      if (action === 'APPROVE') {
        const templates = row.restore_templates.split(',');
        const placeholders = templates.map(() => '?').join(',');
        db.run(`
          DELETE FROM unsubscribe_records 
          WHERE phone = ? AND template_type IN (${placeholders})
        `, [row.phone, ...templates], (err) => {
          if (err) console.error('删除退订记录失败:', err);
        });
      }

      res.json({
        success: true,
        data: {
          application_no,
          status: newStatus,
          action
        }
      });
    });
  });
});

app.get('/api/restore/list', (req, res) => {
  const { phone, status, page = 1, page_size = 20 } = req.query;
  const offset = (page - 1) * page_size;
  
  let whereClauses = [];
  let params = [];
  
  if (phone) {
    whereClauses.push('phone LIKE ?');
    params.push(`%${phone}%`);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  db.all(`SELECT * FROM restore_applications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(page_size), offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`SELECT COUNT(*) as total FROM restore_applications ${whereSql}`, params, (err, countRow) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countRow.total
        }
      });
    });
  });
});

app.get('/api/restore/:application_no', (req, res) => {
  const { application_no } = req.params;
  
  db.get(`SELECT * FROM restore_applications WHERE application_no = ?`, [application_no], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: '申请记录不存在' });
    
    res.json({
      success: true,
      data: row
    });
  });
});

app.get('/api/restore/:application_no/history', (req, res) => {
  const { application_no } = req.params;
  
  db.all(`SELECT * FROM operation_history WHERE application_no = ? ORDER BY operation_time DESC`, [application_no], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    res.json({
      success: true,
      data: rows
    });
  });
});

app.get('/api/restore/export/csv', (req, res) => {
  const { phone, status, start_date, end_date } = req.query;
  
  let whereClauses = [];
  let params = [];
  
  if (phone) {
    whereClauses.push('phone LIKE ?');
    params.push(`%${phone}%`);
  }
  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }
  if (start_date) {
    whereClauses.push('apply_time >= ?');
    params.push(start_date);
  }
  if (end_date) {
    whereClauses.push('apply_time <= ?');
    params.push(end_date);
  }
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  db.all(`SELECT * FROM restore_applications ${whereSql} ORDER BY created_at DESC`, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const fields = [
      'application_no', 'phone', 'restore_templates', 'certificate_type',
      'certificate_no', 'applicant', 'apply_time', 'status', 'reviewer',
      'review_time', 'review_remark', 'conflict_reason', 'created_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=restore_applications.csv');
    res.send('\uFEFF' + csv);
  });
});

app.get('/api/unsubscribe/list', (req, res) => {
  const { phone, page = 1, page_size = 20 } = req.query;
  const offset = (page - 1) * page_size;
  
  let whereSql = phone ? 'WHERE phone LIKE ?' : '';
  let params = phone ? [`%${phone}%`] : [];
  
  db.all(`SELECT * FROM unsubscribe_records ${whereSql} ORDER BY unsubscribe_time DESC LIMIT ? OFFSET ?`, [...params, parseInt(page_size), offset], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`SELECT COUNT(*) as total FROM unsubscribe_records ${whereSql}`, params, (err, countRow) => {
      if (err) return res.status(500).json({ error: err.message });
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          page_size: parseInt(page_size),
          total: countRow.total
        }
      });
    });
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);