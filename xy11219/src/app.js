const express = require('express');
const { initializeDatabase } = require('./database/init');
const { seedDatabase } = require('./database/seed');

const sampleRoutes = require('./routes/samples');
const temperatureRoutes = require('./routes/temperatures');
const wasteRoutes = require('./routes/wastes');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.headers['x-user-id'] || 'unknown'}`);
  next();
});

app.use('/api/samples', sampleRoutes);
app.use('/api/temperatures', temperatureRoutes);
app.use('/api/wastes', wasteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '门店品控系统运行正常', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

async function startServer() {
  try {
    await initializeDatabase();
    console.log('数据库初始化完成');
    
    await seedDatabase();
    console.log('种子数据初始化完成');

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`🚀 门店品控系统已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`📊 API 文档: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
