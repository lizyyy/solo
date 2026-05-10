const express = require('express');
const cors = require('cors');
const config = require('./config');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

const attachmentsRouter = require('./routes/attachments');
const declarationsRouter = require('./routes/declarations');
const tasksRouter = require('./routes/tasks');
const auditLogsRouter = require('./routes/audit-logs');
const masterRouter = require('./routes/master');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    operator: req.headers['x-operator']
  });
  next();
});

app.use('/api/attachments', attachmentsRouter);
app.use('/api/declarations', declarationsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/master', masterRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '税务申报附件校验服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use((err, req, res, next) => {
  logger.error('[SERVER_ERROR]', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '文件大小超出限制（最大10MB）'
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(config.port, () => {
      logger.info(`服务器启动成功，端口：${config.port}`);
      logger.info('API 文档说明：');
      logger.info('  GET  /api/health                  - 健康检查');
      logger.info('  POST /api/attachments/upload      - 附件上传');
      logger.info('  GET  /api/declarations/:code/:period - 申报状态查询');
      logger.info('  POST /api/master/enterprises      - 创建企业');
      logger.info('  POST /api/master/periods          - 创建申报期');
      logger.info('  POST /api/master/rules            - 创建校验规则');
    });
  } catch (error) {
    logger.error('服务器启动失败', error);
    process.exit(1);
  }
};

startServer();
