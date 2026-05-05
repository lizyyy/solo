const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const Papa = require('papaparse');
const dayjs = require('dayjs');
const storage = require('./storage');
const aiLogic = require('./aiLogic');
const exportService = require('./exportService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// 初始化存储
storage.init().then(() => {
  console.log('存储系统初始化完成');
}).catch(err => {
  console.error('存储系统初始化失败:', err);
});

// API路由

// 导入数据
app.post('/api/import', upload.fields([
  { name: 'illumination', maxCount: 1 },
  { name: 'currentLog', maxCount: 1 },
  { name: 'complaints', maxCount: 1 },
  { name: 'workOrders', maxCount: 1 }
]), async (req, res) => {
  try {
    const results = {};
    
    // 处理照度CSV
    if (req.files.illumination) {
      const file = req.files.illumination[0];
      const data = await storage.parseCSV(file.path);
      results.illumination = await storage.saveIlluminationData(data);
    }
    
    // 处理电流日志
    if (req.files.currentLog) {
      const file = req.files.currentLog[0];
      const data = await storage.parseLog(file.path);
      results.currentLog = await storage.saveCurrentLogData(data);
    }
    
    // 处理报修文本
    if (req.files.complaints) {
      const file = req.files.complaints[0];
      const data = await storage.parseText(file.path);
      results.complaints = await storage.saveComplaintsData(data);
    }
    
    // 处理维修工单
    if (req.files.workOrders) {
      const file = req.files.workOrders[0];
      const data = await storage.parseCSV(file.path);
      results.workOrders = await storage.saveWorkOrdersData(data);
    }
    
    // 重新计算风险
    await aiLogic.calculateAllRisks();
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取风险分析结果
app.get('/api/risks', async (req, res) => {
  try {
    const risks = await storage.getAllRisks();
    res.json({ success: true, data: risks });
  } catch (error) {
    console.error('获取风险数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 按道路获取风险
app.get('/api/risks/road/:roadName', async (req, res) => {
  try {
    const risks = await storage.getRisksByRoad(req.params.roadName);
    res.json({ success: true, data: risks });
  } catch (error) {
    console.error('获取道路风险数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取历史处置建议
app.get('/api/history/:riskType', async (req, res) => {
  try {
    const history = await storage.getSimilarHistory(req.params.riskType);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('获取历史数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存人工复核备注
app.post('/api/remarks', async (req, res) => {
  try {
    const { riskId, remarks, status } = req.body;
    await storage.saveRemarks(riskId, remarks, status);
    res.json({ success: true });
  } catch (error) {
    console.error('保存备注失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出Markdown巡修清单
app.get('/api/export/markdown', async (req, res) => {
  try {
    const markdown = await exportService.generateMarkdown();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=streetlight-maintenance-${dayjs().format('YYYYMMDD')}.md`);
    res.send(markdown);
  } catch (error) {
    console.error('导出Markdown失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出JSON明细
app.get('/api/export/json', async (req, res) => {
  try {
    const jsonData = await exportService.generateJSON();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=streetlight-maintenance-${dayjs().format('YYYYMMDD')}.json`);
    res.json(jsonData);
  } catch (error) {
    console.error('导出JSON失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有道路列表
app.get('/api/roads', async (req, res) => {
  try {
    const roads = await storage.getAllRoads();
    res.json({ success: true, data: roads });
  } catch (error) {
    console.error('获取道路列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计数据
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await storage.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`路灯运维AI小工具运行在 http://localhost:${PORT}`);
});
