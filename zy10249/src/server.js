const express = require('express');
const service = require('./service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.post('/api/packages', (req, res) => {
  try {
    const result = service.createPackage(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/use', (req, res) => {
  try {
    const result = service.usePackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/recycle', (req, res) => {
  try {
    const result = service.recyclePackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/clean', (req, res) => {
  try {
    const result = service.cleanPackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/disinfect', (req, res) => {
  try {
    const result = service.disinfectPackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/sterilize', (req, res) => {
  try {
    const result = service.sterilizePackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/packages/:packageId/distribute', (req, res) => {
  try {
    const result = service.distributePackage(req.params.packageId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/packages/:packageId', (req, res) => {
  try {
    const result = service.getPackage(req.params.packageId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.get('/api/packages/:packageId/history', (req, res) => {
  try {
    const result = service.getPackageHistory(req.params.packageId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.get('/api/packages', (req, res) => {
  try {
    const result = service.getAllPackages();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/batches/:batchNo', (req, res) => {
  try {
    const result = service.getBatch(req.params.batchNo);
    res.json(result);
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`医疗器械消毒批次 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log('');
  console.log('快速开始:');
  console.log('  1. 安装依赖: npm install');
  console.log('  2. 启动服务: npm start');
  console.log('  3. 运行测试: npm test');
});
