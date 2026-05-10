const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');
const MATERIALS_FILE = path.join(DATA_DIR, 'materials.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const APPROVALS_FILE = path.join(DATA_DIR, 'approvals.json');

const readJsonFile = (filePath, defaultValue = []) => {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
};

const writeJsonFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

const initializeSampleData = () => {
  if (fs.existsSync(QUOTES_FILE) && fs.readFileSync(QUOTES_FILE, 'utf8').length > 50) {
    return;
  }
  
  const materials = [
    { id: 'mat1', name: '普通地砖', type: 'floor', unit: '㎡', unitPrice: 85, category: '地面材料', spec: '800x800mm' },
    { id: 'mat2', name: '抛光地砖', type: 'floor', unit: '㎡', unitPrice: 150, category: '地面材料', spec: '800x800mm' },
    { id: 'mat3', name: '实木地板', type: 'floor', unit: '㎡', unitPrice: 280, category: '地面材料', spec: '910x122mm' },
    { id: 'mat4', name: '普通乳胶漆', type: 'wall', unit: '㎡', unitPrice: 35, category: '墙面材料', spec: '5L' },
    { id: 'mat5', name: '进口乳胶漆', type: 'wall', unit: '㎡', unitPrice: 68, category: '墙面材料', spec: '5L' },
    { id: 'mat6', name: '墙纸', type: 'wall', unit: '㎡', unitPrice: 120, category: '墙面材料', spec: '0.53x10m' },
    { id: 'mat7', name: '水泥', type: 'other', unit: '袋', unitPrice: 45, category: '基础材料', spec: '50kg' },
    { id: 'mat8', name: '砂子', type: 'other', unit: 'm³', unitPrice: 120, category: '基础材料', spec: '1m³' }
  ];
  
  const laborItems = [
    { id: 'lab1', name: '地砖铺贴', type: 'floor', unit: '㎡', unitPrice: 45 },
    { id: 'lab2', name: '地板安装', type: 'floor', unit: '㎡', unitPrice: 25 },
    { id: 'lab3', name: '墙面基层处理', type: 'wall', unit: '㎡', unitPrice: 18 },
    { id: 'lab4', name: '乳胶漆涂刷', type: 'wall', unit: '㎡', unitPrice: 12 },
    { id: 'lab5', name: '墙纸铺贴', type: 'wall', unit: '㎡', unitPrice: 28 },
    { id: 'lab6', name: '拆墙', type: 'other', unit: '㎡', unitPrice: 80 },
    { id: 'lab7', name: '砌墙', type: 'other', unit: '㎡', unitPrice: 120 }
  ];
  
  const project1 = {
    id: 'proj1',
    name: '阳光小区两居室',
    client: '张先生',
    phone: '13800138001',
    address: '阳光小区A栋1203',
    totalArea: 98,
    spaces: [
      { id: 'sp1', name: '客厅', area: 28, type: 'living' },
      { id: 'sp2', name: '主卧', area: 18, type: 'bedroom' },
      { id: 'sp3', name: '次卧', area: 14, type: 'bedroom' },
      { id: 'sp4', name: '厨房', area: 8, type: 'kitchen' },
      { id: 'sp5', name: '卫生间', area: 6, type: 'bathroom' },
      { id: 'sp6', name: '阳台', area: 4, type: 'balcony' }
    ],
    designer: '李设计师',
    createdAt: '2024-01-15T09:00:00.000Z',
    status: 'active'
  };
  
  const quote1v1 = {
    id: 'quote1-v1',
    projectId: 'proj1',
    version: 1,
    versionName: '初始报价',
    createdAt: '2024-01-15T09:30:00.000Z',
    createdBy: '李设计师',
    status: 'draft',
    discount: 0,
    discountReason: '',
    needsApproval: false,
    isSigned: false,
    items: [
      {
        id: 'item1',
        spaceId: 'sp1',
        spaceName: '客厅',
        type: 'floor',
        name: '地砖铺贴',
        material: { id: 'mat1', name: '普通地砖', unitPrice: 85, unit: '㎡', spec: '800x800mm' },
        labor: { id: 'lab1', name: '地砖铺贴', unitPrice: 45, unit: '㎡' },
        quantity: 28,
        unitPrice: 130,
        materialCost: 2380,
        laborCost: 1260,
        total: 3640
      },
      {
        id: 'item2',
        spaceId: 'sp1',
        spaceName: '客厅',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat4', name: '普通乳胶漆', unitPrice: 35, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 84,
        unitPrice: 65,
        materialCost: 2940,
        laborCost: 1008,
        total: 3948
      },
      {
        id: 'item3',
        spaceId: 'sp2',
        spaceName: '主卧',
        type: 'floor',
        name: '地板安装',
        material: { id: 'mat1', name: '普通地砖', unitPrice: 85, unit: '㎡', spec: '800x800mm' },
        labor: { id: 'lab1', name: '地砖铺贴', unitPrice: 45, unit: '㎡' },
        quantity: 18,
        unitPrice: 130,
        materialCost: 1530,
        laborCost: 810,
        total: 2340
      },
      {
        id: 'item4',
        spaceId: 'sp2',
        spaceName: '主卧',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat4', name: '普通乳胶漆', unitPrice: 35, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 54,
        unitPrice: 65,
        materialCost: 1890,
        laborCost: 648,
        total: 2538
      },
      {
        id: 'item5',
        spaceId: 'sp3',
        spaceName: '次卧',
        type: 'floor',
        name: '地板安装',
        material: { id: 'mat1', name: '普通地砖', unitPrice: 85, unit: '㎡', spec: '800x800mm' },
        labor: { id: 'lab1', name: '地砖铺贴', unitPrice: 45, unit: '㎡' },
        quantity: 14,
        unitPrice: 130,
        materialCost: 1190,
        laborCost: 630,
        total: 1820
      },
      {
        id: 'item6',
        spaceId: 'sp3',
        spaceName: '次卧',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat4', name: '普通乳胶漆', unitPrice: 35, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 42,
        unitPrice: 65,
        materialCost: 1470,
        laborCost: 504,
        total: 1974
      }
    ],
    summary: {
      totalMaterialCost: 11400,
      totalLaborCost: 4860,
      subtotal: 16260,
      discount: 0,
      finalTotal: 16260
    },
    notes: '普通两居室基础装修报价'
  };
  
  const quote1v2 = {
    id: 'quote1-v2',
    projectId: 'proj1',
    version: 2,
    versionName: '材料升级版本',
    createdAt: '2024-01-18T14:00:00.000Z',
    createdBy: '李设计师',
    status: 'draft',
    discount: 0,
    discountReason: '',
    needsApproval: false,
    isSigned: false,
    basedOn: 'quote1-v1',
    items: [
      {
        id: 'item1',
        spaceId: 'sp1',
        spaceName: '客厅',
        type: 'floor',
        name: '地砖铺贴',
        material: { id: 'mat2', name: '抛光地砖', unitPrice: 150, unit: '㎡', spec: '800x800mm' },
        labor: { id: 'lab1', name: '地砖铺贴', unitPrice: 45, unit: '㎡' },
        quantity: 28,
        unitPrice: 195,
        materialCost: 4200,
        laborCost: 1260,
        total: 5460
      },
      {
        id: 'item2',
        spaceId: 'sp1',
        spaceName: '客厅',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat5', name: '进口乳胶漆', unitPrice: 68, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 84,
        unitPrice: 98,
        materialCost: 5712,
        laborCost: 1008,
        total: 6720
      },
      {
        id: 'item3',
        spaceId: 'sp2',
        spaceName: '主卧',
        type: 'floor',
        name: '实木地板',
        material: { id: 'mat3', name: '实木地板', unitPrice: 280, unit: '㎡', spec: '910x122mm' },
        labor: { id: 'lab2', name: '地板安装', unitPrice: 25, unit: '㎡' },
        quantity: 18,
        unitPrice: 305,
        materialCost: 5040,
        laborCost: 450,
        total: 5490
      },
      {
        id: 'item4',
        spaceId: 'sp2',
        spaceName: '主卧',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat5', name: '进口乳胶漆', unitPrice: 68, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 54,
        unitPrice: 98,
        materialCost: 3672,
        laborCost: 648,
        total: 4320
      },
      {
        id: 'item5',
        spaceId: 'sp3',
        spaceName: '次卧',
        type: 'floor',
        name: '地板安装',
        material: { id: 'mat2', name: '抛光地砖', unitPrice: 150, unit: '㎡', spec: '800x800mm' },
        labor: { id: 'lab1', name: '地砖铺贴', unitPrice: 45, unit: '㎡' },
        quantity: 14,
        unitPrice: 195,
        materialCost: 2100,
        laborCost: 630,
        total: 2730
      },
      {
        id: 'item6',
        spaceId: 'sp3',
        spaceName: '次卧',
        type: 'wall',
        name: '墙面乳胶漆',
        material: { id: 'mat5', name: '进口乳胶漆', unitPrice: 68, unit: '㎡', spec: '5L' },
        labor: { id: 'lab4', name: '乳胶漆涂刷', unitPrice: 12, unit: '㎡' },
        quantity: 42,
        unitPrice: 98,
        materialCost: 2856,
        laborCost: 504,
        total: 3360
      }
    ],
    summary: {
      totalMaterialCost: 23580,
      totalLaborCost: 4500,
      subtotal: 28080,
      discount: 0,
      finalTotal: 28080
    },
    notes: '客户要求升级材料：地砖升级为抛光砖，乳胶漆升级为进口品牌，主卧改为实木地板'
  };
  
  const quote1v3 = {
    id: 'quote1-v3',
    projectId: 'proj1',
    version: 3,
    versionName: '大优惠申请版本',
    createdAt: '2024-01-20T10:00:00.000Z',
    createdBy: '李设计师',
    status: 'pending_approval',
    discount: 15,
    discountReason: '客户是老客户介绍，希望给予特别优惠',
    needsApproval: true,
    isSigned: false,
    basedOn: 'quote1-v2',
    items: quote1v2.items,
    summary: {
      totalMaterialCost: 23580,
      totalLaborCost: 4500,
      subtotal: 28080,
      discount: 15,
      discountAmount: 4212,
      finalTotal: 23868
    },
    notes: '申请15%的优惠额度，超过常规10%的审批阈值'
  };
  
  const approval1 = {
    id: 'appr1',
    quoteId: 'quote1-v3',
    projectId: 'proj1',
    requester: '李设计师',
    createdAt: '2024-01-20T10:00:00.000Z',
    status: 'rejected',
    reviewedBy: '王经理',
    reviewedAt: '2024-01-20T11:30:00.000Z',
    rejectionReason: '优惠力度过大，建议调整为10%以内或提供更多客户价值说明',
    discountRequested: 15,
    discountThreshold: 10
  };
  
  writeJsonFile(MATERIALS_FILE, { materials, laborItems });
  writeJsonFile(PROJECTS_FILE, [project1]);
  writeJsonFile(QUOTES_FILE, [quote1v1, quote1v2, quote1v3]);
  writeJsonFile(APPROVALS_FILE, [approval1]);
};

initializeSampleData();

const DISCOUNT_THRESHOLD = 10;

app.get('/api/projects', (req, res) => {
  const projects = readJsonFile(PROJECTS_FILE, []);
  const quotes = readJsonFile(QUOTES_FILE, []);
  
  const projectsWithLatestQuote = projects.map(p => {
    const projectQuotes = quotes.filter(q => q.projectId === p.id).sort((a, b) => b.version - a.version);
    return {
      ...p,
      latestQuote: projectQuotes[0] || null,
      quoteCount: projectQuotes.length
    };
  });
  
  res.json(projectsWithLatestQuote);
});

app.get('/api/projects/:id', (req, res) => {
  const projects = readJsonFile(PROJECTS_FILE, []);
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const projects = readJsonFile(PROJECTS_FILE, []);
  const newProject = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  
  projects.push(newProject);
  writeJsonFile(PROJECTS_FILE, projects);
  res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const projects = readJsonFile(PROJECTS_FILE, []);
  const index = projects.findIndex(p => p.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  projects[index] = { ...projects[index], ...req.body, updatedAt: new Date().toISOString() };
  writeJsonFile(PROJECTS_FILE, projects);
  res.json(projects[index]);
});

app.get('/api/quotes/project/:projectId', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const projectQuotes = quotes
    .filter(q => q.projectId === req.params.projectId)
    .sort((a, b) => b.version - a.version);
  
  res.json(projectQuotes);
});

app.get('/api/quotes/:id', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const quote = quotes.find(q => q.id === req.params.id);
  
  if (!quote) {
    return res.status(404).json({ error: '报价不存在' });
  }
  
  res.json(quote);
});

app.post('/api/quotes', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const { projectId } = req.body;
  
  const projectQuotes = quotes.filter(q => q.projectId === projectId);
  const nextVersion = projectQuotes.length > 0 
    ? Math.max(...projectQuotes.map(q => q.version)) + 1 
    : 1;
  
  const discount = req.body.discount || 0;
  const needsApproval = discount > DISCOUNT_THRESHOLD;
  
  const newQuote = {
    id: `quote-${uuidv4().substr(0, 8)}-v${nextVersion}`,
    ...req.body,
    version: nextVersion,
    createdAt: new Date().toISOString(),
    status: needsApproval ? 'pending_approval' : 'draft',
    needsApproval,
    isSigned: false
  };
  
  quotes.push(newQuote);
  writeJsonFile(QUOTES_FILE, quotes);
  
  if (needsApproval) {
    const approvals = readJsonFile(APPROVALS_FILE, []);
    approvals.push({
      id: uuidv4(),
      quoteId: newQuote.id,
      projectId: newQuote.projectId,
      requester: newQuote.createdBy || '未知',
      createdAt: new Date().toISOString(),
      status: 'pending',
      discountRequested: discount,
      discountThreshold: DISCOUNT_THRESHOLD
    });
    writeJsonFile(APPROVALS_FILE, approvals);
  }
  
  res.json(newQuote);
});

app.put('/api/quotes/:id/confirm', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const index = quotes.findIndex(q => q.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '报价不存在' });
  }
  
  const quote = quotes[index];
  
  if (quote.status === 'confirmed') {
    return res.status(400).json({ error: '该报价版本已确认，不能重复确认' });
  }
  
  if (quote.needsApproval && quote.status !== 'approved') {
    return res.status(400).json({ error: '该报价需要审批通过后才能确认' });
  }
  
  quotes[index] = {
    ...quote,
    status: 'confirmed',
    confirmedAt: new Date().toISOString(),
    confirmedBy: req.body.confirmedBy || '未知'
  };
  
  writeJsonFile(QUOTES_FILE, quotes);
  res.json(quotes[index]);
});

app.put('/api/quotes/:id/sign', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const index = quotes.findIndex(q => q.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '报价不存在' });
  }
  
  const quote = quotes[index];
  
  if (quote.status !== 'confirmed') {
    return res.status(400).json({ error: '报价需先确认后才能签约' });
  }
  
  if (quote.isSigned) {
    return res.status(400).json({ error: '该报价已签约，不能重复签约' });
  }
  
  quotes[index] = {
    ...quote,
    isSigned: true,
    signedAt: new Date().toISOString(),
    signedBy: req.body.signedBy || '未知'
  };
  
  writeJsonFile(QUOTES_FILE, quotes);
  res.json(quotes[index]);
});

app.put('/api/quotes/:id', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const index = quotes.findIndex(q => q.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: '报价不存在' });
  }
  
  const quote = quotes[index];
  
  if (quote.isSigned) {
    return res.status(400).json({ error: '已签约报价不能直接修改，请创建新版本' });
  }
  
  const discount = req.body.discount || quote.discount || 0;
  const needsApproval = discount > DISCOUNT_THRESHOLD;
  
  quotes[index] = {
    ...quote,
    ...req.body,
    needsApproval,
    updatedAt: new Date().toISOString()
  };
  
  writeJsonFile(QUOTES_FILE, quotes);
  res.json(quotes[index]);
});

app.get('/api/quotes/compare/:quoteId1/:quoteId2', (req, res) => {
  const quotes = readJsonFile(QUOTES_FILE, []);
  const quote1 = quotes.find(q => q.id === req.params.quoteId1);
  const quote2 = quotes.find(q => q.id === req.params.quoteId2);
  
  if (!quote1 || !quote2) {
    return res.status(404).json({ error: '报价不存在' });
  }
  
  res.json({ quote1, quote2 });
});

app.get('/api/materials', (req, res) => {
  const data = readJsonFile(MATERIALS_FILE, { materials: [], laborItems: [] });
  res.json(data);
});

app.post('/api/materials', (req, res) => {
  const data = readJsonFile(MATERIALS_FILE, { materials: [], laborItems: [] });
  const newMaterial = {
    id: uuidv4(),
    ...req.body
  };
  
  data.materials.push(newMaterial);
  writeJsonFile(MATERIALS_FILE, data);
  res.json(newMaterial);
});

app.get('/api/approvals', (req, res) => {
  const approvals = readJsonFile(APPROVALS_FILE, []);
  const quotes = readJsonFile(QUOTES_FILE, []);
  const projects = readJsonFile(PROJECTS_FILE, []);
  
  const approvalsWithDetails = approvals.map(a => {
    const quote = quotes.find(q => q.id === a.quoteId);
    const project = projects.find(p => p.id === a.projectId);
    return {
      ...a,
      quote,
      project
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(approvalsWithDetails);
});

app.put('/api/approvals/:id/approve', (req, res) => {
  const approvals = readJsonFile(APPROVALS_FILE, []);
  const quotes = readJsonFile(QUOTES_FILE, []);
  
  const approvalIndex = approvals.findIndex(a => a.id === req.params.id);
  
  if (approvalIndex === -1) {
    return res.status(404).json({ error: '审批不存在' });
  }
  
  const approval = approvals[approvalIndex];
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ error: '该审批已处理' });
  }
  
  approvals[approvalIndex] = {
    ...approval,
    status: 'approved',
    reviewedBy: req.body.reviewedBy || '管理员',
    reviewedAt: new Date().toISOString()
  };
  
  const quoteIndex = quotes.findIndex(q => q.id === approval.quoteId);
  if (quoteIndex !== -1) {
    quotes[quoteIndex] = {
      ...quotes[quoteIndex],
      status: 'approved'
    };
  }
  
  writeJsonFile(APPROVALS_FILE, approvals);
  writeJsonFile(QUOTES_FILE, quotes);
  
  res.json(approvals[approvalIndex]);
});

app.put('/api/approvals/:id/reject', (req, res) => {
  const approvals = readJsonFile(APPROVALS_FILE, []);
  const quotes = readJsonFile(QUOTES_FILE, []);
  
  const approvalIndex = approvals.findIndex(a => a.id === req.params.id);
  
  if (approvalIndex === -1) {
    return res.status(404).json({ error: '审批不存在' });
  }
  
  const approval = approvals[approvalIndex];
  
  if (approval.status !== 'pending') {
    return res.status(400).json({ error: '该审批已处理' });
  }
  
  approvals[approvalIndex] = {
    ...approval,
    status: 'rejected',
    reviewedBy: req.body.reviewedBy || '管理员',
    reviewedAt: new Date().toISOString(),
    rejectionReason: req.body.rejectionReason || '未提供原因'
  };
  
  const quoteIndex = quotes.findIndex(q => q.id === approval.quoteId);
  if (quoteIndex !== -1) {
    quotes[quoteIndex] = {
      ...quotes[quoteIndex],
      status: 'rejected'
    };
  }
  
  writeJsonFile(APPROVALS_FILE, approvals);
  writeJsonFile(QUOTES_FILE, quotes);
  
  res.json(approvals[approvalIndex]);
});

app.get('/api/reports/overview', (req, res) => {
  const { startDate, endDate, designer, client } = req.query;
  
  const quotes = readJsonFile(QUOTES_FILE, []);
  const projects = readJsonFile(PROJECTS_FILE, []);
  const approvals = readJsonFile(APPROVALS_FILE, []);
  
  let filteredQuotes = quotes;
  let filteredProjects = projects;
  let filteredApprovals = approvals;
  
  if (startDate) {
    filteredQuotes = filteredQuotes.filter(q => new Date(q.createdAt) >= new Date(startDate));
    filteredApprovals = filteredApprovals.filter(a => new Date(a.createdAt) >= new Date(startDate));
    filteredProjects = filteredProjects.filter(p => new Date(p.createdAt) >= new Date(startDate));
  }
  
  if (endDate) {
    filteredQuotes = filteredQuotes.filter(q => new Date(q.createdAt) <= new Date(endDate));
    filteredApprovals = filteredApprovals.filter(a => new Date(a.createdAt) <= new Date(endDate));
    filteredProjects = filteredProjects.filter(p => new Date(p.createdAt) <= new Date(endDate));
  }
  
  if (designer) {
    filteredProjects = filteredProjects.filter(p => p.designer === designer);
    const projectIds = filteredProjects.map(p => p.id);
    filteredQuotes = filteredQuotes.filter(q => projectIds.includes(q.projectId));
    filteredApprovals = filteredApprovals.filter(a => projectIds.includes(a.projectId));
  }
  
  if (client) {
    filteredProjects = filteredProjects.filter(p => 
      p.client.includes(client) || p.name.includes(client)
    );
    const projectIds = filteredProjects.map(p => p.id);
    filteredQuotes = filteredQuotes.filter(q => projectIds.includes(q.projectId));
    filteredApprovals = filteredApprovals.filter(a => projectIds.includes(a.projectId));
  }
  
  const report = {
    overview: {
      totalProjects: filteredProjects.length,
      totalQuotes: filteredQuotes.length,
      signedQuotes: filteredQuotes.filter(q => q.isSigned).length,
      totalValue: filteredQuotes.reduce((sum, q) => sum + (q.summary?.finalTotal || 0), 0),
      signedValue: filteredQuotes.filter(q => q.isSigned).reduce((sum, q) => sum + (q.summary?.finalTotal || 0), 0)
    },
    byDesigner: {},
    byStatus: {
      draft: 0,
      confirmed: 0,
      pending_approval: 0,
      approved: 0,
      rejected: 0,
      signed: 0
    },
    approvalStats: {
      total: filteredApprovals.length,
      approved: filteredApprovals.filter(a => a.status === 'approved').length,
      rejected: filteredApprovals.filter(a => a.status === 'rejected').length,
      pending: filteredApprovals.filter(a => a.status === 'pending').length
    },
    recentActivity: [
      ...filteredQuotes.slice(-10).map(q => ({
        type: 'quote',
        id: q.id,
        action: `创建报价版本 v${q.version}`,
        by: q.createdBy || '未知',
        at: q.createdAt,
        projectName: projects.find(p => p.id === q.projectId)?.name || '未知项目'
      })),
      ...filteredApprovals.slice(-10).map(a => ({
        type: 'approval',
        id: a.id,
        action: a.status === 'approved' ? '审批通过' : a.status === 'rejected' ? '审批拒绝' : '提交审批',
        by: a.reviewer || a.requester,
        at: a.reviewedAt || a.createdAt,
        projectName: projects.find(p => p.id === a.projectId)?.name || '未知项目'
      }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 20)
  };
  
  filteredProjects.forEach(p => {
    if (p.designer) {
      if (!report.byDesigner[p.designer]) {
        report.byDesigner[p.designer] = {
          projectCount: 0,
          quoteCount: 0,
          signedQuoteCount: 0,
          totalValue: 0,
          signedValue: 0
        };
      }
      report.byDesigner[p.designer].projectCount++;
      const designerQuotes = filteredQuotes.filter(q => q.projectId === p.id);
      report.byDesigner[p.designer].quoteCount += designerQuotes.length;
      report.byDesigner[p.designer].signedQuoteCount += designerQuotes.filter(q => q.isSigned).length;
      report.byDesigner[p.designer].totalValue += designerQuotes.reduce((sum, q) => sum + (q.summary?.finalTotal || 0), 0);
      report.byDesigner[p.designer].signedValue += designerQuotes.filter(q => q.isSigned).reduce((sum, q) => sum + (q.summary?.finalTotal || 0), 0);
    }
  });
  
  filteredQuotes.forEach(q => {
    if (q.isSigned) {
      report.byStatus.signed++;
    } else if (report.byStatus[q.status] !== undefined) {
      report.byStatus[q.status]++;
    }
  });
  
  res.json(report);
});

app.get('/api/config', (req, res) => {
  res.json({
    discountThreshold: DISCOUNT_THRESHOLD
  });
});

app.listen(PORT, () => {
  console.log(`家装量房报价协同台已启动: http://localhost:${PORT}`);
});
