const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const db = require('../database');

const assessmentService = require('../services/assessmentService');
const importService = require('../services/importService');
const exportService = require('../services/exportService');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/greenhouses', (req, res) => {
  const greenhouses = db.prepare(`
    SELECT g.*, 
      COUNT(DISTINCT s.id) as seedbed_count,
      COUNT(DISTINCT pb.id) as batch_count
    FROM greenhouses g
    LEFT JOIN seedbeds s ON g.id = s.greenhouse_id
    LEFT JOIN plant_batches pb ON s.id = pb.seedbed_id
    GROUP BY g.id
    ORDER BY g.name
  `).all();
  
  res.json(greenhouses);
});

router.post('/greenhouses', express.json(), (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: '温室名称不能为空' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO greenhouses (name, description) VALUES (?, ?)
    `).run(name, description || null);
    
    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: `温室 ${name} 创建成功`
    });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: `温室名称 ${name} 已存在` });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

router.get('/seedbeds', (req, res) => {
  const { greenhouse_id } = req.query;
  
  let query = `
    SELECT s.*, g.name as greenhouse_name,
      COUNT(DISTINCT pb.id) as batch_count
    FROM seedbeds s
    JOIN greenhouses g ON s.greenhouse_id = g.id
    LEFT JOIN plant_batches pb ON s.id = pb.seedbed_id
  `;
  const params = [];
  
  if (greenhouse_id) {
    query += ' WHERE s.greenhouse_id = ?';
    params.push(parseInt(greenhouse_id));
  }
  
  query += ' GROUP BY s.id ORDER BY g.name, s.code';
  
  const seedbeds = db.prepare(query).all(...params);
  res.json(seedbeds);
});

router.post('/seedbeds', express.json(), (req, res) => {
  const { greenhouse_id, code, name, location } = req.body;
  
  if (!greenhouse_id || !code) {
    return res.status(400).json({ error: '温室ID和苗床编号不能为空' });
  }
  
  try {
    const result = db.prepare(`
      INSERT INTO seedbeds (greenhouse_id, code, name, location) VALUES (?, ?, ?, ?)
    `).run(greenhouse_id, code, name || null, location || null);
    
    res.json({
      success: true,
      id: result.lastInsertRowid,
      message: `苗床 ${code} 创建成功`
    });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: `该温室下苗床编号 ${code} 已存在` });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

router.get('/plant-batches', (req, res) => {
  const { seedbed_id, greenhouse_id, active } = req.query;
  
  let query = `
    SELECT pb.*, 
      s.code as seedbed_code, s.name as seedbed_name,
      g.name as greenhouse_name
    FROM plant_batches pb
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE 1=1
  `;
  const params = [];
  
  if (seedbed_id) {
    query += ' AND pb.seedbed_id = ?';
    params.push(parseInt(seedbed_id));
  }
  
  if (greenhouse_id) {
    query += ' AND s.greenhouse_id = ?';
    params.push(parseInt(greenhouse_id));
  }
  
  if (active === 'true') {
    const today = dayjs().format('YYYY-MM-DD');
    query += ' AND date(?) BETWEEN date(pb.expected_flowering_start, "-3 days") AND date(pb.expected_flowering_end, "+3 days")';
    params.push(today);
  }
  
  query += ' ORDER BY g.name, s.code, pb.plant_name';
  
  const batches = db.prepare(query).all(...params);
  res.json(batches);
});

router.post('/plant-batches', express.json(), (req, res) => {
  const result = importService.importPlantBatches(req.body, 'direct_api');
  res.json(result);
});

router.post('/import/sensor', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传CSV文件' });
  }
  
  try {
    const result = await importService.importSensorReadings(req.file.path, req.file.filename);
    res.json({
      ...result,
      filename: req.file.originalname
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/pollination-plans', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传JSON文件' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const result = importService.importPollinationPlans(jsonData, req.file.filename);
    
    res.json({
      ...result,
      filename: req.file.originalname
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/isolation', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传JSON文件' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const result = importService.importIsolationSchedules(jsonData, req.file.filename);
    
    res.json({
      ...result,
      filename: req.file.originalname
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/plant-batches', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传JSON文件' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const result = importService.importPlantBatches(jsonData, req.file.filename);
    
    res.json({
      ...result,
      filename: req.file.originalname
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/employee-shifts', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传JSON文件' });
  }
  
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const result = importService.importEmployeeShifts(jsonData, req.file.filename);
    
    res.json({
      ...result,
      filename: req.file.originalname
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/import/greenhouses', express.json(), (req, res) => {
  const result = importService.importGreenhouses(req.body);
  res.json(result);
});

router.post('/import/seedbeds', express.json(), (req, res) => {
  const result = importService.importSeedbeds(req.body);
  res.json(result);
});

router.post('/assessment/run', express.json(), (req, res) => {
  const { date } = req.body;
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  try {
    const result = assessmentService.runDailyAssessment(assessmentDate);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/assessment', (req, res) => {
  const { date, greenhouse_id, seedbed_id, risk_type } = req.query;
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  let query = `
    SELECT 
      da.*,
      pb.plant_name, pb.variety, pb.batch_number, pb.quantity,
      pb.planting_date, pb.expected_flowering_start, pb.expected_flowering_end,
      s.code as seedbed_code, s.name as seedbed_name,
      g.name as greenhouse_name, g.id as greenhouse_id
    FROM daily_assessments da
    JOIN plant_batches pb ON da.plant_batch_id = pb.id
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE da.assessment_date = ?
  `;
  const params = [assessmentDate];
  
  if (greenhouse_id) {
    query += ' AND g.id = ?';
    params.push(parseInt(greenhouse_id));
  }
  
  if (seedbed_id) {
    query += ' AND s.id = ?';
    params.push(parseInt(seedbed_id));
  }
  
  if (risk_type) {
    query += ' AND da.risk_type = ?';
    params.push(risk_type);
  }
  
  query += ' ORDER BY g.name, s.code, pb.plant_name';
  
  const assessments = db.prepare(query).all(...params);
  
  const summary = {
    date: assessmentDate,
    total: assessments.length,
    suitable: assessments.filter(a => a.is_suitable_pollination).length,
    atRisk: assessments.filter(a => !a.is_suitable_pollination).length,
    byRiskType: {},
    byGreenhouse: {}
  };
  
  assessments.forEach(a => {
    if (!summary.byRiskType[a.risk_type]) {
      summary.byRiskType[a.risk_type] = 0;
    }
    summary.byRiskType[a.risk_type]++;
    
    if (!summary.byGreenhouse[a.greenhouse_name]) {
      summary.byGreenhouse[a.greenhouse_name] = { total: 0, suitable: 0 };
    }
    summary.byGreenhouse[a.greenhouse_name].total++;
    if (a.is_suitable_pollination) {
      summary.byGreenhouse[a.greenhouse_name].suitable++;
    }
  });
  
  res.json({
    summary,
    assessments
  });
});

router.put('/assessment/:plant_batch_id', express.json(), (req, res) => {
  const { plant_batch_id } = req.params;
  const { date, is_suitable, override_reason, notes } = req.body;
  
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  try {
    const result = assessmentService.updateAssessmentWithOverride(
      assessmentDate,
      parseInt(plant_batch_id),
      is_suitable,
      override_reason,
      notes
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/export/markdown', (req, res) => {
  const { date } = req.query;
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  const markdown = exportService.exportMarkdownWorksheet(assessmentDate);
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=授粉工作单_${assessmentDate}.md`);
  res.send(markdown);
});

router.get('/export/json', (req, res) => {
  const { date } = req.query;
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  const jsonData = exportService.exportJSONAudit(assessmentDate);
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=审计明细_${assessmentDate}.json`);
  res.json(jsonData);
});

router.get('/export/full-report', (req, res) => {
  const { date } = req.query;
  const assessmentDate = date || dayjs().format('YYYY-MM-DD');
  
  const report = exportService.exportFullDailyReport(assessmentDate);
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=完整日报_${assessmentDate}.json`);
  res.json(report);
});

router.get('/employee-shifts', (req, res) => {
  const { date } = req.query;
  const shiftDate = date || dayjs().format('YYYY-MM-DD');
  
  const shifts = db.prepare(`
    SELECT * FROM employee_shifts WHERE shift_date = ?
    ORDER BY shift_type, start_time
  `).all(shiftDate);
  
  res.json({
    date: shiftDate,
    total: shifts.length,
    shifts
  });
});

router.get('/pollination-plans', (req, res) => {
  const { date } = req.query;
  const planDate = date || dayjs().format('YYYY-MM-DD');
  
  const plans = db.prepare(`
    SELECT 
      pp.*,
      pb.plant_name, pb.variety, pb.batch_number,
      s.code as seedbed_code,
      g.name as greenhouse_name
    FROM pollination_plans pp
    JOIN plant_batches pb ON pp.plant_batch_id = pb.id
    JOIN seedbeds s ON pb.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE pp.plan_date = ?
    ORDER BY pp.priority DESC, g.name, s.code
  `).all(planDate);
  
  const priorityMap = { 'high': 1, 'normal': 2, 'low': 3 };
  plans.sort((a, b) => (priorityMap[a.priority] || 2) - (priorityMap[b.priority] || 2));
  
  res.json({
    date: planDate,
    total: plans.length,
    plans
  });
});

router.get('/isolation-schedules', (req, res) => {
  const { date, seedbed_id } = req.query;
  const checkDate = date || dayjs().format('YYYY-MM-DD');
  
  let query = `
    SELECT 
      isch.*,
      s.code as seedbed_code, s.name as seedbed_name,
      g.name as greenhouse_name
    FROM isolation_schedules isch
    JOIN seedbeds s ON isch.seedbed_id = s.id
    JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE date(?) BETWEEN date(isch.start_date) AND date(isch.end_date)
  `;
  const params = [checkDate];
  
  if (seedbed_id) {
    query += ' AND isch.seedbed_id = ?';
    params.push(parseInt(seedbed_id));
  }
  
  const schedules = db.prepare(query).all(...params);
  
  res.json({
    date: checkDate,
    total: schedules.length,
    schedules
  });
});

router.get('/sensor-readings', (req, res) => {
  const { date, seedbed_id } = req.query;
  const readingDate = date || dayjs().format('YYYY-MM-DD');
  
  let query = `
    SELECT 
      sr.*,
      s.code as seedbed_code,
      g.name as greenhouse_name
    FROM sensor_readings sr
    LEFT JOIN seedbeds s ON sr.seedbed_id = s.id
    LEFT JOIN greenhouses g ON s.greenhouse_id = g.id
    WHERE sr.reading_date = ?
  `;
  const params = [readingDate];
  
  if (seedbed_id) {
    query += ' AND sr.seedbed_id = ?';
    params.push(parseInt(seedbed_id));
  }
  
  query += ' ORDER BY s.code, sr.reading_time';
  
  const readings = db.prepare(query).all(...params);
  
  const stats = {
    totalReadings: readings.length,
    seedbeds: {},
    overall: {
      temp: { min: null, max: null, avg: null },
      humidity: { min: null, max: null, avg: null }
    }
  };
  
  const allTemps = readings.map(r => r.temperature).filter(t => t !== null);
  const allHumids = readings.map(r => r.humidity).filter(h => h !== null);
  
  if (allTemps.length > 0) {
    stats.overall.temp = {
      min: Math.min(...allTemps),
      max: Math.max(...allTemps),
      avg: allTemps.reduce((a, b) => a + b, 0) / allTemps.length
    };
  }
  
  if (allHumids.length > 0) {
    stats.overall.humidity = {
      min: Math.min(...allHumids),
      max: Math.max(...allHumids),
      avg: allHumids.reduce((a, b) => a + b, 0) / allHumids.length
    };
  }
  
  readings.forEach(r => {
    const code = r.seedbed_code || '未知';
    if (!stats.seedbeds[code]) {
      stats.seedbeds[code] = { readings: [], temp: {}, humidity: {} };
    }
    stats.seedbeds[code].readings.push({ time: r.reading_time, temp: r.temperature, humidity: r.humidity });
  });
  
  res.json({
    date: readingDate,
    stats,
    readings
  });
});

module.exports = router;
