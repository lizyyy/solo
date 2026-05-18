const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const handoverRoutes = require('./routes/handoverRoutes');
app.use('/api/handover', handoverRoutes);

app.get('/', (req, res) => {
  res.json({
    name: '养老日托站日托服药交接API',
    version: '1.0.0',
    description: '用于管理养老日托站的服药交接记录，自动分离正常记录与异常记录',
    endpoints: {
      'GET /api/handover': '获取所有记录',
      'GET /api/handover/normal': '获取正常记录（校验通过）',
      'GET /api/handover/abnormal': '获取异常记录（待处理或驳回）',
      'GET /api/handover/statistics': '获取统计信息',
      'GET /api/handover/:id': '获取单条记录详情',
      'POST /api/handover': '创建新记录（自动校验）',
      'POST /api/handover/:id/process': '重新校验记录',
      'PUT /api/handover/:id/confirm-nurse': '护士确认剂量变更',
      'PUT /api/handover/:id/medication-records': '更新服药记录并重新校验'
    },
    data_samples: {
      normal_records: 'MH-2024-001, MH-2024-002',
      abnormal_records: 'MH-2024-003（家属改剂量护士未确认）, MH-2024-004（服药记录不一致）, MH-2024-005（两者都有问题）'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`养老日托站日托服药交接API已启动`);
  console.log(`服务器地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`可用接口:`);
  console.log(`  GET  http://localhost:${PORT}/                          - API信息`);
  console.log(`  GET  http://localhost:${PORT}/api/handover               - 所有记录`);
  console.log(`  GET  http://localhost:${PORT}/api/handover/normal        - 正常记录`);
  console.log(`  GET  http://localhost:${PORT}/api/handover/abnormal      - 异常记录`);
  console.log(`  GET  http://localhost:${PORT}/api/handover/statistics    - 统计信息`);
  console.log(`\n样例数据说明:`);
  console.log(`  - MH-2024-001, MH-2024-002: 正常记录，所有校验通过`);
  console.log(`  - MH-2024-003: 家属临时改剂量但护士未确认`);
  console.log(`  - MH-2024-004: 服药记录与实际剂量不一致`);
  console.log(`  - MH-2024-005: 同时存在上述两个问题`);
  console.log(`\n========================================\n`);
});

module.exports = app;
