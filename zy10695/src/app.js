const express = require('express');
const sequelize = require('./config/database');
const Exemption = require('./models/Exemption');
const ExportLog = require('./models/ExportLog');
const ImportLog = require('./models/ImportLog');
const exemptionRoutes = require('./routes/exemptions');
const exportCheckRoutes = require('./routes/exportCheck');
const batchImportRoutes = require('./routes/batchImport');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/exemptions', exemptionRoutes);
app.use('/api/export', exportCheckRoutes);
app.use('/api/batch', batchImportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '数据脱敏服务 - 豁免审批API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();
