const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const EXPORTS_DIR = path.join(__dirname, 'exports');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

function readJSON(filepath, defaultValue = null) {
  try {
    if (fs.existsSync(filepath)) {
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Read JSON error:', e);
  }
  return defaultValue;
}

function writeJSON(filepath, data) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
}

const TANKS_FILE = path.join(DATA_DIR, 'tanks.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const defaultTanks = [
  { id: 'tank-1', name: 'A槽', volume: 500, cropType: '生菜', changeInterval: 14 },
  { id: 'tank-2', name: 'B槽', volume: 800, cropType: '番茄', changeInterval: 14 },
  { id: 'tank-3', name: 'C槽', volume: 300, cropType: '草莓', changeInterval: 10 }
];

const defaultConfig = {
  targetEC: { seedling: 1.2, vegetative: 1.8, flowering: 2.2, fruiting: 2.5 },
  targetPH: { min: 5.5, max: 6.5, optimal: 6.0 },
  stockSolutionA: { concentration: 100, ecPerML: 0.02 },
  stockSolutionB: { concentration: 100, ecPerML: 0.02 },
  acidSolution: { type: '硝酸', concentration: 65, phAdjustFactor: 0.5 },
  baseSolution: { type: '氢氧化钾', concentration: 50, phAdjustFactor: 0.5 },
  waterEC: 0.1,
  driftThreshold: 0.2,
  overDoseThreshold: 2.0,
  gapDays: 3,
  changeWarningDays: 3
};

function calculateRecommendations(record, tank, config, previousRecords) {
  const { ec, ph, temperature, level, cropStage } = record;
  const volume = tank.volume;
  
  const targetEC = config.targetEC[cropStage] || config.targetEC.vegetative;
  const targetPH = config.targetPH.optimal;
  
  const currentVolume = volume * (level / 100);
  const waterNeeded = volume - currentVolume;
  
  const ecDiff = targetEC - ec;
  let solutionA = 0;
  let solutionB = 0;
  
  if (ecDiff > 0) {
    const ecFromWater = config.waterEC * (waterNeeded / volume);
    const ecToAdd = ecDiff - ecFromWater;
    if (ecToAdd > 0) {
      const mlPerEC = 1 / config.stockSolutionA.ecPerML;
      const totalML = ecToAdd * mlPerEC * (currentVolume + waterNeeded) / 1000;
      solutionA = Math.round(totalML * 0.5);
      solutionB = Math.round(totalML * 0.5);
    }
  }
  
  let acidNeeded = 0;
  let baseNeeded = 0;
  const phDiff = ph - targetPH;
  
  if (Math.abs(phDiff) > 0.1) {
    const adjustmentML = Math.abs(phDiff) * config.acidSolution.phAdjustFactor * currentVolume / 1000;
    if (phDiff > 0) {
      acidNeeded = Math.round(adjustmentML * 10) / 10;
    } else {
      baseNeeded = Math.round(adjustmentML * 10) / 10;
    }
  }
  
  return {
    tankId: tank.id,
    tankName: tank.name,
    timestamp: record.timestamp,
    current: {
      ec,
      ph,
      temperature,
      level,
      cropStage,
      volume: currentVolume
    },
    target: {
      ec: targetEC,
      ph: targetPH,
      volume: volume
    },
    recommendations: {
      water: Math.round(waterNeeded),
      solutionA,
      solutionB,
      acid: acidNeeded,
      base: baseNeeded
    },
    summary: generateSummary(ec, ph, targetEC, targetPH, waterNeeded, solutionA, solutionB, acidNeeded, baseNeeded)
  };
}

function generateSummary(ec, ph, targetEC, targetPH, water, solA, solB, acid, base) {
  const parts = [];
  
  if (water > 0) {
    parts.push(`补水 ${water}L`);
  }
  
  if (solA > 0 || solB > 0) {
    parts.push(`添加 A 液 ${solA}ml、B 液 ${solB}ml`);
  }
  
  if (acid > 0) {
    parts.push(`加酸 ${acid}ml 调 pH`);
  }
  if (base > 0) {
    parts.push(`加碱 ${base}ml 调 pH`);
  }
  
  if (parts.length === 0) {
    return '当前参数正常，无需调整';
  }
  
  return parts.join('；');
}

function detectRisks(records, tank, config) {
  const risks = [];
  const tankRecords = records
    .filter(r => r.tankId === tank.id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  if (tankRecords.length < 2) {
    return risks;
  }
  
  const recent3 = tankRecords.slice(-3);
  if (recent3.length >= 3) {
    const ecTrend = recent3[2].ec - recent3[0].ec;
    const phTrend = recent3[2].ph - recent3[0].ph;
    
    if (Math.abs(ecTrend) > config.driftThreshold) {
      risks.push({
        type: 'drift',
        severity: 'warning',
        message: `EC 连续${ecTrend > 0 ? '上升' : '下降'}趋势明显，3 天变化 ${ecTrend.toFixed(2)}`,
        parameter: 'ec',
        trend: ecTrend > 0 ? 'up' : 'down',
        value: ecTrend
      });
    }
    
    if (Math.abs(phTrend) > 0.3) {
      risks.push({
        type: 'drift',
        severity: 'warning',
        message: `pH 连续${phTrend > 0 ? '上升' : '下降'}趋势明显，3 天变化 ${phTrend.toFixed(2)}`,
        parameter: 'ph',
        trend: phTrend > 0 ? 'up' : 'down',
        value: phTrend
      });
    }
  }
  
  const lastRecord = tankRecords[tankRecords.length - 1];
  const secondLast = tankRecords[tankRecords.length - 2];
  
  if (lastRecord && secondLast) {
    const ecChange = lastRecord.ec - secondLast.ec;
    if (Math.abs(ecChange) > config.overDoseThreshold) {
      risks.push({
        type: 'overdose',
        severity: 'error',
        message: `EC 骤变 ${ecChange > 0 ? '+' : ''}${ecChange.toFixed(2)}，可能存在过量投药`,
        parameter: 'ec',
        change: ecChange
      });
    }
  }
  
  if (tankRecords.length >= 1) {
    const lastDate = new Date(tankRecords[tankRecords.length - 1].timestamp);
    const now = new Date();
    const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    
    if (daysSince > config.gapDays) {
      risks.push({
        type: 'gap',
        severity: 'warning',
        message: `已连续 ${daysSince} 天无记录`,
        days: daysSince
      });
    }
  }
  
  if (tankRecords.length >= 1 && tank.changeInterval) {
    const firstRecord = tankRecords[0];
    const firstDate = new Date(firstRecord.timestamp);
    const now = new Date();
    const daysSinceStart = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));
    const daysUntilChange = tank.changeInterval - (daysSinceStart % tank.changeInterval);
    
    if (daysUntilChange <= config.changeWarningDays && daysUntilChange > 0) {
      risks.push({
        type: 'change_due',
        severity: 'info',
        message: `距离换液还有 ${daysUntilChange} 天`,
        daysUntil: daysUntilChange,
        interval: tank.changeInterval
      });
    }
  }
  
  return risks;
}

app.get('/api/tanks', (req, res) => {
  const tanks = readJSON(TANKS_FILE, defaultTanks);
  res.json(tanks);
});

app.post('/api/tanks', (req, res) => {
  const tanks = req.body;
  writeJSON(TANKS_FILE, tanks);
  res.json({ success: true, tanks });
});

app.get('/api/config', (req, res) => {
  const config = readJSON(CONFIG_FILE, defaultConfig);
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const config = req.body;
  writeJSON(CONFIG_FILE, config);
  res.json({ success: true, config });
});

app.get('/api/records', (req, res) => {
  const records = readJSON(RECORDS_FILE, []);
  res.json(records);
});

app.post('/api/records', (req, res) => {
  const newRecords = Array.isArray(req.body) ? req.body : [req.body];
  const existingRecords = readJSON(RECORDS_FILE, []);
  
  const timestamp = new Date().toISOString();
  const recordsWithIds = newRecords.map((r, i) => ({
    id: `record-${Date.now()}-${i}`,
    createdAt: timestamp,
    ...r
  }));
  
  const allRecords = [...existingRecords, ...recordsWithIds];
  writeJSON(RECORDS_FILE, allRecords);
  
  res.json({ success: true, records: recordsWithIds });
});

app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const records = readJSON(RECORDS_FILE, []);
  const filtered = records.filter(r => r.id !== id);
  writeJSON(RECORDS_FILE, filtered);
  res.json({ success: true });
});

app.get('/api/reviews', (req, res) => {
  const reviews = readJSON(REVIEWS_FILE, []);
  res.json(reviews);
});

app.post('/api/reviews', (req, res) => {
  const review = req.body;
  const existingReviews = readJSON(REVIEWS_FILE, []);
  
  const newReview = {
    id: `review-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...review
  };
  
  existingReviews.push(newReview);
  writeJSON(REVIEWS_FILE, existingReviews);
  
  res.json({ success: true, review: newReview });
});

app.post('/api/calculate', (req, res) => {
  const { record, tankId } = req.body;
  const tanks = readJSON(TANKS_FILE, defaultTanks);
  const config = readJSON(CONFIG_FILE, defaultConfig);
  const records = readJSON(RECORDS_FILE, []);
  
  const tank = tanks.find(t => t.id === tankId);
  if (!tank) {
    return res.status(404).json({ error: '水槽不存在' });
  }
  
  const recommendation = calculateRecommendations(record, tank, config, records);
  const risks = detectRisks([...records, record], tank, config);
  
  res.json({
    recommendation,
    risks
  });
});

app.post('/api/calculate/batch', (req, res) => {
  const { records, date } = req.body;
  const tanks = readJSON(TANKS_FILE, defaultTanks);
  const config = readJSON(CONFIG_FILE, defaultConfig);
  const existingRecords = readJSON(RECORDS_FILE, []);
  
  const results = [];
  
  for (const recordData of records) {
    const tank = tanks.find(t => t.id === recordData.tankId);
    if (!tank) continue;
    
    const record = {
      ...recordData,
      timestamp: date || new Date().toISOString()
    };
    
    const recommendation = calculateRecommendations(record, tank, config, existingRecords);
    const risks = detectRisks([...existingRecords, record], tank, config);
    
    results.push({
      tankId: tank.id,
      tankName: tank.name,
      record,
      recommendation,
      risks
    });
  }
  
  res.json(results);
});

function generateMarkdownOperationSheet(batchResults, dateStr) {
  let md = `# 营养液校准操作单\n\n`;
  md += `日期：${dateStr}\n\n`;
  md += `---\n\n`;
  
  for (const result of batchResults) {
    md += `## ${result.tankName}\n\n`;
    
    md += `### 当前参数\n\n`;
    md += `| 参数 | 当前值 | 目标值 |\n`;
    md += `|------|--------|--------|\n`;
    md += `| EC | ${result.record.ec} mS/cm | ${result.recommendation.target.ec} mS/cm |\n`;
    md += `| pH | ${result.record.ph} | ${result.recommendation.target.ph} |\n`;
    md += `| 水温 | ${result.record.temperature}°C | - |\n`;
    md += `| 液位 | ${result.record.level}% | 100% |\n`;
    md += `| 作物阶段 | ${result.record.cropStage} | - |\n\n`;
    
    md += `### 操作建议\n\n`;
    const rec = result.recommendation.recommendations;
    const actions = [];
    if (rec.water > 0) actions.push(`1. **补水**：${rec.water}L`);
    if (rec.solutionA > 0 || rec.solutionB > 0) {
      actions.push(`2. **添加营养液**：A 液 ${rec.solutionA}ml，B 液 ${rec.solutionB}ml`);
    }
    if (rec.acid > 0) actions.push(`3. **调酸**：添加 ${rec.acid}ml 酸液`);
    if (rec.base > 0) actions.push(`4. **调碱**：添加 ${rec.base}ml 碱液`);
    
    if (actions.length === 0) {
      md += `当前参数正常，无需调整。\n\n`;
    } else {
      md += actions.join('\n') + '\n\n';
    }
    
    if (result.risks && result.risks.length > 0) {
      md += `### ⚠️ 风险提示\n\n`;
      for (const risk of result.risks) {
        const severityEmoji = risk.severity === 'error' ? '🔴' : risk.severity === 'warning' ? '🟡' : '🔵';
        md += `- ${severityEmoji} ${risk.message}\n`;
      }
      md += '\n';
    }
    
    md += `---\n\n`;
  }
  
  md += `\n## 复核记录\n\n`;
  md += `复核人：____________\n`;
  md += `复核日期：____________\n`;
  md += `复核结论：□ 同意执行  □ 需要调整\n`;
  md += `备注：____________\n`;
  
  return md;
}

app.post('/api/export/markdown', (req, res) => {
  const { results, date } = req.body;
  const dateStr = date || new Date().toISOString().split('T')[0];
  const markdown = generateMarkdownOperationSheet(results, dateStr);
  
  const filename = `operation-sheet-${dateStr}.md`;
  const filepath = path.join(EXPORTS_DIR, filename);
  
  fs.writeFileSync(filepath, markdown, 'utf8');
  
  res.download(filepath, filename);
});

function generateAuditPackageJSON(results, dateStr, review) {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    date: dateStr,
    summary: {
      totalTanks: results.length,
      tanksNeedingAction: results.filter(r => 
        r.recommendation.recommendations.water > 0 ||
        r.recommendation.recommendations.solutionA > 0 ||
        r.recommendation.recommendations.acid > 0 ||
        r.recommendation.recommendations.base > 0
      ).length,
      risksCount: results.reduce((sum, r) => sum + (r.risks?.length || 0), 0)
    },
    records: results.map(r => ({
      tankId: r.tankId,
      tankName: r.tankName,
      record: r.record,
      recommendation: r.recommendation,
      risks: r.risks || []
    })),
    review: review || null,
    metadata: {
      exporter: 'hydroponic-calibrator',
      format: 'audit-package-v1'
    }
  };
}

app.post('/api/export/audit', (req, res) => {
  const { results, date, review } = req.body;
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  const auditData = generateAuditPackageJSON(results, dateStr, review);
  const markdown = generateMarkdownOperationSheet(results, dateStr);
  
  const zipFilename = `audit-package-${dateStr}.zip`;
  const zipPath = path.join(EXPORTS_DIR, zipFilename);
  
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    res.download(zipPath, zipFilename);
  });
  
  archive.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
  
  archive.pipe(output);
  
  archive.append(JSON.stringify(auditData, null, 2), { name: 'audit-data.json' });
  archive.append(markdown, { name: 'operation-sheet.md' });
  
  const tanks = readJSON(TANKS_FILE, defaultTanks);
  const config = readJSON(CONFIG_FILE, defaultConfig);
  const records = readJSON(RECORDS_FILE, []);
  
  archive.append(JSON.stringify(tanks, null, 2), { name: 'tanks.json' });
  archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });
  archive.append(JSON.stringify(records, null, 2), { name: 'historical-records.json' });
  
  archive.finalize();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`水培营养液校准器已启动：http://localhost:${PORT}`);
});
