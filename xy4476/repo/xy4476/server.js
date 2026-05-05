const express = require('express');
const cors = require('cors');
const db = require('./database');
const conflictChecker = require('./services/conflictChecker');
const reportGenerator = require('./services/reportGenerator');

const sponsorsRouter = require('./routes/sponsors');
const episodesRouter = require('./routes/episodes');
const adSlotsRouter = require('./routes/ad_slots');
const contractsRouter = require('./routes/contracts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/sponsors', sponsorsRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/ad-slots', adSlotsRouter);
app.use('/api/contracts', contractsRouter);

app.get('/api/reports/risk', async (req, res) => {
  try {
    const report = await reportGenerator.generateRiskReport();
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename=risk-report.md');
    res.send(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/risk/json', async (req, res) => {
  try {
    const report = await reportGenerator.generateRiskReport();
    res.json({
      report: report,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/check-conflicts', async (req, res) => {
  const { sponsor_id, category, episode_ids, max_frequency } = req.query;
  
  if (!sponsor_id || !category || !episode_ids) {
    return res.status(400).json({ error: 'sponsor_id, category and episode_ids are required' });
  }
  
  try {
    const episodeIdsArray = episode_ids.split(',').map(id => parseInt(id));
    const conflicts = await conflictChecker.checkAllConflicts({
      sponsor_id: parseInt(sponsor_id),
      category,
      episode_ids: episodeIdsArray,
      max_frequency: max_frequency ? parseInt(max_frequency) : 2
    });
    
    res.json(conflicts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Podcast Ad Scheduler API'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Podcast Ad Scheduler API',
    version: '1.0.0',
    description: '播客广告排期API服务',
    endpoints: {
      sponsors: {
        list: 'GET /api/sponsors',
        get: 'GET /api/sponsors/:id',
        create: 'POST /api/sponsors',
        update: 'PUT /api/sponsors/:id',
        delete: 'DELETE /api/sponsors/:id'
      },
      episodes: {
        list: 'GET /api/episodes',
        get: 'GET /api/episodes/:id',
        create: 'POST /api/episodes',
        update: 'PUT /api/episodes/:id',
        delete: 'DELETE /api/episodes/:id'
      },
      ad_slots: {
        list: 'GET /api/ad-slots',
        get: 'GET /api/ad-slots/:id',
        create: 'POST /api/ad-slots',
        update: 'PUT /api/ad-slots/:id',
        delete: 'DELETE /api/ad-slots/:id'
      },
      contracts: {
        list: 'GET /api/contracts',
        get: 'GET /api/contracts/:id',
        create: 'POST /api/contracts',
        import: 'POST /api/contracts/import',
        update: 'PUT /api/contracts/:id',
        delete: 'DELETE /api/contracts/:id'
      },
      reports: {
        risk_download: 'GET /api/reports/risk',
        risk_json: 'GET /api/reports/risk/json'
      },
      utilities: {
        check_conflicts: 'GET /api/check-conflicts?sponsor_id=:id&category=:cat&episode_ids=:ids',
        health: 'GET /api/health'
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 播客广告排期API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/`);
  console.log(`✅ 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
