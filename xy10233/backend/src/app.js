const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const TankModel = require('./models/tank');
const BatchModel = require('./models/batch');
const WaterQualityModel = require('./models/waterQuality');
const AlertModel = require('./models/alert');
const DeathLossModel = require('./models/deathLoss');
const OperationLogModel = require('./models/operationLog');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

TankModel.init();
BatchModel.init();
WaterQualityModel.init();
AlertModel.init();
DeathLossModel.init();
OperationLogModel.init();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.locals.operator = req.headers['x-operator'] || 'system';
  next();
});

const tanksRouter = require('./routes/tanks');
const batchesRouter = require('./routes/batches');
const waterQualityRouter = require('./routes/waterQuality');
const alertsRouter = require('./routes/alerts');
const deathLossRouter = require('./routes/deathLoss');
const logsRouter = require('./routes/logs');
const dashboardRouter = require('./routes/dashboard');

app.use('/api/tanks', tanksRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/water-quality', waterQualityRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/death-loss', deathLossRouter);
app.use('/api/logs', logsRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`海鲜暂养池水质联动台后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
