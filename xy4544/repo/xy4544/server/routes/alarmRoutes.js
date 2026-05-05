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
    cb(null, `alarm-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router.post('/upload', upload.single('alarmFile'), (req, res) => {
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
        const importedCount = await importAlarmData(results);
        fs.unlinkSync(filePath);
        res.json({ 
          success: true, 
          message: `成功导入 ${importedCount} 条报警数据`,
          count: importedCount
        });
      } catch (error) {
        console.error('导入报警数据失败:', error);
        res.status(500).json({ error: '导入数据失败: ' + error.message });
      }
    })
    .on('error', (error) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析 CSV 文件失败: ' + error.message });
    });
});

function importAlarmData(data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO alarm_data (
        cabin_number, alarm_type, alarm_time, alarm_level, 
        description, status
      ) VALUES (?, ?, ?, ?, ?, ?)
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
          const alarmTime = row['报警时间'] || row['alarm_time'] || row['time'];
          const alarmType = row['报警类型'] || row['alarm_type'] || row['type'];
          
          if (cabinNumber && alarmTime && alarmType) {
            const deck = cabinNumber.toString().charAt(0);
            
            cabinStmt.run([cabinNumber, deck]);
            stmt.run([
              cabinNumber,
              alarmType,
              alarmTime,
              row['报警级别'] || row['alarm_level'] || '普通',
              row['描述'] || row['description'] || null,
              row['状态'] || row['status'] || '未确认'
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
  const { cabin_number, start_date, end_date, status, alarm_type, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM alarm_data WHERE 1=1';
  const params = [];
  
  if (cabin_number) {
    query += ' AND cabin_number = ?';
    params.push(cabin_number);
  }
  
  if (start_date) {
    query += ' AND alarm_time >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND alarm_time <= ?';
    params.push(end_date);
  }
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  if (alarm_type) {
    query += ' AND alarm_type = ?';
    params.push(alarm_type);
  }
  
  query += ' ORDER BY alarm_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT COUNT(*) as total FROM alarm_data', (countErr, countRow) => {
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
      alarm_type,
      status,
      COUNT(*) as count
    FROM alarm_data
    GROUP BY alarm_type, status
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

router.put('/:id/acknowledge', (req, res) => {
  const { id } = req.params;
  const { acknowledged_by } = req.body;
  
  const query = `
    UPDATE alarm_data 
    SET status = '已确认', acknowledged_by = ?, acknowledged_at = DATETIME('now')
    WHERE id = ?
  `;
  
  db.run(query, [acknowledged_by || '系统', id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '报警记录不存在' });
      return;
    }
    
    res.json({ success: true, message: '报警已确认' });
  });
});

module.exports = router;
