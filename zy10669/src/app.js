const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const renewalRoutes = require('./routes/renewalRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '药店会员中台慢病权益续期服务运行正常' });
});

app.use('/api/renewal', renewalRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  GET  /health                   - 健康检查');
  console.log('  POST /api/renewal              - 创建续期记录');
  console.log('  GET  /api/renewal              - 获取续期列表');
  console.log('  GET  /api/renewal/:id          - 获取续期详情');
  console.log('  GET  /api/renewal/:id/history  - 获取续期历史');
  console.log('  PUT  /api/renewal/:id/approve  - 审核通过');
  console.log('  PUT  /api/renewal/:id/suspend  - 暂停');
  console.log('  POST /api/renewal/import       - 批量导入');
  console.log('  GET  /api/renewal/export/csv   - 导出CSV');
  console.log('  GET  /api/renewal/bad-records  - 获取导入坏行');
});