const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/', routes);

app.use('/api', (err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '内部服务器错误'
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'API 端点不存在'
    });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const initializeDatabase = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('数据库连接成功');

    const forceSync = process.env.FORCE_SYNC === 'true';
    await db.sequelize.sync({ force: forceSync });
    console.log('数据库同步完成');

    if (forceSync) {
      const seedData = require('./seeders/seedData');
      await seedData.init();
      console.log('种子数据初始化完成');
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
};

const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`============================================`);
      console.log(`股票模拟交易复盘和风控预警台`);
      console.log(`============================================`);
      console.log(`服务器已启动: http://localhost:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`============================================`);
      console.log(`前端开发模式请运行: npm run dev`);
      console.log(`生产模式请运行: npm run build && npm run start`);
      console.log(`============================================`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
