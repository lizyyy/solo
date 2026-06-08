const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { getDB } = require('../database');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

router.post('/batch', upload.array('files'), async (req, res) => {
  const db = getDB();
  const batchName = req.body.batchName || '批次-' + new Date().toLocaleString('zh-CN');
  
  db.run('INSERT INTO batches (name, status) VALUES (?, ?)', [batchName, 'processing'], function(err) {
    if (err) {
      return res.status(500).json({ error: '创建批次失败' });
    }
    
    const batchId = this.lastID;
    const results = [];
    const files = req.files || [];
    
    let processedCount = 0;
    
    if (files.length === 0) {
      db.run('UPDATE batches SET status = ? WHERE id = ?', ['completed', batchId]);
      return res.json({ 
        batchId, 
        message: '没有可处理的文件',
        success: true,
        results: [] 
      });
    }
    
    files.forEach((file, index) => {
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      db.run(`INSERT INTO files 
        (batch_id, filename, original_name, file_path, file_type, size, upload_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchId, file.filename, file.originalname, file.path, fileExt, file.size, 'processing'],
        function(fileErr) {
          const fileId = this.lastID;
          
          if (fileErr) {
            updateFileStatus(fileId, 'error', '数据库写入失败');
            finishFile();
            return;
          }
          
          try {
            parseFile(file.path, fileExt, batchId, fileId, (parseErr, trackResults) => {
              if (parseErr) {
                updateFileStatus(fileId, 'error', parseErr.message);
                finishFile();
                return;
              }
              
              saveTracksAndAnomalies(trackResults, batchId, fileId, () => {
                updateFileStatus(fileId, 'success', null);
                const totalAnomalies = trackResults.reduce((sum, t) => sum + t.anomalies.length, 0);
                results.push({
                  fileId,
                  originalName: file.originalname,
                  trackCount: trackResults.length,
                  anomalyCount: totalAnomalies
                });
                finishFile();
              });
            });
          } catch (e) {
            updateFileStatus(fileId, 'error', e.message);
            finishFile();
          }
        }
      );
      
      function finishFile() {
        processedCount++;
        if (processedCount === files.length) {
          db.run('UPDATE batches SET status = ? WHERE id = ?', ['completed', batchId]);
          res.json({
            batchId,
            batchName,
            success: true,
            totalFiles: files.length,
            processedFiles: results.length,
            results
          });
        }
      }
    });
  });
  
  function updateFileStatus(fileId, status, errorMsg) {
    db.run('UPDATE files SET upload_status = ?, error_message = ? WHERE id = ?', 
      [status, errorMsg, fileId]);
  }
});

function parseFile(filePath, fileExt, batchId, fileId, callback) {
  const tracks = [];
  
  if (fileExt === '.csv' || fileExt === '.txt') {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const result = parseRow(row, tracks.length + 1);
        tracks.push(result);
      })
      .on('end', () => callback(null, tracks))
      .on('error', (err) => callback(err, []));
  } else if (fileExt === '.xlsx' || fileExt === '.xls') {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      data.forEach((row, index) => {
        const result = parseRow(row, index + 1);
        tracks.push(result);
      });
      callback(null, tracks);
    } catch (e) {
      callback(e, []);
    }
  } else {
    callback(new Error('不支持的文件格式'), []);
  }
}

function parseRow(row, rowNum) {
  const track = {
    track_name: row['曲目'] || row['track_name'] || row['name'] || `曲目${rowNum}`,
    track_number: parseInt(row['序号'] || row['track_number'] || row['number'] || rowNum),
    instrument: row['乐器'] || row['instrument'] || '',
    page_count: parseInt(row['页码数'] || row['页数'] || row['page_count'] || 0),
    start_page: parseInt(row['起始页'] || row['start_page'] || 0),
    end_page: parseInt(row['结束页'] || row['end_page'] || 0),
    expected_pages: row['预期页码'] || row['expected_pages'] || ''
  };
  
  const anomalies = [];
  
  if (track.start_page && track.end_page) {
    const calculatedPages = track.end_page - track.start_page + 1;
    if (track.page_count && calculatedPages !== track.page_count) {
      anomalies.push({
        anomaly_type: '页码不匹配',
        description: `计算页数(${calculatedPages}页)与标注页数(${track.page_count}页)不一致`,
        severity: 'warning',
        suggestion: '请核对乐谱实际页数',
        evidence: `起始页:${track.start_page}, 结束页:${track.end_page}, 标注页数:${track.page_count}`
      });
      track.is_valid = false;
    }
  }
  
  if (track.page_count <= 0) {
    anomalies.push({
      anomaly_type: '页码缺失',
      description: '未标注有效页码数',
      severity: 'info',
      suggestion: '请补充页码信息',
      evidence: '页码字段为空或为0'
    });
  }
  
  return { track, anomalies };
}

function saveTracksAndAnomalies(trackResults, batchId, fileId, callback) {
  const db = getDB();
  let savedCount = 0;
  
  if (trackResults.length === 0) {
    callback();
    return;
  }
  
  trackResults.forEach((result, index) => {
    const track = result.track;
    const trackAnomalies = result.anomalies;
    
    db.run(`INSERT INTO tracks 
      (file_id, batch_id, track_name, track_number, instrument, page_count, start_page, end_page, expected_pages, is_valid, validation_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fileId, batchId, track.track_name, track.track_number, track.instrument, 
       track.page_count, track.start_page, track.end_page, track.expected_pages,
       track.is_valid !== false ? 1 : 0, track.is_valid !== false ? 'passed' : 'warning'],
      function(err) {
        const trackId = this.lastID;
        
        if (trackAnomalies.length === 0) {
          savedCount++;
          if (savedCount === trackResults.length) callback();
          return;
        }
        
        let anomalySaved = 0;
        trackAnomalies.forEach(anomaly => {
          db.run(`INSERT INTO anomalies 
            (track_id, file_id, batch_id, anomaly_type, description, severity, suggestion, evidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [trackId, fileId, batchId, anomaly.anomaly_type, anomaly.description, 
             anomaly.severity, anomaly.suggestion, anomaly.evidence],
            () => {
              anomalySaved++;
              if (anomalySaved === trackAnomalies.length) {
                savedCount++;
                if (savedCount === trackResults.length) callback();
              }
            }
          );
        });
      }
    );
  });
}

router.get('/batches', (req, res) => {
  const db = getDB();
  db.all(`SELECT b.*, 
    COUNT(DISTINCT f.id) as file_count,
    COUNT(DISTINCT t.id) as track_count,
    SUM(CASE WHEN t.is_valid = 0 THEN 1 ELSE 0 END) as issue_count
    FROM batches b
    LEFT JOIN files f ON b.id = f.batch_id
    LEFT JOIN tracks t ON b.id = t.batch_id
    GROUP BY b.id
    ORDER BY b.created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;
