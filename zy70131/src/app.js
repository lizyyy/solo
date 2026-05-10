const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./config/database');

const materialsRoutes = require('./routes/materials');
const authorizationsRoutes = require('./routes/authorizations');
const removalsRoutes = require('./routes/removals');
const notificationsRoutes = require('./routes/notifications');
const exportsRoutes = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '版权授权到期下架API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/materials', materialsRoutes);
app.use('/api/v1/authorizations', authorizationsRoutes);
app.use('/api/v1/removals', removalsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/exports', exportsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

async function startServer() {
  try {
    await sequelize.sync({ force: process.env.NODE_ENV === 'test' });
    console.log('数据库连接成功，表已同步');
    
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`服务器运行在端口 ${PORT}`);
        console.log(`健康检查: http://localhost:${PORT}/health`);
      });
    }
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
