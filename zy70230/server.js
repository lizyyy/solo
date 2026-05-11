const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');

function readData(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
}

function writeData(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getStatusInfo(status) {
  const statusMap = {
    'submitted': { text: '已提交', color: '#3b82f6', icon: '📋' },
    'reviewing': { text: '审核中', color: '#f59e0b', icon: '🔍' },
    'need_material': { text: '需补材料', color: '#ef4444', icon: '⚠️' },
    'approved': { text: '已通过', color: '#10b981', icon: '✅' },
    'rejected': { text: '已拒绝', color: '#6b7280', icon: '❌' }
  };
  return statusMap[status] || { text: '未知', color: '#6b7280', icon: '❓' };
}

app.get('/api/dogs', (req, res) => {
  const dogs = readData('dogs.json');
  res.json(dogs);
});

app.get('/api/dogs/:id', (req, res) => {
  const dogs = readData('dogs.json');
  const dog = dogs.find(d => d.id === req.params.id);
  if (!dog) {
    return res.status(404).json({ error: '未找到犬只档案' });
  }
  res.json(dog);
});

app.get('/api/vaccines', (req, res) => {
  const vaccines = readData('vaccines.json');
  if (req.query.dogId) {
    res.json(vaccines.filter(v => v.dogId === req.query.dogId));
  } else {
    res.json(vaccines);
  }
});

app.get('/api/checks', (req, res) => {
  const checks = readData('checks.json');
  if (req.query.dogId) {
    res.json(checks.filter(c => c.dogId === req.query.dogId));
  } else {
    res.json(checks);
  }
});

app.get('/api/checks/:id', (req, res) => {
  const checks = readData('checks.json');
  const check = checks.find(c => c.id === req.params.id);
  if (!check) {
    return res.status(404).json({ error: '未找到年检记录' });
  }
  res.json(check);
});

app.get('/api/violations', (req, res) => {
  const violations = readData('violations.json');
  if (req.query.dogId) {
    res.json(violations.filter(v => v.dogId === req.query.dogId));
  } else {
    res.json(violations);
  }
});

app.get('/api/dashboard/stats', (req, res) => {
  const checks = readData('checks.json');
  const violations = readData('violations.json');
  
  const stats = {
    total: checks.length,
    byStatus: {
      submitted: checks.filter(c => c.status === 'submitted').length,
      reviewing: checks.filter(c => c.status === 'reviewing').length,
      need_material: checks.filter(c => c.status === 'need_material').length,
      approved: checks.filter(c => c.status === 'approved').length,
      rejected: checks.filter(c => c.status === 'rejected').length
    },
    pendingViolations: violations.filter(v => v.status === 'pending').length,
    needAttention: checks.filter(c => c.status === 'reviewing' || c.status === 'need_material').length
  };
  
  res.json(stats);
});

app.get('/api/dashboard/queue', (req, res) => {
  const checks = readData('checks.json');
  const dogs = readData('dogs.json');
  
  const queue = checks.map(check => {
    const dog = dogs.find(d => d.id === check.dogId);
    const statusInfo = getStatusInfo(check.status);
    
    return {
      checkId: check.id,
      dogId: check.dogId,
      dogName: dog ? dog.name : '未知',
      ownerName: dog ? dog.ownerName : '未知',
      checkYear: check.checkYear,
      applyDate: check.applyDate,
      status: check.status,
      statusInfo: statusInfo,
      blockerCount: check.currentBlockers ? check.currentBlockers.length : 0
    };
  });
  
  queue.sort((a, b) => {
    const priority = { 'need_material': 0, 'reviewing': 1, 'submitted': 2, 'approved': 3, 'rejected': 4 };
    return (priority[a.status] || 99) - (priority[b.status] || 99);
  });
  
  res.json(queue);
});

app.get('/api/checks/:id/detail', (req, res) => {
  const checks = readData('checks.json');
  const dogs = readData('dogs.json');
  const vaccines = readData('vaccines.json');
  const violations = readData('violations.json');
  
  const check = checks.find(c => c.id === req.params.id);
  if (!check) {
    return res.status(404).json({ error: '未找到年检记录' });
  }
  
  const dog = dogs.find(d => d.id === check.dogId);
  const dogVaccines = vaccines.filter(v => v.dogId === check.dogId);
  const dogViolations = violations.filter(v => v.dogId === check.dogId);
  
  const vaccineIssues = [];
  const uniqueVaccineTypes = {};
  
  dogVaccines.forEach(v => {
    if (!uniqueVaccineTypes[v.type]) {
      uniqueVaccineTypes[v.type] = [];
    }
    uniqueVaccineTypes[v.type].push(v);
  });
  
  for (const [type, records] of Object.entries(uniqueVaccineTypes)) {
    if (records.length > 1) {
      const validRecords = records.filter(r => r.status === 'valid');
      if (validRecords.length > 1) {
        vaccineIssues.push({
          type: 'duplicate',
          vaccineType: type,
          message: `${type}存在${records.length}条记录`,
          records: records.map(r => ({ id: r.id, date: r.vaccineDate, status: r.status }))
        });
      }
    }
  }
  
  dogVaccines.forEach(v => {
    const missingFields = [];
    if (!v.vaccineDate) missingFields.push('接种日期');
    if (!v.validUntil) missingFields.push('有效期');
    if (!v.clinic) missingFields.push('接种诊所');
    if (!v.certificateNumber) missingFields.push('证书编号');
    
    if (missingFields.length > 0) {
      vaccineIssues.push({
        type: 'missing_fields',
        vaccineType: v.type,
        message: `${v.type}记录缺少字段: ${missingFields.join('、')}`,
        recordId: v.id
      });
    }
  });
  
  const pendingViolations = dogViolations.filter(v => v.status === 'pending');
  
  const validation = {
    vaccines: {
      total: dogVaccines.length,
      valid: dogVaccines.filter(v => v.status === 'valid').length,
      expired: dogVaccines.filter(v => v.status === 'expired').length,
      pending: dogVaccines.filter(v => v.status === 'pending').length,
      issues: vaccineIssues
    },
    violations: {
      total: dogViolations.length,
      pending: pendingViolations.length,
      resolved: dogViolations.filter(v => v.status === 'resolved').length
    },
    photo: {
      hasPhoto: dog && dog.photo ? true : false,
      issue: dog && !dog.photo ? '缺少犬只照片' : null
    },
    address: {
      hasAddress: dog && dog.address ? true : false,
      issue: dog && !dog.address ? '缺少住址信息' : null
    }
  };
  
  const statusInfo = getStatusInfo(check.status);
  
  res.json({
    check,
    dog,
    vaccines: dogVaccines,
    violations: dogViolations,
    validation,
    statusInfo,
    currentBlockers: check.currentBlockers || [],
    history: check.history || []
  });
});

app.post('/api/checks/:id/action', (req, res) => {
  const checks = readData('checks.json');
  const checkIndex = checks.findIndex(c => c.id === req.params.id);
  
  if (checkIndex === -1) {
    return res.status(404).json({ error: '未找到年检记录' });
  }
  
  const { action, operator, remark, newStatus } = req.body;
  const check = checks[checkIndex];
  const oldStatus = check.status;
  
  if (newStatus) {
    check.status = newStatus;
  }
  
  const historyEntry = {
    timestamp: new Date().toISOString(),
    operator: operator || '系统',
    action: action,
    oldStatus: oldStatus,
    newStatus: newStatus || oldStatus,
    remark: remark || ''
  };
  
  if (!check.history) {
    check.history = [];
  }
  check.history.push(historyEntry);
  
  if (newStatus === 'approved') {
    check.checkResult = '通过';
    check.checkDate = new Date().toISOString().split('T')[0];
    check.checker = operator || '系统';
  } else if (newStatus === 'rejected') {
    check.checkResult = '拒绝';
    check.checkDate = new Date().toISOString().split('T')[0];
    check.checker = operator || '系统';
  }
  
  writeData('checks.json', checks);
  
  res.json({
    success: true,
    message: '操作成功',
    historyEntry
  });
});

app.post('/api/checks/:id/update-blockers', (req, res) => {
  const checks = readData('checks.json');
  const checkIndex = checks.findIndex(c => c.id === req.params.id);
  
  if (checkIndex === -1) {
    return res.status(404).json({ error: '未找到年检记录' });
  }
  
  const { blockers, operator, remark } = req.body;
  const check = checks[checkIndex];
  
  check.currentBlockers = blockers;
  
  const historyEntry = {
    timestamp: new Date().toISOString(),
    operator: operator || '系统',
    action: '更新卡点信息',
    oldStatus: check.status,
    newStatus: check.status,
    remark: remark || `更新了${blockers ? blockers.length : 0}个卡点`
  };
  
  if (!check.history) {
    check.history = [];
  }
  check.history.push(historyEntry);
  
  writeData('checks.json', checks);
  
  res.json({
    success: true,
    message: '卡点更新成功'
  });
});

app.put('/api/vaccines/:id', (req, res) => {
  const vaccines = readData('vaccines.json');
  const vaccineIndex = vaccines.findIndex(v => v.id === req.params.id);
  
  if (vaccineIndex === -1) {
    return res.status(404).json({ error: '未找到疫苗记录' });
  }
  
  const oldData = { ...vaccines[vaccineIndex] };
  vaccines[vaccineIndex] = { ...vaccines[vaccineIndex], ...req.body };
  
  writeData('vaccines.json', vaccines);
  
  res.json({
    success: true,
    message: '疫苗记录更新成功',
    oldData,
    newData: vaccines[vaccineIndex]
  });
});

app.put('/api/violations/:id', (req, res) => {
  const violations = readData('violations.json');
  const violationIndex = violations.findIndex(v => v.id === req.params.id);
  
  if (violationIndex === -1) {
    return res.status(404).json({ error: '未找到违规记录' });
  }
  
  violations[violationIndex] = { ...violations[violationIndex], ...req.body };
  
  writeData('violations.json', violations);
  
  res.json({
    success: true,
    message: '违规记录更新成功'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`社区犬证年检台已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
