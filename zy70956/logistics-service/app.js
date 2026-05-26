const express = require('express');
const cors = require('cors');
const config = require('./config');
const connectDB = require('./utils/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const batchRoutes = require('./routes/batch');
const repairRoutes = require('./routes/repair');
const workerRoutes = require('./routes/worker');
const ratingRoutes = require('./routes/rating');
const appealRoutes = require('./routes/appeal');
const queryRoutes = require('./routes/query');
const reportRoutes = require('./routes/report');
const exceptionRoutes = require('./routes/exception');
const { recoverOnStartup, runScheduledScans } = require('./utils/scheduler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/batch', batchRoutes);
app.use('/api/repair', repairRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/rating', ratingRoutes);
app.use('/api/appeal', appealRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/exception', exceptionRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'logistics-service',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await connectDB();
  await recoverOnStartup();

  setInterval(runScheduledScans, 3600000);
  setTimeout(runScheduledScans, 10000);

  app.listen(config.PORT, () => {
    console.log(`[Server] 后勤服务中心已启动，端口: ${config.PORT}`);
    console.log(`[Server] 健康检查: http://localhost:${config.PORT}/api/health`);
  });
}

start().catch(err => {
  console.error('[Server] 启动失败:', err);
  process.exit(1);
});

module.exports = app;
