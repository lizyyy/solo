const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      lifting_plans: [],
      approval_logs: [],
      commanders: [
        { id: 1, name: '张三', qualified: 1, created_at: new Date().toISOString() },
        { id: 2, name: '李四', qualified: 1, created_at: new Date().toISOString() },
        { id: 3, name: '王五', qualified: 0, created_at: new Date().toISOString() },
      ]
    };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return { lifting_plans: [], approval_logs: [], commanders: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

let db = loadData();

const CRANE_SPECS = {
  'QTZ80': { maxWeight: 8, maxRadius: 50, radiusWeightTable: { 10: 8, 20: 6, 30: 4.5, 40: 3, 50: 1.5 } },
  'QTZ63': { maxWeight: 6, maxRadius: 45, radiusWeightTable: { 10: 6, 20: 4.8, 30: 3.5, 40: 2.2, 45: 1.2 } },
  'QTZ125': { maxWeight: 12, maxRadius: 60, radiusWeightTable: { 10: 12, 20: 10, 30: 8, 40: 6, 50: 4, 60: 2.5 } },
};

const MAX_WIND_SPEED = 12;

function generatePlanNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const count = db.lifting_plans.filter(p => p.plan_no && p.plan_no.startsWith(`HD${dateStr}`)).length;
  return `HD${dateStr}${String(count + 1).padStart(3, '0')}`;
}

function interpolateMaxWeight(specs, radius) {
  const table = specs.radiusWeightTable;
  const radii = Object.keys(table).map(Number).sort((a, b) => a - b);
  
  if (radius <= radii[0]) return table[radii[0]];
  if (radius >= radii[radii.length - 1]) return table[radii[radii.length - 1]];
  
  for (let i = 0; i < radii.length - 1; i++) {
    const r1 = radii[i];
    const r2 = radii[i + 1];
    if (radius >= r1 && radius <= r2) {
      const ratio = (radius - r1) / (r2 - r1);
      return table[r1] - ratio * (table[r1] - table[r2]);
    }
  }
  return table[radii[0]];
}

function validateWeightRadius(weight, radius, craneType) {
  const specs = CRANE_SPECS[craneType];
  if (!specs) {
    return { valid: false, reason: '未知塔吊型号' };
  }
  
  if (weight > specs.maxWeight) {
    return { valid: false, reason: `超重：物料重量${weight}吨超过塔吊最大起重${specs.maxWeight}吨` };
  }
  
  if (radius > specs.maxRadius) {
    return { valid: false, reason: `超半径：作业半径${radius}米超过塔吊最大半径${specs.maxRadius}米` };
  }
  
  const maxAllowedWeight = interpolateMaxWeight(specs, radius);
  if (weight > maxAllowedWeight) {
    return { 
      valid: false, 
      reason: `半径重量不匹配：在${radius}米半径下，${craneType}塔吊最大只能吊${maxAllowedWeight.toFixed(1)}吨，但申请了${weight}吨` 
    };
  }
  
  return { valid: true, maxAllowedWeight: maxAllowedWeight };
}

function validatePlan(plan) {
  const issues = [];
  const warnings = [];
  
  const weightCheck = validateWeightRadius(plan.material_weight, plan.operation_radius, plan.crane_type);
  if (!weightCheck.valid) {
    issues.push(weightCheck.reason);
  }
  
  if (plan.wind_speed > MAX_WIND_SPEED) {
    warnings.push(`风速超限：当前风速${plan.wind_speed}m/s超过安全限值${MAX_WIND_SPEED}m/s，需要安全员复核`);
  }
  
  const commander = db.commanders.find(c => c.name === plan.commander);
  const isQualified = commander ? commander.qualified === 1 : false;
  if (!isQualified) {
    issues.push(`资质缺失：指挥人员"${plan.commander}"无有效吊装指挥资质`);
  }
  
  if (plan.start_time && plan.end_time) {
    const conflict = db.lifting_plans.find(p => 
      ['pending_review', 'approved', 'pending_safety_review'].includes(p.status) &&
      p.id !== (plan.id || 0) &&
      !(p.end_time <= plan.start_time || p.start_time >= plan.end_time)
    );
    
    if (conflict) {
      issues.push(`时间冲突：与已审批计划"${conflict.task_name}"时段重叠`);
    }
  }
  
  return { issues, warnings, weightCheck, isQualified };
}

function getNextPlanId() {
  if (db.lifting_plans.length === 0) return 1;
  return Math.max(...db.lifting_plans.map(p => p.id)) + 1;
}

function getNextLogId() {
  if (db.approval_logs.length === 0) return 1;
  return Math.max(...db.approval_logs.map(l => l.id)) + 1;
}

app.get('/api/plans', (req, res) => {
  const { status, risk_level, keyword } = req.query;
  let plans = [...db.lifting_plans];
  
  if (status) {
    plans = plans.filter(p => p.status === status);
  }
  if (risk_level) {
    plans = plans.filter(p => p.risk_level === risk_level);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    plans = plans.filter(p => 
      p.task_name.toLowerCase().includes(kw) ||
      p.plan_no.toLowerCase().includes(kw) ||
      p.material_name.toLowerCase().includes(kw)
    );
  }
  
  plans.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(plans);
});

app.get('/api/plans/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const plan = db.lifting_plans.find(p => p.id === id);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  
  const logs = db.approval_logs.filter(l => l.plan_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json({ plan, logs });
});

app.post('/api/plans', (req, res) => {
  const plan = req.body;
  plan.id = getNextPlanId();
  plan.plan_no = generatePlanNo();
  plan.status = 'draft';
  plan.risk_level = 'low';
  
  const commander = db.commanders.find(c => c.name === plan.commander);
  plan.commander_qualified = commander && commander.qualified === 1 ? 1 : 0;
  plan.created_at = new Date().toISOString();
  plan.updated_at = new Date().toISOString();
  
  db.lifting_plans.push(plan);
  saveData(db);
  
  res.json(plan);
});

app.put('/api/plans/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.lifting_plans.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: '计划不存在' });
  
  const existing = db.lifting_plans[index];
  if (existing.status !== 'draft') {
    return res.status(400).json({ error: '只能修改草稿状态的计划' });
  }
  
  const plan = req.body;
  const commander = db.commanders.find(c => c.name === plan.commander);
  const qualified = commander && commander.qualified === 1 ? 1 : 0;
  
  db.lifting_plans[index] = {
    ...existing,
    ...plan,
    commander_qualified: qualified,
    updated_at: new Date().toISOString()
  };
  saveData(db);
  
  res.json(db.lifting_plans[index]);
});

app.post('/api/plans/:id/submit', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.lifting_plans.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: '计划不存在' });
  
  const plan = db.lifting_plans[index];
  if (plan.status !== 'draft') {
    return res.status(400).json({ error: '该计划已提交过，不能重复提交' });
  }
  
  const validation = validatePlan(plan);
  
  if (validation.issues.length > 0) {
    return res.json({ 
      success: false, 
      canSubmit: false, 
      issues: validation.issues, 
      warnings: validation.warnings,
      message: '存在必须驳回的问题，请修正后再提交'
    });
  }
  
  let newStatus = 'pending_review';
  let riskLevel = 'low';
  
  if (validation.warnings.length > 0) {
    riskLevel = 'high';
    newStatus = 'pending_safety_review';
  }
  
  db.lifting_plans[index] = {
    ...plan,
    status: newStatus,
    risk_level: riskLevel,
    updated_at: new Date().toISOString()
  };
  
  const log = {
    id: getNextLogId(),
    plan_id: id,
    action: '提交审批',
    operator: req.body.operator || '申请人',
    comment: req.body.comment || '',
    before_status: 'draft',
    after_status: newStatus,
    created_at: new Date().toISOString()
  };
  db.approval_logs.push(log);
  saveData(db);
  
  const logs = db.approval_logs.filter(l => l.plan_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  res.json({
    success: true,
    canSubmit: true,
    warnings: validation.warnings,
    needsSafetyReview: validation.warnings.length > 0,
    plan: db.lifting_plans[index],
    logs,
    message: validation.warnings.length > 0 ? '已提交，因存在风险需安全员复核' : '已提交审批'
  });
});

app.post('/api/plans/:id/approve', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.lifting_plans.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: '计划不存在' });
  
  const plan = db.lifting_plans[index];
  if (!['pending_review', 'pending_safety_review'].includes(plan.status)) {
    return res.status(400).json({ error: '该状态下不能审批' });
  }
  
  const beforeStatus = plan.status;
  db.lifting_plans[index] = {
    ...plan,
    status: 'approved',
    updated_at: new Date().toISOString()
  };
  
  const log = {
    id: getNextLogId(),
    plan_id: id,
    action: '审批通过',
    operator: req.body.operator || '审批人',
    comment: req.body.comment || '',
    before_status: beforeStatus,
    after_status: 'approved',
    created_at: new Date().toISOString()
  };
  db.approval_logs.push(log);
  saveData(db);
  
  const logs = db.approval_logs.filter(l => l.plan_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  res.json({ success: true, plan: db.lifting_plans[index], logs, message: '审批通过' });
});

app.post('/api/plans/:id/reject', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.lifting_plans.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: '计划不存在' });
  
  const plan = db.lifting_plans[index];
  if (!['pending_review', 'pending_safety_review'].includes(plan.status)) {
    return res.status(400).json({ error: '该状态下不能驳回' });
  }
  
  const beforeStatus = plan.status;
  db.lifting_plans[index] = {
    ...plan,
    status: 'rejected',
    rejection_reason: req.body.reason || '',
    updated_at: new Date().toISOString()
  };
  
  const log = {
    id: getNextLogId(),
    plan_id: id,
    action: '驳回',
    operator: req.body.operator || '审批人',
    comment: req.body.reason || '',
    before_status: beforeStatus,
    after_status: 'rejected',
    created_at: new Date().toISOString()
  };
  db.approval_logs.push(log);
  saveData(db);
  
  const logs = db.approval_logs.filter(l => l.plan_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  res.json({ success: true, plan: db.lifting_plans[index], logs, message: '已驳回' });
});

app.post('/api/plans/:id/return_to_draft', (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.lifting_plans.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: '计划不存在' });
  
  const plan = db.lifting_plans[index];
  if (plan.status !== 'rejected') {
    return res.status(400).json({ error: '只有被驳回的计划可以撤回修改' });
  }
  
  db.lifting_plans[index] = {
    ...plan,
    status: 'draft',
    updated_at: new Date().toISOString()
  };
  
  const log = {
    id: getNextLogId(),
    plan_id: id,
    action: '撤回修改',
    operator: req.body.operator || '申请人',
    comment: req.body.comment || '',
    before_status: 'rejected',
    after_status: 'draft',
    created_at: new Date().toISOString()
  };
  db.approval_logs.push(log);
  saveData(db);
  
  res.json({ success: true, plan: db.lifting_plans[index], message: '已撤回，可重新编辑' });
});

app.post('/api/validate/weight-radius', (req, res) => {
  const { weight, radius, crane_type } = req.body;
  const result = validateWeightRadius(weight, radius, crane_type);
  res.json(result);
});

app.post('/api/validate/plan', (req, res) => {
  const plan = req.body;
  const result = validatePlan(plan);
  res.json(result);
});

app.get('/api/commanders', (req, res) => {
  res.json(db.commanders);
});

app.get('/api/crane-specs', (req, res) => {
  res.json(CRANE_SPECS);
});

app.get('/api/export/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  
  const plans = db.lifting_plans.filter(p => 
    (p.start_time && p.start_time.startsWith(date)) ||
    (p.created_at && p.created_at.startsWith(date))
  ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  
  const withDetails = plans.map(p => {
    const validation = validatePlan(p);
    return {
      ...p,
      validation_issues: validation.issues,
      validation_warnings: validation.warnings,
      has_risk: validation.issues.length > 0 || validation.warnings.length > 0
    };
  });
  
  res.json({
    date,
    total_count: plans.length,
    high_risk_count: withDetails.filter(p => p.has_risk).length,
    approved_count: withDetails.filter(p => p.status === 'approved').length,
    pending_count: withDetails.filter(p => ['pending_review', 'pending_safety_review'].includes(p.status)).length,
    rejected_count: withDetails.filter(p => p.status === 'rejected').length,
    records: withDetails
  });
});

function initSampleData() {
  if (db.lifting_plans.length > 0) return;
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const samples = [
    {
      task_name: '3号楼标准层钢筋吊装',
      material_name: 'HRB400钢筋',
      material_weight: 3.5,
      operation_radius: 25,
      crane_type: 'QTZ80',
      start_time: `${today.toISOString().slice(0, 10)}T09:00:00`,
      end_time: `${today.toISOString().slice(0, 10)}T11:00:00`,
      wind_speed: 6,
      commander: '张三',
      status: 'approved',
      risk_level: 'low'
    },
    {
      task_name: '基坑模板吊装（风速超限）',
      material_name: '钢模板',
      material_weight: 2,
      operation_radius: 15,
      crane_type: 'QTZ80',
      start_time: `${today.toISOString().slice(0, 10)}T14:00:00`,
      end_time: `${today.toISOString().slice(0, 10)}T16:00:00`,
      wind_speed: 15,
      commander: '李四',
      status: 'pending_safety_review',
      risk_level: 'high'
    },
    {
      task_name: '屋面钢结构吊装（半径重量不匹配）',
      material_name: 'H型钢梁',
      material_weight: 5,
      operation_radius: 40,
      crane_type: 'QTZ80',
      start_time: `${tomorrow.toISOString().slice(0, 10)}T10:00:00`,
      end_time: `${tomorrow.toISOString().slice(0, 10)}T12:00:00`,
      wind_speed: 8,
      commander: '王五',
      status: 'draft',
      risk_level: 'low'
    }
  ];
  
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const planNo = `HD${today.toISOString().slice(0, 10).replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`;
    
    const commander = db.commanders.find(c => c.name === s.commander);
    const qualified = commander && commander.qualified === 1 ? 1 : 0;
    
    db.lifting_plans.push({
      id: getNextPlanId(),
      plan_no: planNo,
      task_name: s.task_name,
      material_name: s.material_name,
      material_weight: s.material_weight,
      operation_radius: s.operation_radius,
      crane_type: s.crane_type,
      start_time: s.start_time,
      end_time: s.end_time,
      wind_speed: s.wind_speed,
      commander: s.commander,
      commander_qualified: qualified,
      status: s.status,
      risk_level: s.risk_level,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  saveData(db);
}

initSampleData();

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`打开浏览器访问 http://localhost:${PORT}/ 即可使用系统`);
});
