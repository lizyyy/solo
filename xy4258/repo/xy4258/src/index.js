const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const dataParser = require('./core/dataParser');
const metrics = require('./core/metrics');
const riskRules = require('./core/riskRules');
const storage = require('./core/storage');
const exporter = require('./core/exporter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const upload = multer({ 
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

let currentData = null;
let analysisResults = null;

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    hasData: currentData !== null,
    hasAnalysis: analysisResults !== null
  });
});

app.post('/api/data/upload/sample', async (req, res) => {
  try {
    const data = await dataParser.loadSampleData();
    currentData = data;
    
    await storage.saveSessionState({
      current_dataset: 'sample',
      loaded_at: Date.now()
    });
    
    res.json({
      success: true,
      message: '示例数据加载成功',
      stats: {
        bikeGPS: data.bikeGPS.length,
        stations: data.stations.length,
        workOrders: data.workOrders.length
      }
    });
  } catch (error) {
    console.error('加载示例数据失败:', error);
    res.status(500).json({
      success: false,
      message: '加载示例数据失败: ' + error.message
    });
  }
});

const uploadFields = upload.fields([
  { name: 'bikeGPS', maxCount: 1 },
  { name: 'stations', maxCount: 1 },
  { name: 'workOrders', maxCount: 1 }
]);

app.post('/api/data/upload', uploadFields, async (req, res) => {
  try {
    const files = req.files;
    const filePaths = {};
    
    if (files.bikeGPS && files.bikeGPS[0]) {
      filePaths.bikeGPSPath = files.bikeGPS[0].path;
    }
    if (files.stations && files.stations[0]) {
      filePaths.stationPath = files.stations[0].path;
    }
    if (files.workOrders && files.workOrders[0]) {
      filePaths.workOrdersPath = files.workOrders[0].path;
    }
    
    if (Object.keys(filePaths).length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少上传一个数据文件'
      });
    }
    
    const data = await dataParser.loadFromFiles(filePaths);
    currentData = { ...currentData, ...data };
    
    await storage.saveSessionState({
      current_dataset: 'custom',
      loaded_at: Date.now()
    });
    
    res.json({
      success: true,
      message: '数据上传成功',
      stats: {
        bikeGPS: data.bikeGPS ? data.bikeGPS.length : (currentData.bikeGPS ? currentData.bikeGPS.length : 0),
        stations: data.stations ? data.stations.length : (currentData.stations ? currentData.stations.length : 0),
        workOrders: data.workOrders ? data.workOrders.length : (currentData.workOrders ? currentData.workOrders.length : 0)
      }
    });
  } catch (error) {
    console.error('上传数据失败:', error);
    res.status(500).json({
      success: false,
      message: '上传数据失败: ' + error.message
    });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    if (!currentData || !currentData.bikeGPS || !currentData.stations) {
      return res.status(400).json({
        success: false,
        message: '请先加载数据（车辆GPS和站点信息是必需的）'
      });
    }
    
    const { bikeGPS, stations, workOrders } = currentData;
    
    const cleanedData = riskRules.cleanAnomalousLocations(bikeGPS);
    const stationGaps = metrics.calculateSupplyDemandGap(stations, cleanedData.cleaned);
    const riskStations = metrics.calculateStationRisks(stationGaps, cleanedData.cleaned);
    const suggestions = metrics.generateSchedulingSuggestions(riskStations);
    const bikeClusters = riskRules.detectBikeClusters(cleanedData.cleaned, stations);
    const timeSeries = metrics.aggregateByTimeWindow(bikeGPS, 30);
    
    analysisResults = {
      stations: stations,
      bikeGPS: cleanedData.cleaned,
      workOrders: workOrders || [],
      anomalies: cleanedData.anomalies,
      cleaningStats: cleanedData.stats,
      stationGaps: stationGaps,
      riskStations: riskStations,
      suggestions: suggestions,
      bikeClusters: bikeClusters,
      timeSeries: timeSeries,
      analyzed_at: Date.now()
    };
    
    await storage.saveAnalysisResults(analysisResults);
    
    res.json({
      success: true,
      message: '分析完成',
      results: {
        stats: {
          totalBikes: cleanedData.stats.total,
          cleanedBikes: cleanedData.stats.cleaned,
          anomalies: cleanedData.stats.anomalies,
          totalStations: stations.length,
          criticalStations: riskStations.filter(s => s.risk_level === 'CRITICAL').length,
          highRiskStations: riskStations.filter(s => s.risk_level === 'HIGH').length,
          suggestions: suggestions.length,
          clusters: bikeClusters.length
        },
        riskStations: riskStations.slice(0, 20),
        suggestions: suggestions,
        clusters: bikeClusters
      }
    });
  } catch (error) {
    console.error('分析失败:', error);
    res.status(500).json({
      success: false,
      message: '分析失败: ' + error.message
    });
  }
});

app.get('/api/analysis/summary', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的分析结果，请先运行分析'
    });
  }
  
  res.json({
    success: true,
    data: {
      stats: {
        totalBikes: analysisResults.cleaningStats.total,
        cleanedBikes: analysisResults.cleaningStats.cleaned,
        anomalies: analysisResults.cleaningStats.anomalies,
        totalStations: analysisResults.stations.length,
        criticalStations: analysisResults.riskStations.filter(s => s.risk_level === 'CRITICAL').length,
        highRiskStations: analysisResults.riskStations.filter(s => s.risk_level === 'HIGH').length,
        mediumRiskStations: analysisResults.riskStations.filter(s => s.risk_level === 'MEDIUM').length,
        lowRiskStations: analysisResults.riskStations.filter(s => s.risk_level === 'LOW').length,
        suggestions: analysisResults.suggestions.length,
        clusters: analysisResults.bikeClusters.length
      },
      analyzed_at: analysisResults.analyzed_at
    }
  });
});

app.get('/api/stations', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的数据'
    });
  }
  
  const { risk_level, gap_type } = req.query;
  let stations = [...analysisResults.riskStations];
  
  if (risk_level) {
    stations = stations.filter(s => s.risk_level === risk_level);
  }
  if (gap_type) {
    stations = stations.filter(s => s.gap_type === gap_type);
  }
  
  res.json({
    success: true,
    data: stations,
    total: stations.length
  });
});

app.get('/api/stations/:id', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的数据'
    });
  }
  
  const station = analysisResults.riskStations.find(s => s.station_id === req.params.id);
  
  if (!station) {
    return res.status(404).json({
      success: false,
      message: '站点不存在'
    });
  }
  
  res.json({
    success: true,
    data: station
  });
});

app.get('/api/suggestions', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的分析结果'
    });
  }
  
  const { type, priority } = req.query;
  let suggestions = [...analysisResults.suggestions];
  
  if (type) {
    suggestions = suggestions.filter(s => s.type === type);
  }
  if (priority) {
    suggestions = suggestions.filter(s => s.priority === priority);
  }
  
  res.json({
    success: true,
    data: suggestions,
    total: suggestions.length
  });
});

app.get('/api/clusters', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的分析结果'
    });
  }
  
  res.json({
    success: true,
    data: analysisResults.bikeClusters
  });
});

app.get('/api/anomalies', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的分析结果'
    });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const anomalies = analysisResults.anomalies.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: anomalies,
    pagination: {
      page,
      limit,
      total: analysisResults.anomalies.length,
      totalPages: Math.ceil(analysisResults.anomalies.length / limit)
    }
  });
});

app.get('/api/timeseries', (req, res) => {
  if (!analysisResults) {
    return res.status(404).json({
      success: false,
      message: '没有可用的分析结果'
    });
  }
  
  res.json({
    success: true,
    data: analysisResults.timeSeries
  });
});

app.post('/api/dispatch/mark', async (req, res) => {
  try {
    const { suggestionIndex, operator, notes, status = 'completed' } = req.body;
    
    if (!analysisResults || !analysisResults.suggestions[suggestionIndex]) {
      return res.status(404).json({
        success: false,
        message: '调度建议不存在'
      });
    }
    
    const suggestion = analysisResults.suggestions[suggestionIndex];
    
    const result = await storage.saveDispatchResult({
      suggestion: suggestion,
      suggestion_index: suggestionIndex,
      operator: operator || '未知操作员',
      notes: notes || ''
    });
    
    if (status === 'completed') {
      await storage.markDispatchComplete(result.id, operator || '未知操作员', notes);
    }
    
    res.json({
      success: true,
      message: '调度结果已记录',
      data: result
    });
  } catch (error) {
    console.error('记录调度结果失败:', error);
    res.status(500).json({
      success: false,
      message: '记录调度结果失败: ' + error.message
    });
  }
});

app.get('/api/dispatch/history', async (req, res) => {
  try {
    const { status, date } = req.query;
    const results = await storage.getDispatchResults({ status, date });
    
    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('获取调度历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取调度历史失败: ' + error.message
    });
  }
});

app.post('/api/export/report', async (req, res) => {
  try {
    if (!analysisResults) {
      return res.status(404).json({
        success: false,
        message: '没有可用的分析结果'
      });
    }
    
    const { operator } = req.body;
    
    const result = await exporter.saveMarkdownReport(analysisResults, {
      operator: operator || '系统自动生成'
    });
    
    res.json({
      success: true,
      message: '报告导出成功',
      data: result
    });
  } catch (error) {
    console.error('导出报告失败:', error);
    res.status(500).json({
      success: false,
      message: '导出报告失败: ' + error.message
    });
  }
});

app.post('/api/export/dispatch', async (req, res) => {
  try {
    if (!analysisResults) {
      return res.status(404).json({
        success: false,
        message: '没有可用的分析结果'
      });
    }
    
    const result = await exporter.saveDispatchCSV(analysisResults.suggestions);
    
    res.json({
      success: true,
      message: '调拨单导出成功',
      data: result
    });
  } catch (error) {
    console.error('导出调拨单失败:', error);
    res.status(500).json({
      success: false,
      message: '导出调拨单失败: ' + error.message
    });
  }
});

app.get('/api/exports', async (req, res) => {
  try {
    const exports = await exporter.listExports();
    res.json({
      success: true,
      data: exports
    });
  } catch (error) {
    console.error('获取导出列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取导出列表失败: ' + error.message
    });
  }
});

app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../exports', filename);
  
  res.download(filepath, filename, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  潮汐车堆预警台已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
