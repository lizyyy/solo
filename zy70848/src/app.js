const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const batchesRouter = require('./routes/batches');
const claimsRouter = require('./routes/claims');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchesRouter);
app.use('/api/claims', claimsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '理赔内勤后端服务运行正常' });
});

app.get('/', (req, res) => {
  res.json({
    name: '理赔内勤后端服务',
    version: '1.0.0',
    description: '材料清单CSV、保单JSON导入与规则审核系统',
    endpoints: {
      batches: '/api/batches',
      claims: '/api/claims',
      health: '/api/health'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`理赔内勤后端服务已启动，监听端口 ${PORT}`);
  console.log(`API文档: http://localhost:${PORT}/`);
});

module.exports = app;
