const express = require('express');
const giftRoutes = require('./routes/giftRoutes');
const dataStore = require('./models/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {
      activities: dataStore.activities.size,
      gifts: dataStore.gifts.size,
      inventory: dataStore.inventory.size,
      qualifications: dataStore.userQualifications.size,
      lockRecords: dataStore.lockRecords.size
    }
  });
});

app.get('/reset', (req, res) => {
  dataStore.reset();
  res.json({
    message: '数据已重置',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/gifts', giftRoutes);

app.listen(PORT, () => {
  console.log(`赠品库存锁定 API 服务启动在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`重置数据: http://localhost:${PORT}/reset`);
  console.log(`\nAPI 端点:`);
  console.log(`  POST /api/gifts/lock - 锁定赠品库存`);
  console.log(`  POST /api/gifts/release - 释放赠品库存`);
  console.log(`  POST /api/gifts/manual-correct - 人工修正`);
  console.log(`  GET  /api/gifts/status/:lockRecordId - 查询锁定状态`);
  console.log(`  POST /api/gifts/verify-qualification - 验证用户资格`);
  console.log(`  GET  /api/gifts/locks - 列出所有锁定记录`);
  console.log(`  GET  /api/gifts/release-logs - 释放日志`);
  console.log(`  GET  /api/gifts/manual-corrections - 人工修正记录`);
});

module.exports = app;
