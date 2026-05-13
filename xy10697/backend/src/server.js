const express = require('express');
const cors = require('cors');
const cylinderRoutes = require('./routes/cylinders');
const exportRoutes = require('./routes/export');
const { initSampleData } = require('./sampleData');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/cylinders', cylinderRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '气瓶管理系统API运行正常' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}');
  initSampleData();
  console.log('样例数据已初始化');
});

module.exports = app;
