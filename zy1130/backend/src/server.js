const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const jobsRoute = require('./routes/jobs');
const workersRoute = require('./routes/workers');
const plansRoute = require('./routes/plans');
const optimizeRoute = require('./routes/optimize');
const importRoute = require('./routes/import');
const exportRoute = require('./routes/export');

const jobRepository = require('./repositories/JobRepository');
const workerRepository = require('./repositories/WorkerRepository');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/jobs', jobsRoute);
app.use('/api/workers', workersRoute);
app.use('/api/plans', plansRoute);
app.use('/api/optimize', optimizeRoute);
app.use('/api/import', importRoute);
app.use('/api/export', exportRoute);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Route Planner API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const jobCount = await jobRepository.count();
    const workerCount = await workerRepository.count();
    
    res.json({
      success: true,
      data: {
        jobs: jobCount,
        workers: workerCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/sample-data', (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../data');
    const sampleFiles = ['jobs.csv', 'workers.csv', 'travel-times.json', 'road-rules.json'];
    const available = [];
    
    sampleFiles.forEach(file => {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        available.push(file);
      }
    });
    
    res.json({
      success: true,
      data: {
        availableSampleFiles: available,
        dataDirectory: dataDir
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: '请求体 JSON 格式错误'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API 端点不存在'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Route Planner API Server running on http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${path.join(__dirname, '../../data')}`);
  console.log(`🔧 API endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/stats`);
  console.log(`   GET  /api/jobs`);
  console.log(`   POST /api/jobs`);
  console.log(`   GET  /api/workers`);
  console.log(`   POST /api/workers`);
  console.log(`   GET  /api/plans`);
  console.log(`   POST /api/optimize`);
  console.log(`   POST /api/import/jobs`);
  console.log(`   POST /api/import/workers`);
  console.log(`   GET  /api/export/plan/:id/dispatch-table`);
  console.log(`   GET  /api/export/plan/:id/report`);
});

module.exports = app;
