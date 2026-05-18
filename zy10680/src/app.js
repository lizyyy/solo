const express = require('express');
const cors = require('cors');
const transferRoutes = require('./routes/transferRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/transfers', transferRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '门店排班系统临时借调班次 API 运行正常' });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API 文档:');
  console.log('  POST   /api/transfers          - 创建借调记录');
  console.log('  GET    /api/transfers          - 获取借调列表');
  console.log('  GET    /api/transfers/export   - 导出借调记录');
  console.log('  GET    /api/transfers/:id      - 获取借调详情');
  console.log('  GET    /api/transfers/:id/history - 获取操作历史');
  console.log('  PUT    /api/transfers/:id/status - 更新状态');
  console.log('  PUT    /api/transfers/:id/resolve-conflict - 处理冲突');
  console.log('  PUT    /api/transfers/:id/archive - 归档');
});

module.exports = app;
