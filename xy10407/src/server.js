const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');

const tasksRouter = require('./routes/tasks');
const packagesRouter = require('./routes/packages');
const anomaliesRouter = require('./routes/anomalies');
const queryRouter = require('./routes/query');

const app = express();

app.use(bodyParser.json({ limit: config.limits.maxPackageSize }));
app.use(bodyParser.urlencoded({ extended: true, limit: config.limits.maxPackageSize }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '设备巡检离线包 API',
    version: '1.0.0',
    endpoints: {
      tasks: {
        list: 'GET /api/tasks',
        create: 'POST /api/tasks'
      },
      packages: {
        upload: 'POST /api/packages/upload',
        get: 'GET /api/packages/:package_code'
      },
      anomalies: {
        list: 'GET /api/anomalies',
        confirm: 'POST /api/anomalies/:id/confirm',
        batch_confirm: 'POST /api/anomalies/batch-confirm'
      },
      query: {
        device_status: 'GET /api/devices/status',
        device_trend: 'GET /api/devices/:device_code/trend',
        team_report: 'GET /api/reports/by-team'
      }
    },
    config: {
      temperature_range: config.temperatureRange,
      pressure_range: config.pressureRange
    }
  });
});

app.use('/api', tasksRouter);
app.use('/api', packagesRouter);
app.use('/api', anomaliesRouter);
app.use('/api', queryRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
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

app.listen(config.port, () => {
  console.log(`设备巡检离线包 API 服务已启动`);
  console.log(`服务地址: http://localhost:${config.port}`);
});
