const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./config/database');
const { logger, logAudit } = require('./config/logger');

const inspectionRoutes = require('./routes/inspections');
const alarmRoutes = require('./routes/alarms');
const workOrderRoutes = require('./routes/workOrders');
const importRoutes = require('./routes/import');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.user = {
    id: 'system',
    name: '系统管理员',
    role: 'admin'
  };
  next();
});

app.use('/api/inspections', inspectionRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.use((err, req, res, next) => {
  logger.error('Error:', { error: err.message, stack: err.stack });
  res.status(500).json({ error: '服务器内部错误' });
});

const startServer = async () => {
  try {
    await initDB();
    logger.info('数据库初始化完成');
    
    app.listen(PORT, () => {
      logger.info(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();
