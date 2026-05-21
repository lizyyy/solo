const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./utils/initDB');
const requestIdMiddleware = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    console.log('正在检查数据库状态...');
    await initDatabase();
    console.log('数据库准备完成\n');

    app.use(cors());
    app.use(express.json());
    app.use(requestIdMiddleware);

    app.use('/api/inventory', inventoryRoutes);

    app.get('/api/health', (req, res) => {
      res.json({ success: true, message: '药品库存接口台服务正常', timestamp: new Date().toISOString() });
    });

    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));

    app.get('/', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API端点不存在' });
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });

    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log('==========================================');
      console.log('   药品库存接口台服务启动成功');
      console.log('==========================================');
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`前端页面: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/api/health`);
      console.log(`API前缀:   http://localhost:${PORT}/api/inventory`);
      console.log('==========================================\n');
    });
  } catch (err) {
    console.error('服务启动失败:', err.message);
    process.exit(1);
  }
}

startServer();
