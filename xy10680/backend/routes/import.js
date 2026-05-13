const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const db = require('../database');
const { addTimelineEvent } = require('../utils/timeline');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/employees', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const results = [];
  const errors = [];
  
  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);
  
  bufferStream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      const successCount = 0;
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare('INSERT INTO employees (employee_id, name, department, size) VALUES (?, ?, ?, ?)');
        
        results.forEach((row, index) => {
          if (!row.employee_id || !row.name || !row.size) {
            errors.push({ row: index + 1, error: '缺少必填字段', data: row });
            return;
          }
          
          stmt.run([row.employee_id, row.name, row.department || '', row.size], function(err) {
            if (err) {
              errors.push({ row: index + 1, error: err.message, data: row });
            }
          });
        });
        
        stmt.finalize();
        
        db.run('COMMIT', async function(err) {
          if (err) {
            await addTimelineEvent('import_employees', {}, 'failed', `批量导入失败: ${err.message}`);
            return res.status(500).json({ error: err.message });
          }
          
          await addTimelineEvent('import_employees', { 
            total: results.length, 
            success: results.length - errors.length, 
            failed: errors.length 
          }, 'success', `员工批量导入完成: 成功 ${results.length - errors.length} 条`);
          
          res.json({
            total: results.length,
            success: results.length - errors.length,
            failed: errors.length,
            errors: errors
          });
        });
      });
    });
});

router.post('/inventory', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const results = [];
  const errors = [];
  
  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);
  
  bufferStream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(
          'INSERT INTO inventory (size, quantity) VALUES (?, ?) ON CONFLICT(size) DO UPDATE SET quantity = quantity + ?'
        );
        
        results.forEach((row, index) => {
          if (!row.size || !row.quantity) {
            errors.push({ row: index + 1, error: '缺少必填字段', data: row });
            return;
          }
          
          stmt.run([row.size, parseInt(row.quantity), parseInt(row.quantity)], function(err) {
            if (err) {
              errors.push({ row: index + 1, error: err.message, data: row });
            }
          });
        });
        
        stmt.finalize();
        
        db.run('COMMIT', async function(err) {
          if (err) {
            await addTimelineEvent('import_inventory', {}, 'failed', `库存导入失败: ${err.message}`);
            return res.status(500).json({ error: err.message });
          }
          
          await addTimelineEvent('import_inventory', { 
            total: results.length, 
            success: results.length - errors.length 
          }, 'success', `库存批量导入完成`);
          
          res.json({
            total: results.length,
            success: results.length - errors.length,
            failed: errors.length,
            errors: errors
          });
        });
      });
    });
});

module.exports = router;