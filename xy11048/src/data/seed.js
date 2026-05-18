const store = require('./store');
const Reagent = require('../models/Reagent');
const { REAGENT_CATEGORIES, HAZARD_LEVELS, STORAGE_CONDITIONS, APPROVAL_STATES } = require('../config/constants');
const approvalService = require('../services/ApprovalService');

function seedReagents() {
  const reagents = [
    {
      id: 'reag_001',
      casNumber: '64-17-5',
      chineseName: '无水乙醇',
      englishName: 'Ethanol',
      category: REAGENT_CATEGORIES.GENERAL,
      purity: '99.7%',
      specification: '500ml/瓶',
      unit: 'ml',
      manufacturer: '国药集团化学试剂有限公司',
      supplier: '国药集团',
      storageCondition: STORAGE_CONDITIONS.ROOM_TEMP,
      expiryMonths: 24,
      safetyDataSheet: '易燃液体，需远离火源',
      hazardPhrases: ['H225'],
      precautionaryPhrases: ['P210', 'P233'],
      currentStock: 5000,
      minStock: 1000,
      maxStock: 10000
    },
    {
      id: 'reag_002',
      casNumber: '7664-38-2',
      chineseName: '浓硫酸',
      englishName: 'Sulfuric Acid',
      category: REAGENT_CATEGORIES.HAZARDOUS,
      hazardLevel: HAZARD_LEVELS.HIGH,
      purity: '95-98%',
      specification: '500ml/瓶',
      unit: 'ml',
      manufacturer: '西陇科学股份有限公司',
      supplier: '西陇科学',
      storageCondition: STORAGE_CONDITIONS.DARK,
      expiryMonths: 36,
      safetyDataSheet: '强腐蚀性，佩戴防护手套',
      hazardPhrases: ['H314', 'H290'],
      precautionaryPhrases: ['P280', 'P305+P351+P338'],
      currentStock: 2000,
      minStock: 500,
      maxStock: 5000
    },
    {
      id: 'reag_003',
      casNumber: '50-00-0',
      chineseName: '甲醛溶液',
      englishName: 'Formaldehyde',
      category: REAGENT_CATEGORIES.HAZARDOUS,
      hazardLevel: HAZARD_LEVELS.MEDIUM,
      purity: '37-40%',
      specification: '500ml/瓶',
      unit: 'ml',
      manufacturer: '麦克林生化科技有限公司',
      supplier: '麦克林',
      storageCondition: STORAGE_CONDITIONS.REFRIGERATED,
      expiryMonths: 12,
      safetyDataSheet: '致癌物质，需在通风橱操作',
      hazardPhrases: ['H350', 'H311', 'H331'],
      precautionaryPhrases: ['P201', 'P308+P313'],
      currentStock: 1500,
      minStock: 300,
      maxStock: 3000
    },
    {
      id: 'reag_004',
      casNumber: '7647-01-0',
      chineseName: '浓盐酸',
      englishName: 'Hydrochloric Acid',
      category: REAGENT_CATEGORIES.HAZARDOUS,
      hazardLevel: HAZARD_LEVELS.HIGH,
      purity: '36-38%',
      specification: '500ml/瓶',
      unit: 'ml',
      manufacturer: '国药集团化学试剂有限公司',
      supplier: '国药集团',
      storageCondition: STORAGE_CONDITIONS.ROOM_TEMP,
      expiryMonths: 24,
      safetyDataSheet: '腐蚀性酸，佩戴防护装备',
      hazardPhrases: ['H314', 'H335'],
      precautionaryPhrases: ['P261', 'P280'],
      currentStock: 1800,
      minStock: 400,
      maxStock: 4000
    },
    {
      id: 'reag_005',
      casNumber: '7732-18-5',
      chineseName: '超纯水',
      englishName: 'Water',
      category: REAGENT_CATEGORIES.GENERAL,
      purity: '18.2MΩ·cm',
      specification: '5L/桶',
      unit: 'L',
      manufacturer: 'Milli-Q',
      supplier: '默克',
      storageCondition: STORAGE_CONDITIONS.ROOM_TEMP,
      expiryMonths: 1,
      currentStock: 50,
      minStock: 10,
      maxStock: 100
    },
    {
      id: 'reag_006',
      casNumber: '141-78-6',
      chineseName: '乙酸乙酯',
      englishName: 'Ethyl Acetate',
      category: REAGENT_CATEGORIES.HAZARDOUS,
      hazardLevel: HAZARD_LEVELS.EXTREME,
      purity: '99.5%',
      specification: '500ml/瓶',
      unit: 'ml',
      manufacturer: '阿拉丁试剂',
      supplier: '阿拉丁',
      storageCondition: STORAGE_CONDITIONS.EXPLOSION_PROOF,
      expiryMonths: 18,
      safetyDataSheet: '极度易燃，爆炸危险',
      hazardPhrases: ['H225', 'H319', 'H336'],
      precautionaryPhrases: ['P210', 'P370+P378'],
      currentStock: 800,
      minStock: 200,
      maxStock: 2000
    }
  ];

  reagents.forEach(r => store.addReagent(new Reagent(r)));
  console.log(`已导入 ${reagents.length} 种试剂`);
}

function seedUsers() {
  const users = [
    { id: 'user_001', name: '张三', department: '化学系', role: 'researcher', labId: 'lab_001' },
    { id: 'user_002', name: '李四', department: '化学系', role: 'lab_manager', labId: 'lab_001' },
    { id: 'user_003', name: '王五', department: '安全管理处', role: 'safety_officer', labId: null },
    { id: 'user_004', name: '赵六', department: '审计处', role: 'auditor', labId: null },
    { id: 'user_005', name: '钱七', department: '安全管理处', role: 'admin', labId: null }
  ];

  users.forEach(u => store.addUser(u));
  console.log(`已导入 ${users.length} 个用户`);
}

function seedLaboratories() {
  const labs = [
    { id: 'lab_001', name: '有机化学实验室', location: '实验楼A座301', manager: '李四', maxReagents: 500 },
    { id: 'lab_002', name: '分析化学实验室', location: '实验楼A座302', manager: '孙八', maxReagents: 400 },
    { id: 'lab_003', name: '物理化学实验室', location: '实验楼B座201', manager: '周九', maxReagents: 300 }
  ];

  labs.forEach(l => store.addLaboratory(l));
  console.log(`已导入 ${labs.length} 个实验室`);
}

function seedApprovalRequests() {
  const requests = [
    {
      applicantId: 'user_001',
      applicantName: '张三',
      applicantDepartment: '化学系',
      labId: 'lab_001',
      labName: '有机化学实验室',
      projectName: '新型催化剂的合成与表征',
      projectNumber: '2024KJ001',
      researchPurpose: '用于过渡金属催化的碳氢键活化反应研究，需要无水无氧操作环境',
      items: [
        { reagentId: 'reag_001', reagentName: '无水乙醇', category: REAGENT_CATEGORIES.GENERAL, quantity: 500, unit: 'ml' }
      ],
      estimatedUseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      storageLocation: 'A301-01柜',
      emergencyContact: '李四',
      emergencyPhone: '13800138000',
      safetyTrainingCertified: true,
      wasteDisposalPlan: '废液统一收集至有机废液桶，由学校指定危废处理公司定期清运'
    },
    {
      applicantId: 'user_001',
      applicantName: '张三',
      applicantDepartment: '化学系',
      labId: 'lab_001',
      labName: '有机化学实验室',
      projectName: '功能材料的制备与性能研究',
      projectNumber: '2024KJ002',
      researchPurpose: '制备高比表面积的多孔材料，用于气体吸附与分离实验',
      items: [
        { reagentId: 'reag_002', reagentName: '浓硫酸', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.HIGH, quantity: 100, unit: 'ml' },
        { reagentId: 'reag_004', reagentName: '浓盐酸', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.HIGH, quantity: 200, unit: 'ml' }
      ],
      estimatedUseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      storageLocation: 'A301-危化品柜',
      emergencyContact: '李四',
      emergencyPhone: '13800138000',
      safetyTrainingCertified: true,
      wasteDisposalPlan: '酸液中和后倒入酸废液桶，需佩戴防酸手套和护目镜操作'
    }
  ];

  requests.forEach((r, index) => {
    const request = approvalService.createRequest(r);
    
    if (index === 0) {
      approvalService.submitRequest(request.id, request.etag);
      approvalService.labManagerApprove(request.id, 'user_002', '李四', '试剂用途合理，同意');
    }
  });

  console.log(`已导入 ${requests.length} 个审批申请`);
}

function seedUsageRecords() {
  const records = [
    {
      id: 'usage_001',
      applicantId: 'user_001',
      reagentId: 'reag_002',
      reagentName: '浓硫酸',
      quantity: 50,
      unit: 'ml',
      usedAt: new Date(),
      status: 'approved',
      labId: 'lab_001'
    }
  ];

  records.forEach(r => store.addUsageRecord(r));
  console.log(`已导入 ${records.length} 条使用记录`);
}

function seedAll() {
  console.log('开始导入种子数据...\n');
  
  seedReagents();
  seedUsers();
  seedLaboratories();
  seedApprovalRequests();
  seedUsageRecords();
  
  console.log('\n种子数据导入完成！');
  console.log('\n数据概览:');
  console.log(`- 试剂: ${store.getAllReagents().length} 种`);
  console.log(`- 用户: ${store.getAllUsers().length} 人`);
  console.log(`- 实验室: ${store.getAllLaboratories().length} 个`);
  console.log(`- 审批申请: ${store.getAllApprovalRequests().length} 条`);
  
  const requestsByState = {};
  store.getAllApprovalRequests().forEach(r => {
    requestsByState[r.currentState] = (requestsByState[r.currentState] || 0) + 1;
  });
  console.log('- 申请状态分布:', JSON.stringify(requestsByState, null, 2));
}

module.exports = { seedAll, seedReagents, seedUsers, seedLaboratories, seedApprovalRequests, seedUsageRecords };

if (require.main === module) {
  seedAll();
}
