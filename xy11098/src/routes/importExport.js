const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const db = getDb();
const { Parser } = require('json2csv');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { AppError, errorCodes, asyncHandler } = require('../middleware/errorHandler');
const { validateSeverityLevel, checkDuplicateWarningNo } = require('../utils/validation');

router.get('/export', asyncHandler(async (req, res) => {
  const { greenhouse_id, status } = req.query;
  
  let query = 'SELECT * FROM disease_warnings WHERE 1=1';
  let params = [];
  
  if (greenhouse_id) {
    query += ' AND greenhouse_id = ?';
    params.push(greenhouse_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY detected_date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) throw err;
    
    const fields = [
      'id', 'greenhouse_id', 'warning_no', 'disease_type', 'severity_level',
      'affected_area', 'detected_date', 'reporter', 'status', 'description',
      'temperature', 'humidity', 'ph_value', 'fertilizer_used', 'pesticide_applied',
      'previous_warning_id', 'version', 'created_at', 'updated_at'
    ];
    
    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(rows);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=disease_warnings_${Date.now()}.csv`);
    res.send('\uFEFF' + csvData);
  });
}));

router.post('/import', asyncHandler(async (req, res) => {
  const { csv_content, operator } = req.body;
  
  if (!csv_content) {
    throw new AppError('缺少CSV内容', 400, 'MISSING_CSV_CONTENT');
  }
  
  if (!operator) {
    throw new AppError('必须提供操作人信息', 400, 'OPERATOR_REQUIRED');
  }
  
  const results = [];
  const errors = [];
  const successRows = [];
  
  const bufferStream = new Readable();
  bufferStream.push(csv_content);
  bufferStream.push(null);
  
  bufferStream
    .pipe(csv({ headers: true }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const rowNumber = i + 2;
        
        try {
          if (!row.greenhouse_id || !row.warning_no || !row.disease_type || 
              !row.severity_level || !row.affected_area || !row.detected_date || !row.reporter) {
            throw new Error('缺少必填字段');
          }
          
          validateSeverityLevel(row.severity_level);
          
          try {
            await checkDuplicateWarningNo(row.warning_no);
          } catch (e) {
            throw new Error('预警编号已存在');
          }
          
          const id = row.id || `WARN-IMPORT-${Date.now()}-${i}`;
          
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO disease_warnings 
              (id, greenhouse_id, warning_no, disease_type, severity_level, affected_area,
               detected_date, reporter, status, description, temperature, humidity,
               ph_value, fertilizer_used, pesticide_applied, version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
              id, row.greenhouse_id, row.warning_no, row.disease_type,
              row.severity_level, parseFloat(row.affected_area),
              row.detected_date, row.reporter, row.status || 'pending',
              row.description, parseFloat(row.temperature) || null,
              parseFloat(row.humidity) || null, parseFloat(row.ph_value) || null,
              row.fertilizer_used, row.pesticide_applied
            ], function(err) {
              if (err) reject(err);
              else resolve();
            });
          });
          
          successRows.push({
            rowNumber,
            warningNo: row.warning_no,
            id,
            status: 'success'
          });
          
        } catch (error) {
          errors.push({
            rowNumber,
            rowData: row,
            error: error.message,
            status: 'error'
          });
        }
      }
      
      res.json({
        success: true,
        summary: {
          totalRows: results.length,
          successCount: successRows.length,
          errorCount: errors.length
        },
        successRows,
        errorRows: errors,
        message: `导入完成：成功${successRows.length}条，失败${errors.length}条`
      });
    });
}));

router.get('/template', asyncHandler(async (req, res) => {
  const templateData = [{
    greenhouse_id: 'GH-001',
    warning_no: '2024-GH001-DIS-001',
    disease_type: '白粉病',
    severity_level: 'medium',
    affected_area: 150.5,
    detected_date: '2024-05-10 08:30:00',
    reporter: '张农艺师',
    status: 'pending',
    description: '叶片表面有白色粉状物',
    temperature: 22.5,
    humidity: 78,
    ph_value: 6.2,
    fertilizer_used: '复合肥NPK 15-15-15',
    pesticide_applied: ''
  }, {
    greenhouse_id: 'GH-001',
    warning_no: '2024-GH001-DIS-002',
    disease_type: '黑斑病',
    severity_level: 'high',
    affected_area: 280.0,
    detected_date: '2024-05-12 14:20:00',
    reporter: '李技术员',
    status: 'pending',
    description: '这是一条坏行示例 - 预警编号重复',
    temperature: 25.0,
    humidity: 85,
    ph_value: 5.8,
    fertilizer_used: '有机肥',
    pesticide_applied: ''
  }];
  
  const fields = [
    'greenhouse_id', 'warning_no', 'disease_type', 'severity_level',
    'affected_area', 'detected_date', 'reporter', 'status', 'description',
    'temperature', 'humidity', 'ph_value', 'fertilizer_used', 'pesticide_applied'
  ];
  
  const json2csvParser = new Parser({ fields });
  const csvData = json2csvParser.parse(templateData);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=warning_import_template.csv');
  res.send('\uFEFF' + csvData);
}));

module.exports = router;