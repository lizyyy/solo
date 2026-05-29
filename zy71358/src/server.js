const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const MetadataAuditor = require('./auditor');
const AuditReporter = require('./reporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const uploadDir = path.join(__dirname, '../uploads');
const reportsDir = path.join(__dirname, '../reports');
[uploadDir, reportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'nft-metadata-audit', version: '1.0.0' });
});

app.post('/api/audit', upload.array('images', 100), async (req, res) => {
  try {
    let items = [];
    
    if (req.body.items) {
      try {
        items = typeof req.body.items === 'string' 
          ? JSON.parse(req.body.items) 
          : req.body.items;
      } catch (e) {
        return res.status(400).json({ error: 'items 格式错误，需为JSON数组' });
      }
    }
    
    if (req.files && req.files.length > 0) {
      const imageMap = new Map();
      req.files.forEach(file => {
        const baseName = path.basename(file.originalname, path.extname(file.originalname));
        imageMap.set(baseName, file.path);
        imageMap.set(file.originalname, file.path);
      });
      
      items = items.map(item => {
        const possibleKeys = [item.tokenId, item.id, item.name];
        for (const key of possibleKeys) {
          if (key && imageMap.has(String(key))) {
            return { ...item, imagePath: imageMap.get(String(key)) };
          }
        }
        if (items.length === req.files.length) {
          const idx = items.indexOf(item);
          if (idx >= 0 && idx < req.files.length) {
            return { ...item, imagePath: req.files[idx].path };
          }
        }
        return item;
      });
    }
    
    if (items.length === 0) {
      return res.status(400).json({ error: '未提供审计数据，请在items字段中传入JSON数组' });
    }
    
    const auditor = new MetadataAuditor({
      strictMode: req.query.strict !== 'false'
    });
    
    const results = await auditor.auditBatch(items);
    
    const reporter = new AuditReporter(results, reportsDir);
    const jsonReport = reporter.exportJson();
    
    res.json({
      success: true,
      auditId: results.auditId,
      summary: auditor.getSummary(),
      anomalies: results.anomalies,
      reportPath: jsonReport.path,
      fullResults: results
    });
    
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: '审计失败', details: error.message });
  }
});

app.post('/api/audit/json', async (req, res) => {
  try {
    const { items, options = {} } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: '需要提供 items 数组' });
    }
    
    const auditor = new MetadataAuditor(options);
    const results = await auditor.auditBatch(items);
    
    res.json({
      success: true,
      auditId: results.auditId,
      summary: auditor.getSummary(),
      anomalies: results.anomalies,
      items: results.items
    });
    
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: '审计失败', details: error.message });
  }
});

app.post('/api/audit/export', async (req, res) => {
  try {
    const { items, format = 'json', options = {} } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: '需要提供 items 数组' });
    }
    
    const auditor = new MetadataAuditor(options);
    const results = await auditor.auditBatch(items);
    const reporter = new AuditReporter(results, reportsDir);
    
    let output;
    switch (format.toLowerCase()) {
      case 'csv':
        output = await reporter.exportCsv();
        break;
      case 'pdf':
        output = await reporter.exportPdf();
        break;
      case 'all':
        output = await reporter.exportAll();
        break;
      default:
        output = reporter.exportJson();
    }
    
    res.json({
      success: true,
      auditId: results.auditId,
      summary: auditor.getSummary(),
      exports: Array.isArray(output) ? output : [output],
      downloadUrl: `/api/reports/${Array.isArray(output) ? output[0].filename : output.filename}`
    });
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: '导出失败', details: error.message });
  }
});

app.get('/api/reports/:filename', (req, res) => {
  const filepath = path.join(reportsDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).json({ error: '报告不存在' });
  }
});

app.get('/api/anomalies/:auditId?', (req, res) => {
  const auditId = req.params.auditId;
  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    return res.json({ anomalies: [] });
  }
  
  let targetFile;
  if (auditId) {
    targetFile = files.find(f => f.includes(auditId));
  }
  if (!targetFile) {
    targetFile = files.sort().pop();
  }
  
  const content = JSON.parse(fs.readFileSync(path.join(reportsDir, targetFile), 'utf8'));
  res.json({
    auditId: content.auditId,
    auditTime: content.auditTime,
    anomalies: content.anomalies || []
  });
});

app.get('/api/docs', (req, res) => {
  res.json({
    endpoints: {
      'GET /api/health': '健康检查',
      'POST /api/audit': '上传文件并执行审计（支持multipart/form-data）',
      'POST /api/audit/json': '纯JSON数据审计',
      'POST /api/audit/export': '审计并导出报告',
      'GET /api/anomalies': '获取最新异常清单',
      'GET /api/reports/:filename': '下载报告文件'
    },
    itemSchema: {
      tokenId: '链上编号（必填，用于去重）',
      name: '作品名称',
      creator: '创作者',
      imageHash: '图片哈希（用于校验）',
      imagePath: '图片文件路径',
      imageBuffer: '图片Buffer数据',
      metadata: '元数据对象',
      rights: {
        version: '权益版本',
        expiryDate: '权益过期日期（ISO格式）'
      }
    },
    examples: {
      jsonBody: {
        items: [
          {
            tokenId: 'NFT-001',
            name: '示例作品',
            creator: '艺术家A',
            imageHash: 'abc123...',
            metadata: { name: '示例', description: '...', image: '...' },
            rights: { version: 'v1.0', expiryDate: '2025-12-31' }
          }
        ]
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   数字藏品元数据审计服务已启动                                ║
║                                                              ║
║   前端页面:    http://localhost:${PORT}                       ║
║   API文档:     http://localhost:${PORT}/api/docs              ║
║   健康检查:    http://localhost:${PORT}/api/health            ║
║                                                              ║
║   命令行使用:  npm run cli -- --help                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
