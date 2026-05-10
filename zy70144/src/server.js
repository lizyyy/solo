const express = require('express');
const path = require('path');
const fs = require('fs');

const artifactRoutes = require('./routes/artifacts');
const signatureRoutes = require('./routes/signatures');
const scanRoutes = require('./routes/scans');
const approvalRoutes = require('./routes/approvals');
const promotionRoutes = require('./routes/promotions');
const rollbackRoutes = require('./routes/rollbacks');
const ruleRoutes = require('./routes/rules');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Artifact Promotion Gate Service',
    version: '1.0.0',
    description: '制品仓库晋级门禁服务',
    endpoints: {
      artifacts: '/api/artifacts',
      signatures: '/api/signatures',
      scans: '/api/scans',
      approvals: '/api/approvals',
      promotions: '/api/promotions',
      rollbacks: '/api/rollbacks',
      rules: '/api/rules',
      reports: '/api/reports'
    }
  });
});

app.use('/api/artifacts', artifactRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/rollbacks', rollbackRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, error: '内部服务器错误' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

const { loadDatabase, DB_PATH } = require('./config/database');
loadDatabase();

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  制品仓库晋级门禁服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log(`  数据库: ${DB_PATH}`);
  console.log(`========================================`);
  console.log('');
  console.log('首次使用请先初始化数据库:');
  console.log('  npm run init-db');
  console.log('');
  console.log('运行演示脚本:');
  console.log('  npm run demo');
});

module.exports = app;
