const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./models/database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const startServer = async () => {
  try {
    await db.init();
    
    const buildingsRouter = require('./routes/buildings');
    const contractorsRouter = require('./routes/contractors');
    const problemsRouter = require('./routes/problems');
    const dashboardRouter = require('./routes/dashboard');

    app.use('/api/buildings', buildingsRouter);
    app.use('/api/contractors', contractorsRouter);
    app.use('/api/problems', problemsRouter);
    app.use('/api/dashboard', dashboardRouter);

    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({ code: 1, message: '服务器内部错误', error: err.message });
    });

    app.listen(PORT, () => {
      console.log(`新房交付整改台后端服务已启动: http://localhost:${PORT}`);
      console.log('API 接口:');
      console.log('  - 楼栋房号: /api/buildings');
      console.log('  - 施工方:   /api/contractors');
      console.log('  - 验房问题: /api/problems');
      console.log('  - 看板统计: /api/dashboard');
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();
