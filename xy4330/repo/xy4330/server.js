const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 数据库连接
const dbPath = path.join(__dirname, 'database', 'repair.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到数据库');
  }
});

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 状态定义
const STATUS_OPTIONS = [
  '待评估',
  '评估中',
  '报价确认',
  '修复中',
  '待客户确认',
  '已交付'
];

// API 路由

// 客户相关 API
app.get('/api/customers', (req, res) => {
  db.all('SELECT * FROM customers ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/customers/:id', (req, res) => {
  db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json(row);
  });
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  const sql = 'INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)';
  
  db.run(sql, [name, phone, email, address, notes], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/customers/:id', (req, res) => {
  const { name, phone, email, address, notes } = req.body;
  const sql = 'UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?';
  
  db.run(sql, [name, phone, email, address, notes, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json({ message: '更新成功' });
  });
});

app.delete('/api/customers/:id', (req, res) => {
  db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json({ message: '删除成功' });
  });
});

// 器物相关 API
app.get('/api/artifacts', (req, res) => {
  let sql = `SELECT a.*, c.name as customer_name, c.phone as customer_phone 
             FROM artifacts a 
             LEFT JOIN customers c ON a.customer_id = c.id`;
  
  const params = [];
  const conditions = [];
  
  // 状态筛选
  if (req.query.status) {
    conditions.push('a.current_status = ?');
    params.push(req.query.status);
  }
  
  // 超期筛选
  if (req.query.overdue === 'true') {
    conditions.push('a.estimated_completion_date < ?');
    params.push(new Date().toISOString().split('T')[0]);
    conditions.push("a.current_status != '已交付'");
  }
  
  // 待确认筛选
  if (req.query.pending_confirmation === 'true') {
    conditions.push("a.current_status = '待客户确认'");
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  sql += ' ORDER BY a.updated_at DESC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/artifacts/:id', (req, res) => {
  const sql = `SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
               FROM artifacts a 
               LEFT JOIN customers c ON a.customer_id = c.id 
               WHERE a.id = ?`;
  
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '器物不存在' });
    }
    res.json(row);
  });
});

app.post('/api/artifacts', (req, res) => {
  const { customer_id, name, type, era, material, size, damage_description, estimated_completion_date } = req.body;
  const sql = `INSERT INTO artifacts (customer_id, name, type, era, material, size, damage_description, estimated_completion_date) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [customer_id, name, type, era, material, size, damage_description, estimated_completion_date], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const artifactId = this.lastID;
    
    // 添加初始状态日志
    const logSql = 'INSERT INTO status_logs (artifact_id, status, description) VALUES (?, ?, ?)';
    db.run(logSql, [artifactId, '待评估', '客户提交委托，等待评估'], (logErr) => {
      if (logErr) {
        console.error('添加状态日志失败:', logErr.message);
      }
    });
    
    res.status(201).json({ id: artifactId });
  });
});

app.put('/api/artifacts/:id', (req, res) => {
  const { name, type, era, material, size, damage_description, estimated_completion_date } = req.body;
  const sql = `UPDATE artifacts 
               SET name = ?, type = ?, era = ?, material = ?, size = ?, damage_description = ?, estimated_completion_date = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`;
  
  db.run(sql, [name, type, era, material, size, damage_description, estimated_completion_date, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '器物不存在' });
    }
    res.json({ message: '更新成功' });
  });
});

// 更新器物状态
app.put('/api/artifacts/:id/status', (req, res) => {
  const { status, description, operator } = req.body;
  
  if (!STATUS_OPTIONS.includes(status)) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  
  const updateSql = 'UPDATE artifacts SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  
  db.run(updateSql, [status, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '器物不存在' });
    }
    
    // 添加状态日志
    const logSql = 'INSERT INTO status_logs (artifact_id, status, description, operator) VALUES (?, ?, ?, ?)';
    db.run(logSql, [req.params.id, status, description, operator], (logErr) => {
      if (logErr) {
        console.error('添加状态日志失败:', logErr.message);
      }
    });
    
    res.json({ message: '状态更新成功' });
  });
});

app.delete('/api/artifacts/:id', (req, res) => {
  db.run('DELETE FROM artifacts WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '器物不存在' });
    }
    res.json({ message: '删除成功' });
  });
});

// 照片相关 API
app.get('/api/artifacts/:id/photos', (req, res) => {
  db.all('SELECT * FROM photos WHERE artifact_id = ? ORDER BY uploaded_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/artifacts/:id/photos', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  
  const { description } = req.body;
  const filePath = '/uploads/' + req.file.filename;
  const sql = 'INSERT INTO photos (artifact_id, file_path, file_name, description) VALUES (?, ?, ?, ?)';
  
  db.run(sql, [req.params.id, filePath, req.file.originalname, description], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID, file_path: filePath });
  });
});

app.delete('/api/photos/:id', (req, res) => {
  db.get('SELECT * FROM photos WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '照片不存在' });
    }
    
    // 删除文件
    const fullPath = path.join(__dirname, row.file_path);
    fs.unlink(fullPath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('删除文件失败:', unlinkErr.message);
      }
    });
    
    // 删除数据库记录
    db.run('DELETE FROM photos WHERE id = ?', [req.params.id], function(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }
      res.json({ message: '删除成功' });
    });
  });
});

// 状态日志 API
app.get('/api/artifacts/:id/status-logs', (req, res) => {
  db.all('SELECT * FROM status_logs WHERE artifact_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 报价相关 API
app.get('/api/artifacts/:id/quotes', (req, res) => {
  db.all('SELECT * FROM quotes WHERE artifact_id = ? ORDER BY created_at DESC', [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/artifacts/:id/quotes', (req, res) => {
  const { amount, description } = req.body;
  const sql = 'INSERT INTO quotes (artifact_id, amount, description) VALUES (?, ?, ?)';
  
  db.run(sql, [req.params.id, amount, description], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/quotes/:id', (req, res) => {
  const { amount, description, status } = req.body;
  const sql = 'UPDATE quotes SET amount = ?, description = ?, status = ? WHERE id = ?';
  
  db.run(sql, [amount, description, status, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '报价不存在' });
    }
    res.json({ message: '更新成功' });
  });
});

// 提醒相关 API
app.get('/api/reminders', (req, res) => {
  let sql = `SELECT r.*, a.name as artifact_name 
             FROM reminders r 
             LEFT JOIN artifacts a ON r.artifact_id = a.id`;
  
  const params = [];
  const conditions = [];
  
  if (req.query.status) {
    conditions.push('r.status = ?');
    params.push(req.query.status);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  
  sql += ' ORDER BY r.reminder_date ASC';
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/reminders', (req, res) => {
  const { artifact_id, title, description, reminder_date } = req.body;
  const sql = 'INSERT INTO reminders (artifact_id, title, description, reminder_date) VALUES (?, ?, ?, ?)';
  
  db.run(sql, [artifact_id, title, description, reminder_date], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/reminders/:id', (req, res) => {
  const { title, description, reminder_date, status } = req.body;
  const sql = 'UPDATE reminders SET title = ?, description = ?, reminder_date = ?, status = ? WHERE id = ?';
  
  db.run(sql, [title, description, reminder_date, status, req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    res.json({ message: '更新成功' });
  });
});

app.delete('/api/reminders/:id', (req, res) => {
  db.run('DELETE FROM reminders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    res.json({ message: '删除成功' });
  });
});

// 导出功能

// 导出 Markdown 修复单
app.get('/api/artifacts/:id/export/markdown', (req, res) => {
  const artifactId = req.params.id;
  
  // 获取器物信息
  const artifactSql = `SELECT a.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
                       FROM artifacts a 
                       LEFT JOIN customers c ON a.customer_id = c.id 
                       WHERE a.id = ?`;
  
  db.get(artifactSql, [artifactId], (err, artifact) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!artifact) {
      return res.status(404).json({ error: '器物不存在' });
    }
    
    // 获取状态日志
    db.all('SELECT * FROM status_logs WHERE artifact_id = ? ORDER BY created_at ASC', [artifactId], (logErr, logs) => {
      if (logErr) {
        return res.status(500).json({ error: logErr.message });
      }
      
      // 获取报价信息
      db.all('SELECT * FROM quotes WHERE artifact_id = ? ORDER BY created_at DESC', [artifactId], (quoteErr, quotes) => {
        if (quoteErr) {
          return res.status(500).json({ error: quoteErr.message });
        }
        
        // 生成 Markdown
        let markdown = `# 非遗器物修复单

## 基本信息
- **器物名称**: ${artifact.name || '-'}
- **客户姓名**: ${artifact.customer_name || '-'}
- **联系电话**: ${artifact.customer_phone || '-'}
- **电子邮箱**: ${artifact.customer_email || '-'}

## 器物详情
- **器物类型**: ${artifact.type || '-'}
- **年代**: ${artifact.era || '-'}
- **材质**: ${artifact.material || '-'}
- **尺寸**: ${artifact.size || '-'}
- **损伤描述**: ${artifact.damage_description || '-'}

## 修复状态
- **当前状态**: ${artifact.current_status || '-'}
- **预计完成日期**: ${artifact.estimated_completion_date || '-'}
- **创建时间**: ${artifact.created_at || '-'}

## 状态流转记录
`;

        if (logs.length > 0) {
          logs.forEach((log, index) => {
            markdown += `
### ${index + 1}. ${log.status}
- **时间**: ${log.created_at || '-'}
- **操作人员**: ${log.operator || '-'}
- **描述**: ${log.description || '-'}
`;
          });
        } else {
          markdown += `\n暂无状态记录\n`;
        }

        markdown += `
## 报价信息
`;

        if (quotes.length > 0) {
          quotes.forEach((quote, index) => {
            markdown += `
### 报价 ${index + 1}
- **金额**: ¥${quote.amount || 0}
- **状态**: ${quote.status || '-'}
- **描述**: ${quote.description || '-'}
- **创建时间**: ${quote.created_at || '-'}
`;
          });
        } else {
          markdown += `\n暂无报价记录\n`;
        }

        markdown += `\n---\n*此修复单由非遗器物修复委托流转台生成*`;
        
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="修复单-${artifact.name}.md"`);
        res.send(markdown);
      });
    });
  });
});

// 导出 CSV 待办清单
app.get('/api/export/todos/csv', (req, res) => {
  let sql = `SELECT a.id, a.name as artifact_name, c.name as customer_name, c.phone, 
             a.current_status, a.estimated_completion_date, a.damage_description
             FROM artifacts a 
             LEFT JOIN customers c ON a.customer_id = c.id
             WHERE a.current_status != '已交付'
             ORDER BY a.estimated_completion_date ASC`;
  
  db.all(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // 生成 CSV
    let csv = `ID,器物名称,客户姓名,联系电话,当前状态,预计完成日期,损伤描述\n`;
    
    rows.forEach(row => {
      const estimatedDate = row.estimated_completion_date || '';
      const today = new Date().toISOString().split('T')[0];
      const isOverdue = estimatedDate && estimatedDate < today;
      const status = isOverdue ? `[超期] ${row.current_status}` : row.current_status;
      
      csv += `${row.id},"${row.artifact_name || ''}","${row.customer_name || ''}","${row.phone || ''}","${status}","${estimatedDate}","${(row.damage_description || '').replace(/"/g, '""')}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="待办清单.csv"');
    // 添加 BOM 以支持中文
    res.send('\uFEFF' + csv);
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请访问 http://localhost:${PORT} 查看应用`);
});
