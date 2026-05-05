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
    cb(null, `sensor-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router.post('/upload', upload.single('sensorFile'), (req, res) => {
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
        const importedCount = await importSensorData(results);
        fs.unlinkSync(filePath);
        res.json({ 
          success: true, 
          message: `成功导入 ${importedCount} 条传感器数据`,
          count: importedCount
        });
      } catch (error) {
        console.error('导入传感器数据失败:', error);
        res.status(500).json({ error: '导入数据失败: ' + error.message });
      }
    })
    .on('error', (error) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: '解析 CSV 文件失败: ' + error.message });
    });
});

function importSensorData(data) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO sensor_data (cabin_number, timestamp, temperature, humidity, source)
      VALUES (?, ?, ?, ?, ?)
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
          const timestamp = row['时间戳'] || row['timestamp'] || row['time'];
          const temperature = parseFloat(row['温度'] || row['temperature'] || row['temp']);
          const humidity = parseFloat(row['湿度'] || row['humidity'] || row['hum']);
          
          if (cabinNumber && timestamp) {
            const deck = cabinNumber.toString().charAt(0);
            
            cabinStmt.run([cabinNumber, deck]);
            stmt.run([
              cabinNumber,
              timestamp,
              isNaN(temperature) ? null : temperature,
              isNaN(humidity) ? null : humidity,
              'CSV导入'
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
  
  let query = 'SELECT * FROM sensor_data WHERE 1=1';
  const params = [];
  
  if (cabin_number) {
    query += ' AND cabin_number = ?';
    params.push(cabin_number);
  }
  
  if (start_date) {
    query += ' AND timestamp >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND timestamp <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    db.get('SELECT COUNT(*) as total FROM sensor_data', (countErr, countRow) => {
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

router.get('/cabins', (req, res) => {
  const query = `
    SELECT DISTINCT s.cabin_number, c.deck, c.type
    FROM sensor_data s
    LEFT JOIN cabins c ON s.cabin_number = c.cabin_number
    ORDER BY c.deck, s.cabin_number
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/summary', (req, res) => {
  const query = `
    SELECT 
      cabin_number,
      COUNT(*) as record_count,
      MIN(timestamp) as earliest_time,
      MAX(timestamp) as latest_time,
      AVG(temperature) as avg_temperature,
      AVG(humidity) as avg_humidity,
      MIN(temperature) as min_temperature,
      MAX(temperature) as max_temperature,
      MIN(humidity) as min_humidity,
      MAX(humidity) as max_humidity
    FROM sensor_data
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
