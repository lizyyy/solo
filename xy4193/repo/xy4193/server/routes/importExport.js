const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const importService = require('../services/importService');
const exportService = require('../services/exportService');
const { logAudit } = require('../middleware/auditMiddleware');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许 CSV 文件'));
    }
  }
});

router.post('/import/donors', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const { operator } = req.body;
    const filePath = req.file.path;

    const validation = await importService.validateCSVFormat(filePath, ['donor_code']);
    if (!validation.valid) {
      fs.unlinkSync(filePath);
      return res.status(400).json(validation);
    }

    const result = await importService.importDonorsFromCSV(filePath, operator);
    
    fs.unlinkSync(filePath);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/blood-bags', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const { operator } = req.body;
    const filePath = req.file.path;

    const validation = await importService.validateCSVFormat(filePath, ['bag_code']);
    if (!validation.valid) {
      fs.unlinkSync(filePath);
      return res.status(400).json(validation);
    }

    const result = await importService.importBloodBagsFromCSV(filePath, operator);
    
    fs.unlinkSync(filePath);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/import/sample-tubes', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 CSV 文件' });
    }

    const { operator } = req.body;
    const filePath = req.file.path;

    const validation = await importService.validateCSVFormat(filePath, ['tube_code']);
    if (!validation.valid) {
      fs.unlinkSync(filePath);
      return res.status(400).json(validation);
    }

    const result = await importService.importSampleTubesFromCSV(filePath, operator);
    
    fs.unlinkSync(filePath);
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export/handover/:handoverCode', async (req, res) => {
  try {
    const { handoverCode } = req.params;
    const { operator } = req.body;

    const result = await exportService.exportHandoverToMarkdown(handoverCode);
    
    await logAudit('EXPORT', 'handovers', null, operator, null, { handoverCode, fileName: result.fileName }, '导出交接报告');
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
    res.send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export/audit', async (req, res) => {
  try {
    const { startTime, endTime, operator: filterOperator, operator } = req.body;

    const result = await exportService.exportAuditToJSON(startTime, endTime, filterOperator);
    
    await logAudit('EXPORT', 'audit_logs', null, operator, null, { fileName: result.fileName }, '导出审计日志');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
    res.json(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export/coldbox-timeline', async (req, res) => {
  try {
    const { boxCode, startTime, endTime, operator } = req.body;

    const result = await exportService.exportColdBoxTimeline(boxCode, startTime, endTime);
    
    await logAudit('EXPORT', 'cold_box_timeline', null, operator, null, { fileName: result.fileName }, '导出冷箱时间线');
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
    res.send(result.content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/handover/:handoverCode/download', async (req, res) => {
  try {
    const { handoverCode } = req.params;

    const result = await exportService.exportHandoverToMarkdown(handoverCode);
    
    res.download(result.filePath, result.fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/audit/download', async (req, res) => {
  try {
    const { startTime, endTime, operator: filterOperator } = req.query;

    const result = await exportService.exportAuditToJSON(startTime, endTime, filterOperator);
    
    res.download(result.filePath, result.fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
