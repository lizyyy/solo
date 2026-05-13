const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const dbModule = require('./database');

const app = express();
const PORT = 3003;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

function now() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function generateBatchNo() {
  const d = new Date();
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0') +
    d.getHours().toString().padStart(2, '0') +
    d.getMinutes().toString().padStart(2, '0') +
    d.getSeconds().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CC${dateStr}${rand}`;
}

function generateReportNo() {
  const d = new Date();
  const dateStr = d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0') +
    d.getHours().toString().padStart(2, '0') +
    d.getMinutes().toString().padStart(2, '0') +
    d.getSeconds().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TR${dateStr}${rand}`;
}

function addAuditLog(recordId, action, operator, operatorRole, detail) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (record_id, action, operator, operator_role, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(recordId, action, operator, operatorRole, detail || null, now());
}

function determineStatus(temp, min, max) {
  if (temp === null || temp === undefined) return 'pending';
  if (temp >= min && temp <= max) return 'normal';
  return 'abnormal';
}

function getRecordIdByBatchNo(batch_no) {
  const row = db.prepare('SELECT id FROM sign_records WHERE batch_no = ?').get(batch_no);
  return row ? row.id : null;
}

app.get('/api/records', (req, res) => {
  const { status } = req.query;
  let query = 'SELECT * FROM sign_records ORDER BY created_at DESC';
  let params = [];
  if (status) {
    query = 'SELECT * FROM sign_records WHERE status = ? ORDER BY created_at DESC';
    params = [status];
  }
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

app.get('/api/records/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sign_records WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Record not found' });
  res.json(row);
});

app.post('/api/records', (req, res) => {
  const { product_name, quantity, driver_name, warehouse_name, customer_name, expected_temp_min, expected_temp_max, actual_temp } = req.body;
  const batch_no = generateBatchNo();
  const currentTime = now();
  const status = actual_temp !== undefined && actual_temp !== null ? determineStatus(actual_temp, expected_temp_min, expected_temp_max) : 'pending';
  const is_abnormal = status === 'abnormal' ? 1 : 0;

  try {
    db.prepare(`
      INSERT INTO sign_records (batch_no, product_name, quantity, driver_name, warehouse_name, customer_name, sign_time, expected_temp_min, expected_temp_max, actual_temp, status, is_abnormal, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batch_no,
      product_name,
      quantity,
      driver_name,
      warehouse_name,
      customer_name,
      currentTime,
      expected_temp_min,
      expected_temp_max,
      actual_temp !== undefined ? actual_temp : null,
      status,
      is_abnormal,
      currentTime,
      currentTime
    );

    const record = db.prepare('SELECT * FROM sign_records WHERE batch_no = ?').get(batch_no);
    if (record) {
      addAuditLog(record.id, '创建签收记录', customer_name, 'customer', `批次号: ${batch_no}`);
    }
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/records/:id', (req, res) => {
  const { actual_temp, status, is_abnormal } = req.body;
  const record = db.prepare('SELECT * FROM sign_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const currentTime = now();
  let newStatus = status;
  let newIsAbnormal = is_abnormal;

  if (actual_temp !== undefined && actual_temp !== null) {
    newStatus = determineStatus(actual_temp, record.expected_temp_min, record.expected_temp_max);
    newIsAbnormal = newStatus === 'abnormal' ? 1 : 0;
  }

  db.prepare(`
    UPDATE sign_records SET actual_temp = ?, status = ?, is_abnormal = ?, updated_at = ? WHERE id = ?
  `).run(actual_temp !== undefined ? actual_temp : record.actual_temp, newStatus || record.status, newIsAbnormal !== undefined ? newIsAbnormal : record.is_abnormal, currentTime, req.params.id);
  addAuditLog(req.params.id, '更新签收记录', 'system', 'system', `状态更新为: ${newStatus || record.status}`);

  const updated = db.prepare('SELECT * FROM sign_records WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.get('/api/records/:id/temp-evidence', (req, res) => {
  const rows = db.prepare('SELECT * FROM temp_evidence WHERE record_id = ? ORDER BY upload_time DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/records/:id/temp-evidence', (req, res) => {
  const { temp, source, uploader, remark } = req.body;
  const currentTime = now();
  db.prepare(`
    INSERT INTO temp_evidence (record_id, temp, source, uploader, upload_time, remark, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, temp, source, uploader, currentTime, remark || null, currentTime);
  addAuditLog(req.params.id, '上传温度证据', uploader, source, `温度: ${temp}°C`);

  const record = db.prepare('SELECT * FROM sign_records WHERE id = ?').get(req.params.id);
  if (record) {
    const newStatus = determineStatus(temp, record.expected_temp_min, record.expected_temp_max);
    if (newStatus !== record.status) {
      db.prepare('UPDATE sign_records SET status = ?, is_abnormal = ?, updated_at = ? WHERE id = ?').run(
        newStatus, newStatus === 'abnormal' ? 1 : 0, currentTime, req.params.id
      );
    }
  }

  const evidenceList = db.prepare('SELECT * FROM temp_evidence WHERE record_id = ? AND upload_time = ?').all(req.params.id, currentTime);
  const evidence = evidenceList[evidenceList.length - 1] || null;
  res.status(201).json(evidence);
});

app.get('/api/records/:id/transfers', (req, res) => {
  const rows = db.prepare('SELECT * FROM responsibility_transfer WHERE record_id = ? ORDER BY transfer_time DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/records/:id/transfers', (req, res) => {
  const { from_role, from_user, to_role, to_user, reason } = req.body;
  const currentTime = now();
  db.prepare(`
    INSERT INTO responsibility_transfer (record_id, from_role, from_user, to_role, to_user, reason, status, transfer_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, from_role, from_user, to_role, to_user, reason, 'pending', currentTime);
  addAuditLog(req.params.id, '责任流转', from_user, from_role, `流转至: ${to_role} - ${to_user}`);

  const list = db.prepare('SELECT * FROM responsibility_transfer WHERE record_id = ? AND transfer_time = ?').all(req.params.id, currentTime);
  const transfer = list[list.length - 1] || null;
  res.status(201).json(transfer);
});

app.put('/api/transfers/:id', (req, res) => {
  const { status } = req.body;
  const transfer = db.prepare('SELECT * FROM responsibility_transfer WHERE id = ?').get(req.params.id);
  if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

  const currentTime = now();
  db.prepare('UPDATE responsibility_transfer SET status = ?, transfer_time = ? WHERE id = ?').run(status, currentTime, req.params.id);
  addAuditLog(transfer.record_id, `责任流转${status === 'accepted' ? '接受' : status === 'rejected' ? '拒绝' : '更新'}`, transfer.to_user, transfer.to_role, `原由: ${transfer.reason}`);

  const updated = db.prepare('SELECT * FROM responsibility_transfer WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.get('/api/records/:id/reviews', (req, res) => {
  const rows = db.prepare('SELECT * FROM supplementary_review WHERE record_id = ? ORDER BY submit_time DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/records/:id/reviews', (req, res) => {
  const { submitter, submit_role, content } = req.body;
  const currentTime = now();
  db.prepare(`
    INSERT INTO supplementary_review (record_id, submitter, submit_role, content, review_status, submit_time)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, submitter, submit_role, content, 'pending', currentTime);
  addAuditLog(req.params.id, '提交补录审核', submitter, submit_role, '提交补录申请');

  const list = db.prepare('SELECT * FROM supplementary_review WHERE record_id = ? AND submit_time = ?').all(req.params.id, currentTime);
  const review = list[list.length - 1] || null;
  res.status(201).json(review);
});

app.put('/api/reviews/:id', (req, res) => {
  const { review_status, reviewer, review_remark } = req.body;
  const review = db.prepare('SELECT * FROM supplementary_review WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const currentTime = now();
  db.prepare(`
    UPDATE supplementary_review SET review_status = ?, reviewer = ?, review_remark = ?, review_time = ?
    WHERE id = ?
  `).run(review_status, reviewer, review_remark || null, currentTime, req.params.id);
  addAuditLog(review.record_id, `补录审核${review_status === 'approved' ? '通过' : review_status === 'rejected' ? '拒绝' : '更新'}`, reviewer, 'admin', `审核备注: ${review_remark || '无'}`);

  const updated = db.prepare('SELECT * FROM supplementary_review WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.get('/api/records/:id/messages', (req, res) => {
  const rows = db.prepare('SELECT * FROM messages WHERE record_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
});

app.post('/api/records/:id/messages', (req, res) => {
  const { sender, sender_role, content } = req.body;
  const currentTime = now();
  db.prepare(`
    INSERT INTO messages (record_id, sender, sender_role, content, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, sender, sender_role, content, 0, currentTime);
  addAuditLog(req.params.id, '发送消息', sender, sender_role, `消息内容: ${content}`);

  const list = db.prepare('SELECT * FROM messages WHERE record_id = ? AND created_at = ?').all(req.params.id, currentTime);
  const message = list[list.length - 1] || null;
  res.status(201).json(message);
});

app.put('/api/messages/:id/read', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  res.json(msg);
});

app.get('/api/records/:id/report', (req, res) => {
  const row = db.prepare('SELECT * FROM trace_reports WHERE record_id = ?').get(req.params.id);
  res.json(row || null);
});

app.post('/api/records/:id/report', (req, res) => {
  const { root_cause, responsibility, action_plan, generated_by } = req.body;
  const report_no = generateReportNo();
  const currentTime = now();

  try {
    db.prepare(`
      INSERT INTO trace_reports (record_id, report_no, root_cause, responsibility, action_plan, generated_by, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, report_no, root_cause, responsibility, action_plan, generated_by, currentTime);
    addAuditLog(req.params.id, '生成追溯报告', generated_by, 'admin', `报告号: ${report_no}`);

    db.prepare('UPDATE sign_records SET status = ?, updated_at = ? WHERE id = ?').run('resolved', currentTime, req.params.id);

    const report = db.prepare('SELECT * FROM trace_reports WHERE report_no = ?').get(report_no);
    res.status(201).json(report);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/records/:id/audit-logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
});

app.get('/api/stats', (req, res) => {
  const totalResult = db.prepare('SELECT COUNT(*) as count FROM sign_records').get();
  const normalResult = db.prepare("SELECT COUNT(*) as count FROM sign_records WHERE status = 'normal'").get();
  const abnormalResult = db.prepare("SELECT COUNT(*) as count FROM sign_records WHERE status = 'abnormal'").get();
  const pendingResult = db.prepare("SELECT COUNT(*) as count FROM sign_records WHERE status = 'pending'").get();
  const resolvedResult = db.prepare("SELECT COUNT(*) as count FROM sign_records WHERE status = 'resolved'").get();
  
  const total = totalResult ? (totalResult.count || 0) : 0;
  const normal = normalResult ? (normalResult.count || 0) : 0;
  const abnormal = abnormalResult ? (abnormalResult.count || 0) : 0;
  const pending = pendingResult ? (pendingResult.count || 0) : 0;
  const resolved = resolvedResult ? (resolvedResult.count || 0) : 0;
  
  res.json({ total, normal, abnormal, pending, resolved });
});

(async () => {
  try {
    db = await dbModule.initDb();
    app.listen(PORT, () => {
      console.log(`冷链签收异常协同台运行在: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('初始化数据库失败:', e);
    process.exit(1);
  }
})();
