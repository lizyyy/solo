const express = require('express');
const cors = require('cors');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('./models');
const { errorHandler } = require('./middleware/errorHandler');

const devicesRouter = require('./routes/devices');
const importRouter = require('./routes/import');
const anomaliesRouter = require('./routes/anomalies');
const zonesRouter = require('./routes/zones');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.use('/api/devices', devicesRouter);
app.use('/api/import', importRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/api/stats', async (req, res) => {
  const { Device, ScanRecord, PairingEvent, Zone, Anomaly } = require('./models');
  
  try {
    const [devices, scans, pairings, zones, openAnomalies] = await Promise.all([
      Device.count(),
      ScanRecord.count(),
      PairingEvent.count(),
      Zone.count(),
      Anomaly.count({ 
        where: { status: { [Op.in]: ['open', 'acknowledged', 'investigating'] } } 
      })
    ]);

    res.json({
      success: true,
      data: {
        devices,
        scans,
        pairings,
        zones,
        openAnomalies
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found'
    });
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.use(errorHandler);

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    const forceSync = process.env.FORCE_SYNC === 'true';
    await sequelize.sync({ force: forceSync });
    console.log('数据库同步完成');

    if (forceSync) {
      console.log('警告：数据库已重置');
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`蓝牙巡检工具服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`API 文档: http://localhost:${PORT}/api`);
  });
});

module.exports = app;
