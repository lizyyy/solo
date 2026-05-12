const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: '二方审核整改 API',
    version: '1.0.0',
    description: '追踪整改计划、证据、复审和关闭状态',
    endpoints: {
      'POST /api/audit/issues': '创建审核问题',
      'GET /api/audit/issues': '查询问题列表',
      'GET /api/audit/issues/:id': '查询问题详情',
      'POST /api/audit/issues/:id/submit-plan': '提交整改计划',
      'POST /api/audit/issues/:id/approve-plan': '审批整改计划',
      'POST /api/audit/issues/:id/submit-evidence': '提交证据',
      'POST /api/audit/issues/:id/customer-review': '客户复审',
      'POST /api/audit/issues/:id/request-extension': '申请延期',
      'POST /api/audit/issues/:id/manual-correction': '人工修正',
      'POST /api/audit/check-overdue': '检查逾期并升级',
      'GET /api/audit/reports/summary': '导出汇总报告',
      'GET /api/audit/status-definitions': '状态定义'
    }
  });
});

const auditRoutes = require('./routes/audit');
app.use('/api/audit', auditRoutes);

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
    error: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('    二方审核整改 API');
  console.log('========================================');
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log('API前缀: /api/audit');
  console.log('========================================');
});
