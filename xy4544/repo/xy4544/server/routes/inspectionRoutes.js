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
    cb(null, `inspection-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router.post('/upload', upload.single('inspectionFile'), (req, res) => {
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
        const importedCount = await importInspectionData(results);
        fs.unlinkSync(filePath);
        res.json({ 
          success: true, 
          message: `成功导入 ${importedCount} 条巡检数据`,
          count: importedCount
        });
      } catch (error) {
        console.error('导入巡检数据失败:', error);
        res.status(500).json({ error: '导入数据失败: ' + error.message });
      }
    })
    .on('error', (error) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析 CSV 文件失败: ' + error.message });
    });
});

function importInspectionData(data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO inspection_data (
        cabin_number, inspection_date, inspector, fan_coil_status, 
        filter_status, condensate_pipe_status, temperature_setpoint, 
        actual_temperature, actual_humidity, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          const inspectionDate = row['巡检日期'] || row['inspection_date'] || row['date'];
          
          if (cabinNumber && inspectionDate) {
            const deck = cabinNumber.toString().charAt(0);
            
            cabinStmt.run([cabinNumber, deck]);
            stmt.run([
              cabinNumber,
              inspectionDate,
              row['巡检员'] || row['inspector'] || null,
              row['风机盘管状态'] || row['fan_coil_status'] || null,
              row['滤网状态'] || row['filter_status'] || null,
              row['冷凝水管状态'] || row['condensate_pipe_status'] || null,
              parseFloat(row['设定温度'] || row['temperature_setpoint']) || null,
              parseFloat(row['实际温度'] || row['actual_temperature']) || null,
              parseFloat(row['实际湿度'] || row['actual_humidity']) || null,
              row['备注'] || row['notes'] || null
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
  const { cabin_number, start_date, end_date, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM inspection_data WHERE 1=1';
  const params = [];
  
  if (cabin_number) {
    query += ' AND cabin_number = ?';
    params.push(cabin_number);
  }
  
  if (start_date) {
    query += ' AND inspection_date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND inspection_date <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY inspection_date DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT COUNT(*) as total FROM inspection_data', (countErr, countRow) => {
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
      cabin_number,
      COUNT(*) as inspection_count,
      MAX(inspection_date) as last_inspection,
      MIN(inspection_date) as first_inspection
    FROM inspection_data
    GROUP BY cabin_number
    ORDER BY cabin_number
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
