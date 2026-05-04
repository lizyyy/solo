const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('数据目录已创建:', dataDir);
}

const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

const samplesRouter = require('./routes/samples');
const risksRouter = require('./routes/risks');
const exportRouter = require('./routes/export');

app.use('/api/samples', samplesRouter);
app.use('/api/risks', risksRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/config/standards', (req, res) => {
  const { WATER_QUALITY_STANDARDS } = require('./config/waterQualityStandards');
  res.json({
    success: true,
    data: WATER_QUALITY_STANDARDS
  });
});

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      success: true,
      message: '水质巡检分析台API服务运行中',
      endpoints: {
        samples: '/api/samples',
        risks: '/api/risks',
        export: '/api/export',
        health: '/api/health'
      }
    });
  }
});

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    await sequelize.sync({ alter: true });
    console.log('数据库模型同步完成');
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  水质巡检分析台已启动`);
      console.log(`========================================`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  API地址:  http://localhost:${PORT}/api`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
