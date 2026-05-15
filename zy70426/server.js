const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const db = require('./db');
const heartbeatRoutes = require('./routes/heartbeat');
const transferRoutes = require('./routes/transfer');
const batchRoutes = require('./routes/batch');
const historyRoutes = require('./routes/history');
const traceRoutes = require('./routes/trace');

const app = express();
const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/heartbeat', heartbeatRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/trace', traceRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cross-heartbeat-service'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`跨器心跳服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
