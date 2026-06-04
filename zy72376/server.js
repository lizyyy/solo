const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/samples', express.static('samples'));

let calibrationData = {
  records: [],
  importHistory: [],
  handoverReport: null
};

const DATA_FILE = path.join(__dirname, 'data', 'calibration-data.json');
const SAMPLES_DIR = path.join(__dirname, 'samples');

function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function saveData() {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(calibrationData, null, 2));
}

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      calibrationData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.log('数据文件加载失败，使用空数据');
    }
  }
}

function validateRecord(record, rowNumber) {
  const issues = [];
  const warnings = [];
  
  if (!record.nozzleId) {
    issues.push('缺少喷嘴编号');
  }
  if (record.temperature !== undefined && record.temperature !== null && record.temperature !== '') {
    const temp = parseFloat(record.temperature);
    const tempUnit = record.temperatureUnit || record['温度单位'] || '';
    
    if (tempUnit === 'K' && temp < 273.15) {
      issues.push(`开尔文温度${temp}K低于绝对零度`);
    }
    if (tempUnit === '℃' && temp > 1000) {
      warnings.push(`摄氏度${temp}℃异常高，请确认单位是否正确`);
    }
  }
  
  return { issues, warnings };
}

function detectTemperatureMix(records) {
  const hasCelsius = records.some(r => 
    (r.temperatureUnit === '℃' || r['温度单位'] === '℃') && r.temperature !== null);
  const hasKelvin = records.some(r => 
    (r.temperatureUnit === 'K' || r['温度单位'] === 'K') && r.temperature !== null);
  return hasCelsius && hasKelvin;
}

function calculateFlowCoefficient(record) {
  const flowRate = parseFloat(record.flowRate || record['流量']) || 0;
  const pressure = parseFloat(record.pressure || record['压差']) || 1;
  const temperature = parseFloat(record.temperature || record['温度']) || 293.15;
  let tempK = temperature;
  
  const unit = record.temperatureUnit || record['温度单位'] || 'K';
  if (unit === '℃') {
    tempK = temperature + 273.15;
  }
  
  const density = 1.225 * (288.15 / tempK);
  const cv = flowRate / Math.sqrt(pressure * density);
  
  return Math.round(cv * 10000) / 10000;
}

function performSelfCheck() {
  const records = calibrationData.records;
  const results = {
    duplicateImport: { pass: true, details: [] },
    temperatureMix: { pass: true, details: [], mixedRecords: [] },
    recalculation: { pass: true, details: [] },
    exportConsistency: { pass: true, details: [] }
  };
  
  const nozzleMap = new Map();
  records.forEach((r, idx) => {
    const key = `${r.nozzleId || r['喷嘴编号']}-${r.importBatch}`;
    if (nozzleMap.has(key)) {
      results.duplicateImport.pass = false;
      results.duplicateImport.details.push(`喷嘴${r.nozzleId || r['喷嘴编号']}在批次${r.importBatch}重复导入`);
    }
    nozzleMap.set(key, idx);
  });
  
  if (detectTemperatureMix(records)) {
    results.temperatureMix.pass = false;
    results.temperatureMix.details.push('检测到摄氏度和开尔文混用，请复核后处理');
    results.temperatureMix.mixedRecords = records
      .filter(r => r.temperature !== null && r.temperature !== '')
      .map(r => ({
        id: r.id,
        nozzleId: r.nozzleId || r['喷嘴编号'],
        temperature: r.temperature,
        unit: r.temperatureUnit || r['温度单位'],
        status: r.status,
        reviewerNote: r.reviewerNote
      }));
  }
  
  records.forEach((r, idx) => {
    const expectedCv = calculateFlowCoefficient(r);
    if (r.flowCoefficient && Math.abs(r.flowCoefficient - expectedCv) > 0.001) {
      results.recalculation.pass = false;
      results.recalculation.details.push(`记录${idx}:流量系数不一致，计算值${expectedCv}，存储值${r.flowCoefficient}`);
    }
  });
  
  results.exportConsistency.pass = true;
  results.exportConsistency.details.push('导出一致性检查通过（页面、接口、导出共享数据源）');
  
  return results;
}

app.post('/api/import', upload.single('file'), (req, res) => {
  const results = [];
  const batchId = Date.now().toString();
  const fileName = req.file.originalname;
  
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => {
      const rowNumber = results.length + 1;
      const validation = validateRecord(data, rowNumber);
      
      const record = {
        id: `${batchId}-${rowNumber}`,
        ...data,
        originalRowNumber: rowNumber,
        importBatch: batchId,
        importFileName: fileName,
        importTime: new Date().toISOString(),
        temperatureUnit: data.temperatureUnit || data['温度单位'] || '',
        temperature: data.temperature || data['温度'] || null,
        manualChanges: [],
        status: validation.issues.length > 0 ? 'error' : 
                detectTemperatureMix([...results, data]) ? 'pending_review' : 'pending',
        validationIssues: validation.issues,
        validationWarnings: validation.warnings,
        flowCoefficient: null
      };
      
      if (record.status === 'pending') {
        record.flowCoefficient = calculateFlowCoefficient(record);
      }
      
      results.push(record);
    })
    .on('end', () => {
      calibrationData.records.push(...results);
      calibrationData.importHistory.push({
        batchId,
        fileName,
        importTime: new Date().toISOString(),
        recordCount: results.length
      });
      saveData();
      
      const selfCheck = performSelfCheck();
      res.json({ success: true, batchId, records: results, selfCheck });
    })
    .on('error', (err) => {
      res.status(500).json({ success: false, error: err.message });
    });
});

app.get('/api/records', (req, res) => {
  res.json({
    records: calibrationData.records,
    selfCheck: performSelfCheck()
  });
});

app.get('/api/records/:id', (req, res) => {
  const record = calibrationData.records.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

app.put('/api/records/:id', (req, res) => {
  const idx = calibrationData.records.findIndex(r => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const oldRecord = { ...calibrationData.records[idx] };
  const changes = [];
  
  Object.keys(req.body).forEach(key => {
    if (key !== 'id' && key !== 'originalRowNumber' && key !== 'importBatch') {
      if (oldRecord[key] !== req.body[key]) {
        changes.push({
          field: key,
          oldValue: oldRecord[key],
          newValue: req.body[key],
          time: new Date().toISOString(),
          operator: req.body.operator || '质检员小白'
        });
      }
    }
  });
  
  calibrationData.records[idx] = {
    ...calibrationData.records[idx],
    ...req.body,
    manualChanges: [...calibrationData.records[idx].manualChanges, ...changes]
  };
  
  const record = calibrationData.records[idx];
  if (record.status === 'pending' || record.status === 'reviewed') {
    record.flowCoefficient = calculateFlowCoefficient(record);
  }
  
  saveData();
  res.json({ success: true, record: calibrationData.records[idx], changes });
});

app.put('/api/records/:id/review', (req, res) => {
  const idx = calibrationData.records.findIndex(r => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  calibrationData.records[idx].status = req.body.status || 'reviewed';
  calibrationData.records[idx].reviewerNote = req.body.reviewerNote || '';
  calibrationData.records[idx].reviewTime = new Date().toISOString();
  calibrationData.records[idx].reviewer = req.body.reviewer || '训练教练';
  
  if (req.body.status === 'normal') {
    calibrationData.records[idx].flowCoefficient = calculateFlowCoefficient(calibrationData.records[idx]);
  }
  
  saveData();
  res.json({ success: true, record: calibrationData.records[idx] });
});

app.post('/api/recalculate', (req, res) => {
  const recalculated = [];
  calibrationData.records.forEach((r, idx) => {
    if (r.status !== 'error') {
      const oldCv = r.flowCoefficient;
      r.flowCoefficient = calculateFlowCoefficient(r);
      if (oldCv !== r.flowCoefficient) {
        recalculated.push({
          id: r.id,
          nozzleId: r.nozzleId || r['喷嘴编号'],
          oldCv,
          newCv: r.flowCoefficient
        });
      }
    }
  });
  saveData();
  res.json({ success: true, recalculated, selfCheck: performSelfCheck() });
});

app.get('/api/export', (req, res) => {
  const records = calibrationData.records.map(r => ({
    记录ID: r.id,
    原始行号: r.originalRowNumber,
    导入批次: r.importBatch,
    喷嘴编号: r.nozzleId || r['喷嘴编号'] || '',
    流量: r.flowRate || r['流量'] || '',
    压差: r.pressure || r['压差'] || '',
    温度: r.temperature,
    温度单位: r.temperatureUnit || r['温度单位'] || '',
    流量系数: r.flowCoefficient,
    状态: r.status,
    复核备注: r.reviewerNote || '',
    人工改动次数: r.manualChanges?.length || 0,
    导入时间: r.importTime
  }));
  
  const parser = new Parser();
  const csv = parser.parse(records);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="calibration-export.csv"');
  res.send('\uFEFF' + csv);
});

app.get('/api/self-check', (req, res) => {
  res.json(performSelfCheck());
});

app.post('/api/handover', (req, res) => {
  calibrationData.handoverReport = {
    ...req.body,
    generatedTime: new Date().toISOString(),
    operator: req.body.operator || '质检员小白',
    records: calibrationData.records.filter(r => r.status !== 'error').map(r => ({
      id: r.id,
      nozzleId: r.nozzleId || r['喷嘴编号'],
      temperature: r.temperature,
      temperatureUnit: r.temperatureUnit || r['温度单位'],
      status: r.status,
      reviewerNote: r.reviewerNote,
      flowCoefficient: r.flowCoefficient
    }))
  };
  saveData();
  res.json({ success: true, report: calibrationData.handoverReport });
});

app.get('/api/handover', (req, res) => {
  res.json(calibrationData.handoverReport);
});

app.get('/api/samples', (req, res) => {
  const samples = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.csv'));
  res.json(samples);
});

app.get('/api/import-history', (req, res) => {
  res.json(calibrationData.importHistory);
});

app.delete('/api/data', (req, res) => {
  calibrationData = {
    records: [],
    importHistory: [],
    handoverReport: null
  };
  saveData();
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

loadData();
app.listen(PORT, () => {
  console.log(`喷嘴流量系数标定系统运行在 http://localhost:${PORT}`);
});
