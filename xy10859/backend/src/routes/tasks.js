const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/init');
const MaskingService = require('../utils/masking');

router.post('/create', (req, res) => {
  const { role_code, task_name, parameters, created_by } = req.body;
  
  if (!role_code || !task_name || !created_by) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  db.get('SELECT id, role_code, strategy_version FROM export_roles WHERE role_code = ? AND is_active = 1', 
    [role_code], 
    (err, role) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!role) return res.status(404).json({ error: '角色不存在' });

      const taskId = uuidv4();
      const needApproval = role_code === 'admin' ? 0 : 1;
      
      db.run(`INSERT INTO export_tasks (task_id, role_id, task_name, parameters, need_approval, created_by, status) 
              VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [taskId, role.id, task_name, JSON.stringify(parameters || {}), needApproval, created_by],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              return res.status(409).json({ error: '任务ID冲突，请重试' });
            }
            return res.status(500).json({ error: err.message });
          }
          
          res.json({ 
            task_id: taskId, 
            status: 'pending',
            need_approval: needApproval,
            strategy_version: role.strategy_version
          });
        }
      );
    }
  );
});

router.get('/list', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT t.*, r.role_code, r.role_name, r.strategy_version 
    FROM export_tasks t 
    JOIN export_roles r ON t.role_id = r.id 
  `;
  const params = [];
  
  if (status) {
    query += ' WHERE t.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);
  
  db.all(query, params, (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });
    
    tasks.forEach(t => {
      t.parameters = JSON.parse(t.parameters || '{}');
    });
    
    db.get('SELECT COUNT(*) as total FROM export_tasks', (err, count) => {
      res.json({
        tasks,
        total: count ? count.total : 0,
        page: Number(page),
        limit: Number(limit)
      });
    });
  });
});

router.get('/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  db.get(`
    SELECT t.*, r.role_code, r.role_name, r.strategy_version 
    FROM export_tasks t 
    JOIN export_roles r ON t.role_id = r.id 
    WHERE t.task_id = ?
  `, [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    
    task.parameters = JSON.parse(task.parameters || '{}');
    
    db.all('SELECT * FROM field_strategies WHERE role_id = ?', [task.role_id], (err, strategies) => {
      db.all('SELECT * FROM approval_records WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, approvals) => {
        db.all('SELECT * FROM download_logs WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, downloads) => {
          res.json({
            task,
            strategies,
            approvals,
            downloads
          });
        });
      });
    });
  });
});

router.post('/:taskId/approve', (req, res) => {
  const { taskId } = req.params;
  const { approver, comment } = req.body;
  
  db.get('SELECT * FROM export_tasks WHERE task_id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.status !== 'pending') return res.status(400).json({ error: '只能审批待处理任务' });
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO approval_records (task_id, approver, action, comment) VALUES (?, ?, 'approve', ?)`,
      [taskId, approver, comment || '']);
    
    db.run(`UPDATE export_tasks SET status = 'processing', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [approver, taskId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        db.run('COMMIT');
        
        setTimeout(() => {
          simulateExport(taskId);
        }, 2000);
        
        res.json({ task_id: taskId, status: 'processing' });
      }
    );
  });
});

router.post('/:taskId/reject', (req, res) => {
  const { taskId } = req.params;
  const { approver, comment } = req.body;
  
  db.get('SELECT * FROM export_tasks WHERE task_id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    
    db.run('BEGIN TRANSACTION');
    
    db.run(`INSERT INTO approval_records (task_id, approver, action, comment) VALUES (?, ?, 'reject', ?)`,
      [taskId, approver, comment || '']);
    
    db.run(`UPDATE export_tasks SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [taskId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ task_id: taskId, status: 'rejected' });
      }
    );
  });
});

router.post('/:taskId/retry', (req, res) => {
  const { taskId } = req.params;
  
  db.get('SELECT * FROM export_tasks WHERE task_id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.status !== 'failed') return res.status(400).json({ error: '只能重试失败任务' });
    
    db.run(`UPDATE export_tasks SET status = 'processing', retry_count = retry_count + 1, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [taskId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        setTimeout(() => {
          simulateExport(taskId);
        }, 2000);
        
        res.json({ task_id: taskId, status: 'processing', retry_count: task.retry_count + 1 });
      }
    );
  });
});

router.get('/:taskId/download', (req, res) => {
  const { taskId } = req.params;
  const { downloaded_by } = req.query;
  
  db.get(`
    SELECT t.*, r.role_code 
    FROM export_tasks t 
    JOIN export_roles r ON t.role_id = r.id 
    WHERE t.task_id = ?
  `, [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: '任务不存在' });
    if (task.status !== 'completed') return res.status(400).json({ error: '任务未完成' });
    
    db.all('SELECT * FROM field_strategies WHERE role_id = ?', [task.role_id], (err, strategies) => {
      const mockData = generateMockData();
      const maskedData = mockData.map(row => MaskingService.applyMasking(row, strategies));
      
      const violations = [];
      maskedData.forEach(row => {
        const v = MaskingService.validateViolation(row, task.role_code);
        if (v.length > 0) violations.push(...v);
      });
      
      if (violations.length > 0) {
        return res.status(403).json({ error: '违规拦截', violations });
      }
      
      db.run(`INSERT INTO download_logs (task_id, downloaded_by, download_ip) VALUES (?, ?, ?)`,
        [taskId, downloaded_by || 'unknown', req.ip]);
      
      res.json({
        filename: `export_${taskId}.csv`,
        data: maskedData,
        strategy_version: task.strategy_version
      });
    });
  });
});

router.get('/statistics/overview', (req, res) => {
  db.all(`
    SELECT status, COUNT(*) as count 
    FROM export_tasks 
    GROUP BY status
  `, (err, statusCounts) => {
    db.get('SELECT COUNT(*) as total FROM export_tasks', (err, total) => {
      db.get('SELECT COUNT(*) as today FROM export_tasks WHERE DATE(created_at) = DATE("now")', (err, today) => {
        db.get('SELECT COUNT(*) as failed FROM export_tasks WHERE status = "failed"', (err, failed) => {
          res.json({
            total: total ? total.total : 0,
            today: today ? today.today : 0,
            failed: failed ? failed.total : 0,
            status_breakdown: statusCounts || []
          });
        });
      });
    });
  });
});

function simulateExport(taskId) {
  const success = Math.random() > 0.2;
  
  if (success) {
    db.run(`UPDATE export_tasks SET status = 'completed', file_path = '/exports/' || taskId || '.csv', updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [taskId]);
  } else {
    const errors = ['数据源连接超时', '脱敏规则执行异常', '文件写入失败', '内存不足'];
    const errorMsg = errors[Math.floor(Math.random() * errors.length)];
    db.run(`UPDATE export_tasks SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?`,
      [errorMsg, taskId]);
  }
}

function generateMockData() {
  const names = ['张三', '李四', '王五', '赵六', '钱七'];
  return names.map((name, i) => ({
    id: i + 1,
    name: name,
    phone: `138${String(1000000 + i).slice(1)}`,
    id_card: `1101011990010${1000 + i}`,
    email: `user${i + 1}@example.com`
  }));
}

module.exports = router;