const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const xlsx = require('xlsx');

const upload = multer({ 
  dest: path.join(__dirname, '../../uploads'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('只支持CSV和XLSX格式文件'));
    }
  }
});

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath, { encoding: 'utf8' })
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseXLSX(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const filePath = req.file.path;
    const isCSV = req.file.originalname.endsWith('.csv');
    
    let records;
    if (isCSV) {
      records = await parseCSV(filePath);
    } else {
      records = parseXLSX(filePath);
    }

    fs.unlinkSync(filePath);

    if (records.length === 0) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [],
      total: records.length
    };

    const stmt = db.prepare(`
      INSERT INTO appointments 
      (patient_id, patient_name, phone, lab_item, lab_item_code, sampling_window,
       fasting_required, fasting_hours, appointment_date, appointment_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const patientId = record.patient_id || record['患者ID'] || `P${Date.now()}${i}`;
        const patientName = record.patient_name || record['患者姓名'];
        const phone = record.phone || record['电话'] || '';
        const labItem = record.lab_item || record['检验项目'];
        const labItemCode = record.lab_item_code || record['项目代码'] || '';
        const samplingWindow = record.sampling_window || record['采样窗口'] || '上午8:00-11:00';
        const fastingRequired = (record.fasting_required || record['空腹']) === '是' ? 1 : 0;
        const fastingHours = parseInt(record.fasting_hours || record['空腹小时'] || 0);
        const appointmentDate = record.appointment_date || record['预约日期'];
        const appointmentTime = record.appointment_time || record['预约时间'] || '08:30';
        const status = record.status || record['状态'] || 'pending';

        if (!patientName || !labItem || !appointmentDate) {
          throw new Error(`第${i+1}行：缺少必填字段（患者姓名、检验项目、预约日期）`);
        }

        stmt.run(
          patientId, patientName, phone, labItem, labItemCode,
          samplingWindow, fastingRequired, fastingHours,
          appointmentDate, appointmentTime, status
        );
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
      }
    }

    stmt.finalize();

    res.json({
      message: `导入完成：成功${results.success}条，失败${results.failed}条`,
      ...results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/template', (req, res) => {
  const template = [
    {
      '患者ID': 'P001',
      '患者姓名': '张三',
      '电话': '13800138000',
      '检验项目': '肝功能',
      '项目代码': 'LFT001',
      '采样窗口': '上午8:00-10:00',
      '空腹': '是',
      '空腹小时': 8,
      '预约日期': '2024-05-20',
      '预约时间': '08:30',
      '状态': 'pending'
    }
  ];

  const fields = Object.keys(template[0]);
  const { Parser } = require('json2csv');
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(template);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="import_template.csv"');
  res.send('\uFEFF' + csv);
});

module.exports = router;
