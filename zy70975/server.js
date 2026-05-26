const express = require('express');
const { Parser } = require('json2csv');
const { db, generateContentHash } = require('./db');

const app = express();
app.use(express.json({ limit: '10mb' }));

const ACTIVITY_TYPES = ['parent_child', 'elderly'];
const STATUS_TYPES = ['pending', 'approved', 'rejected', 'cancelled'];

function generateBatchNo() {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-8);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BATCH${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}${timestamp}${random}`;
}

function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

app.post('/api/submissions', wrapAsync(async (req, res) => {
  const { submitter, community, applications } = req.body;

  if (!submitter || !community || !applications || !Array.isArray(applications)) {
    return res.status(400).json({ error: '缺少必要参数: submitter, community, applications' });
  }

  if (applications.length === 0) {
    return res.status(400).json({ error: '申请列表不能为空' });
  }

  const contentHash = generateContentHash({ submitter, community, applications });

  const existingSubmission = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM submissions WHERE content_hash = ?', [contentHash], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (existingSubmission) {
    const existingApplications = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM applications WHERE submission_id = ?', [existingSubmission.id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return res.json({
      isDuplicate: true,
      message: '检测到重复提交，返回原有处理结果',
      submission: existingSubmission,
      applications: existingApplications
    });
  }

  const batchNo = generateBatchNo();

  const submissionId = await new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO submissions (batch_no, content_hash, submitter, community, total_applications) VALUES (?, ?, ?, ?, ?)',
      [batchNo, contentHash, submitter, community, applications.length],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  const insertedApplications = [];
  for (const app of applications) {
    const { applicant_name, id_card, phone, activity_type, relationship, remark } = app;

    if (!applicant_name || !id_card || !phone || !activity_type) {
      return res.status(400).json({ error: '申请人信息不完整' });
    }

    if (!ACTIVITY_TYPES.includes(activity_type)) {
      return res.status(400).json({ error: `活动类型必须是: ${ACTIVITY_TYPES.join(', ')}` });
    }

    const appId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO applications 
         (submission_id, applicant_name, id_card, phone, activity_type, relationship, status, last_handler, remark) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [submissionId, applicant_name, id_card, phone, activity_type, relationship || null, submitter, remark || null],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_logs 
         (application_id, operator, operation_type, old_status, new_status, old_remark, new_remark, reason) 
         VALUES (?, ?, 'create', NULL, 'pending', NULL, ?, '初始提交')`,
        [appId, submitter, remark || null],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    const insertedApp = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM applications WHERE id = ?', [appId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    insertedApplications.push(insertedApp);
  }

  const newSubmission = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM submissions WHERE id = ?', [submissionId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  res.status(201).json({
    isDuplicate: false,
    message: '提交成功',
    submission: newSubmission,
    applications: insertedApplications
  });
}));

app.put('/api/applications/:id/status', wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { status, operator, reason, remark } = req.body;

  if (!status || !operator || !reason) {
    return res.status(400).json({ error: '缺少必要参数: status, operator, reason' });
  }

  if (!STATUS_TYPES.includes(status)) {
    return res.status(400).json({ error: `状态必须是: ${STATUS_TYPES.join(', ')}` });
  }

  const existingApp = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM applications WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!existingApp) {
    return res.status(404).json({ error: '申请记录不存在' });
  }

  const oldStatus = existingApp.status;
  const oldRemark = existingApp.remark;

  if (oldStatus === status && oldRemark === remark) {
    return res.json({ message: '状态未变更', application: existingApp });
  }

  const updates = [];
  const params = [];

  updates.push('status = ?');
  params.push(status);

  if (remark !== undefined) {
    updates.push('remark = ?');
    params.push(remark);
  }

  updates.push('last_handler = ?');
  params.push(operator);

  updates.push('last_handle_time = CURRENT_TIMESTAMP');

  if (status === 'cancelled') {
    updates.push('cancel_time = CURRENT_TIMESTAMP');
  }

  params.push(id);

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE applications SET ${updates.join(', ')} WHERE id = ?`,
      params,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO audit_logs 
       (application_id, operator, operation_type, old_status, new_status, old_remark, new_remark, reason) 
       VALUES (?, ?, 'status_change', ?, ?, ?, ?, ?)`,
      [id, operator, oldStatus, status, oldRemark, remark || null, reason],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  const updatedApp = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM applications WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  res.json({
    message: '状态更新成功',
    application: updatedApp
  });
}));

app.get('/api/applications/:id/audit-logs', wrapAsync(async (req, res) => {
  const { id } = req.params;

  const logs = await new Promise((resolve, reject) => {
    db.all(
      `SELECT al.*, a.applicant_name, a.activity_type 
       FROM audit_logs al 
       JOIN applications a ON al.application_id = a.id 
       WHERE al.application_id = ? 
       ORDER BY al.operate_time DESC`,
      [id],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  res.json({ logs });
}));

app.get('/api/submissions', wrapAsync(async (req, res) => {
  const { community, activity_type, status, start_date, end_date, page = 1, page_size = 20 } = req.query;

  const where = [];
  const params = [];

  if (community) {
    where.push('s.community = ?');
    params.push(community);
  }

  if (activity_type) {
    where.push('a.activity_type = ?');
    params.push(activity_type);
  }

  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }

  if (start_date) {
    where.push('s.submit_time >= ?');
    params.push(start_date);
  }

  if (end_date) {
    where.push('s.submit_time <= ?');
    params.push(end_date);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * page_size;

  const countResult = await new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(DISTINCT s.id) as total 
       FROM submissions s 
       LEFT JOIN applications a ON s.id = a.submission_id 
       ${whereClause}`,
      params,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  const submissions = await new Promise((resolve, reject) => {
    db.all(
      `SELECT s.*, 
              COUNT(a.id) as total_applications,
              SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
              SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
              SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
              SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
       FROM submissions s 
       LEFT JOIN applications a ON s.id = a.submission_id 
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.submit_time DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  res.json({
    total: countResult.total,
    page: parseInt(page),
    page_size: parseInt(page_size),
    data: submissions
  });
}));

app.get('/api/submissions/:id', wrapAsync(async (req, res) => {
  const { id } = req.params;

  const submission = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM submissions WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!submission) {
    return res.status(404).json({ error: '提交批次不存在' });
  }

  const applications = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM applications WHERE submission_id = ? ORDER BY id', [id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  res.json({ submission, applications });
}));

app.get('/api/statistics', wrapAsync(async (req, res) => {
  const { community, start_date, end_date } = req.query;

  const where = [];
  const params = [];

  if (community) {
    where.push('s.community = ?');
    params.push(community);
  }

  if (start_date) {
    where.push('s.submit_time >= ?');
    params.push(start_date);
  }

  if (end_date) {
    where.push('s.submit_time <= ?');
    params.push(end_date);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const stats = await new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(a.id) as total_applications,
        SUM(CASE WHEN a.activity_type = 'parent_child' THEN 1 ELSE 0 END) as parent_child_total,
        SUM(CASE WHEN a.activity_type = 'elderly' THEN 1 ELSE 0 END) as elderly_total,
        SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_total,
        SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) as approved_total,
        SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_total,
        SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_total
       FROM submissions s 
       LEFT JOIN applications a ON s.id = a.submission_id 
       ${whereClause}`,
      params,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  const byCommunity = await new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        s.community,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(a.id) as application_count,
        SUM(CASE WHEN a.activity_type = 'parent_child' THEN 1 ELSE 0 END) as parent_child_count,
        SUM(CASE WHEN a.activity_type = 'elderly' THEN 1 ELSE 0 END) as elderly_count,
        SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
       FROM submissions s 
       LEFT JOIN applications a ON s.id = a.submission_id 
       ${whereClause}
       GROUP BY s.community
       ORDER BY application_count DESC`,
      params,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  res.json({ summary: stats, by_community: byCommunity });
}));

app.get('/api/export', wrapAsync(async (req, res) => {
  const { community, activity_type, status, start_date, end_date, format = 'json' } = req.query;

  const where = [];
  const params = [];

  if (community) {
    where.push('s.community = ?');
    params.push(community);
  }

  if (activity_type) {
    where.push('a.activity_type = ?');
    params.push(activity_type);
  }

  if (status) {
    where.push('a.status = ?');
    params.push(status);
  }

  if (start_date) {
    where.push('a.register_time >= ?');
    params.push(start_date);
  }

  if (end_date) {
    where.push('a.register_time <= ?');
    params.push(end_date);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const exportData = await new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        s.batch_no,
        s.community,
        s.submitter as batch_submitter,
        s.submit_time,
        a.id as application_id,
        a.applicant_name,
        a.id_card,
        a.phone,
        a.activity_type,
        a.relationship,
        a.status,
        a.register_time,
        a.cancel_time,
        a.last_handler,
        a.last_handle_time,
        a.remark,
        CASE a.activity_type 
          WHEN 'parent_child' THEN '亲子课' 
          WHEN 'elderly' THEN '老人课' 
          ELSE a.activity_type 
        END as activity_type_name,
        CASE a.status 
          WHEN 'pending' THEN '待处理' 
          WHEN 'approved' THEN '已通过' 
          WHEN 'rejected' THEN '已拒绝' 
          WHEN 'cancelled' THEN '已取消' 
          ELSE a.status 
        END as status_name
       FROM applications a 
       JOIN submissions s ON a.submission_id = s.id 
       ${whereClause}
       ORDER BY s.submit_time DESC, a.id ASC`,
      params,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  if (format === 'csv') {
    const fields = [
      'batch_no', 'community', 'batch_submitter', 'submit_time',
      'application_id', 'applicant_name', 'id_card', 'phone',
      'activity_type_name', 'relationship', 'status_name',
      'register_time', 'cancel_time', 'last_handler', 'last_handle_time', 'remark'
    ];
    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(exportData);
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="waitlist_export_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ error: 'CSV导出失败', details: err.message });
    }
  } else {
    res.json({
      total: exportData.length,
      data: exportData
    });
  }
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`社区活动名额候补API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
