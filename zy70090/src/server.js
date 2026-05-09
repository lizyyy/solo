const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config/config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const seizedItemRoutes = require('./routes/seizedItemRoutes');
const sealRoutes = require('./routes/sealRoutes');
const transferRoutes = require('./routes/transferRoutes');
const returnApprovalRoutes = require('./routes/returnApprovalRoutes');
const photoRoutes = require('./routes/photoRoutes');
const exportRoutes = require('./routes/exportRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 429
  }
});

app.use(limiter);

app.use('/uploads', express.static(path.resolve(config.upload.dir)));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/seized-items', seizedItemRoutes);
app.use('/api/seals', sealRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/return-approvals', returnApprovalRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/logs', logRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.app.port;

app.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`环境: ${config.app.nodeEnv}`);
});

module.exports = app;
