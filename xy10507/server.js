const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const campaignsRouter = require('./routes/campaigns');
const channelsRouter = require('./routes/channels');
const materialsRouter = require('./routes/materials');
const reportsRouter = require('./routes/reports');

app.use('/api/campaigns', campaignsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '广告素材版本投放 API'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  广告素材版本投放 API 服务已启动`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`  管理面板: http://localhost:${PORT}/`);
  console.log(`\n  API 接口:`);
  console.log(`    - 活动管理: /api/campaigns`);
  console.log(`    - 渠道管理: /api/channels`);
  console.log(`    - 素材版本: /api/materials`);
  console.log(`    - 报表导出: /api/reports`);
  console.log(`========================================\n`);
});
