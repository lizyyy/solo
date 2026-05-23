const express = require('express');
const path = require('path');

const gateEventsRoutes = require('./routes/gateEvents');
const personnelRoutes = require('./routes/personnel');
const visitorsRoutes = require('./routes/visitors');
const exceptionsRoutes = require('./routes/exceptions');
const reportsRoutes = require('./routes/reports');
const correctionsRoutes = require('./routes/corrections');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '工地人员进出API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/gate-events', gateEventsRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/exceptions', exceptionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/corrections', correctionsRoutes);

app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

module.exports = app;
