const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const handoverRoutes = require('./routes/handoverRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/handover', handoverRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'customer-config-handover-api',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`客户配置交接API服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API文档:
  POST /api/handover/customers - 创建客户
  POST /api/handover/configs - 创建配置项
  GET /api/handover/configs/:id - 获取配置项详情
  GET /api/handover/customers/:customerId/configs - 获取客户所有配置
  POST /api/handover/configs/:id/status - 推进状态
  POST /api/handover/configs/:id/confirm - 确认配置
  POST /api/handover/configs/:id/correct - 人工修正
  POST /api/handover/configs/:id/sources - 添加来源材料
  GET /api/handover/configs/:id/changes - 获取变更对比
  GET /api/handover/exceptions - 获取异常列表
  POST /api/handover/exceptions/:id/handle - 处理异常
  POST /api/handover/customers/:customerId/summaries - 生成交接摘要
  GET /api/handover/customers/:customerId/summaries - 获取交接摘要列表
  GET /api/handover/customers/:customerId/export - 导出配置
  `);
});
