#!/usr/bin/env node

import { initDatabase } from './models/database';
import { OrderModel } from './models/OrderModel';
import { TaskService } from './services/TaskService';
import { ReworkService } from './services/ReworkService';
import { DeductionService } from './services/DeductionService';
import { SettlementService } from './services/SettlementService';
import { ValidationEngine } from './rules/ValidationEngine';
import { UserModel } from './models/UserModel';
import { UserRole, DeductionType } from './types';
import { ReportGenerator } from './reports/ReportGenerator';
import dayjs from 'dayjs';

const args = process.argv.slice(2);
const command = args[0];

initDatabase();

async function main() {
  switch (command) {
    case 'init':
      await cmdInit();
      break;
    case 'task:assign':
      await cmdTaskAssign();
      break;
    case 'task:approve':
      await cmdTaskApprove();
      break;
    case 'task:validate':
      await cmdTaskValidate();
      break;
    case 'rework:create':
      await cmdReworkCreate();
      break;
    case 'deduction:create':
      await cmdDeductionCreate();
      break;
    case 'settlement:create':
      await cmdSettlementCreate();
      break;
    case 'settlement:confirm':
      await cmdSettlementConfirm();
      break;
    case 'settlement:export':
      await cmdSettlementExport();
      break;
    case 'seed':
      await cmdSeed();
      break;
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
民宿运营管理系统 CLI

使用方法:
  npm run cli -- <命令> [选项]

命令:
  init              初始化系统和默认用户
  task:assign       派单
  task:approve      验收任务
  task:validate     校验任务
  rework:create     创建返工
  deduction:create  创建扣款
  settlement:create 生成结算单
  settlement:confirm 确认结算
  settlement:export 导出结算CSV
  seed              生成测试数据

示例:
  npm run cli -- task:assign --order O001 --cleaner C001 --date 2024-01-15
  npm run cli -- settlement:create --cleaner C001 --start 2024-01-01 --end 2024-01-31
`);
}

async function cmdInit() {
  console.log('🔧 初始化系统...');
  
  const admin = UserModel.create({
    username: 'admin',
    name: '系统管理员',
    phone: '13800138000',
    role: UserRole.ADMIN,
    isActive: true
  }, 'admin123');

  const manager = UserModel.create({
    username: 'manager',
    name: '运营经理',
    phone: '13800138001',
    role: UserRole.MANAGER,
    isActive: true
  }, 'manager123');

  const cleaner1 = UserModel.create({
    username: 'cleaner1',
    name: '张阿姨',
    phone: '13912345678',
    role: UserRole.CLEANER,
    isActive: true
  }, 'cleaner123');

  const cleaner2 = UserModel.create({
    username: 'cleaner2',
    name: '李阿姨',
    phone: '13987654321',
    role: UserRole.CLEANER,
    isActive: true
  }, 'cleaner456');

  const finance = UserModel.create({
    username: 'finance',
    name: '财务',
    phone: '13800138002',
    role: UserRole.FINANCE,
    isActive: true
  }, 'finance123');

  console.log('✅ 初始化完成');
  console.log('\n默认账号:');
  console.log('  管理员: admin / admin123');
  console.log('  运营经理: manager / manager123');
  console.log('  保洁员张阿姨: cleaner1 / cleaner123');
  console.log('  保洁员李阿姨: cleaner2 / cleaner456');
  console.log('  财务: finance / finance123');
}

async function cmdTaskAssign() {
  const orderId = getArgValue('order') || getArgValue('orderId');
  const cleanerId = getArgValue('cleaner') || getArgValue('cleanerId');
  const date = getArgValue('date') || dayjs().format('YYYY-MM-DD');
  const deadline = getArgValue('deadline') || dayjs(date).add(1, 'day').format('YYYY-MM-DD HH:mm:ss');

  if (!orderId || !cleanerId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- task:assign --order <订单ID> --cleaner <保洁员ID> [--date <日期>] [--deadline <截止时间>]');
    process.exit(1);
  }

  const result = await TaskService.assignTask({
    orderId,
    cleanerId,
    scheduledDate: date,
    deadline,
    operatorId: 'system'
  });

  if (result.success) {
    if (result.isDuplicate) {
      console.log(`⚠️  检测到重复派单，返回已有任务: ${result.task!.taskNo}`);
    } else {
      console.log(`✅ 派单成功，任务编号: ${result.task!.taskNo}`);
    }
    console.log(`   任务ID: ${result.task!.id}`);
    console.log(`   保洁员: ${result.task!.cleanerName}`);
  } else {
    console.log(`❌ 派单失败: ${result.error}`);
  }
}

async function cmdTaskApprove() {
  const taskId = getArgValue('id') || getArgValue('taskId');
  if (!taskId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- task:approve --id <任务ID>');
    process.exit(1);
  }

  const validation = await ValidationEngine.validateTaskById(taskId);
  console.log('📋 校验结果:');
  console.log(ValidationEngine.explainResults(validation.results));

  if (!validation.canApprove) {
    console.log('❌ 任务无法通过验收，请处理上述问题后重试');
    process.exit(1);
  }

  const result = await TaskService.approveTask(taskId, 'system');
  if (result.success) {
    console.log(`✅ 任务验收通过`);
  } else {
    console.log(`❌ 验收失败: ${result.error}`);
  }
}

async function cmdTaskValidate() {
  const taskId = getArgValue('id') || getArgValue('taskId');
  if (!taskId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- task:validate --id <任务ID>');
    process.exit(1);
  }

  const report = await ValidationEngine.validateTaskById(taskId);
  
  console.log('📋 任务校验报告');
  console.log(`任务编号: ${report.taskNo}`);
  console.log(`可验收: ${report.canApprove ? '✅' : '❌'}`);
  console.log(`可结算: ${report.canSettle ? '✅' : '❌'}`);
  console.log(`预计扣款: ${report.totalDeduction > 0 ? '¥' + report.totalDeduction : '无'}`);
  console.log('');
  console.log(ValidationEngine.explainResults(report.results));
}

async function cmdReworkCreate() {
  const taskId = getArgValue('task') || getArgValue('taskId');
  const reason = getArgValue('reason') || '质量不达标';

  if (!taskId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- rework:create --task <任务ID> [--reason <原因>]');
    process.exit(1);
  }

  const result = await ReworkService.createRework({
    taskId,
    reason,
    requesterId: 'system',
    deadline: dayjs().add(1, 'day').toISOString()
  });

  if (result.success) {
    if (result.isDuplicate) {
      console.log(`⚠️  检测到已有进行中的返工任务`);
    } else {
      console.log(`✅ 返工创建成功，返工编号: ${result.rework!.id}`);
    }
    console.log(`   原因: ${result.rework!.reason}`);
  } else {
    console.log(`❌ 创建失败: ${result.error}`);
  }
}

async function cmdDeductionCreate() {
  const taskId = getArgValue('task') || getArgValue('taskId');
  const type = (getArgValue('type') as DeductionType) || DeductionType.OTHER;
  const amount = parseFloat(getArgValue('amount') || '0');
  const reason = getArgValue('reason') || '其他扣款';

  if (!taskId || amount <= 0) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- deduction:create --task <任务ID> --type <类型> --amount <金额> [--reason <原因>]');
    console.log('类型: missing_photos, overtime, complaint, rework, damage, other');
    process.exit(1);
  }

  const result = await DeductionService.createDeduction({
    taskId,
    type,
    amount,
    reason,
    operatorId: 'system',
    autoConfirm: true
  });

  if (result.success) {
    if (result.isDuplicate) {
      console.log(`⚠️  检测到重复扣款`);
    } else {
      console.log(`✅ 扣款创建成功，扣款编号: ${result.deduction!.id}`);
    }
    console.log(`   类型: ${result.deduction!.type}`);
    console.log(`   金额: ¥${result.deduction!.amount}`);
    console.log(`   原因: ${result.deduction!.reason}`);
  } else {
    console.log(`❌ 创建失败: ${result.error}`);
  }
}

async function cmdSettlementCreate() {
  const cleanerId = getArgValue('cleaner') || getArgValue('cleanerId');
  const startDate = getArgValue('start') || getArgValue('startDate');
  const endDate = getArgValue('end') || getArgValue('endDate');

  if (!cleanerId || !startDate || !endDate) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- settlement:create --cleaner <保洁员ID> --start <开始日期> --end <结束日期>');
    process.exit(1);
  }

  const result = await SettlementService.createSettlement({
    cleanerId,
    startDate,
    endDate,
    operatorId: 'system'
  });

  if (result.success) {
    if (result.isDuplicate) {
      console.log(`⚠️  检测到重叠的结算单`);
    } else {
      console.log(`✅ 结算单创建成功`);
    }
    const s = result.settlement!;
    console.log(`   结算编号: ${s.settlementNo}`);
    console.log(`   保洁员: ${s.cleanerName}`);
    console.log(`   周期: ${s.startDate} 至 ${s.endDate}`);
    console.log(`   任务数: ${s.totalTasks}`);
    console.log(`   基础总额: ¥${s.totalBaseAmount}`);
    console.log(`   扣款总额: ¥${s.totalDeduction}`);
    console.log(`   实发金额: ¥${s.netAmount}`);
  } else {
    console.log(`❌ 创建失败: ${result.error}`);
  }
}

async function cmdSettlementConfirm() {
  const settlementId = getArgValue('id') || getArgValue('settlementId');
  if (!settlementId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- settlement:confirm --id <结算单ID>');
    process.exit(1);
  }

  const result = await SettlementService.confirmSettlement(settlementId, 'system');
  if (result.success) {
    console.log(`✅ 结算单已确认`);
  } else {
    console.log(`❌ 确认失败: ${result.error}`);
  }
}

async function cmdSettlementExport() {
  const settlementId = getArgValue('id') || getArgValue('settlementId');
  const output = getArgValue('output') || getArgValue('o') || `settlement-${settlementId}.csv`;

  if (!settlementId) {
    console.log('❌ 缺少参数');
    console.log('使用方法: npm run cli -- settlement:export --id <结算单ID> [--output <文件路径>]');
    process.exit(1);
  }

  const csv = await ReportGenerator.exportSettlementToCSV(settlementId);
  const fs = require('fs');
  fs.writeFileSync(output, csv, 'utf8');
  
  console.log(`✅ 结算单已导出到: ${output}`);
}

async function cmdSeed() {
  console.log('🌱 生成测试数据...');

  const users = await createTestUsers();
  console.log(`   创建用户: ${users.length} 个`);

  const orders = await createTestOrders();
  console.log(`   创建订单: ${orders.length} 个`);

  const tasks = await createTestTasks(orders, users);
  console.log(`   创建任务: ${tasks.length} 个`);

  console.log('✅ 测试数据生成完成');
}

async function createTestUsers() {
  return [
    UserModel.create({ username: 'test_cleaner1', name: '测试保洁A', phone: '13000000001', role: UserRole.CLEANER, isActive: true }, 'test123'),
    UserModel.create({ username: 'test_cleaner2', name: '测试保洁B', phone: '13000000002', role: UserRole.CLEANER, isActive: true }, 'test123')
  ];
}

async function createTestOrders() {
  const orders = [];
  for (let i = 1; i <= 10; i++) {
    orders.push(OrderModel.create({
      orderNo: `TEST${dayjs().format('YYYYMMDD')}${String(i).padStart(4, '0')}`,
      homestayId: `HS${String(i).padStart(3, '0')}`,
      homestayName: `测试民宿${i}号`,
      guestName: `客人${i}`,
      guestPhone: `186${String(10000000 + i).slice(0, 8)}`,
      checkInDate: dayjs().subtract(i, 'day').format('YYYY-MM-DD'),
      checkOutDate: dayjs().subtract(i - 1, 'day').format('YYYY-MM-DD'),
      roomCount: 1,
      cleaningFee: 100,
      status: 'active'
    }));
  }
  return orders;
}

async function createTestTasks(orders: any[], users: any[]) {
  const tasks = [];
  for (let i = 0; i < orders.length; i++) {
    const cleaner = users[i % users.length];
    const result = await TaskService.assignTask({
      orderId: orders[i].id,
      cleanerId: cleaner.id,
      scheduledDate: dayjs(orders[i].checkOutDate).format('YYYY-MM-DD HH:mm:ss'),
      deadline: dayjs(orders[i].checkOutDate).add(6, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      operatorId: 'system'
    });
    if (result.task) {
      tasks.push(result.task);
    }
  }
  return tasks;
}

function getArgValue(name: string): string | null {
  const index = args.findIndex(arg => arg === `--${name}` || arg === `-${name}`);
  return index >= 0 && index < args.length - 1 ? args[index + 1] : null;
}

main().catch(console.error);
