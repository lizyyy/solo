const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const valuationRoutes = require('./routes/valuationRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/valuations', valuationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '旧家电回收估价系统后端服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 旧家电回收估价系统后端服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔧 API 前缀: /api`);
  console.log(`========================================\n`);
});
