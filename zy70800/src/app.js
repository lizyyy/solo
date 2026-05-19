const express = require('express');
const cors = require('cors');
const path = require('path');

const batchRoutes = require('./routes/batchRoutes');
const criticalValueRoutes = require('./routes/criticalValueRoutes');
const callbackRoutes = require('./routes/callbackRoutes');
const dutyScheduleRoutes = require('./routes/dutyScheduleRoutes');
const exportRoutes = require('./routes/exportRoutes');
const queryRoutes = require('./routes/queryRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/batches', batchRoutes);
app.use('/api/critical-values', criticalValueRoutes);
app.use('/api/callbacks', callbackRoutes);
app.use('/api/duty-schedule', dutyScheduleRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/query', queryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '检验科危急值追踪系统运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
