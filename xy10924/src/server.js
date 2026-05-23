const express = require('express');
const path = require('path');

const customersRoute = require('./routes/customers');
const workersRoute = require('./routes/workers');
const schedulesRoute = require('./routes/schedules');
const depositsRoute = require('./routes/deposits');
const evaluationsRoute = require('./routes/evaluations');
const conclusionsRoute = require('./routes/conclusions');
const processingRecordsRoute = require('./routes/processingRecords');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get('/', (req, res) => {
  res.json({
    name: '家政阿姨试工 API',
    version: '1.0.0',
    description: '提供家政公司试工安排、客户评价、押金管理和转正结论的完整流程管理',
    endpoints: {
      customers: '/api/customers',
      workers: '/api/workers',
      schedules: '/api/schedules',
      deposits: '/api/deposits',
      evaluations: '/api/evaluations',
      conclusions: '/api/conclusions',
      processing_records: '/api/processing-records'
    }
  });
});

app.use('/api/customers', customersRoute);
app.use('/api/workers', workersRoute);
app.use('/api/schedules', schedulesRoute);
app.use('/api/deposits', depositsRoute);
app.use('/api/evaluations', evaluationsRoute);
app.use('/api/conclusions', conclusionsRoute);
app.use('/api/processing-records', processingRecordsRoute);

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`家政阿姨试工 API 服务已启动，运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
});
