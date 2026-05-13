const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

(async () => {
  await initSchema();
  
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  const exportsDir = path.join(__dirname, 'exports');
  app.use('/exports', express.static(exportsDir));

  app.use('/api/hosts', require('./routes/hostSchedules'));
  app.use('/api/samples', require('./routes/samples'));
  app.use('/api/responsible-persons', require('./routes/responsiblePersons'));
  app.use('/api/transactions', require('./routes/transactions'));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      message: '直播样品借还管理系统 API 服务正常',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'API 路由不存在'
    });
  });

  app.listen(PORT, () => {
    console.log(`直播样品借还管理系统已启动`);
    console.log(`服务器地址: http://localhost:${PORT}`);
    console.log(`API 健康检查: http://localhost:${PORT}/api/health`);
  });
})();
