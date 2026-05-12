const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const initTables = require('./models/initTables');
const errorHandler = require('./middleware/errorHandler');

const customerRoutes = require('./routes/customerRoutes');
const plantRoutes = require('./routes/plantRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const repottingRoutes = require('./routes/repottingRoutes');
const compensationRoutes = require('./routes/compensationRoutes');
const witheringRoutes = require('./routes/witheringRoutes');
const renewalRoutes = require('./routes/renewalRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/customers', customerRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/repotting', repottingRoutes);
app.use('/api/compensations', compensationRoutes);
app.use('/api/withering', witheringRoutes);
app.use('/api/renewal', renewalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '绿植租摆系统 API 运行正常' });
});

app.use(errorHandler);

const initializeDatabase = async () => {
  try {
    await initTables();
    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
  }
};

app.listen(PORT, async () => {
  await initializeDatabase();
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API 文档:');
  console.log('  GET  /api/health - 健康检查');
  console.log('  POST /api/customers - 创建客户');
  console.log('  POST /api/plants - 创建植物');
  console.log('  POST /api/maintenance - 创建养护任务');
  console.log('  POST /api/repotting - 创建换盆记录');
  console.log('  POST /api/compensations - 创建赔偿记录');
  console.log('  POST /api/withering - 创建枯萎处理');
  console.log('  POST /api/renewal/contracts - 创建续租合同');
  console.log('  POST /api/renewal/contracts/:id/generate-bill - 生成续租账单');
});

module.exports = app;
