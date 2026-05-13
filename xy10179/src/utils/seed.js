const { sequelize, Tenant, User, DataRecord } = require('../models');

async function seedDatabase() {
  console.log('开始检查数据库状态...');
  
  await sequelize.sync();
  console.log('数据库表已同步（保留现有数据）');

  const existingTenants = await Tenant.count();
  
  if (existingTenants > 0) {
    console.log('数据库已有数据，跳过初始化');
    return null;
  }

  console.log('检测到空数据库，开始初始化...');

  const tenantA = await Tenant.create({
    name: '租户A - 科技公司',
    code: 'TENANT_A',
    status: 'active'
  });

  const tenantB = await Tenant.create({
    name: '租户B - 电商平台',
    code: 'TENANT_B',
    status: 'active'
  });

  const tenantC = await Tenant.create({
    name: '租户C - 金融服务',
    code: 'TENANT_C',
    status: 'active'
  });

  console.log('租户已创建:', {
    A: tenantA.id,
    B: tenantB.id,
    C: tenantC.id
  });

  const adminUser = await User.create({
    tenantId: tenantA.id,
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: 'admin',
    status: 'active'
  });

  const csUser = await User.create({
    tenantId: tenantA.id,
    username: 'cs001',
    password: 'cs123456',
    name: '客服小王',
    role: 'customer_service',
    status: 'active'
  });

  const userA = await User.create({
    tenantId: tenantA.id,
    username: 'user_a_01',
    password: 'user123',
    name: '租户A用户',
    role: 'user',
    status: 'active'
  });

  const userB = await User.create({
    tenantId: tenantB.id,
    username: 'user_b_01',
    password: 'user123',
    name: '租户B用户',
    role: 'user',
    status: 'active'
  });

  console.log('用户已创建:', {
    admin: adminUser.id,
    cs: csUser.id,
    userA: userA.id,
    userB: userB.id
  });

  const tenantARecords = await DataRecord.bulkCreate([
    {
      tenantId: tenantA.id,
      title: '租户A - 产品需求文档',
      content: '这是租户A的产品需求文档内容，包含详细的功能说明。',
      status: 'approved',
      createdBy: userA.id,
      updatedBy: userA.id
    },
    {
      tenantId: tenantA.id,
      title: '租户A - 技术方案',
      content: '租户A的技术实现方案，包括架构设计和技术选型。',
      status: 'pending',
      createdBy: userA.id,
      updatedBy: userA.id
    },
    {
      tenantId: tenantA.id,
      title: '租户A - 测试计划',
      content: '详细的测试计划和测试用例。',
      status: 'draft',
      createdBy: userA.id,
      updatedBy: userA.id
    }
  ]);

  const tenantBRecords = await DataRecord.bulkCreate([
    {
      tenantId: tenantB.id,
      title: '租户B - 订单处理流程',
      content: '电商订单处理的完整流程说明。',
      status: 'approved',
      createdBy: userB.id,
      updatedBy: userB.id
    },
    {
      tenantId: tenantB.id,
      title: '租户B - 支付系统文档',
      content: '支付系统的技术文档和接口说明。',
      status: 'approved',
      createdBy: userB.id,
      updatedBy: userB.id
    },
    {
      tenantId: tenantB.id,
      title: '租户B - 物流配送方案',
      content: '物流配送的优化方案。',
      status: 'draft',
      createdBy: userB.id,
      updatedBy: userB.id
    }
  ]);

  const tenantCRecords = await DataRecord.bulkCreate([
    {
      tenantId: tenantC.id,
      title: '租户C - 金融产品介绍',
      content: '金融产品的详细介绍和收益说明。',
      status: 'approved',
      createdBy: adminUser.id,
      updatedBy: adminUser.id
    },
    {
      tenantId: tenantC.id,
      title: '租户C - 风险评估报告',
      content: '详细的风险评估和控制措施。',
      status: 'pending',
      createdBy: adminUser.id,
      updatedBy: adminUser.id
    }
  ]);

  console.log('数据记录已创建:', {
    tenantA: tenantARecords.length,
    tenantB: tenantBRecords.length,
    tenantC: tenantCRecords.length
  });

  console.log('✅ 数据库初始化完成');

  return {
    tenants: { A: tenantA, B: tenantB, C: tenantC },
    users: { admin: adminUser, cs: csUser, userA, userB },
    records: {
      tenantA: tenantARecords,
      tenantB: tenantBRecords,
      tenantC: tenantCRecords
    }
  };
}

module.exports = seedDatabase;
