const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const craneRoutes = require('./routes/cranes');
const applicationRoutes = require('./routes/applications');
const scheduleRoutes = require('./routes/schedule');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: '塔吊吊次排程 API',
    version: '1.0.0',
    endpoints: {
      cranes: '/api/cranes',
      applications: '/api/applications',
      schedule: '/api/schedule',
      reports: '/api/reports'
    }
  });
});

app.use('/api/cranes', craneRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || '服务器内部错误',
    code: err.code || 'UNKNOWN_ERROR'
  });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`塔吊吊次排程 API 运行在 http://localhost:${PORT}`);
  });
});
