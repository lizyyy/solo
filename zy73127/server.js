const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function readJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'coral-bleaching-playback',
    dataset: '2024_Q2_Xisha',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/timeseries', (req, res) => {
  const data = readJson('timeseries_summary.json');
  res.json(data);
});

app.get('/api/formula', (req, res) => {
  const data = readJson('calc_formula.json');
  res.json(data);
});

app.get('/api/log/:id', (req, res) => {
  const logId = req.params.id;
  const data = readJson('ship_logbook.json');
  const entry = data.entries.find(e => e.id === logId);
  if (!entry) {
    return res.status(404).json({ error: '未找到船上记录条目', log_id: logId });
  }
  res.json({
    dataset: data.dataset,
    station: data.station,
    entry
  });
});

app.get('/api/remote/:scene_id', (req, res) => {
  const sceneId = req.params.scene_id;
  const data = readJson('remote_sensing.json');
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) {
    return res.status(404).json({ error: '未找到遥感场景', scene_id: sceneId });
  }
  res.json({
    dataset: data.dataset,
    source: data.source,
    description: data.description,
    scene
  });
});

app.get('/api/anomaly/:date', (req, res) => {
  const targetDate = req.params.date;
  const ts = readJson('timeseries_summary.json');
  const point = ts.series.find(p => p.date === targetDate);
  if (!point) {
    return res.status(404).json({ error: '未找到该日期数据', date: targetDate });
  }
  const logbook = readJson('ship_logbook.json');
  const remote = readJson('remote_sensing.json');
  const formula = readJson('calc_formula.json');
  const log = logbook.entries.find(e => e.id === point.log_id) || null;
  const scene = remote.scenes.find(s => s.id === point.rs_scene_id) || null;
  res.json({
    date: targetDate,
    anomaly: point.anomaly,
    anomaly_reason: point.anomaly_reason || null,
    anomaly_flags: point.anomaly_flags || [],
    summary: {
      bleaching_rate: point.bleaching_rate,
      water_temp_c: point.water_temp_c,
      coral_cover_pct: point.coral_cover_pct,
      driver: point.driver
    },
    ship_log: log,
    remote_scene: scene,
    calc_formula: formula
  });
});

app.get('/api/datasets', (req, res) => {
  res.json({
    datasets: ['2024_Q2_Xisha'],
    current: '2024_Q2_Xisha'
  });
});

app.listen(PORT, () => {
  console.log(`[珊瑚白化时序回放] 服务已启动: http://localhost:${PORT}`);
  console.log(`  - API健康检查:  http://localhost:${PORT}/api/health`);
  console.log(`  - 时序数据接口:  http://localhost:${PORT}/api/timeseries`);
  console.log(`  - 异常明细接口:  http://localhost:${PORT}/api/anomaly/2024-04-22`);
});
