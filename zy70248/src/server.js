const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const shipsRouter = require('./routes/ships');
const berthingsRouter = require('./routes/berthings');
const contractsRouter = require('./routes/contracts');
const meterReadingsRouter = require('./routes/meterReadings');
const interruptionsRouter = require('./routes/interruptions');
const settlementsRouter = require('./routes/settlements');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '码头岸电接入结算 API',
      version: '1.0.0',
      description: '船舶靠港接岸电结算系统 API',
      endpoints: {
        ships: '/api/ships',
        berthings: '/api/berthings',
        contracts: '/api/contracts',
        meterReadings: '/api/meter-readings',
        interruptions: '/api/interruptions',
        settlements: '/api/settlements'
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

app.use('/api/ships', shipsRouter);
app.use('/api/berthings', berthingsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/meter-readings', meterReadingsRouter);
app.use('/api/interruptions', interruptionsRouter);
app.use('/api/settlements', settlementsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: '请求的端点不存在',
      details: { path: req.path, method: req.method }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: {}
    }
  });
});

app.listen(PORT, () => {
  console.log(`码头岸电接入结算 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 文档入口: http://localhost:${PORT}/`);
});

module.exports = app;
