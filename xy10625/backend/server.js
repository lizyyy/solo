const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const idempotencyKeys = new Map();
const dataStore = {
  exhibits: [],
  transportations: [],
  insurances: [],
  environmentAlerts: [],
  acceptanceChecks: [],
  riskReports: [],
  history: []
};

function recordHistory(entityType, entityId, action, oldData, newData, operator) {
  const record = {
    id: uuidv4(),
    entityType,
    entityId,
    action,
    oldData,
    newData,
    operator,
    timestamp: new Date().toISOString()
  };
  dataStore.history.push(record);
  return record;
}

function idempotentMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: '缺少幂等键 x-idempotency-key' });
  }
  
  if (idempotencyKeys.has(idempotencyKey)) {
    const cached = idempotencyKeys.get(idempotencyKey);
    return res.status(cached.status).json(cached.data);
  }
  
  res.sendResponse = (status, data) => {
    idempotencyKeys.set(idempotencyKey, { status, data });
    res.status(status).json(data);
  };
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  const stats = {
    totalExhibits: dataStore.exhibits.length,
    activeInsurances: dataStore.insurances.filter(i => i.status === 'active').length,
    environmentAlerts: dataStore.environmentAlerts.filter(a => a.status === 'active').length,
    pendingAcceptance: dataStore.acceptanceChecks.filter(a => a.status === 'pending').length,
    riskReports: dataStore.riskReports.length
  };
  res.json(stats);
});

app.post('/api/exhibits', idempotentMiddleware, (req, res) => {
  try {
    const { name, type, value, location, description, operator } = req.body;
    
    if (!name || !type) {
      return res.sendResponse(400, { error: '展品名称和类型不能为空' });
    }
    
    const exhibit = {
      id: uuidv4(),
      name,
      type,
      value: value || 0,
      location: location || '',
      description: description || '',
      status: 'registered',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dataStore.exhibits.push(exhibit);
    recordHistory('exhibit', exhibit.id, 'create', null, exhibit, operator || 'system');
    
    res.sendResponse(201, exhibit);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/exhibits', (req, res) => {
  res.json(dataStore.exhibits);
});

app.get('/api/exhibits/:id', (req, res) => {
  const exhibit = dataStore.exhibits.find(e => e.id === req.params.id);
  if (!exhibit) {
    return res.status(404).json({ error: '展品不存在' });
  }
  res.json(exhibit);
});

app.put('/api/exhibits/:id', idempotentMiddleware, (req, res) => {
  try {
    const index = dataStore.exhibits.findIndex(e => e.id === req.params.id);
    if (index === -1) {
      return res.sendResponse(404, { error: '展品不存在' });
    }
    
    const oldData = { ...dataStore.exhibits[index] };
    const { operator, ...updates } = req.body;
    
    dataStore.exhibits[index] = {
      ...dataStore.exhibits[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    recordHistory('exhibit', req.params.id, 'update', oldData, dataStore.exhibits[index], operator || 'system');
    
    res.sendResponse(200, dataStore.exhibits[index]);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.post('/api/transportations', idempotentMiddleware, (req, res) => {
  try {
    const { exhibitId, fromLocation, toLocation, transporter, departureTime, operator } = req.body;
    
    if (!exhibitId || !fromLocation || !toLocation) {
      return res.sendResponse(400, { error: '展品ID、出发地和目的地不能为空' });
    }
    
    const exhibit = dataStore.exhibits.find(e => e.id === exhibitId);
    if (!exhibit) {
      return res.sendResponse(404, { error: '展品不存在' });
    }
    
    const transportation = {
      id: uuidv4(),
      exhibitId,
      exhibitName: exhibit.name,
      fromLocation,
      toLocation,
      transporter: transporter || '',
      departureTime: departureTime || new Date().toISOString(),
      arrivalTime: null,
      status: 'in_transit',
      checks: [],
      createdAt: new Date().toISOString()
    };
    
    dataStore.transportations.push(transportation);
    recordHistory('transportation', transportation.id, 'create', null, transportation, operator || 'system');
    
    res.sendResponse(201, transportation);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.post('/api/transportations/:id/check', idempotentMiddleware, (req, res) => {
  try {
    const index = dataStore.transportations.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.sendResponse(404, { error: '运输记录不存在' });
    }
    
    const { checkItems, checker, notes } = req.body;
    
    if (!checkItems || !Array.isArray(checkItems)) {
      return res.sendResponse(400, { error: '校验项目不能为空' });
    }
    
    const requiredChecks = ['packaging', 'condition', 'documentation', 'temperature'];
    const missingChecks = requiredChecks.filter(c => !checkItems.find(item => item.type === c));
    
    if (missingChecks.length > 0) {
      return res.sendResponse(400, { 
        error: '缺少必检验项',
        missing: missingChecks
      });
    }
    
    const allPassed = checkItems.every(item => item.result === 'pass');
    
    const check = {
      id: uuidv4(),
      checkItems,
      checker: checker || '',
      notes: notes || '',
      result: allPassed ? 'pass' : 'fail',
      timestamp: new Date().toISOString()
    };
    
    const oldData = { ...dataStore.transportations[index] };
    dataStore.transportations[index].checks.push(check);
    
    if (allPassed) {
      dataStore.transportations[index].status = 'completed';
      dataStore.transportations[index].arrivalTime = new Date().toISOString();
    }
    
    recordHistory('transportation', req.params.id, 'check', oldData, dataStore.transportations[index], checker || 'system');
    
    res.sendResponse(200, dataStore.transportations[index]);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/transportations', (req, res) => {
  res.json(dataStore.transportations);
});

app.post('/api/insurances', idempotentMiddleware, (req, res) => {
  try {
    const { exhibitId, policyNumber, insurer, coverageAmount, startDate, endDate, operator } = req.body;
    
    if (!exhibitId || !policyNumber || !coverageAmount) {
      return res.sendResponse(400, { error: '展品ID、保单号和保额不能为空' });
    }
    
    const exhibit = dataStore.exhibits.find(e => e.id === exhibitId);
    if (!exhibit) {
      return res.sendResponse(404, { error: '展品不存在' });
    }
    
    const insurance = {
      id: uuidv4(),
      exhibitId,
      exhibitName: exhibit.name,
      policyNumber,
      insurer: insurer || '',
      coverageAmount,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dataStore.insurances.push(insurance);
    recordHistory('insurance', insurance.id, 'create', null, insurance, operator || 'system');
    
    res.sendResponse(201, insurance);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.post('/api/insurances/:id/activate', idempotentMiddleware, (req, res) => {
  try {
    const index = dataStore.insurances.findIndex(i => i.id === req.params.id);
    if (index === -1) {
      return res.sendResponse(404, { error: '保单不存在' });
    }
    
    const oldData = { ...dataStore.insurances[index] };
    const { operator } = req.body;
    
    dataStore.insurances[index].status = 'active';
    dataStore.insurances[index].updatedAt = new Date().toISOString();
    
    recordHistory('insurance', req.params.id, 'activate', oldData, dataStore.insurances[index], operator || 'system');
    
    res.sendResponse(200, dataStore.insurances[index]);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/insurances', (req, res) => {
  res.json(dataStore.insurances);
});

app.post('/api/environment-alerts', idempotentMiddleware, (req, res) => {
  try {
    const { exhibitId, alertType, value, threshold, location, operator } = req.body;
    
    if (!exhibitId || !alertType) {
      return res.sendResponse(400, { error: '展品ID和告警类型不能为空' });
    }
    
    const exhibit = dataStore.exhibits.find(e => e.id === exhibitId);
    if (!exhibit) {
      return res.sendResponse(404, { error: '展品不存在' });
    }
    
    const alert = {
      id: uuidv4(),
      exhibitId,
      exhibitName: exhibit.name,
      alertType,
      value,
      threshold,
      location: location || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      resolvedAt: null
    };
    
    dataStore.environmentAlerts.push(alert);
    recordHistory('environment-alert', alert.id, 'create', null, alert, operator || 'system');
    
    res.sendResponse(201, alert);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.post('/api/environment-alerts/:id/resolve', idempotentMiddleware, (req, res) => {
  try {
    const index = dataStore.environmentAlerts.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.sendResponse(404, { error: '告警不存在' });
    }
    
    const oldData = { ...dataStore.environmentAlerts[index] };
    const { operator, resolutionNotes } = req.body;
    
    dataStore.environmentAlerts[index].status = 'resolved';
    dataStore.environmentAlerts[index].resolvedAt = new Date().toISOString();
    dataStore.environmentAlerts[index].resolutionNotes = resolutionNotes || '';
    
    recordHistory('environment-alert', req.params.id, 'resolve', oldData, dataStore.environmentAlerts[index], operator || 'system');
    
    res.sendResponse(200, dataStore.environmentAlerts[index]);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/environment-alerts', (req, res) => {
  res.json(dataStore.environmentAlerts);
});

app.post('/api/acceptance-checks', idempotentMiddleware, (req, res) => {
  try {
    const { exhibitId, checkItems, checker, notes, operator } = req.body;
    
    if (!exhibitId || !checkItems || !Array.isArray(checkItems)) {
      return res.sendResponse(400, { error: '展品ID和检验项目不能为空' });
    }
    
    const exhibit = dataStore.exhibits.find(e => e.id === exhibitId);
    if (!exhibit) {
      return res.sendResponse(404, { error: '展品不存在' });
    }
    
    const allPassed = checkItems.every(item => item.result === 'pass');
    
    const acceptance = {
      id: uuidv4(),
      exhibitId,
      exhibitName: exhibit.name,
      checkItems,
      checker: checker || '',
      notes: notes || '',
      result: allPassed ? 'pass' : 'fail',
      status: allPassed ? 'completed' : 'pending',
      createdAt: new Date().toISOString()
    };
    
    dataStore.acceptanceChecks.push(acceptance);
    recordHistory('acceptance', acceptance.id, 'create', null, acceptance, operator || checker || 'system');
    
    res.sendResponse(201, acceptance);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.post('/api/acceptance-checks/:id/review', idempotentMiddleware, (req, res) => {
  try {
    const index = dataStore.acceptanceChecks.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.sendResponse(404, { error: '验收记录不存在' });
    }
    
    const oldData = { ...dataStore.acceptanceChecks[index] };
    const { reviewer, reviewResult, reviewNotes, operator } = req.body;
    
    dataStore.acceptanceChecks[index].reviewer = reviewer || '';
    dataStore.acceptanceChecks[index].reviewResult = reviewResult;
    dataStore.acceptanceChecks[index].reviewNotes = reviewNotes || '';
    dataStore.acceptanceChecks[index].reviewedAt = new Date().toISOString();
    dataStore.acceptanceChecks[index].status = reviewResult === 'pass' ? 'approved' : 'rejected';
    
    recordHistory('acceptance', req.params.id, 'review', oldData, dataStore.acceptanceChecks[index], operator || reviewer || 'system');
    
    res.sendResponse(200, dataStore.acceptanceChecks[index]);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/acceptance-checks', (req, res) => {
  res.json(dataStore.acceptanceChecks);
});

app.post('/api/risk-reports', idempotentMiddleware, (req, res) => {
  try {
    const { title, type, relatedEntityId, relatedEntityType, description, riskLevel, operator } = req.body;
    
    if (!title || !type) {
      return res.sendResponse(400, { error: '报告标题和类型不能为空' });
    }
    
    const report = {
      id: uuidv4(),
      title,
      type,
      relatedEntityId: relatedEntityId || '',
      relatedEntityType: relatedEntityType || '',
      description: description || '',
      riskLevel: riskLevel || 'medium',
      status: 'open',
      createdBy: operator || 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    dataStore.riskReports.push(report);
    recordHistory('risk-report', report.id, 'create', null, report, operator || 'system');
    
    res.sendResponse(201, report);
  } catch (error) {
    res.sendResponse(500, { error: error.message });
  }
});

app.get('/api/risk-reports', (req, res) => {
  res.json(dataStore.riskReports);
});

app.get('/api/risk-reports/:id', (req, res) => {
  const report = dataStore.riskReports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: '风险报告不存在' });
  }
  res.json(report);
});

app.get('/api/history', (req, res) => {
  const { entityType, entityId } = req.query;
  let history = [...dataStore.history];
  
  if (entityType) {
    history = history.filter(h => h.entityType === entityType);
  }
  if (entityId) {
    history = history.filter(h => h.entityId === entityId);
  }
  
  res.json(history);
});

app.get('/api/export/risk-reports', (req, res) => {
  try {
    const { responsiblePerson, startDate, endDate } = req.query;
    
    let reports = [...dataStore.riskReports];
    
    if (responsiblePerson) {
      reports = reports.filter(r => r.createdBy === responsiblePerson);
    }
    if (startDate) {
      reports = reports.filter(r => new Date(r.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      reports = reports.filter(r => new Date(r.createdAt) <= new Date(endDate));
    }
    
    const fields = ['id', 'title', 'type', 'riskLevel', 'status', 'createdBy', 'createdAt', 'description'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reports);
    
    res.header('Content-Type', 'text/csv');
    res.attachment(`risk-reports-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function initSampleData() {
  const operators = ['张三', '李四', '王五', '赵六'];
  
  const exhibits = [
    { name: '蒙娜丽莎复制品', type: 'painting', value: 500000, location: 'A馆-01' },
    { name: '青铜器-鼎', type: 'sculpture', value: 1200000, location: 'B馆-03' },
    { name: '青花瓷瓶', type: 'ceramic', value: 800000, location: 'C馆-02' },
    { name: '古代书法真迹', type: 'calligraphy', value: 2000000, location: 'A馆-05' },
    { name: '玉雕观音', type: 'jade', value: 650000, location: 'B馆-07' }
  ];
  
  exhibits.forEach((exhibit, idx) => {
    const id = uuidv4();
    dataStore.exhibits.push({
      id,
      ...exhibit,
      status: idx < 3 ? 'exhibiting' : 'in_storage',
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - idx * 86400000).toISOString()
    });
  });
  
  dataStore.exhibits.forEach((exhibit, idx) => {
    const insurance = {
      id: uuidv4(),
      exhibitId: exhibit.id,
      exhibitName: exhibit.name,
      policyNumber: `POL-${2024}${String(idx + 1).padStart(4, '0')}`,
      insurer: '平安保险',
      coverageAmount: exhibit.value,
      startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
      status: idx < 3 ? 'active' : 'pending',
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - idx * 86400000).toISOString()
    };
    dataStore.insurances.push(insurance);
  });
  
  const transportData = [
    { exhibitIdx: 0, from: '北京库房', to: '上海美术馆', status: 'completed' },
    { exhibitIdx: 1, from: '故宫博物院', to: '上海美术馆', status: 'completed' },
    { exhibitIdx: 2, from: '南京博物馆', to: '上海美术馆', status: 'in_transit' }
  ];
  
  transportData.forEach((t, idx) => {
    const exhibit = dataStore.exhibits[t.exhibitIdx];
    const checks = idx < 2 ? [{
      id: uuidv4(),
      checkItems: [
        { type: 'packaging', result: 'pass', notes: '包装完好' },
        { type: 'condition', result: 'pass', notes: '品相完好' },
        { type: 'documentation', result: 'pass', notes: '文件齐全' },
        { type: 'temperature', result: 'pass', notes: '温度正常' }
      ],
      checker: operators[idx],
      notes: '运输交接顺利',
      result: 'pass',
      timestamp: new Date(Date.now() - (2 - idx) * 86400000).toISOString()
    }] : [];
    
    dataStore.transportations.push({
      id: uuidv4(),
      exhibitId: exhibit.id,
      exhibitName: exhibit.name,
      fromLocation: t.from,
      toLocation: t.to,
      transporter: '顺丰物流',
      departureTime: new Date(Date.now() - (3 - idx) * 86400000).toISOString(),
      arrivalTime: t.status === 'completed' ? new Date(Date.now() - (2 - idx) * 86400000).toISOString() : null,
      status: t.status,
      checks,
      createdAt: new Date(Date.now() - (3 - idx) * 86400000).toISOString()
    });
  });
  
  const alerts = [
    { exhibitIdx: 0, type: 'temperature', value: 28, threshold: 25, status: 'resolved' },
    { exhibitIdx: 1, type: 'humidity', value: 75, threshold: 60, status: 'active' },
    { exhibitIdx: 2, type: 'temperature', value: 30, threshold: 25, status: 'active' }
  ];
  
  alerts.forEach((a, idx) => {
    const exhibit = dataStore.exhibits[a.exhibitIdx];
    const alert = {
      id: uuidv4(),
      exhibitId: exhibit.id,
      exhibitName: exhibit.name,
      alertType: a.type,
      value: a.value,
      threshold: a.threshold,
      location: exhibit.location,
      status: a.status,
      createdAt: new Date(Date.now() - (3 - idx) * 3600000).toISOString(),
      resolvedAt: a.status === 'resolved' ? new Date(Date.now() - (2 - idx) * 3600000).toISOString() : null
    };
    dataStore.environmentAlerts.push(alert);
  });
  
  const acceptances = [
    { exhibitIdx: 0, result: 'pass', status: 'approved', hasReview: true },
    { exhibitIdx: 1, result: 'fail', status: 'pending', hasReview: false },
    { exhibitIdx: 2, result: 'pass', status: 'completed', hasReview: false }
  ];
  
  acceptances.forEach((a, idx) => {
    const exhibit = dataStore.exhibits[a.exhibitIdx];
    const acceptance = {
      id: uuidv4(),
      exhibitId: exhibit.id,
      exhibitName: exhibit.name,
      checkItems: [
        { type: 'appearance', result: idx === 1 ? 'fail' : 'pass', notes: idx === 1 ? '发现轻微划痕' : '外观完好' },
        { type: 'structure', result: 'pass', notes: '结构稳定' },
        { type: 'packaging', result: 'pass', notes: '包装完整' }
      ],
      checker: operators[idx],
      notes: a.result === 'pass' ? '验收通过' : '需要复核',
      result: a.result,
      status: a.status,
      createdAt: new Date(Date.now() - (3 - idx) * 86400000).toISOString()
    };
    
    if (a.hasReview) {
      acceptance.reviewer = operators[3];
      acceptance.reviewResult = 'pass';
      acceptance.reviewNotes = '复核通过，划痕为原有旧伤';
      acceptance.reviewedAt = new Date(Date.now() - (2 - idx) * 86400000).toISOString();
    }
    
    dataStore.acceptanceChecks.push(acceptance);
  });
  
  const reports = [
    { title: 'A馆温度超限报告', type: 'environment', riskLevel: 'high' },
    { title: '青铜器运输风险评估', type: 'transport', riskLevel: 'medium' },
    { title: '青花瓷瓶验收异常报告', type: 'acceptance', riskLevel: 'low' },
    { title: '书法作品保险到期提醒', type: 'insurance', riskLevel: 'medium' },
    { title: '玉雕温湿度告警处理报告', type: 'environment', riskLevel: 'high' }
  ];
  
  reports.forEach((r, idx) => {
    dataStore.riskReports.push({
      id: uuidv4(),
      ...r,
      relatedEntityId: dataStore.environmentAlerts[idx % 3]?.id || '',
      relatedEntityType: r.type,
      description: `${r.title}，请及时处理。`,
      status: idx < 3 ? 'open' : 'closed',
      createdBy: operators[idx % 4],
      createdAt: new Date(Date.now() - idx * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - idx * 86400000).toISOString()
    });
  });
  
  console.log('样例数据初始化完成');
}

initSampleData();

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
});
