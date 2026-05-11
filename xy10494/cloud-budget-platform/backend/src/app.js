require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const sharedServiceRoutes = require('./routes/sharedServiceRoutes');
const billRoutes = require('./routes/billRoutes');
const anomalyRoutes = require('./routes/anomalyRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const { sequelize } = require('./db/models');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/shared-services', sharedServiceRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '云资源预算归属台服务运行正常',
    timestamp: new Date().toISOString(),
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ success: false, message: '未授权访问' });
  }
  
  if (err.message && err.message.includes('仅支持')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误',
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: '请求的资源不存在' });
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API 前缀: /api`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
