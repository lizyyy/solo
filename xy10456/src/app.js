const express = require('express');
const db = require('./database');

const insuranceTypesRouter = require('./routes/insuranceTypes');
const claimsRouter = require('./routes/claims');
const materialsRouter = require('./routes/materials');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/insurance-types', insuranceTypesRouter);
app.use('/api/claims', claimsRouter);
app.use('/api', materialsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/api/status-enum', (req, res) => {
  res.json({
    claim_status: {
      DRAFT: '草稿',
      SUBMITTED: '已提交',
      UNDER_REVIEW: '审核中',
      SUPPLEMENT_REQUESTED: '待补件',
      APPROVED: '已批准',
      REJECTED: '已驳回',
      CLOSED: '已结案'
    },
    stages: {
      APPLICATION: '申请阶段',
      MATERIAL_CHECK: '材料校验阶段',
      REVIEW: '审核阶段',
      PAYMENT: '赔付阶段',
      CLOSED: '已结案'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`保险理赔材料 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
