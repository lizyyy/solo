const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const TIRE_SETS_FILE = path.join(DATA_DIR, 'tireSets.json');
const INSPECTIONS_FILE = path.join(DATA_DIR, 'inspections.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const LOCATIONS_FILE = path.join(DATA_DIR, 'locations.json');

function initDataFiles() {
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(TIRE_SETS_FILE)) {
    fs.writeFileSync(TIRE_SETS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(INSPECTIONS_FILE)) {
    fs.writeFileSync(INSPECTIONS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(APPOINTMENTS_FILE)) {
    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(LOCATIONS_FILE)) {
    const defaultLocations = [
      { id: 'A01', name: 'A区-01号仓位', zone: 'A', row: 1 },
      { id: 'A02', name: 'A区-02号仓位', zone: 'A', row: 1 },
      { id: 'A03', name: 'A区-03号仓位', zone: 'A', row: 1 },
      { id: 'B01', name: 'B区-01号仓位', zone: 'B', row: 2 },
      { id: 'B02', name: 'B区-02号仓位', zone: 'B', row: 2 },
      { id: 'B03', name: 'B区-03号仓位', zone: 'B', row: 2 }
    ];
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(defaultLocations, null, 2));
  }
}

initDataFiles();

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content || '[]');
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

const RULE_CONFIG = {
  minWearDepth: 1.6,
  normalPressure: { min: 2.2, max: 2.8 }
};

function checkRules(tireSet, inspection, appointment, allTireSets) {
  const risks = [];

  if (tireSet && appointment) {
    if (tireSet.location && appointment.expectedLocation && tireSet.location !== appointment.expectedLocation) {
      risks.push({
        type: 'wrong_location',
        severity: 'high',
        message: `错仓：轮胎实际仓位 ${tireSet.location} 与预约仓位 ${appointment.expectedLocation} 不符`
      });
    }
  }

  if (tireSet && inspection) {
    if (inspection.wearDepths) {
      const minWear = Math.min(...inspection.wearDepths.filter(d => d !== null && d !== undefined));
      if (minWear < RULE_CONFIG.minWearDepth) {
        risks.push({
          type: 'wear_exceeded',
          severity: 'critical',
          message: `磨损超限：最小磨损深度 ${minWear}mm 低于安全阈值 ${RULE_CONFIG.minWearDepth}mm`
        });
      }
    }

    if (inspection.pressures) {
      const abnormalPressures = inspection.pressures.filter(p => 
        p !== null && p !== undefined && (p < RULE_CONFIG.normalPressure.min || p > RULE_CONFIG.normalPressure.max)
      );
      if (abnormalPressures.length > 0) {
        risks.push({
          type: 'pressure_abnormal',
          severity: 'medium',
          message: `胎压异常：${abnormalPressures.length} 个轮胎胎压超出正常范围 (${RULE_CONFIG.normalPressure.min}-${RULE_CONFIG.normalPressure.max}bar)`
        });
      }
    }
  }

  if (tireSet) {
    const specs = tireSet.specifications || [];
    const uniqueSpecs = [...new Set(specs.filter(s => s))];
    if (uniqueSpecs.length > 1) {
      risks.push({
        type: 'spec_mismatch',
        severity: 'high',
        message: `轮胎规格不匹配：同一轮胎组存在多种规格 ${uniqueSpecs.join(', ')}`
      });
    }
  }

  return risks;
}

function checkDuplicateAppointment(tireSetId, excludeAppointmentId = null) {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  return appointments.some(apt => 
    apt.id !== excludeAppointmentId &&
    apt.status === 'pending' &&
    apt.tireSetIds && apt.tireSetIds.includes(tireSetId)
  );
}

app.get('/api/locations', (req, res) => {
  const locations = readJsonFile(LOCATIONS_FILE);
  res.json(locations);
});

app.get('/api/customers', (req, res) => {
  const customers = readJsonFile(CUSTOMERS_FILE);
  res.json(customers);
});

app.get('/api/customers/:id', (req, res) => {
  const customers = readJsonFile(CUSTOMERS_FILE);
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
  }
  res.json(customer);
});

app.post('/api/customers', (req, res) => {
  const customers = readJsonFile(CUSTOMERS_FILE);
  const newCustomer = {
    id: generateId(),
    name: req.body.name,
    phone: req.body.phone,
    vehiclePlate: req.body.vehiclePlate,
    vehicleModel: req.body.vehicleModel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  customers.push(newCustomer);
  writeJsonFile(CUSTOMERS_FILE, customers);
  res.json(newCustomer);
});

app.put('/api/customers/:id', (req, res) => {
  const customers = readJsonFile(CUSTOMERS_FILE);
  const index = customers.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '客户不存在' });
  }
  customers[index] = {
    ...customers[index],
    name: req.body.name,
    phone: req.body.phone,
    vehiclePlate: req.body.vehiclePlate,
    vehicleModel: req.body.vehicleModel,
    updatedAt: new Date().toISOString()
  };
  writeJsonFile(CUSTOMERS_FILE, customers);
  res.json(customers[index]);
});

app.get('/api/tire-sets', (req, res) => {
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const { customerId, status, location } = req.query;
  
  let filtered = tireSets;
  if (customerId) {
    filtered = filtered.filter(t => t.customerId === customerId);
  }
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }
  if (location) {
    filtered = filtered.filter(t => t.location === location);
  }
  
  res.json(filtered);
});

app.get('/api/tire-sets/:id', (req, res) => {
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const tireSet = tireSets.find(t => t.id === req.params.id || t.barcode === req.params.id);
  if (!tireSet) {
    return res.status(404).json({ error: '轮胎组不存在' });
  }
  res.json(tireSet);
});

app.post('/api/tire-sets', (req, res) => {
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  
  const existingByBarcode = tireSets.find(t => t.barcode === req.body.barcode);
  if (existingByBarcode) {
    return res.status(400).json({ error: '条码已存在' });
  }

  const newTireSet = {
    id: generateId(),
    customerId: req.body.customerId,
    barcode: req.body.barcode,
    location: req.body.location,
    specifications: req.body.specifications || [],
    brands: req.body.brands || [],
    patterns: req.body.patterns || [],
    quantity: req.body.quantity || 4,
    status: req.body.status || 'stored',
    storedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: req.body.notes || ''
  };
  tireSets.push(newTireSet);
  writeJsonFile(TIRE_SETS_FILE, tireSets);
  res.json(newTireSet);
});

app.put('/api/tire-sets/:id', (req, res) => {
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const index = tireSets.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '轮胎组不存在' });
  }
  tireSets[index] = {
    ...tireSets[index],
    location: req.body.location || tireSets[index].location,
    specifications: req.body.specifications || tireSets[index].specifications,
    brands: req.body.brands || tireSets[index].brands,
    patterns: req.body.patterns || tireSets[index].patterns,
    status: req.body.status || tireSets[index].status,
    retrievedAt: req.body.status === 'retrieved' ? new Date().toISOString() : tireSets[index].retrievedAt,
    updatedAt: new Date().toISOString(),
    notes: req.body.notes !== undefined ? req.body.notes : tireSets[index].notes
  };
  writeJsonFile(TIRE_SETS_FILE, tireSets);
  res.json(tireSets[index]);
});

app.get('/api/inspections', (req, res) => {
  const inspections = readJsonFile(INSPECTIONS_FILE);
  const { tireSetId } = req.query;
  
  let filtered = inspections;
  if (tireSetId) {
    filtered = filtered.filter(i => i.tireSetId === tireSetId);
  }
  
  res.json(filtered);
});

app.post('/api/inspections', (req, res) => {
  const inspections = readJsonFile(INSPECTIONS_FILE);
  const newInspection = {
    id: generateId(),
    tireSetId: req.body.tireSetId,
    wearDepths: req.body.wearDepths || [],
    pressures: req.body.pressures || [],
    inspector: req.body.inspector || '系统',
    inspectedAt: new Date().toISOString(),
    notes: req.body.notes || ''
  };
  inspections.push(newInspection);
  writeJsonFile(INSPECTIONS_FILE, inspections);
  res.json(newInspection);
});

app.get('/api/appointments', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const { date, status } = req.query;
  
  let filtered = appointments;
  if (date) {
    filtered = filtered.filter(a => a.scheduledDate === date);
  }
  if (status) {
    filtered = filtered.filter(a => a.status === status);
  }
  
  res.json(filtered);
});

app.get('/api/appointments/:id', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const appointment = appointments.find(a => a.id === req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }
  res.json(appointment);
});

app.post('/api/appointments', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const tireSetIds = req.body.tireSetIds || [];

  for (const tireSetId of tireSetIds) {
    if (checkDuplicateAppointment(tireSetId)) {
      return res.status(400).json({ error: `轮胎组 ${tireSetId} 已存在待装预约` });
    }
  }

  const newAppointment = {
    id: generateId(),
    customerId: req.body.customerId,
    tireSetIds: tireSetIds,
    scheduledDate: req.body.scheduledDate,
    expectedLocation: req.body.expectedLocation,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: req.body.notes || ''
  };
  appointments.push(newAppointment);
  writeJsonFile(APPOINTMENTS_FILE, appointments);
  res.json(newAppointment);
});

app.put('/api/appointments/:id', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const index = appointments.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '预约不存在' });
  }
  
  const tireSetIds = req.body.tireSetIds || appointments[index].tireSetIds;
  for (const tireSetId of tireSetIds) {
    if (checkDuplicateAppointment(tireSetId, req.params.id)) {
      return res.status(400).json({ error: `轮胎组 ${tireSetId} 已存在待装预约` });
    }
  }

  appointments[index] = {
    ...appointments[index],
    tireSetIds: tireSetIds,
    scheduledDate: req.body.scheduledDate || appointments[index].scheduledDate,
    expectedLocation: req.body.expectedLocation || appointments[index].expectedLocation,
    status: req.body.status || appointments[index].status,
    completedAt: req.body.status === 'completed' ? new Date().toISOString() : appointments[index].completedAt,
    updatedAt: new Date().toISOString(),
    notes: req.body.notes !== undefined ? req.body.notes : appointments[index].notes
  };
  writeJsonFile(APPOINTMENTS_FILE, appointments);
  res.json(appointments[index]);
});

app.post('/api/appointments/:id/check-risks', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const appointment = appointments.find(a => a.id === req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }

  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const inspections = readJsonFile(INSPECTIONS_FILE);
  
  const allRisks = [];
  const tireSetDetails = [];

  for (const tireSetId of appointment.tireSetIds) {
    const tireSet = tireSets.find(t => t.id === tireSetId || t.barcode === tireSetId);
    if (!tireSet) continue;

    const latestInspection = inspections
      .filter(i => i.tireSetId === tireSet.id)
      .sort((a, b) => new Date(b.inspectedAt) - new Date(a.inspectedAt))[0];

    const risks = checkRules(tireSet, latestInspection, appointment, tireSets);
    
    tireSetDetails.push({
      tireSet,
      latestInspection,
      risks
    });

    allRisks.push(...risks.map(r => ({
      ...r,
      tireSetId: tireSet.id,
      tireSetBarcode: tireSet.barcode
    })));
  }

  res.json({
    appointment,
    tireSetDetails,
    allRisks,
    summary: {
      total: allRisks.length,
      critical: allRisks.filter(r => r.severity === 'critical').length,
      high: allRisks.filter(r => r.severity === 'high').length,
      medium: allRisks.filter(r => r.severity === 'medium').length
    }
  });
});

app.get('/api/reviews/:appointmentId', (req, res) => {
  const reviews = readJsonFile(REVIEWS_FILE);
  const appointmentReviews = reviews.filter(r => r.appointmentId === req.params.appointmentId);
  res.json(appointmentReviews);
});

app.post('/api/reviews', (req, res) => {
  const reviews = readJsonFile(REVIEWS_FILE);
  const { appointmentId, tireSetId, riskType, decision, notes } = req.body;

  let review = reviews.find(r => 
    r.appointmentId === appointmentId && 
    r.tireSetId === tireSetId && 
    r.riskType === riskType
  );

  if (!review) {
    review = {
      id: generateId(),
      appointmentId,
      tireSetId,
      riskType,
      decision: decision || 'pending',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    reviews.push(review);
  } else {
    review.decision = decision;
    review.notes = notes;
    review.updatedAt = new Date().toISOString();
  }

  writeJsonFile(REVIEWS_FILE, reviews);
  res.json(review);
});

app.get('/api/export/markdown/:appointmentId', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const inspections = readJsonFile(INSPECTIONS_FILE);
  const customers = readJsonFile(CUSTOMERS_FILE);
  const reviews = readJsonFile(REVIEWS_FILE);

  const appointment = appointments.find(a => a.id === req.params.appointmentId);
  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }

  const customer = customers.find(c => c.id === appointment.customerId);
  const appointmentReviews = reviews.filter(r => r.appointmentId === appointment.id);

  const tireSetDetails = appointment.tireSetIds.map(tireSetId => {
    const tireSet = tireSets.find(t => t.id === tireSetId || t.barcode === tireSetId);
    if (!tireSet) return null;

    const latestInspection = inspections
      .filter(i => i.tireSetId === tireSet.id)
      .sort((a, b) => new Date(b.inspectedAt) - new Date(a.inspectedAt))[0];

    const risks = checkRules(tireSet, latestInspection, appointment, tireSets);
    const tireSetReviews = appointmentReviews.filter(r => r.tireSetId === tireSet.id);

    return { tireSet, latestInspection, risks, reviews: tireSetReviews };
  }).filter(Boolean);

  const markdown = generateMarkdownReport(appointment, customer, tireSetDetails);
  
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loading-checklist-${appointment.id}.md"`);
  res.send(markdown);
});

app.get('/api/export/json/:appointmentId', (req, res) => {
  const appointments = readJsonFile(APPOINTMENTS_FILE);
  const tireSets = readJsonFile(TIRE_SETS_FILE);
  const inspections = readJsonFile(INSPECTIONS_FILE);
  const customers = readJsonFile(CUSTOMERS_FILE);
  const reviews = readJsonFile(REVIEWS_FILE);

  const appointment = appointments.find(a => a.id === req.params.appointmentId);
  if (!appointment) {
    return res.status(404).json({ error: '预约不存在' });
  }

  const customer = customers.find(c => c.id === appointment.customerId);
  const appointmentReviews = reviews.filter(r => r.appointmentId === appointment.id);

  const tireSetDetails = appointment.tireSetIds.map(tireSetId => {
    const tireSet = tireSets.find(t => t.id === tireSetId || t.barcode === tireSetId);
    if (!tireSet) return null;

    const latestInspection = inspections
      .filter(i => i.tireSetId === tireSet.id)
      .sort((a, b) => new Date(b.inspectedAt) - new Date(a.inspectedAt))[0];

    const risks = checkRules(tireSet, latestInspection, appointment, tireSets);
    const tireSetReviews = appointmentReviews.filter(r => r.tireSetId === tireSet.id);

    return { tireSet, latestInspection, risks, reviews: tireSetReviews };
  }).filter(Boolean);

  const exportData = {
    exportType: 'audit-detail',
    exportedAt: new Date().toISOString(),
    appointment,
    customer,
    tireSetDetails,
    reviews: appointmentReviews
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="audit-detail-${appointment.id}.json"`);
  res.send(JSON.stringify(exportData, null, 2));
});

function generateMarkdownReport(appointment, customer, tireSetDetails) {
  const scheduledDate = appointment.scheduledDate || '未指定';
  
  let md = `# 轮胎装车交接单\n\n`;
  md += `**交接日期**: ${new Date().toLocaleDateString('zh-CN')}\n`;
  md += `**预约日期**: ${scheduledDate}\n`;
  if (customer) {
    md += `**客户姓名**: ${customer.name}\n`;
    md += `**联系电话**: ${customer.phone || '-'}\n`;
    md += `**车辆信息**: ${customer.vehicleModel || '-'} / ${customer.vehiclePlate || '-'}\n`;
  }
  md += `**预约状态**: ${getStatusName(appointment.status)}\n\n`;

  md += `---\n\n`;
  md += `## 轮胎组明细\n\n`;

  for (const detail of tireSetDetails) {
    const { tireSet, latestInspection, risks, reviews } = detail;
    
    md += `### 条码: ${tireSet.barcode}\n\n`;
    md += `- **仓位**: ${tireSet.location || '-'}\n`;
    md += `- **规格**: ${(tireSet.specifications || []).filter(s => s).join(', ') || '-'}\n`;
    md += `- **品牌**: ${(tireSet.brands || []).filter(b => b).join(', ') || '-'}\n`;
    md += `- **花纹**: ${(tireSet.patterns || []).filter(p => p).join(', ') || '-'}\n`;
    md += `- **数量**: ${tireSet.quantity || 4} 条\n\n`;

    if (latestInspection) {
      md += `#### 检测记录\n\n`;
      md += `- **检测时间**: ${new Date(latestInspection.inspectedAt).toLocaleString('zh-CN')}\n`;
      if (latestInspection.wearDepths && latestInspection.wearDepths.length > 0) {
        md += `- **磨损深度**: ${latestInspection.wearDepths.map(w => w !== null && w !== undefined ? `${w}mm` : '-').join(' / ')}\n`;
      }
      if (latestInspection.pressures && latestInspection.pressures.length > 0) {
        md += `- **胎压**: ${latestInspection.pressures.map(p => p !== null && p !== undefined ? `${p}bar` : '-').join(' / ')}\n`;
      }
      md += `\n`;
    }

    if (risks && risks.length > 0) {
      md += `#### ⚠️ 风险识别\n\n`;
      for (const risk of risks) {
        const review = reviews.find(r => r.riskType === risk.type);
        const decision = review ? review.decision : 'pending';
        const notes = review ? review.notes : '';
        
        md += `**[${getSeverityName(risk.severity)}] ${risk.message}**\n\n`;
        md += `- **判定状态**: ${getDecisionName(decision)}\n`;
        if (notes) {
          md += `- **备注**: ${notes}\n`;
        }
        md += `\n`;
      }
    }

    if (tireSet.notes) {
      md += `#### 📝 备注\n\n`;
      md += `${tireSet.notes}\n\n`;
    }

    md += `---\n\n`;
  }

  const allRisks = tireSetDetails.flatMap(d => d.risks || []);
  if (allRisks.length > 0) {
    md += `## 风险汇总\n\n`;
    md += `| 风险类型 | 严重程度 | 状态 |\n`;
    md += `|----------|----------|------|\n`;
    
    for (const detail of tireSetDetails) {
      for (const risk of detail.risks) {
        const review = detail.reviews.find(r => r.riskType === risk.type);
        const decision = review ? review.decision : 'pending';
        md += `| ${getRiskTypeName(risk.type)} | ${getSeverityName(risk.severity)} | ${getDecisionName(decision)} |\n`;
      }
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## 交接确认\n\n`;
  md += `- [ ] 轮胎组条码核对无误\n`;
  md += `- [ ] 轮胎规格、花纹一致\n`;
  md += `- [ ] 磨损深度在安全范围内\n`;
  md += `- [ ] 胎压正常\n`;
  md += `- [ ] 所有风险已处理或确认\n\n`;

  md += `**装车员签字**: _______________\n\n`;
  md += `**客户签字**: _______________\n\n`;
  md += `**交接时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;

  md += `---\n\n`;
  md += `*报告生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;

  return md;
}

function getStatusName(status) {
  const statusMap = {
    'pending': '待装车',
    'in_progress': '装车中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function getSeverityName(severity) {
  const severityMap = {
    'critical': '🔴 致命',
    'high': '🟠 高',
    'medium': '🟡 中',
    'low': '🟢 低'
  };
  return severityMap[severity] || severity;
}

function getDecisionName(decision) {
  const decisionMap = {
    'pending': '待确认',
    'confirmed': '已确认',
    'overruled': '已改判'
  };
  return decisionMap[decision] || decision;
}

function getRiskTypeName(type) {
  const typeMap = {
    'wrong_location': '错仓',
    'duplicate_appointment': '重复预约',
    'spec_mismatch': '规格不匹配',
    'pressure_abnormal': '胎压异常',
    'wear_exceeded': '磨损超限'
  };
  return typeMap[type] || type;
}

app.listen(PORT, () => {
  console.log(`轮胎店寄存复核系统已启动: http://localhost:${PORT}`);
});
