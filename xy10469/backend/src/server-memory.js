const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const generateId = () => Math.random().toString(36).substring(2, 15);

const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const now = new Date();
const todayStr = formatDate(now);
const future10 = formatDate(new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000));
const future30 = formatDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
const future40 = formatDate(new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000));
const past30 = formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
const past10 = formatDate(new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));

const db = {
  booths: [
    {
      _id: 'booth_f001',
      code: 'F001',
      name: '食品摊位A区-1号',
      type: 'food',
      location: '一楼中庭A区',
      area: 15,
      standardElectricity: 5,
      standardRental: 500,
      standardDeposit: 2000,
      status: 'available',
      description: '适合特色小吃、快餐类食品商户',
      equipment: ['水电接口', '排气扇']
    },
    {
      _id: 'booth_f002',
      code: 'F002',
      name: '食品摊位A区-2号',
      type: 'food',
      location: '一楼中庭A区',
      area: 12,
      standardElectricity: 5,
      standardRental: 450,
      standardDeposit: 1800,
      status: 'available',
      description: '适合饮品、甜点类食品商户',
      equipment: ['水电接口']
    },
    {
      _id: 'booth_c001',
      code: 'C001',
      name: '文创摊位B区-1号',
      type: 'cultural',
      location: '二楼手扶梯旁',
      area: 10,
      standardElectricity: 3,
      standardRental: 300,
      standardDeposit: 1000,
      status: 'available',
      description: '适合手工艺品、文创产品',
      equipment: ['普通电源']
    },
    {
      _id: 'booth_c002',
      code: 'C002',
      name: '文创摊位B区-2号',
      type: 'cultural',
      location: '二楼手扶梯旁',
      area: 8,
      standardElectricity: 3,
      standardRental: 250,
      standardDeposit: 800,
      status: 'available',
      description: '适合图书、文具类商户',
      equipment: ['普通电源']
    },
    {
      _id: 'booth_p001',
      code: 'P001',
      name: '促销摊位C区-1号',
      type: 'promotion',
      location: '主入口广场',
      area: 20,
      standardElectricity: 4,
      standardRental: 800,
      standardDeposit: 3000,
      status: 'available',
      description: '适合大型促销活动',
      equipment: ['大功率电源', '网络接口']
    },
    {
      _id: 'booth_p002',
      code: 'P002',
      name: '促销摊位C区-2号',
      type: 'promotion',
      location: '主入口广场',
      area: 18,
      standardElectricity: 4,
      standardRental: 700,
      standardDeposit: 2500,
      status: 'available',
      description: '适合品牌展示、新品发布',
      equipment: ['大功率电源', '网络接口']
    }
  ],
  merchants: [
    { _id: 'merchant_1', name: '美味小吃坊', contactPerson: '张经理', phone: '13800138001', email: 'zhang@delicious.com', businessType: '餐饮小吃', licenseNumber: 'CY2024001', address: '北京市朝阳区xxx路xxx号', status: 'active', creditScore: 95 },
    { _id: 'merchant_2', name: '甜心奶茶屋', contactPerson: '李小姐', phone: '13800138002', email: 'li@sweettea.com', businessType: '饮品甜点', licenseNumber: 'CY2024002', address: '北京市海淀区xxx路xxx号', status: 'active', creditScore: 92 },
    { _id: 'merchant_3', name: '匠心手作', contactPerson: '王师傅', phone: '13800138003', email: 'wang@handmade.com', businessType: '手工艺品', licenseNumber: 'WG2024001', address: '北京市东城区xxx路xxx号', status: 'active', creditScore: 98 },
    { _id: 'merchant_4', name: '书香阁', contactPerson: '陈店长', phone: '13800138004', email: 'chen@bookshop.com', businessType: '图书文具', licenseNumber: 'TS2024001', address: '北京市西城区xxx路xxx号', status: 'active', creditScore: 90 },
    { _id: 'merchant_5', name: '优品数码', contactPerson: '刘总', phone: '13800138005', email: 'liu@digital.com', businessType: '电子产品', licenseNumber: 'DX2024001', address: '北京市丰台区xxx路xxx号', status: 'active', creditScore: 88 },
    { _id: 'merchant_6', name: '潮牌服饰', contactPerson: '赵经理', phone: '13800138006', email: 'zhao@fashion.com', businessType: '服装鞋帽', licenseNumber: 'FZ2024001', address: '北京市通州区xxx路xxx号', status: 'active', creditScore: 94 }
  ],
  schedules: [
    { _id: 'schedule_1', name: '春季美食节', description: '春季美食节活动', startDate: past30, endDate: past10, status: 'completed', boothTypes: ['food'], targetMerchants: '餐饮类商户', totalSlots: 10 },
    { _id: 'schedule_2', name: '夏季文创市集', description: '文创产品展示与销售', startDate: todayStr, endDate: future10, status: 'active', boothTypes: ['cultural'], targetMerchants: '文创类商户', totalSlots: 8 },
    { _id: 'schedule_3', name: '品牌促销周', description: '品牌联合促销', startDate: future30, endDate: future40, status: 'planning', boothTypes: ['promotion', 'cultural', 'food'], targetMerchants: '品牌商户', totalSlots: 6 }
  ],
  applications: [
    {
      _id: 'app_1',
      applicationNo: 'AP20240501001',
      merchantId: 'merchant_1',
      boothId: 'booth_f001',
      scheduleId: 'schedule_1',
      businessType: '特色小吃',
      requiredElectricity: 4,
      specialRequirements: '需要额外排气设备',
      status: 'in_progress',
      startDate: past30,
      endDate: future10,
      depositPaid: true,
      electricityApproved: true,
      admissionConfirmed: true,
      rentalFee: 5000,
      depositAmount: 2000,
      createdAt: past30
    },
    {
      _id: 'app_2',
      applicationNo: 'AP20240501002',
      merchantId: 'merchant_3',
      boothId: 'booth_c001',
      scheduleId: 'schedule_2',
      businessType: '手工艺品',
      requiredElectricity: 2,
      specialRequirements: '无',
      status: 'approved',
      startDate: todayStr,
      endDate: future10,
      depositPaid: true,
      electricityApproved: true,
      admissionConfirmed: false,
      rentalFee: 3000,
      depositAmount: 1000,
      createdAt: past10
    },
    {
      _id: 'app_3',
      applicationNo: 'AP20240501003',
      merchantId: 'merchant_5',
      boothId: 'booth_p001',
      scheduleId: 'schedule_3',
      businessType: '电子产品',
      requiredElectricity: 8,
      specialRequirements: '需要大功率电源',
      status: 'pending',
      startDate: future30,
      endDate: future40,
      depositPaid: false,
      electricityApproved: false,
      admissionConfirmed: false,
      rentalFee: 8000,
      depositAmount: 3000,
      createdAt: todayStr
    }
  ],
  deposits: [
    { _id: 'dep_1', transactionNo: 'DP20240501001', applicationId: 'app_1', merchantId: 'merchant_1', type: 'deposit', amount: 2000, paymentMethod: 'bank_transfer', status: 'confirmed', operator: '张运营', transactionDate: past30, notes: '入场押金' },
    { _id: 'dep_2', transactionNo: 'RT20240501001', applicationId: 'app_1', merchantId: 'merchant_1', type: 'rent', amount: 5000, paymentMethod: 'bank_transfer', status: 'confirmed', operator: '张运营', transactionDate: past30, notes: '摊位租金' },
    { _id: 'dep_3', transactionNo: 'DP20240501002', applicationId: 'app_2', merchantId: 'merchant_3', type: 'deposit', amount: 1000, paymentMethod: 'wechat', status: 'confirmed', operator: '李运营', transactionDate: past10, notes: '入场押金' },
    { _id: 'dep_4', transactionNo: 'RT20240501002', applicationId: 'app_2', merchantId: 'merchant_3', type: 'rent', amount: 3000, paymentMethod: 'wechat', status: 'confirmed', operator: '李运营', transactionDate: past10, notes: '摊位租金' },
    { _id: 'dep_5', transactionNo: 'EL20240501001', applicationId: 'app_1', merchantId: 'merchant_1', type: 'electricity', amount: 350, paymentMethod: 'bank_transfer', status: 'confirmed', operator: '系统', transactionDate: todayStr, notes: '用电费用' },
    { _id: 'dep_6', transactionNo: 'DD20240501001', applicationId: 'app_1', merchantId: 'merchant_1', type: 'deduction', amount: 500, paymentMethod: null, status: 'confirmed', operator: '王检查员', transactionDate: todayStr, notes: '撤场验收扣款：清洁卫生不合格、设备损坏', deductionDetails: [
      { category: 'cleanliness', name: '场地清洁', passed: false, deductionAmount: 200, deductionReason: '地面有污渍，垃圾未清理' },
      { category: 'equipment', name: '设备设施完好', passed: false, deductionAmount: 300, deductionReason: '展示柜台面有划痕' }
    ] }
  ],
  electricityApprovals: [
    {
      _id: 'el_1',
      approvalNo: 'ELAPV20240501001',
      applicationId: 'app_1',
      merchantId: 'merchant_1',
      boothId: 'booth_f001',
      standardElectricity: 5,
      requestedElectricity: 4,
      exceedsStandard: false,
      status: 'approved',
      approvedElectricity: 4,
      reason: '用电需求在标准范围内，自动通过',
      safetyCheck: true,
      approvedBy: '系统自动审批',
      approvedAt: past30,
      riskLevel: 'none'
    },
    {
      _id: 'el_2',
      approvalNo: 'ELAPV20240501002',
      applicationId: 'app_2',
      merchantId: 'merchant_3',
      boothId: 'booth_c001',
      standardElectricity: 3,
      requestedElectricity: 2,
      exceedsStandard: false,
      status: 'approved',
      approvedElectricity: 2,
      reason: '用电需求在标准范围内，自动通过',
      safetyCheck: true,
      approvedBy: '系统自动审批',
      approvedAt: past10,
      riskLevel: 'none'
    },
    {
      _id: 'el_3',
      approvalNo: 'ELAPV20240501003',
      applicationId: 'app_3',
      merchantId: 'merchant_5',
      boothId: 'booth_p001',
      standardElectricity: 4,
      requestedElectricity: 8,
      exceedsStandard: true,
      status: 'pending',
      approvedElectricity: null,
      reason: '超出标准用电100%，需要审批',
      equipmentList: ['大型冰箱', '展示屏', '音响设备'],
      approvedBy: null,
      approvedAt: null,
      riskLevel: 'high',
      riskReason: '高风险：超出标准用电4kW，存在安全隐患'
    }
  ],
  acceptances: [
    {
      _id: 'acc_1',
      acceptanceNo: 'ADM20240501001',
      applicationId: 'app_1',
      merchantId: 'merchant_1',
      boothId: 'booth_f001',
      type: 'admission',
      items: [
        { category: 'equipment', itemName: '摊位设备完好', status: 'pass', deductionAmount: 0 },
        { category: 'cleanliness', itemName: '场地清洁', status: 'pass', deductionAmount: 0 },
        { category: 'electricity', itemName: '用电设备正常', status: 'pass', deductionAmount: 0 },
        { category: 'structure', itemName: '结构安全', status: 'pass', deductionAmount: 0 }
      ],
      overallStatus: 'passed',
      totalDeduction: 0,
      canRefundDeposit: true,
      inspector: '王检查员',
      inspectionDate: past30,
      conclusion: '入场验收通过'
    },
    {
      _id: 'acc_2',
      acceptanceNo: 'WDL20240501001',
      applicationId: 'app_1',
      merchantId: 'merchant_1',
      boothId: 'booth_f001',
      type: 'withdrawal',
      items: [
        { category: 'equipment', itemName: '摊位设备完好', status: 'fail', deductionAmount: 300, deductionReason: '展示柜台面有划痕' },
        { category: 'cleanliness', itemName: '场地清洁', status: 'fail', deductionAmount: 200, deductionReason: '地面有污渍，垃圾未清理' },
        { category: 'electricity', itemName: '用电设备正常', status: 'pass', deductionAmount: 0 },
        { category: 'structure', itemName: '结构安全', status: 'pass', deductionAmount: 0 }
      ],
      overallStatus: 'failed',
      totalDeduction: 500,
      canRefundDeposit: true,
      inspector: '王检查员',
      inspectionDate: todayStr,
      conclusion: '撤场验收部分项目未通过，扣除押金500元'
    }
  ]
};

const getMerchantById = (id) => db.merchants.find(m => m._id === id);
const getBoothById = (id) => db.booths.find(b => b._id === id);
const getScheduleById = (id) => db.schedules.find(s => s._id === id);
const getApplicationById = (id) => db.applications.find(a => a._id === id);

const populateApplication = (app) => ({
  ...app,
  merchantId: getMerchantById(app.merchantId),
  boothId: getBoothById(app.boothId),
  scheduleId: app.scheduleId ? getScheduleById(app.scheduleId) : null
});

const populateDeposit = (d) => ({
  ...d,
  merchantId: getMerchantById(d.merchantId),
  applicationId: getApplicationById(d.applicationId)
});

const datesOverlap = (s1, e1, s2, e2) => {
  const start1 = new Date(s1), end1 = new Date(e1);
  const start2 = new Date(s2), end2 = new Date(e2);
  return start1 <= end2 && end1 >= start2;
};

const checkScheduleConflict = (boothId, startDate, endDate, excludeAppId = null) => {
  return db.applications.some(app => 
    app.boothId === boothId &&
    app._id !== excludeAppId &&
    ['approved', 'in_progress', 'admission'].includes(app.status) &&
    datesOverlap(startDate, endDate, app.startDate, app.endDate)
  );
};

const checkMerchantDoubleBooking = (merchantId, startDate, endDate, excludeAppId = null) => {
  return db.applications.some(app => 
    app.merchantId === merchantId &&
    app._id !== excludeAppId &&
    ['approved', 'in_progress', 'admission', 'pending'].includes(app.status) &&
    datesOverlap(startDate, endDate, app.startDate, app.endDate)
  );
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '商场临时摊位管理系统后端运行正常（内存模式）' });
});

app.get('/api/booths', (req, res) => {
  const { type, status } = req.query;
  let result = [...db.booths];
  if (type) result = result.filter(b => b.type === type);
  if (status) result = result.filter(b => b.status === status);
  res.json({ success: true, data: result });
});

app.get('/api/booths/:id', (req, res) => {
  const booth = db.booths.find(b => b._id === req.params.id);
  if (!booth) return res.status(404).json({ success: false, message: '摊位不存在' });
  res.json({ success: true, data: booth });
});

app.post('/api/booths', (req, res) => {
  const booth = { _id: 'booth_' + generateId(), ...req.body, code: req.body.code || ('B' + String(db.booths.length + 1).padStart(3, '0')) };
  db.booths.push(booth);
  res.json({ success: true, data: booth });
});

app.put('/api/booths/:id', (req, res) => {
  const idx = db.booths.findIndex(b => b._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '摊位不存在' });
  db.booths[idx] = { ...db.booths[idx], ...req.body };
  res.json({ success: true, data: db.booths[idx] });
});

app.delete('/api/booths/:id', (req, res) => {
  const idx = db.booths.findIndex(b => b._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '摊位不存在' });
  db.booths.splice(idx, 1);
  res.json({ success: true, message: '删除成功' });
});

app.post('/api/booths/check-availability', (req, res) => {
  const { boothId, startDate, endDate, merchantId, applicationId } = req.body;
  const conflict = checkScheduleConflict(boothId, startDate, endDate, applicationId);
  const doubleBooking = merchantId ? checkMerchantDoubleBooking(merchantId, startDate, endDate, applicationId) : false;
  
  res.json({
    success: true,
    data: {
      available: !conflict && !doubleBooking,
      scheduleConflict: conflict,
      doubleBooking,
      message: conflict ? '该档期已被占用' : doubleBooking ? '同一商户在该时间段已有申请' : '档期可用'
    }
  });
});

app.get('/api/merchants', (req, res) => {
  res.json({ success: true, data: db.merchants });
});

app.post('/api/merchants', (req, res) => {
  const merchant = { _id: 'merchant_' + generateId(), ...req.body, status: 'active', creditScore: 80 };
  db.merchants.push(merchant);
  res.json({ success: true, data: merchant });
});

app.put('/api/merchants/:id', (req, res) => {
  const idx = db.merchants.findIndex(m => m._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '商户不存在' });
  db.merchants[idx] = { ...db.merchants[idx], ...req.body };
  res.json({ success: true, data: db.merchants[idx] });
});

app.delete('/api/merchants/:id', (req, res) => {
  const idx = db.merchants.findIndex(m => m._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '商户不存在' });
  db.merchants.splice(idx, 1);
  res.json({ success: true, message: '删除成功' });
});

app.get('/api/schedules', (req, res) => {
  res.json({ success: true, data: db.schedules });
});

app.post('/api/schedules', (req, res) => {
  const schedule = { _id: 'schedule_' + generateId(), ...req.body, status: req.body.status || 'planning' };
  db.schedules.push(schedule);
  res.json({ success: true, data: schedule });
});

app.put('/api/schedules/:id', (req, res) => {
  const idx = db.schedules.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '档期不存在' });
  db.schedules[idx] = { ...db.schedules[idx], ...req.body };
  res.json({ success: true, data: db.schedules[idx] });
});

app.delete('/api/schedules/:id', (req, res) => {
  const idx = db.schedules.findIndex(s => s._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '档期不存在' });
  db.schedules.splice(idx, 1);
  res.json({ success: true, message: '删除成功' });
});

app.get('/api/applications', (req, res) => {
  const result = db.applications.map(populateApplication);
  res.json({ success: true, data: result });
});

app.get('/api/applications/:id', (req, res) => {
  const app = db.applications.find(a => a._id === req.params.id);
  if (!app) return res.status(404).json({ success: false, message: '申请不存在' });
  res.json({ success: true, data: populateApplication(app) });
});

app.post('/api/applications', (req, res) => {
  const { boothId, merchantId, startDate, endDate } = req.body;
  
  if (checkScheduleConflict(boothId, startDate, endDate)) {
    return res.status(400).json({ success: false, message: '档期冲突：该摊位在该时间段已被占用' });
  }
  
  if (checkMerchantDoubleBooking(merchantId, startDate, endDate)) {
    return res.status(400).json({ success: false, message: '重复占位：同一商户在该时间段已有申请' });
  }
  
  const booth = getBoothById(boothId);
  const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
  
  const app = {
    _id: 'app_' + generateId(),
    applicationNo: 'AP' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(db.applications.length + 1).padStart(3, '0'),
    ...req.body,
    status: 'pending',
    depositPaid: false,
    electricityApproved: false,
    admissionConfirmed: false,
    rentalFee: booth ? booth.standardRental * days : 0,
    depositAmount: booth ? booth.standardDeposit : 0,
    createdAt: todayStr
  };
  
  db.applications.push(app);
  
  if (booth) {
    const exceeds = (req.body.requiredElectricity || 0) > booth.standardElectricity;
    const excess = Math.max(0, (req.body.requiredElectricity || 0) - booth.standardElectricity);
    const riskLevel = exceeds ? (excess > 10 ? 'high' : excess > 5 ? 'medium' : 'low') : 'none';
    
    const approval = {
      _id: 'el_' + generateId(),
      approvalNo: 'ELAPV' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + String(db.electricityApprovals.length + 1).padStart(3, '0'),
      applicationId: app._id,
      merchantId,
      boothId,
      standardElectricity: booth.standardElectricity,
      requestedElectricity: req.body.requiredElectricity || 0,
      exceedsStandard: exceeds,
      status: exceeds ? 'pending' : 'approved',
      approvedElectricity: exceeds ? null : (req.body.requiredElectricity || 0),
      reason: exceeds ? `超出标准用电${excess}kW，需要审批` : '用电需求在标准范围内，自动通过',
      approvedBy: exceeds ? null : '系统自动审批',
      approvedAt: exceeds ? null : todayStr,
      riskLevel,
      riskReason: exceeds ? `用电风险：超出标准${excess}kW` : '正常用电'
    };
    db.electricityApprovals.push(approval);
    
    if (!exceeds) {
      app.electricityApproved = true;
    }
  }
  
  res.json({ success: true, data: populateApplication(app), message: '申请已提交' });
});

app.post('/api/applications/:id/approve', (req, res) => {
  const idx = db.applications.findIndex(a => a._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '申请不存在' });
  
  const app = db.applications[idx];
  if (app.status !== 'pending') return res.status(400).json({ success: false, message: '只有待审核状态可以审批' });
  
  app.status = 'approved';
  
  const booth = getBoothById(app.boothId);
  if (booth) {
    const dep1 = { _id: 'dep_' + generateId(), transactionNo: 'DP' + generateId().toUpperCase(), applicationId: app._id, merchantId: app.merchantId, type: 'deposit', amount: booth.standardDeposit, status: 'pending', operator: '系统', transactionDate: todayStr, notes: '入场押金待缴' };
    const dep2 = { _id: 'dep_' + generateId(), transactionNo: 'RT' + generateId().toUpperCase(), applicationId: app._id, merchantId: app.merchantId, type: 'rent', amount: app.rentalFee, status: 'pending', operator: '系统', transactionDate: todayStr, notes: '摊位租金待缴' };
    db.deposits.push(dep1, dep2);
  }
  
  res.json({ success: true, data: populateApplication(app), message: '审批通过，已生成押金和租金待缴单' });
});

app.post('/api/applications/:id/reject', (req, res) => {
  const idx = db.applications.findIndex(a => a._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '申请不存在' });
  
  db.applications[idx].status = 'rejected';
  res.json({ success: true, data: populateApplication(db.applications[idx]), message: '申请已拒绝' });
});

app.post('/api/applications/:id/admission', (req, res) => {
  const idx = db.applications.findIndex(a => a._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '申请不存在' });
  
  const app = db.applications[idx];
  
  if (!app.depositPaid) {
    return res.status(400).json({ success: false, message: '未交押金，不能入场' });
  }
  if (!app.electricityApproved) {
    return res.status(400).json({ success: false, message: '用电审批未通过，不能入场' });
  }
  if (app.status !== 'approved') {
    return res.status(400).json({ success: false, message: '申请未审批通过，不能入场' });
  }
  
  app.status = 'in_progress';
  app.admissionConfirmed = true;
  
  const acceptance = {
    _id: 'acc_' + generateId(),
    acceptanceNo: 'ADM' + generateId().toUpperCase(),
    applicationId: app._id,
    merchantId: app.merchantId,
    boothId: app.boothId,
    type: 'admission',
    items: [
      { category: 'equipment', itemName: '摊位设备完好', status: 'pass', deductionAmount: 0 },
      { category: 'cleanliness', itemName: '场地清洁', status: 'pass', deductionAmount: 0 },
      { category: 'electricity', itemName: '用电设备正常', status: 'pass', deductionAmount: 0 },
      { category: 'structure', itemName: '结构安全', status: 'pass', deductionAmount: 0 }
    ],
    overallStatus: 'passed',
    totalDeduction: 0,
    canRefundDeposit: true,
    inspector: '系统自动',
    inspectionDate: todayStr,
    conclusion: '入场确认完成'
  };
  db.acceptances.push(acceptance);
  
  res.json({ success: true, data: populateApplication(app), message: '入场确认成功' });
});

app.get('/api/deposits', (req, res) => {
  const { type, status } = req.query;
  let result = db.deposits.map(populateDeposit);
  if (type) result = result.filter(d => d.type === type);
  if (status) result = result.filter(d => d.status === status);
  res.json({ success: true, data: result });
});

app.get('/api/deposits/summary', (req, res) => {
  const summary = {
    totalDeposits: 0,
    totalRefunds: 0,
    totalDeductions: 0,
    totalRent: 0,
    totalElectricity: 0,
    pendingPayments: 0,
    netRevenue: 0
  };
  
  db.deposits.forEach(t => {
    if (t.status === 'confirmed') {
      switch (t.type) {
        case 'deposit': summary.totalDeposits += t.amount; break;
        case 'refund': summary.totalRefunds += t.amount; break;
        case 'deduction': summary.totalDeductions += t.amount; break;
        case 'rent': summary.totalRent += t.amount; break;
        case 'electricity': summary.totalElectricity += t.amount; break;
      }
    }
    if (t.status === 'pending') {
      summary.pendingPayments += t.amount;
    }
  });
  
  summary.netRevenue = summary.totalRent + summary.totalDeductions + summary.totalElectricity;
  res.json({ success: true, data: summary });
});

app.post('/api/deposits/:id/confirm', (req, res) => {
  const idx = db.deposits.findIndex(d => d._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '交易不存在' });
  
  const dep = db.deposits[idx];
  dep.status = 'confirmed';
  dep.paymentMethod = req.body.paymentMethod || 'bank_transfer';
  dep.transactionDate = todayStr;
  
  if (dep.type === 'deposit') {
    const appIdx = db.applications.findIndex(a => a._id === dep.applicationId);
    if (appIdx !== -1) db.applications[appIdx].depositPaid = true;
  }
  
  res.json({ success: true, data: populateDeposit(dep), message: '收款确认成功' });
});

app.get('/api/electricity', (req, res) => {
  const result = db.electricityApprovals.map(e => ({
    ...e,
    merchantId: getMerchantById(e.merchantId),
    boothId: getBoothById(e.boothId),
    applicationId: getApplicationById(e.applicationId)
  }));
  res.json({ success: true, data: result });
});

app.get('/api/electricity/risky', (req, res) => {
  const risky = db.electricityApprovals.filter(e => e.exceedsStandard || e.status === 'pending');
  const result = risky.map(e => ({
    ...e,
    merchantId: getMerchantById(e.merchantId),
    boothId: getBoothById(e.boothId),
    applicationId: getApplicationById(e.applicationId)
  }));
  res.json({ success: true, data: result });
});

app.post('/api/electricity/:id/approve', (req, res) => {
  const idx = db.electricityApprovals.findIndex(e => e._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '审批不存在' });
  
  const approval = db.electricityApprovals[idx];
  approval.status = 'approved';
  approval.approvedElectricity = req.body.approvedElectricity || approval.requestedElectricity;
  approval.approvedBy = '管理员';
  approval.approvedAt = todayStr;
  
  const appIdx = db.applications.findIndex(a => a._id === approval.applicationId);
  if (appIdx !== -1) db.applications[appIdx].electricityApproved = true;
  
  res.json({ success: true, data: approval, message: '用电审批通过' });
});

app.post('/api/electricity/:id/reject', (req, res) => {
  const idx = db.electricityApprovals.findIndex(e => e._id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: '审批不存在' });
  
  db.electricityApprovals[idx].status = 'rejected';
  res.json({ success: true, data: db.electricityApprovals[idx], message: '用电审批拒绝' });
});

app.get('/api/acceptance', (req, res) => {
  const { type } = req.query;
  let result = db.acceptances.map(a => ({
    ...a,
    merchantId: getMerchantById(a.merchantId),
    boothId: getBoothById(a.boothId),
    applicationId: getApplicationById(a.applicationId)
  }));
  if (type) result = result.filter(a => a.type === type);
  res.json({ success: true, data: result });
});

app.post('/api/acceptance/admission', (req, res) => {
  const acceptance = {
    _id: 'acc_' + generateId(),
    acceptanceNo: 'ADM' + generateId().toUpperCase(),
    ...req.body,
    type: 'admission',
    inspectionDate: todayStr
  };
  db.acceptances.push(acceptance);
  res.json({ success: true, data: acceptance, message: '入场验收完成' });
});

app.post('/api/acceptance/withdrawal', (req, res) => {
  const { applicationId, items, inspector } = req.body;
  
  const totalDeduction = items.reduce((sum, item) => sum + (item.deductionAmount || 0), 0);
  const allPassed = items.every(item => item.status === 'pass');
  
  const acceptance = {
    _id: 'acc_' + generateId(),
    acceptanceNo: 'WDL' + generateId().toUpperCase(),
    applicationId,
    merchantId: req.body.merchantId,
    boothId: req.body.boothId,
    type: 'withdrawal',
    items,
    overallStatus: allPassed ? 'passed' : 'failed',
    totalDeduction,
    canRefundDeposit: true,
    inspector: inspector || '管理员',
    inspectionDate: todayStr,
    conclusion: allPassed ? '撤场验收通过' : `撤场验收未通过，扣款${totalDeduction}元`
  };
  db.acceptances.push(acceptance);
  
  if (totalDeduction > 0) {
    const deductionItems = items.filter(i => i.status === 'fail').map(i => ({
      category: i.category,
      name: i.itemName,
      passed: false,
      deductionAmount: i.deductionAmount,
      deductionReason: i.deductionReason
    }));
    
    const deduction = {
      _id: 'dep_' + generateId(),
      transactionNo: 'DD' + generateId().toUpperCase(),
      applicationId,
      merchantId: req.body.merchantId,
      type: 'deduction',
      amount: totalDeduction,
      status: 'confirmed',
      operator: inspector || '管理员',
      transactionDate: todayStr,
      notes: acceptance.conclusion,
      deductionDetails: deductionItems
    };
    db.deposits.push(deduction);
  }
  
  const appIdx = db.applications.findIndex(a => a._id === applicationId);
  if (appIdx !== -1) {
    db.applications[appIdx].status = 'completed';
  }
  
  res.json({ success: true, data: acceptance, message: '撤场验收完成' });
});

app.post('/api/acceptance/refund', (req, res) => {
  const { applicationId, refundAmount, operator } = req.body;
  
  const appIdx = db.applications.findIndex(a => a._id === applicationId);
  if (appIdx === -1) return res.status(404).json({ success: false, message: '申请不存在' });
  
  const hasWithdrawal = db.acceptances.some(a => a.applicationId === applicationId && a.type === 'withdrawal');
  if (!hasWithdrawal) {
    return res.status(400).json({ success: false, message: '撤场未验收，不能退押' });
  }
  
  const refund = {
    _id: 'dep_' + generateId(),
    transactionNo: 'RF' + generateId().toUpperCase(),
    applicationId,
    merchantId: db.applications[appIdx].merchantId,
    type: 'refund',
    amount: refundAmount,
    status: 'confirmed',
    operator: operator || '管理员',
    transactionDate: todayStr,
    notes: '押金退还'
  };
  db.deposits.push(refund);
  
  const originalDeposits = db.deposits.filter(d => d.applicationId === applicationId && d.type === 'deposit' && d.status === 'confirmed');
  originalDeposits.forEach(d => { d.status = 'refunded'; });
  
  res.json({ success: true, data: refund, message: '押金退还成功' });
});

app.get('/api/reports/dashboard', (req, res) => {
  const totalBooths = db.booths.filter(b => b.status !== 'disabled').length;
  const availableBooths = db.booths.filter(b => b.status === 'available').length;
  const activeApps = db.applications.filter(a => ['approved', 'in_progress'].includes(a.status)).length;
  const pendingApps = db.applications.filter(a => a.status === 'pending').length;
  
  const risky = db.electricityApprovals.filter(e => e.exceedsStandard || e.status === 'pending');
  const highRisk = risky.filter(e => e.riskLevel === 'high').length;
  const pendingApproval = risky.filter(e => e.status === 'pending').length;
  
  let totalRent = 0, totalDeductions = 0, totalElectricity = 0, pendingPayments = 0;
  db.deposits.forEach(t => {
    if (t.status === 'confirmed') {
      if (t.type === 'rent') totalRent += t.amount;
      if (t.type === 'deduction') totalDeductions += t.amount;
      if (t.type === 'electricity') totalElectricity += t.amount;
    }
    if (t.status === 'pending') pendingPayments += t.amount;
  });
  
  res.json({
    success: true,
    data: {
      booths: { total: totalBooths, available: availableBooths, occupied: totalBooths - availableBooths, occupancyRate: totalBooths > 0 ? (((totalBooths - availableBooths) / totalBooths) * 100).toFixed(1) : 0 },
      merchants: { total: db.merchants.filter(m => m.status === 'active').length },
      applications: { active: activeApps, pending: pendingApps },
      finance: { totalRent, totalDeductions, totalElectricity, netRevenue: totalRent + totalDeductions + totalElectricity, pendingPayments },
      alerts: { electricityRisk: highRisk, pendingApprovals: pendingApproval }
    }
  });
});

app.get('/api/reports/booth-calendar', (req, res) => {
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;
  
  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0);
  
  const activeApps = db.applications.filter(a => 
    ['approved', 'in_progress', 'completed', 'admission'].includes(a.status) &&
    new Date(a.startDate) <= endOfMonth && new Date(a.endDate) >= startOfMonth
  );
  
  const result = db.booths.map(booth => ({
    _id: booth._id,
    boothCode: booth.code,
    boothName: booth.name,
    boothType: booth.type,
    location: booth.location,
    applications: activeApps
      .filter(app => app.boothId === booth._id)
      .map(app => ({
        _id: app._id,
        applicationNo: app.applicationNo,
        merchantId: getMerchantById(app.merchantId),
        startDate: app.startDate,
        endDate: app.endDate,
        status: app.status
      }))
  }));
  
  res.json({ success: true, data: result });
});

app.get('/api/reports/income', (req, res) => {
  const { startDate, endDate } = req.query;
  let transactions = db.deposits.map(populateDeposit);
  
  if (startDate && endDate) {
    const s = new Date(startDate), e = new Date(endDate);
    transactions = transactions.filter(d => {
      const t = new Date(d.transactionDate);
      return t >= s && t <= e;
    });
  }
  
  const confirmed = transactions.filter(t => t.status === 'confirmed');
  const summary = {
    totalRent: confirmed.filter(t => t.type === 'rent').reduce((sum, t) => sum + t.amount, 0),
    totalDeductions: confirmed.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0),
    totalElectricity: confirmed.filter(t => t.type === 'electricity').reduce((sum, t) => sum + t.amount, 0)
  };
  
  res.json({ success: true, data: { transactions, summary } });
});

app.get('/api/reports/deduction-details', (req, res) => {
  const { startDate, endDate } = req.query;
  let deductions = db.deposits.filter(d => d.type === 'deduction' && d.status === 'confirmed');
  
  if (startDate && endDate) {
    const s = new Date(startDate), e = new Date(endDate);
    deductions = deductions.filter(d => {
      const t = new Date(d.transactionDate);
      return t >= s && t <= e;
    });
  }
  
  const records = deductions.map(d => {
    const acceptance = db.acceptances.find(a => a.applicationId === d.applicationId && a.type === 'withdrawal');
    let items = d.deductionDetails || [];
    if (!items.length && acceptance) {
      items = acceptance.items.filter(i => i.status === 'fail').map(i => ({
        category: i.category,
        name: i.itemName,
        passed: false,
        deductionAmount: i.deductionAmount,
        deductionReason: i.deductionReason
      }));
    }
    return {
      ...populateDeposit(d),
      deductionItems: items,
      acceptanceId: acceptance
    };
  });
  
  res.json({
    success: true,
    data: {
      records,
      totalAmount: records.reduce((sum, r) => sum + r.amount, 0)
    }
  });
});

app.get('/api/reports/electricity-risk', (req, res) => {
  const approvals = db.electricityApprovals.map(e => ({
    ...e,
    applicationId: {
      ...getApplicationById(e.applicationId),
      merchantId: getMerchantById(e.merchantId),
      boothId: getBoothById(e.boothId)
    }
  }));
  
  const summary = {
    total: approvals.filter(e => e.exceedsStandard || e.status === 'pending').length,
    highRisk: approvals.filter(e => e.riskLevel === 'high').length,
    mediumRisk: approvals.filter(e => e.riskLevel === 'medium').length,
    lowRisk: approvals.filter(e => e.riskLevel === 'low').length,
    pendingApproval: approvals.filter(e => e.status === 'pending').length
  };
  
  res.json({ success: true, data: { summary, details: approvals } });
});

app.get('/api/reports/deposit-flow', (req, res) => {
  const { startDate, endDate } = req.query;
  let transactions = db.deposits.map(populateDeposit);
  
  if (startDate) {
    const s = new Date(startDate);
    transactions = transactions.filter(d => new Date(d.transactionDate) >= s);
  }
  if (endDate) {
    const e = new Date(endDate);
    transactions = transactions.filter(d => new Date(d.transactionDate) <= e);
  }
  
  let totalDeposits = 0, totalRefunds = 0, totalDeductions = 0, totalRent = 0, totalElectricity = 0, pendingPayments = 0;
  db.deposits.forEach(t => {
    if (t.status === 'confirmed') {
      if (t.type === 'deposit') totalDeposits += t.amount;
      if (t.type === 'refund') totalRefunds += t.amount;
      if (t.type === 'deduction') totalDeductions += t.amount;
      if (t.type === 'rent') totalRent += t.amount;
      if (t.type === 'electricity') totalElectricity += t.amount;
    }
    if (t.status === 'pending') pendingPayments += t.amount;
  });
  
  res.json({
    success: true,
    data: {
      summary: { totalDeposits, totalRefunds, totalDeductions, totalRent, totalElectricity, pendingPayments, netRevenue: totalRent + totalDeductions + totalElectricity },
      transactions
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('商场临时摊位管理系统 - 后端（内存模式）');
  console.log('========================================');
  console.log(`服务运行在 http://localhost:${PORT}`);
  console.log('\n已加载样例数据：');
  console.log(`- 摊位: ${db.booths.length} 个（食品、文创、促销各2个）`);
  console.log(`- 商户: ${db.merchants.length} 个`);
  console.log(`- 档期: ${db.schedules.length} 个`);
  console.log(`- 申请: ${db.applications.length} 个`);
  console.log(`- 交易: ${db.deposits.length} 条`);
  console.log(`- 用电审批: ${db.electricityApprovals.length} 条`);
  console.log(`- 验收: ${db.acceptances.length} 条`);
  console.log('\n演示场景：');
  console.log('1. 正常入场：匠心手作已批准，可操作缴押金→入场确认');
  console.log('2. 档期冲突：尝试与app_1同一时间段申请F001');
  console.log('3. 撤场扣押：美味小吃坊已有撤场扣款500元记录');
  console.log('4. 用电风险：优品数码申请用电8kW超标4kW待审批');
});
