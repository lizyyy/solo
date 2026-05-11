const mongoose = require('mongoose');
require('dotenv').config();

const Booth = require('../models/Booth.model');
const Merchant = require('../models/Merchant.model');
const Schedule = require('../models/Schedule.model');
const Application = require('../models/Application.model');
const Deposit = require('../models/Deposit.model');
const ElectricityApproval = require('../models/ElectricityApproval.model');
const Acceptance = require('../models/Acceptance.model');

const booths = [
  {
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
];

const merchants = [
  {
    name: '美味小吃坊',
    contactPerson: '张经理',
    phone: '13800138001',
    email: 'zhang@delicious.com',
    businessType: '餐饮小吃',
    licenseNumber: 'CY2024001',
    address: '北京市朝阳区xxx路xxx号',
    status: 'active',
    creditScore: 95
  },
  {
    name: '甜心奶茶屋',
    contactPerson: '李小姐',
    phone: '13800138002',
    email: 'li@sweettea.com',
    businessType: '饮品甜点',
    licenseNumber: 'CY2024002',
    address: '北京市海淀区xxx路xxx号',
    status: 'active',
    creditScore: 92
  },
  {
    name: '匠心手作',
    contactPerson: '王师傅',
    phone: '13800138003',
    email: 'wang@handmade.com',
    businessType: '手工艺品',
    licenseNumber: 'WG2024001',
    address: '北京市东城区xxx路xxx号',
    status: 'active',
    creditScore: 98
  },
  {
    name: '书香阁',
    contactPerson: '陈店长',
    phone: '13800138004',
    email: 'chen@bookshop.com',
    businessType: '图书文具',
    licenseNumber: 'TS2024001',
    address: '北京市西城区xxx路xxx号',
    status: 'active',
    creditScore: 90
  },
  {
    name: '优品数码',
    contactPerson: '刘总',
    phone: '13800138005',
    email: 'liu@digital.com',
    businessType: '电子产品',
    licenseNumber: 'DX2024001',
    address: '北京市丰台区xxx路xxx号',
    status: 'active',
    creditScore: 88
  },
  {
    name: '潮牌服饰',
    contactPerson: '赵经理',
    phone: '13800138006',
    email: 'zhao@fashion.com',
    businessType: '服装鞋帽',
    licenseNumber: 'FZ2024001',
    address: '北京市通州区xxx路xxx号',
    status: 'active',
    creditScore: 94
  }
];

const schedules = [
  {
    name: '2024年春季美食节',
    description: '春季美食节活动，邀请特色小吃商户参加',
    startDate: new Date('2024-05-15'),
    endDate: new Date('2024-05-20'),
    status: 'active',
    boothTypes: ['food'],
    targetMerchants: '餐饮类商户',
    totalSlots: 10,
    notes: '包含周末'
  },
  {
    name: '2024年文创市集',
    description: '文创产品展示与销售活动',
    startDate: new Date('2024-05-18'),
    endDate: new Date('2024-05-25'),
    status: 'planning',
    boothTypes: ['cultural'],
    targetMerchants: '文创类商户',
    totalSlots: 8,
    notes: '为期8天'
  },
  {
    name: '品牌促销周',
    description: '各大品牌联合促销活动',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-07'),
    status: 'planning',
    boothTypes: ['promotion'],
    targetMerchants: '品牌商户',
    totalSlots: 6,
    notes: '六一儿童节期间'
  }
];

const createSeedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功，开始创建样例数据...');

    await Booth.deleteMany({});
    await Merchant.deleteMany({});
    await Schedule.deleteMany({});
    await Application.deleteMany({});
    await Deposit.deleteMany({});
    await ElectricityApproval.deleteMany({});
    await Acceptance.deleteMany({});

    const createdBooths = await Booth.insertMany(booths);
    console.log(`✓ 创建了 ${createdBooths.length} 个摊位`);

    const createdMerchants = await Merchant.insertMany(merchants);
    console.log(`✓ 创建了 ${createdMerchants.length} 个商户`);

    const createdSchedules = await Schedule.insertMany(schedules);
    console.log(`✓ 创建了 ${createdSchedules.length} 个档期`);

    const boothMap = {};
    createdBooths.forEach(b => boothMap[b.code] = b._id);
    
    const merchantMap = {};
    createdMerchants.forEach(m => merchantMap[m.name] = m._id);
    
    const scheduleMap = {};
    createdSchedules.forEach(s => scheduleMap[s.name] = s._id);

    const applications = [
      {
        applicationNo: 'AP20240501TEST01',
        merchantId: merchantMap['美味小吃坊'],
        boothId: boothMap['F001'],
        scheduleId: scheduleMap['2024年春季美食节'],
        businessType: '特色小吃',
        requiredElectricity: 4,
        specialRequirements: '需要额外的排气设备',
        status: 'in_progress',
        startDate: new Date('2024-05-15'),
        endDate: new Date('2024-05-20'),
        depositPaid: true,
        electricityApproved: true,
        admissionConfirmed: true
      },
      {
        applicationNo: 'AP20240501TEST02',
        merchantId: merchantMap['甜心奶茶屋'],
        boothId: boothMap['F002'],
        scheduleId: scheduleMap['2024年春季美食节'],
        businessType: '奶茶饮品',
        requiredElectricity: 3,
        specialRequirements: '展示冰柜',
        status: 'approved',
        startDate: new Date('2024-05-15'),
        endDate: new Date('2024-05-20'),
        depositPaid: true,
        electricityApproved: true,
        admissionConfirmed: false
      },
      {
        applicationNo: 'AP20240501TEST03',
        merchantId: merchantMap['匠心手作'],
        boothId: boothMap['C001'],
        scheduleId: scheduleMap['2024年文创市集'],
        businessType: '手工艺品',
        requiredElectricity: 2,
        specialRequirements: '无',
        status: 'pending',
        startDate: new Date('2024-05-18'),
        endDate: new Date('2024-05-25'),
        depositPaid: false,
        electricityApproved: false,
        admissionConfirmed: false
      }
    ];

    const createdApplications = await Application.insertMany(applications);
    console.log(`✓ 创建了 ${createdApplications.length} 个申请`);

    const createdAppMap = {};
    createdApplications.forEach(a => createdAppMap[a.applicationNo] = a);

    const deposits = [
      {
        transactionNo: 'DP20240501TEST01',
        applicationId: createdAppMap['AP20240501TEST01']._id,
        merchantId: merchantMap['美味小吃坊'],
        type: 'deposit',
        amount: 2000,
        paymentMethod: 'bank_transfer',
        status: 'confirmed',
        operator: '张运营',
        transactionDate: new Date('2024-05-10'),
        notes: '入场押金'
      },
      {
        transactionNo: 'RT20240501TEST01',
        applicationId: createdAppMap['AP20240501TEST01']._id,
        merchantId: merchantMap['美味小吃坊'],
        type: 'rent',
        amount: 3000,
        paymentMethod: 'bank_transfer',
        status: 'confirmed',
        operator: '张运营',
        transactionDate: new Date('2024-05-10'),
        notes: '摊位租金（6天）'
      },
      {
        transactionNo: 'DP20240501TEST02',
        applicationId: createdAppMap['AP20240501TEST02']._id,
        merchantId: merchantMap['甜心奶茶屋'],
        type: 'deposit',
        amount: 1800,
        paymentMethod: 'wechat',
        status: 'confirmed',
        operator: '李运营',
        transactionDate: new Date('2024-05-12'),
        notes: '入场押金'
      },
      {
        transactionNo: 'RT20240501TEST02',
        applicationId: createdAppMap['AP20240501TEST02']._id,
        merchantId: merchantMap['甜心奶茶屋'],
        type: 'rent',
        amount: 2700,
        paymentMethod: 'wechat',
        status: 'confirmed',
        operator: '李运营',
        transactionDate: new Date('2024-05-12'),
        notes: '摊位租金（6天）'
      }
    ];

    const createdDeposits = await Deposit.insertMany(deposits);
    console.log(`✓ 创建了 ${createdDeposits.length} 条押金/租金记录`);

    const electricityApprovals = [
      {
        approvalNo: 'EL20240501TEST01',
        applicationId: createdAppMap['AP20240501TEST01']._id,
        merchantId: merchantMap['美味小吃坊'],
        boothId: boothMap['F001'],
        standardElectricity: 5,
        requestedElectricity: 4,
        exceedsStandard: false,
        status: 'approved',
        approvedElectricity: 4,
        reason: '用电需求在标准范围内，自动通过',
        safetyCheck: true,
        approvedBy: '系统自动审批',
        approvedAt: new Date('2024-05-10')
      },
      {
        approvalNo: 'EL20240501TEST02',
        applicationId: createdAppMap['AP20240501TEST02']._id,
        merchantId: merchantMap['甜心奶茶屋'],
        boothId: boothMap['F002'],
        standardElectricity: 5,
        requestedElectricity: 3,
        exceedsStandard: false,
        status: 'approved',
        approvedElectricity: 3,
        reason: '用电需求在标准范围内，自动通过',
        safetyCheck: true,
        approvedBy: '系统自动审批',
        approvedAt: new Date('2024-05-12')
      }
    ];

    const createdApprovals = await ElectricityApproval.insertMany(electricityApprovals);
    console.log(`✓ 创建了 ${createdApprovals.length} 条用电审批记录`);

    const acceptances = [
      {
        acceptanceNo: 'AD20240501TEST01',
        applicationId: createdAppMap['AP20240501TEST01']._id,
        merchantId: merchantMap['美味小吃坊'],
        boothId: boothMap['F001'],
        type: 'admission',
        items: [
          { itemName: '摊位设备完好', category: 'equipment', status: 'pass' },
          { itemName: '场地清洁', category: 'cleanliness', status: 'pass' },
          { itemName: '用电设备正常', category: 'electricity', status: 'pass' },
          { itemName: '结构安全', category: 'structure', status: 'pass' }
        ],
        overallStatus: 'passed',
        totalDeduction: 0,
        canRefundDeposit: true,
        inspector: '王检查员',
        inspectionDate: new Date('2024-05-14'),
        conclusion: '入场验收通过，商户可正常入场经营'
      }
    ];

    const createdAcceptances = await Acceptance.insertMany(acceptances);
    console.log(`✓ 创建了 ${createdAcceptances.length} 条验收记录`);

    console.log('\n=== 样例数据创建完成 ===');
    console.log('\n已创建数据：');
    console.log(`- 摊位: ${createdBooths.length} 个（食品、文创、促销各2个）`);
    console.log(`- 商户: ${createdMerchants.length} 个`);
    console.log(`- 档期: ${createdSchedules.length} 个`);
    console.log(`- 申请: ${createdApplications.length} 个`);
    console.log(`- 押金/租金记录: ${createdDeposits.length} 条`);
    console.log(`- 用电审批: ${createdApprovals.length} 条`);
    console.log(`- 验收记录: ${createdAcceptances.length} 条`);

    console.log('\n=== 演示场景 ===');
    console.log('\n1. 正常入场流程：');
    console.log('   - 美味小吃坊已完成：申请→审批→缴押金→用电审批→入场验收→进行中');
    console.log('\n2. 档期冲突演示：');
    console.log('   - 尝试在2024-05-15至2024-05-20期间申请F001摊位，系统将提示档期冲突');
    console.log('\n3. 撤场扣押演示：');
    console.log('   - 对进行中的申请进行撤场验收，设置部分验收项不通过');
    console.log('   - 系统将自动生成押金扣款记录');
    console.log('\n4. 重复占位检查：');
    console.log('   - 尝试让同一商户在同一时间段申请多个摊位');
    console.log('   - 系统将提示同一商户重复占位');

    process.exit(0);
  } catch (error) {
    console.error('创建样例数据失败:', error);
    process.exit(1);
  }
};

module.exports = createSeedData;