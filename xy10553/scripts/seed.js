const db = require('../src/data/db');
const { createVisitorApplication, VISITOR_STATUS, EVENT_TYPES, EXCEPTION_TYPES } = require('../src/models/visitor');
const { applyEvent } = require('../src/services/stateMachine');

const { v4: uuidv4 } = require('uuid');

function seedCompanions() {
  const companions = [
    { id: 'COMP001', name: '张工程师', department: '运维部', phone: '13800138001', onDuty: true },
    { id: 'COMP002', name: '李主管', department: '安全部', phone: '13800138002', onDuty: true },
    { id: 'COMP003', name: '王技术员', department: '网络部', phone: '13800138003', onDuty: false }
  ];
  companions.forEach(c => db.registerCompanion(c));
  return companions;
}

function seedApprovers() {
  const approvers = [
    { id: 'APPR001', name: '赵总监', department: 'IT部', role: '机房负责人' },
    { id: 'APPR002', name: '陈经理', department: '安全部', role: '安全审批' }
  ];
  approvers.forEach(a => db.registerApprover(a));
  return approvers;
}

function createNormalVisitFlow() {
  const now = Date.now();
  const visitor = createVisitorApplication({
    idempotencyKey: 'seed-normal-001',
    name: '刘访客',
    phone: '13900139001',
    company: 'ABC科技有限公司',
    idCard: '110101199001011234',
    purpose: '设备检修与系统升级',
    visitorType: 'EXTERNAL',
    approverId: 'APPR001',
    companionId: 'COMP001',
    companionName: '张工程师',
    expectedEntryTime: now,
    expectedExitTime: now + 4 * 60 * 60 * 1000,
    devices: [
      { type: '笔记本电脑', brand: 'Lenovo', model: 'ThinkPad X1', serialNumber: 'SN-LAPTOP-001' },
      { type: 'U盘', brand: 'Kingston', model: 'DTSE9', serialNumber: 'SN-USB-001' }
    ],
    operatorId: 'ADMIN001'
  });
  
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.APPROVE, {
    approverId: 'APPR001',
    approverName: '赵总监',
    notes: '同意，需陪同全程'
  }, 'APPR001');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CONFIRM_COMPANION, {
    companionId: 'COMP001',
    companionName: '张工程师'
  }, 'COMP001');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CHECK_IN, {}, 'GUARD001');
  db.saveVisitor(visitor);
  
  setTimeout(() => {
    applyEvent(visitor, EVENT_TYPES.CHECK_OUT, {}, 'GUARD001');
    db.saveVisitor(visitor);
  }, 100);
  
  return visitor;
}

function createApprovalMissingFlow() {
  const now = Date.now();
  const visitor = createVisitorApplication({
    idempotencyKey: 'seed-appr-001',
    name: '周访客',
    phone: '13900139002',
    company: 'XYZ系统集成',
    idCard: '110101199002022345',
    purpose: '紧急设备维修',
    visitorType: 'VENDOR',
    approverId: 'APPR001',
    companionId: 'COMP002',
    expectedEntryTime: now,
    expectedExitTime: now + 2 * 60 * 60 * 1000,
    devices: [
      { type: '服务器诊断工具', brand: 'Dell', model: 'Diagnostic Kit', serialNumber: 'SN-TOOL-001' }
    ],
    operatorId: 'ADMIN002'
  });
  
  db.saveVisitor(visitor);
  
  return visitor;
}

function createDeviceLeftBehindFlow() {
  const now = Date.now();
  const visitor = createVisitorApplication({
    idempotencyKey: 'seed-device-001',
    name: '吴访客',
    phone: '13900139003',
    company: '云服务商',
    idCard: '110101199003033456',
    purpose: '数据迁移',
    visitorType: 'VENDOR',
    approverId: 'APPR002',
    companionId: 'COMP001',
    expectedEntryTime: now,
    expectedExitTime: now + 6 * 60 * 60 * 1000,
    devices: [
      { type: '便携服务器', brand: 'HPE', model: 'ProLiant Micro', serialNumber: 'SN-SERVER-001' },
      { type: '移动硬盘', brand: 'WD', model: 'My Passport', serialNumber: 'SN-HDD-001' }
    ],
    operatorId: 'ADMIN003'
  });
  
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.APPROVE, {
    approverId: 'APPR002',
    approverName: '陈经理'
  }, 'APPR002');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CONFIRM_COMPANION, {
    companionId: 'COMP001',
    companionName: '张工程师'
  }, 'COMP001');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CHECK_IN, {}, 'GUARD002');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CHECK_OUT, {
    leftBehindDeviceSerials: ['SN-SERVER-001']
  }, 'GUARD002');
  db.saveVisitor(visitor);
  
  return visitor;
}

function createTimeoutFlow() {
  const now = Date.now();
  const visitor = createVisitorApplication({
    idempotencyKey: 'seed-timeout-001',
    name: '郑访客',
    phone: '13900139004',
    company: '内部审计',
    idCard: '110101199004044567',
    purpose: '季度安全审计',
    visitorType: 'INTERNAL',
    approverId: 'APPR001',
    companionId: 'COMP002',
    expectedEntryTime: now - 12 * 60 * 60 * 1000,
    expectedExitTime: now - 8 * 60 * 60 * 1000,
    devices: [
      { type: '审计笔记本', brand: 'Apple', model: 'MacBook Pro', serialNumber: 'SN-AUDIT-001' }
    ],
    operatorId: 'ADMIN004'
  });
  
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.APPROVE, {
    approverId: 'APPR001',
    approverName: '赵总监'
  }, 'APPR001');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CONFIRM_COMPANION, {
    companionId: 'COMP002',
    companionName: '李主管'
  }, 'COMP002');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.CHECK_IN, {}, 'GUARD001');
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.TIMEOUT, {}, 'SYSTEM');
  db.saveVisitor(visitor);
  
  return visitor;
}

function createRejectedFlow() {
  const now = Date.now();
  const visitor = createVisitorApplication({
    idempotencyKey: 'seed-reject-001',
    name: '冯访客',
    phone: '13900139005',
    company: '外部供应商',
    idCard: '110101199005055678',
    purpose: '未经预约的拜访',
    visitorType: 'EXTERNAL',
    approverId: 'APPR002',
    expectedEntryTime: now,
    expectedExitTime: now + 1 * 60 * 60 * 1000,
    devices: [],
    operatorId: 'RECEPTION'
  });
  
  db.saveVisitor(visitor);
  
  applyEvent(visitor, EVENT_TYPES.REJECT, {
    approverId: 'APPR002',
    approverName: '陈经理',
    notes: '未提前预约，拒绝访问'
  }, 'APPR002');
  db.saveVisitor(visitor);
  
  return visitor;
}

function runSeed() {
  console.log('开始生成样例数据...\n');
  
  const companions = seedCompanions();
  console.log(`已注册 ${companions.length} 位陪同人员`);
  
  const approvers = seedApprovers();
  console.log(`已注册 ${approvers.length} 位审批人员`);
  
  const normal = createNormalVisitFlow();
  console.log(`[正常入离场] ${normal.name} - ${normal.id}`);
  
  const approvalMissing = createApprovalMissingFlow();
  console.log(`[审批缺失] ${approvalMissing.name} - ${approvalMissing.id}`);
  
  const deviceLeft = createDeviceLeftBehindFlow();
  console.log(`[设备未带出] ${deviceLeft.name} - ${deviceLeft.id}`);
  
  const timeout = createTimeoutFlow();
  console.log(`[超时告警] ${timeout.name} - ${timeout.id}`);
  
  const rejected = createRejectedFlow();
  console.log(`[审批拒绝] ${rejected.name} - ${rejected.id}`);
  
  console.log('\n样例数据生成完成！');
  console.log('访客总数:', db.getAllVisitors().length);
  
  return {
    normalVisitorId: normal.id,
    approvalMissingId: approvalMissing.id,
    deviceLeftId: deviceLeft.id,
    timeoutId: timeout.id,
    rejectedId: rejected.id
  };
}

if (require.main === module) {
  runSeed();
  process.exit(0);
}

module.exports = {
  runSeed,
  seedCompanions,
  seedApprovers,
  createNormalVisitFlow,
  createApprovalMissingFlow,
  createDeviceLeftBehindFlow,
  createTimeoutFlow,
  createRejectedFlow
};
