const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const importService = require('./importService');
const queryService = require('./queryService');
const fixService = require('./fixService');
const exportService = require('./exportService');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 CSV 或 TXT 文件'));
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'water-quality-api'
  });
});

app.post('/api/import/:recordType', upload.single('file'), async (req, res) => {
  try {
    const { recordType } = req.params;
    const { batchNumber } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        error: '请上传文件'
      });
    }
    
    if (!batchNumber) {
      return res.status(400).json({
        error: '请提供批次号 (batchNumber)'
      });
    }
    
    const validTypes = ['water_sample', 'instrument_reading', 'recheck_note', 'sampling_point', 'instrument'];
    if (!validTypes.includes(recordType)) {
      return res.status(400).json({
        error: `无效的记录类型，有效值: ${validTypes.join(', ')}`
      });
    }
    
    const results = await importService.importFromCSV(
      req.file.path,
      recordType,
      batchNumber,
      req.file.originalname
    );
    
    fs.unlinkSync(req.file.path);
    
    res.json({
      success: true,
      batchNumber,
      recordType,
      summary: {
        total: results.total,
        success: results.success,
        updated: results.updated,
        duplicate: results.duplicate,
        rejected: results.rejected
      },
      details: results.details
    });
    
  } catch (error) {
    res.status(500).json({
      error: '导入失败',
      message: error.message
    });
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const { limit = 100, offset = 0, status } = req.query;
    
    const batches = queryService.getBatches({
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    });
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/samples', (req, res) => {
  try {
    const { batchNumber, bottleCode, limit = 100, offset = 0 } = req.query;
    
    const samples = queryService.getWaterSamples({
      batchNumber,
      bottleCode,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: samples
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/readings', (req, res) => {
  try {
    const { sampleId, readingType, limit = 100, offset = 0 } = req.query;
    
    const readings = queryService.getInstrumentReadings({
      sampleId,
      readingType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: readings
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/rechecks', (req, res) => {
  try {
    const { sampleId, batchId, limit = 100, offset = 0 } = req.query;
    
    const rechecks = queryService.getRecheckNotes({
      sampleId,
      batchId,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rechecks
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/sampling-points', (req, res) => {
  try {
    const { pointCode, limit = 100, offset = 0 } = req.query;
    
    const points = queryService.getSamplingPoints({
      pointCode,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: points
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/instruments', (req, res) => {
  try {
    const { instrumentCode, status, limit = 100, offset = 0 } = req.query;
    
    const instruments = queryService.getInstruments({
      instrumentCode,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: instruments
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/rejected', (req, res) => {
  try {
    const { batchNumber, isFixed, riskLevel, recordType, limit = 100, offset = 0 } = req.query;
    
    const rejected = queryService.getRejectedRecords({
      batchNumber,
      isFixed: isFixed !== undefined ? (isFixed === 'true' || isFixed === '1') : undefined,
      riskLevel,
      recordType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: rejected
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/rejected/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const rejected = queryService.getRejectedRecordById(id);
    
    if (!rejected) {
      return res.status(404).json({
        error: '未找到该隔离记录'
      });
    }
    
    res.json({
      success: true,
      data: rejected
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/duplicates', (req, res) => {
  try {
    const { batchNumber, bottleCode, recordType, limit = 100, offset = 0 } = req.query;
    
    const duplicates = queryService.getDuplicateRecords({
      batchNumber,
      bottleCode,
      recordType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: duplicates
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.get('/api/statistics', (req, res) => {
  try {
    const stats = queryService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.put('/api/rejected/:id/mark-fixed', (req, res) => {
  try {
    const { id } = req.params;
    const { fixedContent, fixedBy, notes } = req.body;
    
    const result = fixService.markAsFixed(id, fixedContent, fixedBy, notes);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message.includes('未找到') || error.message.includes('已被标记')) {
      return res.status(400).json({
        error: error.message
      });
    }
    res.status(500).json({
      error: '操作失败',
      message: error.message
    });
  }
});

app.put('/api/rejected/:id/recalculate-risk', (req, res) => {
  try {
    const { id } = req.params;
    const { manualOverride, riskLevel, riskScore, assessedBy, notes } = req.body;
    
    const result = fixService.recalculateRisk(id, {
      manualOverride,
      riskLevel,
      riskScore: riskScore ? parseInt(riskScore) : undefined,
      assessedBy,
      notes
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message.includes('未找到')) {
      return res.status(404).json({
        error: error.message
      });
    }
    res.status(500).json({
      error: '操作失败',
      message: error.message
    });
  }
});

app.post('/api/rejected/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await fixService.processFixedRecord(id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message.includes('未找到') || error.message.includes('尚未标记') || error.message.includes('仍然无效') || error.message.includes('重复')) {
      return res.status(400).json({
        error: error.message
      });
    }
    res.status(500).json({
      error: '处理失败',
      message: error.message
    });
  }
});

app.get('/api/rejected/:id/risk-history', (req, res) => {
  try {
    const { id } = req.params;
    
    const history = fixService.getRiskAssessmentHistory(id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      error: '查询失败',
      message: error.message
    });
  }
});

app.post('/api/rejected/bulk-recalculate-risk', (req, res) => {
  try {
    const { riskLevel, batchNumber, recordType } = req.body;
    
    const result = fixService.bulkRecalculateRisk({
      riskLevel,
      batchNumber,
      recordType
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      error: '批量操作失败',
      message: error.message
    });
  }
});

app.get('/api/export/clean', (req, res) => {
  try {
    const { batchNumber, recordType, format = 'json' } = req.query;
    
    const results = exportService.exportCleanCSV({
      batchNumber,
      recordType
    });
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="clean_${Date.now()}.csv"`);
      
      let csvContent = '';
      if (results.waterSamples && results.waterSamples.data) {
        csvContent += results.waterSamples.data + '\n\n';
      }
      if (results.instrumentReadings && results.instrumentReadings.data) {
        csvContent += results.instrumentReadings.data + '\n\n';
      }
      if (results.recheckNotes && results.recheckNotes.data) {
        csvContent += results.recheckNotes.data + '\n\n';
      }
      
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: results
      });
    }
  } catch (error) {
    res.status(500).json({
      error: '导出失败',
      message: error.message
    });
  }
});

app.get('/api/export/rejects', (req, res) => {
  try {
    const { batchNumber, isFixed, riskLevel, recordType } = req.query;
    
    const results = exportService.exportRejectsJSON({
      batchNumber,
      isFixed: isFixed !== undefined ? (isFixed === 'true' || isFixed === '1') : undefined,
      riskLevel,
      recordType
    });
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rejects_${Date.now()}.json"`);
    
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: '导出失败',
      message: error.message
    });
  }
});

app.get('/api/export/report', (req, res) => {
  try {
    const { batchNumber, includeDuplicates = true, format = 'markdown' } = req.query;
    
    const report = exportService.generateMarkdownReport({
      batchNumber,
      includeDuplicates: includeDuplicates !== 'false'
    });
    
    if (format === 'html') {
      const { marked } = require('marked');
      const html = marked.parse(report);
      
      const htmlPage = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>水质检测数据交接报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: bold; }
    h1, h2, h3, h4 { color: #333; margin-top: 30px; }
    hr { border: none; border-top: 2px solid #eee; margin: 30px 0; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report_${Date.now()}.html"`);
      res.send(htmlPage);
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report_${Date.now()}.md"`);
      res.send(report);
    }
  } catch (error) {
    res.status(500).json({
      error: '报告生成失败',
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: '文件上传错误',
      message: err.message
    });
  }
  
  res.status(500).json({
    error: '服务器错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`水质检测数据管理服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档: 请参考 README.md`);
});

module.exports = app;
