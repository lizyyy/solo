const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Papa = require('papaparse');
const _ = require('lodash');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, '../data');

app.use(cors());
app.use(express.json());

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const DATA_FILES = {
  registrations: path.join(DATA_DIR, 'registrations.json'),
  rentals: path.join(DATA_DIR, 'rentals.json'),
  coaches: path.join(DATA_DIR, 'coaches.json'),
  slopes: path.join(DATA_DIR, 'slopes.json'),
  weather: path.join(DATA_DIR, 'weather.json'),
  overrides: path.join(DATA_DIR, 'overrides.json'),
  classes: path.join(DATA_DIR, 'classes.json')
};

function loadData(filePath, defaultValue = []) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/data/:type', (req, res) => {
  const { type } = req.params;
  const filePath = DATA_FILES[type];
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid data type' });
  }
  res.json(loadData(filePath));
});

app.post('/api/data/:type', (req, res) => {
  const { type } = req.params;
  const filePath = DATA_FILES[type];
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid data type' });
  }
  saveData(filePath, req.body);
  res.json({ success: true });
});

app.post('/api/import/:type', upload.single('file'), (req, res) => {
  const { type } = req.params;
  const filePath = DATA_FILES[type];
  if (!filePath) {
    return res.status(400).json({ error: 'Invalid data type' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  try {
    let data;
    const fileContent = req.file.buffer.toString('utf8');
    
    if (req.file.originalname.endsWith('.json')) {
      data = JSON.parse(fileContent);
    } else if (req.file.originalname.endsWith('.csv')) {
      const result = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      data = result.data;
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    saveData(filePath, data);
    res.json({ success: true, count: Array.isArray(data) ? data.length : 1 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse file: ' + e.message });
  }
});

app.get('/api/classes', (req, res) => {
  const registrations = loadData(DATA_FILES.registrations, []);
  const rentals = loadData(DATA_FILES.rentals, []);
  const coaches = loadData(DATA_FILES.coaches, []);
  const slopes = loadData(DATA_FILES.slopes, []);
  const weather = loadData(DATA_FILES.weather, []);
  const overrides = loadData(DATA_FILES.overrides, {});
  
  const classesByDate = _.groupBy(registrations, r => `${r.classDate}-${r.classTime}`);
  const classes = [];
  
  for (const [classKey, classRegistrations] of Object.entries(classesByDate)) {
    const [classDate, classTime] = classKey.split('-');
    const firstReg = classRegistrations[0];
    
    const classData = {
      id: classKey,
      date: classDate,
      time: classTime,
      level: firstReg.level || '初级',
      instructor: firstReg.instructor || '',
      registrations: classRegistrations.length,
      issues: [],
      canOpen: true
    };
    
    const registeredStudentIds = classRegistrations.map(r => r.studentId);
    const studentRentals = rentals.filter(r => registeredStudentIds.includes(r.studentId));
    
    const missingRentals = registeredStudentIds.length - studentRentals.length;
    if (missingRentals > 0) {
      classData.issues.push({
        type: 'rental',
        severity: 'high',
        message: `${missingRentals}名学员缺少雪具租借记录`,
        gap: missingRentals
      });
      classData.canOpen = false;
    }
    
    if (classData.instructor) {
      const coach = coaches.find(c => c.name === classData.instructor || c.id === classData.instructor);
      if (!coach) {
        classData.issues.push({
          type: 'coach',
          severity: 'high',
          message: `教练 ${classData.instructor} 无证照记录`,
          gap: 1
        });
        classData.canOpen = false;
      } else if (coach.status !== 'valid') {
        classData.issues.push({
          type: 'coach',
          severity: 'high',
          message: `教练 ${classData.instructor} 证照无效/过期`,
          gap: 1
        });
        classData.canOpen = false;
      }
    } else {
      classData.issues.push({
        type: 'coach',
        severity: 'high',
        message: '未分配教练',
        gap: 1
      });
      classData.canOpen = false;
    }
    
    const targetSlope = slopes.find(s => s.level === classData.level);
    if (targetSlope) {
      if (targetSlope.status !== 'open') {
        classData.issues.push({
          type: 'slope',
          severity: 'high',
          message: `${classData.level}雪道未开放`,
          gap: 1
        });
        classData.canOpen = false;
      }
    } else {
      classData.issues.push({
        type: 'slope',
        severity: 'medium',
        message: `未找到${classData.level}雪道信息`,
        gap: 1
      });
    }
    
    const classWeather = weather.find(w => w.date === classDate);
    if (classWeather) {
      if (classWeather.windSpeed > 15) {
        classData.issues.push({
          type: 'weather',
          severity: 'high',
          message: `风力过大 (${classWeather.windSpeed}m/s)，超过安全限制`,
          gap: 0
        });
        classData.canOpen = false;
      }
      if (classWeather.visibility < 1000) {
        classData.issues.push({
          type: 'weather',
          severity: 'high',
          message: `能见度过低 (${classWeather.visibility}m)`,
          gap: 0
        });
        classData.canOpen = false;
      }
      if (classWeather.temperature < -25) {
        classData.issues.push({
          type: 'weather',
          severity: 'medium',
          message: `气温过低 (${classWeather.temperature}°C)`,
          gap: 0
        });
      }
    } else {
      classData.issues.push({
        type: 'weather',
        severity: 'low',
        message: `无当日天气数据`,
        gap: 0
      });
    }
    
    if (overrides[classKey]) {
      classData.override = overrides[classKey];
    }
    
    classes.push(classData);
  }
  
  classes.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
  
  res.json(classes);
});

app.post('/api/overrides/:classId', (req, res) => {
  const { classId } = req.params;
  const overrides = loadData(DATA_FILES.overrides, {});
  overrides[classId] = {
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  saveData(DATA_FILES.overrides, overrides);
  res.json({ success: true });
});

app.delete('/api/overrides/:classId', (req, res) => {
  const { classId } = req.params;
  const overrides = loadData(DATA_FILES.overrides, {});
  delete overrides[classId];
  saveData(DATA_FILES.overrides, overrides);
  res.json({ success: true });
});

app.get('/api/export/markdown', (req, res) => {
  const registrations = loadData(DATA_FILES.registrations, []);
  const rentals = loadData(DATA_FILES.rentals, []);
  const coaches = loadData(DATA_FILES.coaches, []);
  const slopes = loadData(DATA_FILES.slopes, []);
  const weather = loadData(DATA_FILES.weather, []);
  const overrides = loadData(DATA_FILES.overrides, {});
  
  let md = `# 滑雪学校开班清单\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;
  
  const classesByDate = _.groupBy(registrations, r => `${r.classDate}-${r.classTime}`);
  const classes = [];
  
  for (const [classKey, classRegistrations] of Object.entries(classesByDate)) {
    const [classDate, classTime] = classKey.split('-');
    const firstReg = classRegistrations[0];
    
    let canOpen = true;
    const issues = [];
    
    const registeredStudentIds = classRegistrations.map(r => r.studentId);
    const studentRentals = rentals.filter(r => registeredStudentIds.includes(r.studentId));
    
    if (registeredStudentIds.length > studentRentals.length) {
      canOpen = false;
      issues.push(`- ${registeredStudentIds.length - studentRentals.length}名学员缺少雪具租借记录`);
    }
    
    if (firstReg.instructor) {
      const coach = coaches.find(c => c.name === firstReg.instructor);
      if (!coach || coach.status !== 'valid') {
        canOpen = false;
        issues.push(`- 教练 ${firstReg.instructor} 证照无效或不存在`);
      }
    } else {
      canOpen = false;
      issues.push(`- 未分配教练`);
    }
    
    const targetSlope = slopes.find(s => s.level === firstReg.level);
    if (targetSlope && targetSlope.status !== 'open') {
      canOpen = false;
      issues.push(`- ${firstReg.level}雪道未开放`);
    }
    
    const classWeather = weather.find(w => w.date === classDate);
    if (classWeather) {
      if (classWeather.windSpeed > 15) {
        canOpen = false;
        issues.push(`- 风力过大 (${classWeather.windSpeed}m/s)`);
      }
      if (classWeather.visibility < 1000) {
        canOpen = false;
        issues.push(`- 能见度过低 (${classWeather.visibility}m)`);
      }
    }
    
    const override = overrides[classKey];
    if (override) {
      if (override.forceOpen !== undefined) {
        canOpen = override.forceOpen;
      }
    }
    
    classes.push({
      key: classKey,
      date: classDate,
      time: classTime,
      level: firstReg.level || '初级',
      instructor: firstReg.instructor || '未分配',
      studentCount: classRegistrations.length,
      canOpen,
      issues,
      override
    });
  }
  
  classes.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
  
  md += `## 开班状态统计\n\n`;
  const openCount = classes.filter(c => c.canOpen).length;
  const closedCount = classes.length - openCount;
  md += `- **可开班**: ${openCount} 节\n`;
  md += `- **不可开班**: ${closedCount} 节\n\n`;
  md += `---\n\n`;
  
  for (const cls of classes) {
    md += `### ${cls.date} ${cls.time} - ${cls.level}班\n\n`;
    md += `- **教练**: ${cls.instructor}\n`;
    md += `- **学员人数**: ${cls.studentCount}\n`;
    md += `- **开班状态**: ${cls.canOpen ? '✅ 可以开班' : '❌ 不可开班'}\n`;
    
    if (cls.issues.length > 0) {
      md += `- **问题/缺口**:\n${cls.issues.join('\n')}\n`;
    }
    
    if (cls.override) {
      md += `- **人工改判**:\n`;
      if (cls.override.forceOpen !== undefined) {
        md += `  - 强制${cls.override.forceOpen ? '开班' : '取消'}\n`;
      }
      if (cls.override.notes) {
        md += `  - 备注: ${cls.override.notes}\n`;
      }
    }
    
    md += `\n---\n\n`;
  }
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=class-list-${Date.now()}.md`);
  res.send(md);
});

app.get('/api/export/json', (req, res) => {
  const exportData = {
    exportedAt: new Date().toISOString(),
    data: {
      registrations: loadData(DATA_FILES.registrations, []),
      rentals: loadData(DATA_FILES.rentals, []),
      coaches: loadData(DATA_FILES.coaches, []),
      slopes: loadData(DATA_FILES.slopes, []),
      weather: loadData(DATA_FILES.weather, []),
      overrides: loadData(DATA_FILES.overrides, {})
    },
    audit: {
      classes: []
    }
  };
  
  const registrations = exportData.data.registrations;
  const rentals = exportData.data.rentals;
  const coaches = exportData.data.coaches;
  const slopes = exportData.data.slopes;
  const weather = exportData.data.weather;
  const overrides = exportData.data.overrides;
  
  const classesByDate = _.groupBy(registrations, r => `${r.classDate}-${r.classTime}`);
  
  for (const [classKey, classRegistrations] of Object.entries(classesByDate)) {
    const [classDate, classTime] = classKey.split('-');
    const firstReg = classRegistrations[0];
    
    const classAudit = {
      id: classKey,
      date: classDate,
      time: classTime,
      level: firstReg.level || '初级',
      instructor: firstReg.instructor,
      studentCount: classRegistrations.length,
      checks: {},
      finalDecision: null,
      override: null
    };
    
    const registeredStudentIds = classRegistrations.map(r => r.studentId);
    const studentRentals = rentals.filter(r => registeredStudentIds.includes(r.studentId));
    
    classAudit.checks.rentals = {
      passed: registeredStudentIds.length === studentRentals.length,
      details: {
        registered: registeredStudentIds.length,
        hasRental: studentRentals.length,
        missing: registeredStudentIds.length - studentRentals.length
      }
    };
    
    if (firstReg.instructor) {
      const coach = coaches.find(c => c.name === firstReg.instructor);
      classAudit.checks.coach = {
        passed: coach && coach.status === 'valid',
        details: {
          instructor: firstReg.instructor,
          exists: !!coach,
          status: coach?.status
        }
      };
    } else {
      classAudit.checks.coach = {
        passed: false,
        details: { instructor: '未分配' }
      };
    }
    
    const targetSlope = slopes.find(s => s.level === firstReg.level);
    classAudit.checks.slope = {
      passed: targetSlope ? targetSlope.status === 'open' : true,
      details: {
        level: firstReg.level,
        status: targetSlope?.status
      }
    };
    
    const classWeather = weather.find(w => w.date === classDate);
    classAudit.checks.weather = {
      passed: classWeather ? (classWeather.windSpeed <= 15 && classWeather.visibility >= 1000) : true,
      details: classWeather ? {
        date: classWeather.date,
        windSpeed: classWeather.windSpeed,
        visibility: classWeather.visibility,
        temperature: classWeather.temperature
      } : { note: '无天气数据' }
    };
    
    const allChecksPassed = Object.values(classAudit.checks).every(c => c.passed);
    classAudit.finalDecision = allChecksPassed;
    
    if (overrides[classKey]) {
      classAudit.override = overrides[classKey];
      if (classAudit.override.forceOpen !== undefined) {
        classAudit.finalDecision = classAudit.override.forceOpen;
      }
    }
    
    exportData.audit.classes.push(classAudit);
  }
  
  exportData.audit.classes.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=audit-package-${Date.now()}.json`);
  res.send(JSON.stringify(exportData, null, 2));
});

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
