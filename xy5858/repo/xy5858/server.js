const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

function validateDate(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isFutureDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

app.get('/api/devices', (req, res) => {
  const { status, type } = req.query;
  let query = `
    SELECT d.*, 
           br.borrower, 
           br.borrow_date, 
           br.expected_return_date,
           br.id as record_id
    FROM devices d
    LEFT JOIN borrow_records br ON d.id = br.device_id AND br.status = 'borrowed'
  `;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('d.status = ?');
    params.push(status);
  }
  if (type) {
    conditions.push('d.type = ?');
    params.push(type);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY d.updated_at DESC';

  db.all(query, params, (err, devices) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(devices);
  });
});

app.get('/api/devices/types', (req, res) => {
  db.all('SELECT DISTINCT type FROM devices ORDER BY type', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const types = rows.map(row => row.type);
    res.json(types);
  });
});

app.get('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT d.*, 
           br.borrower, 
           br.borrow_date, 
           br.expected_return_date,
           br.id as record_id
    FROM devices d
    LEFT JOIN borrow_records br ON d.id = br.device_id AND br.status = 'borrowed'
    WHERE d.id = ?
  `, [id], (err, device) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!device) {
      res.status(404).json({ error: '设备不存在' });
      return;
    }
    res.json(device);
  });
});

app.post('/api/devices', (req, res) => {
  const { name, type, description } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: '设备名称和类型为必填项' });
    return;
  }

  db.run(
    'INSERT INTO devices (name, type, description, status) VALUES (?, ?, ?, ?)',
    [name, type, description || '', 'available'],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, name, type, description, status: 'available' });
    }
  );
});

app.put('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, description } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: '设备名称和类型为必填项' });
    return;
  }

  db.run(
    'UPDATE devices SET name = ?, type = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, type, description || '', id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '设备不存在' });
        return;
      }
      res.json({ id, name, type, description });
    }
  );
});

app.delete('/api/devices/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM devices WHERE id = ?', [id], (err, device) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!device) {
      res.status(404).json({ error: '设备不存在' });
      return;
    }
    if (device.status === 'borrowed') {
      res.status(400).json({ error: '该设备正在被借用，无法删除' });
      return;
    }

    db.run('DELETE FROM devices WHERE id = ?', [id], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: '设备已删除' });
    });
  });
});

app.post('/api/borrow', (req, res) => {
  const { device_id, borrower, expected_return_date, notes } = req.body;

  if (!device_id || !borrower || !expected_return_date) {
    res.status(400).json({ error: '设备ID、借用人和预计归还日期为必填项' });
    return;
  }

  if (!validateDate(expected_return_date)) {
    res.status(400).json({ error: '预计归还日期格式无效' });
    return;
  }

  db.serialize(() => {
    db.get('SELECT * FROM devices WHERE id = ?', [device_id], (err, device) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!device) {
        res.status(404).json({ error: '设备不存在' });
        return;
      }
      if (device.status !== 'available') {
        res.status(400).json({ error: '该设备不可借用' });
        return;
      }

      db.run(
        'INSERT INTO borrow_records (device_id, borrower, expected_return_date, notes) VALUES (?, ?, ?, ?)',
        [device_id, borrower, expected_return_date, notes || ''],
        function (err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          const recordId = this.lastID;

          db.run(
            'UPDATE devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['borrowed', device_id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.status(201).json({
                id: recordId,
                device_id,
                borrower,
                expected_return_date,
                notes,
                status: 'borrowed'
              });
            }
          );
        }
      );
    });
  });
});

app.post('/api/return/:id', (req, res) => {
  const { id } = req.params;

  db.serialize(() => {
    db.get('SELECT * FROM borrow_records WHERE id = ?', [id], (err, record) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!record) {
        res.status(404).json({ error: '借用记录不存在' });
        return;
      }
      if (record.status !== 'borrowed') {
        res.status(400).json({ error: '该设备已经归还' });
        return;
      }

      db.run(
        'UPDATE borrow_records SET status = ?, actual_return_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['returned', id],
        (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          db.run(
            'UPDATE devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['available', record.device_id],
            (err) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }
              res.json({ message: '设备已归还' });
            }
          );
        }
      );
    });
  });
});

app.get('/api/records', (req, res) => {
  const { device_id, status } = req.query;
  let query = `
    SELECT br.*, d.name as device_name, d.type as device_type
    FROM borrow_records br
    JOIN devices d ON br.device_id = d.id
  `;
  const params = [];
  const conditions = [];

  if (device_id) {
    conditions.push('br.device_id = ?');
    params.push(device_id);
  }
  if (status) {
    conditions.push('br.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY br.created_at DESC';

  db.all(query, params, (err, records) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(records);
  });
});

app.get('/api/devices/:id/history', (req, res) => {
  const { id } = req.params;
  db.all(`
    SELECT br.*, d.name as device_name, d.type as device_type
    FROM borrow_records br
    JOIN devices d ON br.device_id = d.id
    WHERE br.device_id = ?
    ORDER BY br.created_at DESC
  `, [id], (err, records) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(records);
  });
});

app.get('/api/reminders', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const threeDaysLater = new Date(Date.now() + 259200000).toISOString().split('T')[0];

  db.all(`
    SELECT br.*, d.name as device_name, d.type as device_type,
           CASE 
             WHEN br.expected_return_date < date('now') THEN 'overdue'
             WHEN br.expected_return_date <= date('now', '+3 days') THEN 'soon'
             ELSE 'normal'
           END as reminder_status
    FROM borrow_records br
    JOIN devices d ON br.device_id = d.id
    WHERE br.status = 'borrowed'
    ORDER BY br.expected_return_date ASC
  `, [], (err, records) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(records);
  });
});

app.post('/api/import/csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传文件' });
    return;
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const validRecords = results.filter(row => row.name && row.type);
      
      if (validRecords.length === 0) {
        fs.unlinkSync(filePath);
        res.status(400).json({ error: 'CSV 文件中没有有效的设备数据（需要 name 和 type 列）' });
        return;
      }

      const stmt = db.prepare('INSERT INTO devices (name, type, description, status) VALUES (?, ?, ?, ?)');
      let successCount = 0;

      validRecords.forEach(row => {
        try {
          stmt.run(
            row.name,
            row.type,
            row.description || row.描述 || '',
            'available'
          );
          successCount++;
        } catch (e) {
          console.error('导入失败:', e);
        }
      });
      stmt.finalize();

      fs.unlinkSync(filePath);
      res.json({ message: `成功导入 ${successCount} 条设备记录`, successCount, totalCount: validRecords.length });
    })
    .on('error', (err) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析 CSV 文件失败: ' + err.message });
    });
});

app.get('/api/export/csv', (req, res) => {
  const { type } = req.query;

  if (type === 'records') {
    db.all(`
      SELECT br.id, 
             d.name as 设备名称, 
             d.type as 设备类型,
             br.borrower as 借用人,
             br.borrow_date as 借出日期,
             br.expected_return_date as 预计归还日期,
             br.actual_return_date as 实际归还日期,
             CASE br.status WHEN 'borrowed' THEN '借用中' WHEN 'returned' THEN '已归还' ELSE br.status END as 状态,
             br.notes as 备注
      FROM borrow_records br
      JOIN devices d ON br.device_id = d.id
      ORDER BY br.created_at DESC
    `, [], (err, records) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const fields = ['id', '设备名称', '设备类型', '借用人', '借出日期', '预计归还日期', '实际归还日期', '状态', '备注'];
      const opts = { fields };

      try {
        const parser = new Parser(opts);
        const csv = parser.parse(records);
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('借用记录.csv');
        res.send('\uFEFF' + csv);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  } else {
    db.all(`
      SELECT id, 
             name as 设备名称, 
             type as 设备类型,
             description as 描述,
             CASE status WHEN 'available' THEN '可用' WHEN 'borrowed' THEN '借用中' ELSE status END as 状态,
             created_at as 创建时间,
             updated_at as 更新时间
      FROM devices
      ORDER BY created_at DESC
    `, [], (err, devices) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const fields = ['id', '设备名称', '设备类型', '描述', '状态', '创建时间', '更新时间'];
      const opts = { fields };

      try {
        const parser = new Parser(opts);
        const csv = parser.parse(devices);
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('设备列表.csv');
        res.send('\uFEFF' + csv);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请在浏览器中访问 http://localhost:${PORT}`);
});
