const express = require('express');
const path = require('path');
const { ObstacleService } = require('./service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'hospital-robot-obstacle-avoidance' });
});

app.get('/api/stats', (req, res) => {
  const stats = ObstacleService.getStatistics();
  res.json(stats);
});

app.get('/api/obstacles', (req, res) => {
  const obstacles = ObstacleService.getAllObstacles();
  res.json(obstacles);
});

app.get('/api/obstacles/:id', (req, res) => {
  const details = ObstacleService.getObstacleWithDetails(req.params.id);
  if (!details) {
    return res.status(404).json({ error: '障碍物不存在' });
  }
  res.json(details);
});

app.post('/api/obstacles', (req, res) => {
  try {
    const result = ObstacleService.importObstacle(req.body);
    res.status(201).json({
      obstacle: result.obstacle,
      report: result.report,
      evidenceSummary: {
        obstacleRemark: result.obstacle.remark || '',
        floorPlanSketch: '',
        alarmTagBlocked: result.obstacle.alarmTagBlocked
      }
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/obstacles/:id/manager-review', (req, res) => {
  try {
    const result = ObstacleService.reviewByManager(req.params.id, req.body);
    res.json({
      obstacle: result.obstacle,
      report: result.report,
      evidenceSummary: result.report.evidenceSummary
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/obstacles/:id/attach-floorplan', (req, res) => {
  try {
    const result = ObstacleService.attachFloorPlan(req.params.id, req.body.floorPlanId);
    res.json({
      obstacle: result.obstacle,
      floorPlan: result.floorPlan,
      report: result.report,
      evidenceSummary: result.report.evidenceSummary
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/obstacles/:id/tao-review', (req, res) => {
  try {
    const result = ObstacleService.reviewByTao(req.params.id, req.body);
    res.json({
      obstacle: result.obstacle,
      report: result.report,
      evidenceSummary: result.report.evidenceSummary
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/floor-plans', (req, res) => {
  const floorPlans = ObstacleService.getAllFloorPlans();
  res.json(floorPlans);
});

app.post('/api/floor-plans', (req, res) => {
  try {
    const floorPlan = ObstacleService.createFloorPlan(req.body);
    res.status(201).json(floorPlan);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/reports', (req, res) => {
  const reports = ObstacleService.getAllReports();
  res.json(reports);
});

app.get('/api/reports/:id', (req, res) => {
  const { SafetyReport } = require('./models');
  const report = SafetyReport.getById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: '报告不存在' });
  }
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`医院物流机器人避障系统 API 服务已启动`);
  console.log(`API地址: http://localhost:${PORT}`);
  console.log(`小看板地址: http://localhost:${PORT}`);
});

module.exports = app;
