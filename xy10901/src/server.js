const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

require('./config/database');

const sampleRoutes = require('./routes/sampleRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', sampleRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '诊所检验样本交接API服务运行正常' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                诊所检验样本交接 API 服务                       ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  服务地址: http://localhost:${PORT}                             ║
  ║  健康检查: http://localhost:${PORT}/health                      ║
  ║  API 前缀: http://localhost:${PORT}/api                         ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  初始化数据: npm run init-data                                ║
  ║  测试坏数据: npm run test-bad-data                            ║
  ╚══════════════════════════════════════════════════════════════╝
  `);
});
