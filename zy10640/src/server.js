const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, '../data/trial-extension.db');
if (!fs.existsSync(DB_PATH)) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  警告: 数据库文件不存在！                                    ║');
  console.log('║  请先执行: npm run init-db                                 ║');
  console.log('║  然后执行: npm run seed                                    ║');
  console.log('║  或者一步执行: npm run setup                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '企业订阅服务试用延期审批 API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'POST /api/extensions': '创建延期申请',
      'GET /api/extensions': '获取申请列表',
      'GET /api/extensions/:id': '获取申请详情',
      'POST /api/extensions/:id/approve': '审批通过',
      'POST /api/extensions/:id/reject': '审批驳回',
      'POST /api/extensions/:id/convert': '转为付费',
      'GET /api/extensions/:id/history': '获取操作历史',
      'GET /api/extensions/export/csv': '导出CSV',
      'POST /api/extensions/import': '批量导入',
      'GET /api/extensions/import/:batch_no': '查看导入记录',
      'POST /api/extensions/tenants': '创建租户',
      'GET /api/extensions/tenants': '获取租户列表'
    },
    status_codes: {
      trial_active: '试用中',
      extension_pending: '延期申请',
      extension_approved: '已延期',
      converted: '已转正'
    }
  });
});

app.use('/api/extensions', require('./routes/extensions'));

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     企业订阅服务试用延期审批 API 服务已启动                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  服务地址: http://localhost:${PORT}                          ║`);
  console.log('║  根路径:   GET /                                           ║');
  console.log('║  API路径:  /api/extensions                                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  状态说明:                                                 ║');
  console.log('║    trial_active        → 试用中                            ║');
  console.log('║    extension_pending   → 延期申请                          ║');
  console.log('║    extension_approved  → 已延期                            ║');
  console.log('║    converted           → 已转正                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  冲突规则: 同一租户有待审批申请时，新申请将被拦截            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});
