const express = require('express');
const cors = require('cors');

const reagentsRoute = require('./routes/reagents');
const batchesRoute = require('./routes/batches');
const recordsRoute = require('./routes/records');
const alertsRoute = require('./routes/alerts');
const exportRoute = require('./routes/export');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/reagents', reagentsRoute);
app.use('/api/batches', batchesRoute);
app.use('/api/records', recordsRoute);
app.use('/api/alerts', alertsRoute);
app.use('/api/export', exportRoute);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  实验室试剂领用追溯系统 - 后端服务`);
  console.log(`========================================`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`  启动时间: ${new Date().toLocaleString()}`);
  console.log(`========================================\n`);
});
