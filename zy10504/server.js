const express = require('express');
const bodyParser = require('body-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const db = require('./database');
const {
  generateId,
  validateRiskLevel,
  validateStatus,
  formatDate,
  getRiskLevelDescription,
  getStatusDescription,
  isWindowExpired,
  safeJsonParse
} = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const addAuditLog = (requestId, action, oldStatus, newStatus, operator, reason, originalInput, processingEvidence) => {
  return new Promise((resolve, reject) => {
    const logId = generateId();
    db.run(
      `INSERT INTO audit_logs (id, request_id, action, old_status, new_status, operator, reason, original_input, processing_evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, requestId, action, oldStatus, newStatus, operator, reason, originalInput ? JSON.stringify(originalInput) : null, processingEvidence ? JSON.stringify(processingEvidence) : null],
      (err) => {
        if (err) reject(err);
        else resolve(logId);
      }
    );
  });
};

app.post('/api/repositories', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: '仓库名称不能为空' });
  }

  const id = generateId();
  db.run(
    `INSERT INTO repositories (id, name, description) VALUES (?, ?, ?)`,
    [id, name, description],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: '仓库名称已存在' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id, name, description });
    }
  );
});

app.get('/api/repositories', (req, res) => {
  db.all(`SELECT * FROM repositories ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/freeze-rules', (req, res) => {
  const { repo_id, rule_name, freeze_start, freeze_end, allowed_users, allowed_branches, created_by } = req.body;
  
  if (!repo_id || !rule_name || !freeze_start || !freeze_end || !created_by) {
    return res.status(400).json({ error: '缺少必填字段: repo_id, rule_name, freeze_start, freeze_end, created_by' });
  }

  const id = generateId();
  db.run(
    `INSERT INTO freeze_rules (id, repo_id, rule_name, freeze_start, freeze_end, allowed_users, allowed_branches, created_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [id, repo_id, rule_name, freeze_start, freeze_end, allowed_users, allowed_branches, created_by],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, repo_id, rule_name, freeze_start, freeze_end, status: 'active' });
    }
  );
});

app.get('/api/freeze-rules', (req, res) => {
  const { repo_id, status } = req.query;
  let query = `SELECT * FROM freeze_rules`;
  let params = [];
  
  if (repo_id || status) {
    query += ` WHERE 1=1`;
    if (repo_id) {
      query += ` AND repo_id = ?`;
      params.push(repo_id);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
  }
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/exception-requests', async (req, res) => {
  const {
    repo_id,
    rule_id,
    title,
    description,
    risk_level,
    risk_description,
    requester,
    release_window_start,
    release_window_end,
    branch
  } = req.body;

  if (!repo_id || !rule_id || !title || !description || !risk_level || !risk_description || !requester) {
    return res.status(400).json({ 
      error: '缺少必填字段',
      required: ['repo_id', 'rule_id', 'title', 'description', 'risk_level', 'risk_description', 'requester']
    });
  }

  if (!validateRiskLevel(risk_level)) {
    return res.status(400).json({ error: '风险级别无效，有效值: low, medium, high, critical' });
  }

  const id = generateId();
  const originalRequest = JSON.stringify(req.body);

  db.run(
    `INSERT INTO exception_requests (id, repo_id, rule_id, title, description, risk_level, risk_description, 
                                      requester, status, release_window_start, release_window_end, branch, original_request)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [id, repo_id, rule_id, title, description, risk_level.toLowerCase(), risk_description, 
     requester, release_window_start, release_window_end, branch, originalRequest],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      try {
        await addAuditLog(
          id,
          'create',
          null,
          'pending',
          requester,
          '创建例外申请',
          req.body,
          { validation_passed: true, risk_level_validated: true }
        );
      } catch (auditErr) {
        console.error('审计日志创建失败:', auditErr);
      }

      res.status(201).json({
        id,
        title,
        status: 'pending',
        risk_level: risk_level.toLowerCase(),
        message: '申请已创建，请等待审批'
      });
    }
  );
});

app.get('/api/exception-requests', (req, res) => {
  const { repo_id, status, risk_level, requester, approver } = req.query;
  let query = `
    SELECT er.*, r.name as repo_name, fr.rule_name 
    FROM exception_requests er
    JOIN repositories r ON er.repo_id = r.id
    JOIN freeze_rules fr ON er.rule_id = fr.id
  `;
  let params = [];
  let conditions = [];

  if (repo_id) { conditions.push(`er.repo_id = ?`); params.push(repo_id); }
  if (status) { conditions.push(`er.status = ?`); params.push(status); }
  if (risk_level) { conditions.push(`er.risk_level = ?`); params.push(risk_level); }
  if (requester) { conditions.push(`er.requester = ?`); params.push(requester); }
  if (approver) { conditions.push(`er.approver = ?`); params.push(approver); }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }
  query += ` ORDER BY er.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const enriched = rows.map(row => ({
      ...row,
      risk_level_desc: getRiskLevelDescription(row.risk_level),
      status_desc: getStatusDescription(row.status),
      is_window_expired: isWindowExpired(row.release_window_end)
    }));
    
    res.json(enriched);
  });
});

app.get('/api/exception-requests/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT er.*, r.name as repo_name, fr.rule_name 
     FROM exception_requests er
     JOIN repositories r ON er.repo_id = r.id
     JOIN freeze_rules fr ON er.rule_id = fr.id
     WHERE er.id = ?`,
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: '申请不存在' });
      
      res.json({
        ...row,
        risk_level_desc: getRiskLevelDescription(row.risk_level),
        status_desc: getStatusDescription(row.status),
        is_window_expired: isWindowExpired(row.release_window_end)
      });
    }
  );
});

app.put('/api/exception-requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, operator, reason, approver, commit_hash } = req.body;

  if (!status || !operator || !reason) {
    return res.status(400).json({ error: '缺少必填字段: status, operator, reason' });
  }

  if (!validateStatus(status)) {
    return res.status(400).json({ 
      error: '状态无效', 
      valid_statuses: ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed', 'expired']
    });
  }

  db.get(`SELECT * FROM exception_requests WHERE id = ?`, [id], async (err, oldRequest) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRequest) return res.status(404).json({ error: '申请不存在' });

    const oldStatus = oldRequest.status;
    let updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    let updateParams = [status.toLowerCase()];
    
    if (approver) { updateFields.push('approver = ?'); updateParams.push(approver); }
    if (commit_hash) { updateFields.push('commit_hash = ?'); updateParams.push(commit_hash); }
    
    updateParams.push(id);

    db.run(
      `UPDATE exception_requests SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams,
      async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        try {
          await addAuditLog(
            id,
            'status_change',
            oldStatus,
            status.toLowerCase(),
            operator,
            reason,
            req.body,
            { 
              previous_status: oldStatus,
              new_status: status.toLowerCase(),
              status_flow_valid: true
            }
          );
        } catch (auditErr) {
          console.error('审计日志创建失败:', auditErr);
        }

        res.json({
          id,
          old_status: oldStatus,
          new_status: status.toLowerCase(),
          message: '状态已更新'
        });
      }
    );
  });
});

app.post('/api/exception-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approver, reason, release_window_start, release_window_end } = req.body;

  if (!approver || !reason) {
    return res.status(400).json({ error: '缺少必填字段: approver, reason' });
  }

  if (!release_window_start || !release_window_end) {
    return res.status(400).json({ error: '必须指定放行窗口时间' });
  }

  db.get(`SELECT * FROM exception_requests WHERE id = ?`, [id], async (err, request) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!request) return res.status(404).json({ error: '申请不存在' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '只有待审批状态的申请可以审批' });
    }

    const oldStatus = request.status;
    
    db.run(
      `UPDATE exception_requests 
       SET status = 'approved', approver = ?, release_window_start = ?, release_window_end = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [approver, release_window_start, release_window_end, id],
      async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        try {
          await addAuditLog(
            id,
            'approve',
            oldStatus,
            'approved',
            approver,
            reason,
            req.body,
            { 
              release_window: { start: release_window_start, end: release_window_end },
              approval_valid: true
            }
          );
        } catch (auditErr) {
          console.error('审计日志创建失败:', auditErr);
        }

        res.json({
          id,
          status: 'approved',
          approver,
          release_window_start,
          release_window_end,
          message: '申请已批准，请在放行窗口内执行修复'
        });
      }
    );
  });
});

app.put('/api/exception-requests/:id/manual-correct', async (req, res) => {
  const { id } = req.params;
  const { operator, reason, updates } = req.body;

  if (!operator || !reason || !updates) {
    return res.status(400).json({ error: '缺少必填字段: operator, reason, updates' });
  }

  const allowedUpdates = ['title', 'description', 'risk_level', 'risk_description', 'branch', 'release_window_start', 'release_window_end'];
  const updateEntries = Object.entries(updates).filter(([key]) => allowedUpdates.includes(key));
  
  if (updateEntries.length === 0) {
    return res.status(400).json({ error: '没有有效的更新字段', allowed_fields: allowedUpdates });
  }

  if (updates.risk_level && !validateRiskLevel(updates.risk_level)) {
    return res.status(400).json({ error: '风险级别无效' });
  }

  db.get(`SELECT * FROM exception_requests WHERE id = ?`, [id], async (err, oldRequest) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRequest) return res.status(404).json({ error: '申请不存在' });

    const setClauses = updateEntries.map(([key]) => `${key} = ?`);
    const values = updateEntries.map(([, value]) => value);
    values.push(id);

    db.run(
      `UPDATE exception_requests SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values,
      async function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        try {
          await addAuditLog(
            id,
            'manual_correction',
            oldRequest.status,
            oldRequest.status,
            operator,
            reason,
            req.body,
            { 
              original_values: Object.fromEntries(updateEntries.map(([key]) => [key, oldRequest[key]])),
              new_values: updates,
              corrected_fields: updateEntries.map(([key]) => key)
            }
          );
        } catch (auditErr) {
          console.error('审计日志创建失败:', auditErr);
        }

        res.json({
          id,
          corrected_fields: updateEntries.map(([key]) => key),
          message: '人工修正已完成'
        });
      }
    );
  });
});

app.post('/api/exception-requests/:id/audit-conclusion', (req, res) => {
  const { id } = req.params;
  const { conclusion, auditor, findings, recommendations } = req.body;

  if (!conclusion || !auditor) {
    return res.status(400).json({ error: '缺少必填字段: conclusion, auditor' });
  }

  const conclusionId = generateId();
  
  db.run(
    `INSERT INTO audit_conclusions (id, request_id, conclusion, auditor, findings, recommendations, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [conclusionId, id, conclusion, auditor, findings, recommendations],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: conclusionId,
        request_id: id,
        conclusion,
        auditor,
        verified_at: new Date().toISOString(),
        message: '审计结论已记录'
      });
    }
  );
});

app.get('/api/exception-requests/:id/audit-logs', (req, res) => {
  const { id } = req.params;
  
  db.all(
    `SELECT * FROM audit_logs WHERE request_id = ? ORDER BY created_at ASC`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const enriched = rows.map(row => ({
        ...row,
        original_input: safeJsonParse(row.original_input),
        processing_evidence: safeJsonParse(row.processing_evidence)
      }));
      
      res.json(enriched);
    }
  );
});

app.get('/api/export/exception-requests', (req, res) => {
  const { repo_id, status, start_date, end_date, format = 'json' } = req.query;
  
  let query = `
    SELECT 
      er.id as 申请编号,
      er.title as 申请标题,
      er.description as 问题描述,
      r.name as 代码仓库,
      fr.rule_name as 冻结规则,
      er.risk_level as 风险等级,
      er.risk_description as 风险说明,
      er.requester as 申请人,
      er.approver as 审批人,
      er.status as 当前状态,
      er.release_window_start as 放行窗口开始,
      er.release_window_end as 放行窗口结束,
      er.branch as 分支,
      er.commit_hash as 提交哈希,
      er.created_at as 申请时间,
      er.updated_at as 更新时间,
      ac.conclusion as 审计结论,
      ac.auditor as 审计人,
      ac.findings as 审计发现,
      ac.recommendations as 改进建议
    FROM exception_requests er
    JOIN repositories r ON er.repo_id = r.id
    JOIN freeze_rules fr ON er.rule_id = fr.id
    LEFT JOIN audit_conclusions ac ON er.id = ac.request_id
  `;
  
  let params = [];
  let conditions = [];

  if (repo_id) { conditions.push(`er.repo_id = ?`); params.push(repo_id); }
  if (status) { conditions.push(`er.status = ?`); params.push(status); }
  if (start_date) { conditions.push(`er.created_at >= ?`); params.push(start_date); }
  if (end_date) { conditions.push(`er.created_at <= ?`); params.push(end_date); }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }
  query += ` ORDER BY er.created_at DESC`;

  db.all(query, params, async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const formattedData = rows.map(row => ({
      ...row,
      风险等级说明: getRiskLevelDescription(row['风险等级']),
      状态说明: getStatusDescription(row['当前状态']),
      放行窗口是否过期: isWindowExpired(row['放行窗口结束']) ? '是' : '否',
      申请时间: formatDate(row['申请时间']),
      更新时间: formatDate(row['更新时间']),
      放行窗口开始: formatDate(row['放行窗口开始']),
      放行窗口结束: formatDate(row['放行窗口结束'])
    }));

    if (format === 'csv') {
      const csvWriter = createCsvWriter({
        path: '/tmp/exception_requests.csv',
        header: Object.keys(formattedData[0] || {}).map(key => ({ id: key, title: key }))
      });
      
      await csvWriter.writeRecords(formattedData);
      res.download('/tmp/exception_requests.csv', '代码冻结例外申请清单.csv');
    } else {
      res.json({
        export_time: formatDate(new Date()),
        total_count: formattedData.length,
        data: formattedData,
        summary: {
          by_status: formattedData.reduce((acc, row) => {
            const status = row['当前状态'];
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}),
          by_risk: formattedData.reduce((acc, row) => {
            const risk = row['风险等级'];
            acc[risk] = (acc[risk] || 0) + 1;
            return acc;
          }, {})
        }
      });
    }
  });
});

app.get('/api/export/audit-trails', (req, res) => {
  const { request_id, start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      al.id as 操作记录编号,
      al.request_id as 申请编号,
      er.title as 申请标题,
      al.action as 操作类型,
      al.old_status as 原状态,
      al.new_status as 新状态,
      al.operator as 操作人,
      al.reason as 操作原因,
      al.created_at as 操作时间,
      al.original_input as 原始输入,
      al.processing_evidence as 处理依据
    FROM audit_logs al
    JOIN exception_requests er ON al.request_id = er.id
  `;
  
  let params = [];
  let conditions = [];

  if (request_id) { conditions.push(`al.request_id = ?`); params.push(request_id); }
  if (start_date) { conditions.push(`al.created_at >= ?`); params.push(start_date); }
  if (end_date) { conditions.push(`al.created_at <= ?`); params.push(end_date); }

  if (conditions.length > 0) {
    query += ` WHERE ` + conditions.join(' AND ');
  }
  query += ` ORDER BY al.created_at DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const formattedData = rows.map(row => ({
      ...row,
      操作时间: formatDate(row['操作时间']),
      原状态说明: getStatusDescription(row['原状态']),
      新状态说明: getStatusDescription(row['新状态']),
      原始输入: typeof row['原始输入'] === 'string' ? safeJsonParse(row['原始输入']) : row['原始输入'],
      处理依据: typeof row['处理依据'] === 'string' ? safeJsonParse(row['处理依据']) : row['处理依据']
    }));

    res.json({
      export_time: formatDate(new Date()),
      total_count: formattedData.length,
      data: formattedData
    });
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`代码冻结例外API服务已启动: http://localhost:${PORT}`);
  console.log('');
  console.log('API 接口列表:');
  console.log('  POST /api/repositories              - 创建仓库');
  console.log('  GET  /api/repositories              - 查询仓库列表');
  console.log('  POST /api/freeze-rules              - 创建冻结规则');
  console.log('  GET  /api/freeze-rules              - 查询冻结规则');
  console.log('  POST /api/exception-requests        - 创建例外申请');
  console.log('  GET  /api/exception-requests        - 查询例外申请列表');
  console.log('  GET  /api/exception-requests/:id    - 查询单个申请详情');
  console.log('  PUT  /api/exception-requests/:id/status - 推进状态');
  console.log('  POST /api/exception-requests/:id/approve - 审批申请');
  console.log('  PUT  /api/exception-requests/:id/manual-correct - 人工修正');
  console.log('  POST /api/exception-requests/:id/audit-conclusion - 记录审计结论');
  console.log('  GET  /api/exception-requests/:id/audit-logs - 查询审计日志');
  console.log('  GET  /api/export/exception-requests - 导出申请清单 (支持 format=csv)');
  console.log('  GET  /api/export/audit-trails       - 导出审计轨迹');
  console.log('');
});
