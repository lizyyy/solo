const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('./config');
const CalculationController = require('./controllers/CalculationController');

const app = express();
const PORT = config.port;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = function (req, file, cb) {
  const allowedTypes = ['text/csv', 'application/csv', 'application/json'];
  if (allowedTypes.includes(file.mimetype) || 
      file.originalname.endsWith('.csv') || 
      file.originalname.endsWith('.json')) {
    cb(null, true);
  } else {
    cb(new Error('只支持CSV和JSON格式的文件'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize
  }
});

const fs = require('fs');
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

app.get('/', (req, res) => {
  res.json({
    name: '影院排片补贴核算API',
    version: '1.0.0',
    endpoints: {
      'POST /api/calculate': '上传文件进行补贴核算',
      'GET /api/batches': '获取所有批次列表',
      'GET /api/batches/:batchId': '获取批次摘要信息',
      'GET /api/batches/:batchId/result': '获取批次完整核算结果',
      'GET /api/batches/:batchId/result/:status': '获取指定状态的结果 (normal/pending/failed)',
      'GET /api/trace/:batchId/:traceId': '通过traceId追踪单条明细记录'
    }
  });
});

app.post('/api/calculate', upload.array('files'), CalculationController.calculate);

app.get('/api/batches', CalculationController.getAllBatches);
app.get('/api/batches/:batchId', CalculationController.getBatchSummary);
app.get('/api/batches/:batchId/result', CalculationController.getBatchResult);
app.get('/api/batches/:batchId/result/:status', CalculationController.getResultByStatus);

app.get('/api/trace/:batchId/:traceId', CalculationController.getTraceItem);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: '文件上传错误',
      error: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`
============================================
🚀 影院排片补贴核算API服务已启动
📡 监听端口: ${PORT}
🌐 服务地址: http://localhost:${PORT}
📚 API文档: http://localhost:${PORT}/
============================================
  `);
});
