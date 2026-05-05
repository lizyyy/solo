const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const db = require('../database');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `complaint-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 文件'));
    }
  }
});

router.post('/upload', upload.single('complaintFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有选择文件' });
  }

  const results = [];
  const filePath = req.file.path;
  
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const importedCount = await importComplaintData(results);
        fs.unlinkSync(filePath);
        res.json({ 
          success: true, 
          message: `成功导入 ${importedCount} 条客诉数据`,
          count: importedCount
        });
      } catch (error) {
        console.error('导入客诉数据失败:', error);
        res.status(500).json({ error: '导入数据失败: ' + error.message });
      }
    })
    .on('error', (error) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析 CSV 文件失败: ' + error.message });
    });
});

function importComplaintData(data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO complaints (
        cabin_number, complaint_time, complainant, type, 
        description, status, priority, assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const cabinStmt = db.prepare(`
      INSERT OR IGNORE INTO cabins (cabin_number, deck)
      VALUES (?, ?)
    `);

    let count = 0;
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      try {
        data.forEach(row => {
          const cabinNumber = row['舱房号'] || row['cabin_number'] || row['cabin'];
          const complaintTime = row['投诉时间'] || row['complaint_time'] || row['time'];
          const type = row['投诉类型'] || row['type'] || row['complaint_type'];
          
          if (cabinNumber && complaintTime && type) {
            const deck = cabinNumber.toString().charAt(0);
            
            cabinStmt.run([cabinNumber, deck]);
            stmt.run([
              cabinNumber,
              complaintTime,
              row['投诉人'] || row['complainant'] || null,
              type,
              row['描述'] || row['description'] || null,
              row['状态'] || row['status'] || '待处理',
              row['优先级'] || row['priority'] || '普通',
              row['分配给'] || row['assigned_to'] || null
            ]);
            count++;
          }
        });
        
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            resolve(count);
          }
        });
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
}

router.get('/', (req, res) => {
  const { cabin_number, start_date, end_date, status, type, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM complaints WHERE 1=1';
  const params = [];
  
  if (cabin_number) {
    query += ' AND cabin_number = ?';
    params.push(cabin_number);
  }
  
  if (start_date) {
    query += ' AND complaint_time >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND complaint_time <= ?';
    params.push(end_date);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY complaint_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT COUNT(*) as total FROM complaints', (countErr, countRow) => {
      if (countErr) {
        res.status(500).json({ error: countErr.message });
        return;
      }
      
      res.json({
        data: rows,
        total: countRow.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    });
  });
});

router.get('/summary', (req, res) => {
  const query = `
    SELECT 
      type,
      status,
      COUNT(*) as count
    FROM complaints
    GROUP BY type, status
    ORDER BY count DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status, resolution, assigned_to } = req.body;
  
  const updates = [];
  const values = [];
  
  if (status) {
    updates.push('status = ?');
    values.push(status);
  }
  
  if (resolution) {
    updates.push('resolution = ?');
    values.push(resolution);
  }
  
  if (assigned_to) {
    updates.push('assigned_to = ?');
    values.push(assigned_to);
  }
  
  if (status === '已解决') {
    updates.push('resolved_at = DATETIME(\'now\')');
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有提供更新字段' });
  }
  
  const query = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
  values.push(id);
  
  db.run(query, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '客诉记录不存在' });
      return;
    }
    
    res.json({ success: true, message: '客诉记录已更新' });
  });
});

module.exports = router;
