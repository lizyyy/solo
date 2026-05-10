import prisma from './db/prisma';
import { Role } from '@prisma/client';

async function main() {
  console.log('🌱 开始初始化测试数据...');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      name: '系统管理员',
      role: Role.ADMIN
    }
  });

  const finance = await prisma.user.upsert({
    where: { username: 'finance' },
    update: {},
    create: {
      username: 'finance',
      email: 'finance@example.com',
      name: '财务总监',
      role: Role.FINANCE
    }
  });

  const salesDept = await prisma.department.upsert({
    where: { code: 'SALES' },
    update: {},
    create: {
      name: '销售部',
      code: 'SALES',
      description: '负责销售业务的部门'
    }
  });

  const marketingDept = await prisma.department.upsert({
    where: { code: 'MARKETING' },
    update: {},
    create: {
      name: '市场部',
      code: 'MARKETING',
      description: '负责市场推广的部门'
    }
  });

  const techDept = await prisma.department.upsert({
    where: { code: 'TECH' },
    update: {},
    create: {
      name: '技术部',
      code: 'TECH',
      description: '负责技术研发的部门'
    }
  });

  const salesHead = await prisma.user.upsert({
    where: { username: 'sales_head' },
    update: {},
    create: {
      username: 'sales_head',
      email: 'sales_head@example.com',
      name: '销售部门负责人',
      role: Role.DEPARTMENT_HEAD,
      departmentId: salesDept.id
    }
  });

  const marketingHead = await prisma.user.upsert({
    where: { username: 'marketing_head' },
    update: {},
    create: {
      username: 'marketing_head',
      email: 'marketing_head@example.com',
      name: '市场部门负责人',
      role: Role.DEPARTMENT_HEAD,
      departmentId: marketingDept.id
    }
  });

  const techHead = await prisma.user.upsert({
    where: { username: 'tech_head' },
    update: {},
    create: {
      username: 'tech_head',
      email: 'tech_head@example.com',
      name: '技术部门负责人',
      role: Role.DEPARTMENT_HEAD,
      departmentId: techDept.id
    }
  });

  const budgetVersion = await prisma.budgetVersion.upsert({
    where: { year_quarter_version: { year: 2026, quarter: 1, version: 1 } },
    update: {},
    create: {
      year: 2026,
      quarter: 1,
      version: 1,
      description: '2026年Q1第1轮滚动预测',
      status: 'DRAFT'
    }
  });

  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const lockWindow = await prisma.lockWindow.upsert({
    where: { id: 'seed-window' },
    update: {},
    create: {
      id: 'seed-window',
      budgetVersionId: budgetVersion.id,
      name: '2026Q1第一轮提交窗口',
      description: '2026年第一季度第一轮预算滚动预测提交窗口期',
      status: 'OPEN',
      startDate,
      endDate
    }
  });

  console.log('✅ 测试数据初始化完成');
  console.log('');
  console.log('📋 初始化的数据：');
  console.log(`   用户:`);
  console.log(`     - admin (系统管理员)`);
  console.log(`     - finance (财务总监)`);
  console.log(`     - sales_head (销售部门负责人)`);
  console.log(`     - marketing_head (市场部门负责人)`);
  console.log(`     - tech_head (技术部门负责人)`);
  console.log('');
  console.log(`   部门:`);
  console.log(`     - 销售部 (SALES)`);
  console.log(`     - 市场部 (MARKETING)`);
  console.log(`     - 技术部 (TECH)`);
  console.log('');
  console.log(`   预算版本:`);
  console.log(`     - 2026 Q1 第1轮 (ID: ${budgetVersion.id})`);
  console.log('');
  console.log(`   锁定窗口:`);
  console.log(`     - 2026Q1第一轮提交窗口 (状态: 开放中)`);
  console.log(`     - 时间: ${startDate.toLocaleString()} ~ ${endDate.toLocaleString()}`);
  console.log('');
  console.log('💡 提示：可以使用这些测试数据开始测试 API 功能');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
