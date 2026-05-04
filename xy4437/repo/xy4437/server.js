const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

let appState = {
  waterPoints: [],
  inspections: [],
  waterDeliveries: [],
  volunteerSchedules: [],
  notes: [],
  overrides: []
};

function loadState() {
  try {
    const statePath = path.join(DATA_DIR, 'app-state.json');
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      appState = JSON.parse(data);
    }
  } catch (err) {
    console.error('加载状态失败:', err);
  }
}

function saveState() {
  try {
    const statePath = path.join(DATA_DIR, 'app-state.json');
    fs.writeFileSync(statePath, JSON.stringify(appState, null, 2));
  } catch (err) {
    console.error('保存状态失败:', err);
  }
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        fs.removeSync(filePath);
        resolve(results);
      })
      .on('error', reject);
  });
}

function assessRisks(point) {
  const risks = [];
  let status = 'green';

  const now = moment();
  
  const pointInspections = appState.inspections.filter(
    i => i.pointId === point.id
  );
  
  const latestInspection = pointInspections.length > 0 
    ? pointInspections.reduce((a, b) => 
        moment(a.inspectionTime).isAfter(moment(b.inspectionTime)) ? a : b
      )
    : null;

  if (latestInspection) {
    const inspectionAge = now.diff(moment(latestInspection.inspectionTime), 'hours');
    
    if (inspectionAge > 24) {
      risks.push({
        type: 'inspection_expired',
        severity: 'red',
        message: `检测已过期 ${Math.floor(inspectionAge / 24)} 天`
      });
      status = 'red';
    }

    const chlorine = parseFloat(latestInspection.residualChlorine);
    if (chlorine < 0.05 || chlorine > 4.0) {
      risks.push({
        type: 'chlorine_out_of_bounds',
        severity: 'red',
        message: `余氯值异常: ${chlorine} mg/L (正常范围: 0.05-4.0)`
      });
      status = 'red';
    } else if (chlorine < 0.3 || chlorine > 2.0) {
      risks.push({
        type: 'chlorine_warning',
        severity: 'yellow',
        message: `余氯值需注意: ${chlorine} mg/L (建议范围: 0.3-2.0)`
      });
      if (status === 'green') status = 'yellow';
    }

    const turbidity = parseFloat(latestInspection.turbidity);
    if (turbidity > 1.0) {
      risks.push({
        type: 'turbidity_high',
        severity: 'red',
        message: `浊度过高: ${turbidity} NTU (应≤1.0)`
      });
      status = 'red';
    } else if (turbidity > 0.5) {
      risks.push({
        type: 'turbidity_warning',
        severity: 'yellow',
        message: `浊度需注意: ${turbidity} NTU (建议≤0.5)`
      });
      if (status === 'green') status = 'yellow';
    }
  } else {
    risks.push({
      type: 'no_inspection',
      severity: 'red',
      message: '暂无检测记录'
    });
    status = 'red';
  }

  const pointDeliveries = appState.waterDeliveries.filter(
    d => d.pointId === point.id
  );
  
  const latestDelivery = pointDeliveries.length > 0
    ? pointDeliveries.reduce((a, b) => 
        moment(a.deliveryTime).isAfter(moment(b.deliveryTime)) ? a : b
      )
    : null;

  if (latestDelivery) {
    const deliveryAge = now.diff(moment(latestDelivery.deliveryTime), 'hours');
    
    if (deliveryAge > 12) {
      risks.push({
        type: 'water_delay',
        severity: 'yellow',
        message: `补水延误: 已 ${Math.floor(deliveryAge)} 小时未补水`
      });
      if (status === 'green') status = 'yellow';
    }
  }

  const hasPriorityDelivery = pointDeliveries.some(d => d.isPriority === true || d.isPriority === 'true');
  if (point.isPriority === true || point.isPriority === 'true') {
    if (!hasPriorityDelivery) {
      risks.push({
        type: 'priority_missing_delivery',
        severity: 'red',
        message: '重点人群点位缺少配送记录'
      });
      status = 'red';
    }
  }

  const activeOverrides = appState.overrides.filter(
    o => o.pointId === point.id && o.isActive
  );
  
  if (activeOverrides.length > 0) {
    const latestOverride = activeOverrides.reduce((a, b) => 
      moment(a.createdAt).isAfter(moment(b.createdAt)) ? a : b
    );
    
    if (latestOverride.overrideStatus) {
      status = latestOverride.overrideStatus;
    }
  }

  return {
    status,
    risks,
    latestInspection,
    latestDelivery
  };
}

function checkVolunteerConflicts() {
  const conflicts = [];
  
  const schedules = [...appState.volunteerSchedules].sort((a, b) => {
    if (a.volunteerName === b.volunteerName) {
      return moment(a.startTime).valueOf() - moment(b.startTime).valueOf();
    }
    return 0;
  });

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      if (schedules[i].volunteerName === schedules[j].volunteerName) {
        const aStart = moment(schedules[i].startTime);
        const aEnd = moment(schedules[i].endTime);
        const bStart = moment(schedules[j].startTime);
        const bEnd = moment(schedules[j].endTime);

        if (aStart.isBefore(bEnd) && bStart.isBefore(aEnd)) {
          conflicts.push({
            volunteerName: schedules[i].volunteerName,
            conflict1: {
              startTime: schedules[i].startTime,
              endTime: schedules[i].endTime,
              pointName: schedules[i].pointName || '未知点位'
            },
            conflict2: {
              startTime: schedules[j].startTime,
              endTime: schedules[j].endTime,
              pointName: schedules[j].pointName || '未知点位'
            }
          });
        }
      }
    }
  }

  return conflicts;
}

app.post('/api/upload/water-points', upload.single('file'), async (req, res) => {
  try {
    const data = await parseCSV(req.file.path);
    appState.waterPoints = data.map((row, index) => ({
      id: row.id || `WP-${index + 1}`,
      name: row.name || row.pointName || `点位 ${index + 1}`,
      address: row.address || '',
      isPriority: row.isPriority === 'true' || row.isPriority === true || false,
      priorityReason: row.priorityReason || '',
      capacity: row.capacity ? parseFloat(row.capacity) : null,
      contactPerson: row.contactPerson || '',
      contactPhone: row.contactPhone || '',
      notes: row.notes || ''
    }));
    saveState();
    res.json({ success: true, count: appState.waterPoints.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/upload/inspections', upload.single('file'), async (req, res) => {
  try {
    const data = await parseCSV(req.file.path);
    appState.inspections = data.map((row, index) => ({
      id: row.id || `INSP-${index + 1}`,
      pointId: row.pointId || '',
      inspectionTime: row.inspectionTime || row.time || '',
      residualChlorine: row.residualChlorine || row.chlorine || '0',
      turbidity: row.turbidity || '0',
      inspector: row.inspector || '',
      notes: row.notes || ''
    }));
    saveState();
    res.json({ success: true, count: appState.inspections.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/upload/water-deliveries', upload.single('file'), async (req, res) => {
  try {
    const data = await parseCSV(req.file.path);
    appState.waterDeliveries = data.map((row, index) => ({
      id: row.id || `DEL-${index + 1}`,
      pointId: row.pointId || '',
      deliveryTime: row.deliveryTime || row.time || '',
      vehicleNumber: row.vehicleNumber || '',
      volume: row.volume ? parseFloat(row.volume) : null,
      driver: row.driver || '',
      isPriority: row.isPriority === 'true' || row.isPriority === true || false,
      notes: row.notes || ''
    }));
    saveState();
    res.json({ success: true, count: appState.waterDeliveries.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/upload/volunteer-schedules', upload.single('file'), async (req, res) => {
  try {
    const data = await parseCSV(req.file.path);
    appState.volunteerSchedules = data.map((row, index) => ({
      id: row.id || `SCH-${index + 1}`,
      volunteerName: row.volunteerName || row.name || '',
      volunteerPhone: row.volunteerPhone || '',
      pointId: row.pointId || '',
      pointName: row.pointName || '',
      startTime: row.startTime || '',
      endTime: row.endTime || '',
      role: row.role || '',
      notes: row.notes || ''
    }));
    saveState();
    res.json({ success: true, count: appState.volunteerSchedules.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/points', (req, res) => {
  const pointsWithRisk = appState.waterPoints.map(point => ({
    ...point,
    riskAssessment: assessRisks(point)
  }));
  
  res.json({
    success: true,
    data: pointsWithRisk,
    stats: {
      green: pointsWithRisk.filter(p => p.riskAssessment.status === 'green').length,
      yellow: pointsWithRisk.filter(p => p.riskAssessment.status === 'yellow').length,
      red: pointsWithRisk.filter(p => p.riskAssessment.status === 'red').length
    }
  });
});

app.get('/api/points/:id', (req, res) => {
  const point = appState.waterPoints.find(p => p.id === req.params.id);
  
  if (!point) {
    return res.status(404).json({ success: false, error: '点位未找到' });
  }
  
  const pointInspections = appState.inspections.filter(i => i.pointId === point.id);
  const pointDeliveries = appState.waterDeliveries.filter(d => d.pointId === point.id);
  const pointSchedules = appState.volunteerSchedules.filter(s => s.pointId === point.id);
  const pointNotes = appState.notes.filter(n => n.pointId === point.id);
  const pointOverrides = appState.overrides.filter(o => o.pointId === point.id);
  
  res.json({
    success: true,
    data: {
      ...point,
      riskAssessment: assessRisks(point),
      inspections: pointInspections,
      deliveries: pointDeliveries,
      schedules: pointSchedules,
      notes: pointNotes,
      overrides: pointOverrides
    }
  });
});

app.get('/api/volunteer-conflicts', (req, res) => {
  const conflicts = checkVolunteerConflicts();
  res.json({
    success: true,
    data: conflicts,
    count: conflicts.length
  });
});

app.post('/api/notes', (req, res) => {
  const note = {
    id: uuidv4(),
    pointId: req.body.pointId,
    content: req.body.content,
    createdBy: req.body.createdBy || '值班员',
    createdAt: moment().toISOString(),
    updatedAt: moment().toISOString()
  };
  
  appState.notes.push(note);
  saveState();
  
  res.json({ success: true, data: note });
});

app.put('/api/notes/:id', (req, res) => {
  const noteIndex = appState.notes.findIndex(n => n.id === req.params.id);
  
  if (noteIndex === -1) {
    return res.status(404).json({ success: false, error: '备注未找到' });
  }
  
  appState.notes[noteIndex] = {
    ...appState.notes[noteIndex],
    content: req.body.content,
    updatedAt: moment().toISOString()
  };
  
  saveState();
  res.json({ success: true, data: appState.notes[noteIndex] });
});

app.post('/api/overrides', (req, res) => {
  appState.overrides.forEach(o => {
    if (o.pointId === req.body.pointId) {
      o.isActive = false;
    }
  });
  
  const override = {
    id: uuidv4(),
    pointId: req.body.pointId,
    originalStatus: req.body.originalStatus,
    overrideStatus: req.body.overrideStatus,
    reason: req.body.reason,
    createdBy: req.body.createdBy || '值班员',
    createdAt: moment().toISOString(),
    isActive: true
  };
  
  appState.overrides.push(override);
  saveState();
  
  res.json({ success: true, data: override });
});

app.get('/api/export/markdown', (req, res) => {
  const pointsWithRisk = appState.waterPoints.map(point => ({
    ...point,
    riskAssessment: assessRisks(point)
  }));
  
  const redPoints = pointsWithRisk.filter(p => p.riskAssessment.status === 'red');
  const yellowPoints = pointsWithRisk.filter(p => p.riskAssessment.status === 'yellow');
  const greenPoints = pointsWithRisk.filter(p => p.riskAssessment.status === 'green');
  
  const volunteerConflicts = checkVolunteerConflicts();
  
  let markdown = `# 水站放行交接单

**生成时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}

## 统计概览

| 状态 | 数量 |
|------|------|
| 🟢 正常 | ${greenPoints.length} |
| 🟡 警告 | ${yellowPoints.length} |
| 🔴 危险 | ${redPoints.length} |
| **总计** | **${pointsWithRisk.length}** |

`;

  if (volunteerConflicts.length > 0) {
    markdown += `## ⚠️ 志愿者排班冲突

共发现 ${volunteerConflicts.length} 处冲突：

`;
    volunteerConflicts.forEach((conflict, index) => {
      markdown += `### 冲突 ${index + 1}: ${conflict.volunteerName}

- **冲突1**: ${conflict.conflict1.pointName} (${conflict.conflict1.startTime} - ${conflict.conflict1.endTime})
- **冲突2**: ${conflict.conflict2.pointName} (${conflict.conflict2.startTime} - ${conflict.conflict2.endTime})

`;
    });
  }

  if (redPoints.length > 0) {
    markdown += `## 🔴 风险点位（需立即处理）

`;
    redPoints.forEach(point => {
      markdown += `### ${point.name}${point.isPriority ? ' (重点人群点位)' : ''}

- **地址**: ${point.address || '未知'}
- **状态**: 🔴 危险
- **风险项**:
${point.riskAssessment.risks.map(r => `  - [${r.severity === 'red' ? '危险' : '警告'}] ${r.message}`).join('\n')}
`;
      const pointNotes = appState.notes.filter(n => n.pointId === point.id);
      if (pointNotes.length > 0) {
        markdown += `- **备注**:\n${pointNotes.map(n => `  - ${n.createdBy}: ${n.content}`).join('\n')}\n`;
      }
      markdown += '\n';
    });
  }

  if (yellowPoints.length > 0) {
    markdown += `## 🟡 警告点位（需关注）

`;
    yellowPoints.forEach(point => {
      markdown += `### ${point.name}${point.isPriority ? ' (重点人群点位)' : ''}

- **地址**: ${point.address || '未知'}
- **状态**: 🟡 警告
- **风险项**:
${point.riskAssessment.risks.map(r => `  - [${r.severity === 'red' ? '危险' : '警告'}] ${r.message}`).join('\n')}
`;
      const pointNotes = appState.notes.filter(n => n.pointId === point.id);
      if (pointNotes.length > 0) {
        markdown += `- **备注**:\n${pointNotes.map(n => `  - ${n.createdBy}: ${n.content}`).join('\n')}\n`;
      }
      markdown += '\n';
    });
  }

  if (greenPoints.length > 0) {
    markdown += `## 🟢 正常点位

以下点位状态正常：

${greenPoints.map(p => `- ${p.name}`).join('\n')}

`;
  }

  const allNotes = appState.notes;
  if (allNotes.length > 0) {
    markdown += `## 值班备注

`;
    allNotes.forEach(note => {
      const point = appState.waterPoints.find(p => p.id === note.pointId);
      markdown += `- **${point ? point.name : '未知点位'}** (${note.createdAt}): ${note.content}\n`;
    });
    markdown += '\n';
  }

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename=water-station-handover-${moment().format('YYYYMMDD-HHmmss')}.md`);
  res.send(markdown);
});

app.get('/api/export/json', (req, res) => {
  const exportData = {
    generatedAt: moment().toISOString(),
    waterPoints: appState.waterPoints,
    inspections: appState.inspections,
    waterDeliveries: appState.waterDeliveries,
    volunteerSchedules: appState.volunteerSchedules,
    notes: appState.notes,
    overrides: appState.overrides,
    volunteerConflicts: checkVolunteerConflicts(),
    riskSummary: {
      points: appState.waterPoints.map(point => ({
        id: point.id,
        name: point.name,
        riskAssessment: assessRisks(point)
      }))
    }
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=water-station-audit-${moment().format('YYYYMMDD-HHmmss')}.json`);
  res.json(exportData);
});

app.get('/api/stats', (req, res) => {
  const pointsWithRisk = appState.waterPoints.map(point => ({
    ...point,
    riskAssessment: assessRisks(point)
  }));
  
  const volunteerConflicts = checkVolunteerConflicts();
  
  res.json({
    success: true,
    data: {
      totalPoints: appState.waterPoints.length,
      totalInspections: appState.inspections.length,
      totalDeliveries: appState.waterDeliveries.length,
      totalVolunteers: appState.volunteerSchedules.length,
      riskStats: {
        green: pointsWithRisk.filter(p => p.riskAssessment.status === 'green').length,
        yellow: pointsWithRisk.filter(p => p.riskAssessment.status === 'yellow').length,
        red: pointsWithRisk.filter(p => p.riskAssessment.status === 'red').length
      },
      volunteerConflicts: volunteerConflicts.length
    }
  });
});

app.delete('/api/data', (req, res) => {
  appState = {
    waterPoints: [],
    inspections: [],
    waterDeliveries: [],
    volunteerSchedules: [],
    notes: [],
    overrides: []
  };
  saveState();
  res.json({ success: true, message: '所有数据已清除' });
});

loadState();

app.listen(PORT, () => {
  console.log(`水站放行工具已启动: http://localhost:${PORT}`);
});
