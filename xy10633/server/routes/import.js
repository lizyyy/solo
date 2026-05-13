const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../database/db');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/meter-readings', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const results = [];
    const errors = [];
    
    let processed = 0;
    
    const processNext = () => {
      if (processed >= data.length) {
        res.json({
          success: results.length,
          errors: errors.length,
          results,
          errors
        });
        return;
      }
      
      const row = data[processed];
      processed++;
      
      if (!row.contract_no || !row.reading_date) {
        errors.push({ row: processed, error: '缺少必要字段' });
        processNext();
        return;
      }
      
      db.get('SELECT id FROM contracts WHERE contract_no = ?', [row.contract_no], (err, contract) => {
        if (err || !contract) {
          errors.push({ row: processed, contract_no: row.contract_no, error: '合同不存在' });
          processNext();
          return;
        }
        
        const stmt = db.prepare(`INSERT INTO meter_readings 
          (contract_id, reading_date, water_prev, water_curr, water_usage, electric_prev, electric_curr, electric_usage, reader, remarks) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        stmt.run(
          contract.id,
          row.reading_date,
          row.water_prev || 0,
          row.water_curr || 0,
          row.water_usage || (row.water_curr - row.water_prev) || 0,
          row.electric_prev || 0,
          row.electric_curr || 0,
          row.electric_usage || (row.electric_curr - row.electric_prev) || 0,
          row.reader || '导入',
          row.remarks || '',
          function(err) {
            if (err) {
              errors.push({ row: processed, contract_no: row.contract_no, error: err.message });
            } else {
              results.push({ row: processed, contract_no: row.contract_no, id: this.lastID });
            }
            processNext();
          }
        );
      });
    };
    
    processNext();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tenants', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const results = [];
    const errors = [];
    
    data.forEach((row, index) => {
      if (!row.name) {
        errors.push({ row: index + 1, error: '缺少租户名称' });
        return;
      }
      
      const stmt = db.prepare('INSERT INTO tenants (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)');
      stmt.run(row.name, row.contact_person || '', row.phone || '', row.email || '', row.address || '', function(err) {
        if (err) {
          errors.push({ row: index + 1, name: row.name, error: err.message });
        } else {
          results.push({ row: index + 1, name: row.name, id: this.lastID });
        }
      });
    });
    
    res.json({
      success: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
