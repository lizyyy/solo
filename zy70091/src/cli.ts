#!/usr/bin/env node

import { ArrearsService, ImportRecordInput } from './services';
import { DatabaseConnection } from './database';
import { PaymentChannel } from './types';
import { formatCurrency, formatDateTime, translateStatus, translatePaymentChannel } from './utils';
import initSqlJs from 'sql.js';

let service: ArrearsService | null = null;

async function initService(): Promise<ArrearsService> {
  if (service) {
    return service;
  }
  const SQL = await initSqlJs();
  DatabaseConnection.setInitializedModule(SQL);
  const db = DatabaseConnection.getInstance();
  service = new ArrearsService(db);
  return service;
}

function showHelp(): void {
  console.log(`
公共停车欠费追缴服务 - 命令行工具

使用方法:
  node dist/cli.js <命令> [选项]

命令:

  导入停车记录:
    import <批次号>           从标准输入导入停车记录（JSON格式）
    示例: echo '[{...}]' | node dist/cli.js import batch001

  查看欠费详情:
    query <车牌号>            查看指定车牌的欠费详情
    示例: node dist/cli.js query 京A12345

  执行追缴:
    collect <车牌号> [类型]   对指定车牌执行追缴
    类型可选: notify（首次通知）、reminder（再次提醒）、legal_notice（法务告知）、blacklist（拉黑）
    示例: node dist/cli.js collect 京A12345

  处理支付回调:
    pay <订单号> <车牌号> <金额> <渠道>
    渠道可选: wechat（微信）、alipay（支付宝）、bank（银行）、cash（现金）、third_party（第三方）
    示例: node dist/cli.js pay order001 京A12345 150.00 wechat

  撤回欠费:
    withdraw <车牌号> <原因>  撤回指定车牌的欠费记录
    示例: node dist/cli.js withdraw 京A12345 "车牌识别错误"

  查看操作历史:
    history <车牌号>          查看指定车牌的所有操作历史
    示例: node dist/cli.js history 京A12345

  生成追缴报告:
    report                    生成并显示当前追缴报告
    示例: node dist/cli.js report

  查看待处理欠费:
    pending                   查看所有待处理的欠费
    示例: node dist/cli.js pending

  运行演示:
    demo                      运行完整演示流程
    示例: node dist/cli.js demo

  帮助:
    help                      显示此帮助信息
`);
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk.toString();
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

async function importRecords(batchId: string): Promise<void> {
  const svc = await initService();
  const data = await readStdin();
  try {
    const records: Array<{
      plateNumber: string;
      parkingLotId: string;
      parkingLotName: string;
      berthId: string;
      berthNumber: string;
      entryTime: string;
      exitTime: string;
      totalAmount: number;
      paidAmount?: number;
      isRecognizedPlate?: boolean;
    }> = JSON.parse(data);

    const importData: ImportRecordInput[] = records.map(r => ({
      ...r,
      entryTime: parseDate(r.entryTime),
      exitTime: parseDate(r.exitTime),
      paidAmount: r.paidAmount || 0
    }));

    const result = svc.importRecords(importData, { batchId });

    console.log('\n========== 导入结果 ==========');
    console.log(`批次号: ${result.batchId}`);
    console.log(`总记录数: ${result.totalRecords}`);
    console.log(`新增记录: ${result.newRecords}`);
    if (result.skippedRecords > 0) {
      console.log(`跳过重复: ${result.skippedRecords}`);
    }
    console.log(`新增欠费: ${formatCurrency(result.unpaidAmount)}`);
    console.log(`\n结果: ${result.message}`);
    if (result.warnings.length > 0) {
      console.log('\n警告:');
      result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
    }
    console.log('==============================\n');
  } catch (e: any) {
    console.error(`❌ 导入失败: ${e.message}`);
    process.exit(1);
  }
}

async function queryArrears(plateNumber: string): Promise<void> {
  const svc = await initService();
  console.log(svc.formatArrearsDetail(plateNumber));
}

async function collectArrears(plateNumber: string, actionType?: string): Promise<void> {
  const svc = await initService();
  const options: { actionType?: any } = {};
  if (actionType) {
    options.actionType = actionType as any;
  }

  const result = svc.performCollection(plateNumber, options);

  console.log('\n========== 追缴结果 ==========');
  console.log(`车牌号: ${result.plateNumber}`);
  console.log(`欠费金额: ${formatCurrency(result.totalUnpaid)}`);
  console.log(`当前状态: ${result.status}`);
  
  if (result.actions.length > 0) {
    console.log('\n执行的操作:');
    result.actions.forEach(action => {
      console.log(`  - ${action.type}（${action.channel}）: ${action.result}`);
      if (action.message) {
        console.log(`    内容: ${action.message}`);
      }
    });
  }
  console.log('==============================\n');
}

async function processPayment(orderId: string, plateNumber: string, amountStr: string, channelStr: string): Promise<void> {
  const svc = await initService();
  const amount = parseFloat(amountStr);
  const channel = channelStr as PaymentChannel;

  const validChannels: PaymentChannel[] = ['wechat', 'alipay', 'bank', 'cash', 'third_party'];
  if (!validChannels.includes(channel)) {
    console.error(`❌ 无效的支付渠道: ${channelStr}`);
    console.error(`   可选渠道: ${validChannels.join('、')}`);
    process.exit(1);
  }

  const result = svc.processPaymentCallback(
    orderId,
    plateNumber,
    amount,
    channel,
    new Date()
  );

  console.log('\n========== 支付结果 ==========');
  console.log(`订单号: ${orderId}`);
  console.log(`车牌号: ${plateNumber}`);
  console.log(`支付金额: ${formatCurrency(amount)}`);
  console.log(`支付渠道: ${translatePaymentChannel(channel)}`);
  console.log(`\n结果: ${result.message}`);
  if (result.data) {
    console.log(`\n详细: ${JSON.stringify(result.data, null, 2)}`);
  }
  console.log('==============================\n');
}

async function withdrawArrears(plateNumber: string, reason: string): Promise<void> {
  const svc = await initService();
  const result = svc.withdrawArrears(plateNumber, reason);

  console.log('\n========== 撤回结果 ==========');
  console.log(`车牌号: ${result.plateNumber}`);
  console.log(`撤回原因: ${result.reason}`);
  console.log(`\n结果: ${result.message}`);
  console.log('==============================\n');
}

async function showHistory(plateNumber: string): Promise<void> {
  const svc = await initService();
  const history = svc.getOperationHistory(plateNumber);

  console.log(`\n========== 操作历史：${plateNumber} ==========`);
  if (history.length === 0) {
    console.log('暂无操作记录');
  } else {
    history.forEach((h, i) => {
      console.log(`\n${i + 1}. [${h.time}] ${h.operation}`);
      if (h.operator) {
        console.log(`   操作人: ${h.operator}`);
      }
      if (h.reason) {
        console.log(`   原因: ${h.reason}`);
      }
    });
  }
  console.log('============================================\n');
}

async function generateReport(): Promise<void> {
  const svc = await initService();
  const report = svc.generateReport();

  console.log('\n========== 追缴报告 ==========');
  console.log(`报告日期: ${formatDateTime(report.reportDate)}`);
  console.log(`生成时间: ${formatDateTime(report.generatedAt)}`);
  console.log('\n统计数据:');
  console.log(`  欠费记录数: ${report.totalRecords} 笔`);
  console.log(`  总金额: ${formatCurrency(report.totalAmount)}`);
  console.log(`  已收回: ${formatCurrency(report.collectedAmount)}`);
  console.log(`  待收回: ${formatCurrency(report.pendingAmount)}`);
  console.log(`  黑名单数量: ${report.blacklistCount} 辆`);
  console.log(`  新增欠费: ${report.newArrearsCount} 辆`);
  console.log(`  已结清: ${report.paidCount} 辆`);
  console.log(`\n摘要: ${report.summary}`);
  console.log('==============================\n');
}

async function showPending(): Promise<void> {
  const svc = await initService();
  const pending = svc.getPendingArrears();

  console.log('\n========== 待处理欠费 ==========');
  if (pending.length === 0) {
    console.log('暂无待处理的欠费');
  } else {
    console.log(`共 ${pending.length} 条待处理欠费:\n`);
    pending.forEach((group, i) => {
      console.log(`${i + 1}. 车牌号: ${group.plateNumber}`);
      console.log(`   欠费金额: ${formatCurrency(group.totalUnpaidAmount)}`);
      console.log(`   欠费笔数: ${group.recordCount} 笔`);
      console.log(`   状态: ${translateStatus(group.status)}`);
      console.log(`   首次欠费: ${formatDateTime(group.firstUnpaidTime)}`);
      console.log();
    });
  }
  console.log('================================\n');
}

async function runDemo(): Promise<void> {
  const svc = await initService();
  
  console.log('\n========================================');
  console.log('    公共停车欠费追缴服务 - 演示流程');
  console.log('========================================\n');

  const batchId = 'demo-batch-001';
  const plate1 = '京A12345';
  const plate2 = '京B67890';
  const plate3 = '京C11111';

  console.log('【第一步】导入停车记录（模拟跨泊位、跨时段的欠费）');
  console.log('------------------------------------------------\n');

  const records: ImportRecordInput[] = [
    {
      plateNumber: plate1,
      parkingLotId: 'lot-001',
      parkingLotName: '中关村大街路侧停车场',
      berthId: 'berth-101',
      berthNumber: 'A-101',
      entryTime: new Date('2024-01-15T09:00:00'),
      exitTime: new Date('2024-01-15T11:30:00'),
      totalAmount: 25.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: plate1,
      parkingLotId: 'lot-001',
      parkingLotName: '中关村大街路侧停车场',
      berthId: 'berth-102',
      berthNumber: 'A-102',
      entryTime: new Date('2024-01-16T14:00:00'),
      exitTime: new Date('2024-01-16T16:45:00'),
      totalAmount: 35.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: plate1,
      parkingLotId: 'lot-002',
      parkingLotName: '五道口路侧停车场',
      berthId: 'berth-205',
      berthNumber: 'B-205',
      entryTime: new Date('2024-01-18T10:15:00'),
      exitTime: new Date('2024-01-18T13:00:00'),
      totalAmount: 40.00,
      paidAmount: 0,
      isRecognizedPlate: false
    },
    {
      plateNumber: plate2,
      parkingLotId: 'lot-003',
      parkingLotName: '国贸CBD停车场',
      berthId: 'berth-333',
      berthNumber: 'C-333',
      entryTime: new Date('2024-01-20T08:30:00'),
      exitTime: new Date('2024-01-20T20:00:00'),
      totalAmount: 120.00,
      paidAmount: 0,
      isRecognizedPlate: true
    },
    {
      plateNumber: plate3,
      parkingLotId: 'lot-001',
      parkingLotName: '中关村大街路侧停车场',
      berthId: 'berth-110',
      berthNumber: 'A-110',
      entryTime: new Date('2024-01-22T09:00:00'),
      exitTime: new Date('2024-01-22T18:00:00'),
      totalAmount: 90.00,
      paidAmount: 30.00,
      isRecognizedPlate: true
    }
  ];

  const importResult = svc.importRecords(records, { batchId });
  console.log(importResult.message);
  if (importResult.warnings.length > 0) {
    importResult.warnings.forEach(w => console.log(`⚠️  ${w}`));
  }

  console.log('\n【第二步】查看待处理欠费列表');
  console.log('------------------------------\n');

  const pending = svc.getPendingArrears();
  console.log(`发现 ${pending.length} 个车牌有欠费:`);
  pending.forEach(g => {
    console.log(`  - ${g.plateNumber}: ${formatCurrency(g.totalUnpaidAmount)} (${g.recordCount}笔)`);
  });

  console.log('\n【第三步】查看 ' + plate1 + ' 的详细欠费情况');
  console.log('----------------------------------------\n');

  console.log(svc.formatArrearsDetail(plate1));

  console.log('\n【第四步】对 ' + plate1 + ' 执行首次追缴（短信通知）');
  console.log('--------------------------------------------\n');

  const collect1 = svc.performCollection(plate1);
  console.log(`${collect1.plateNumber} 欠费 ${formatCurrency(collect1.totalUnpaid)}，当前状态: ${collect1.status}`);
  collect1.actions.forEach(a => {
    console.log(`  执行: ${a.type}（${a.channel}）- ${a.result}`);
    if (a.message) console.log(`  ${a.message}`);
  });

  console.log('\n【第五步】对 ' + plate2 + ' 执行追缴（金额较大直接拉黑）');
  console.log('--------------------------------------------\n');

  const collect2 = svc.performCollection(plate2);
  console.log(`${collect2.plateNumber} 欠费 ${formatCurrency(collect2.totalUnpaid)}，当前状态: ${collect2.status}`);
  collect2.actions.forEach(a => {
    console.log(`  执行: ${a.type}（${a.channel}）- ${a.result}`);
    if (a.message) console.log(`  ${a.message}`);
  });

  console.log('\n【第六步】' + plate1 + ' 支付部分费用（模拟微信支付回调）');
  console.log('--------------------------------------------\n');

  const payResult1 = svc.processPaymentCallback(
    'demo-pay-001',
    plate1,
    60.00,
    'wechat',
    new Date('2024-01-25T15:30:00')
  );
  console.log(payResult1.message);

  console.log('\n【第七步】查看 ' + plate1 + ' 支付后的状态');
  console.log('--------------------------------------\n');

  console.log(svc.formatArrearsDetail(plate1));

  console.log('\n【第八步】' + plate1 + ' 继续支付剩余费用（全额结清）');
  console.log('--------------------------------------------\n');

  const group1 = svc.getArrearsGroup(plate1);
  if (group1 && group1.totalUnpaidAmount > 0) {
    const payResult2 = svc.processPaymentCallback(
      'demo-pay-002',
      plate1,
      group1.totalUnpaidAmount,
      'alipay',
      new Date('2024-01-26T10:00:00')
    );
    console.log(payResult2.message);
  }

  console.log('\n【第九步】查看 ' + plate1 + ' 结清后的状态');
  console.log('--------------------------------------\n');

  console.log(svc.formatArrearsDetail(plate1));

  console.log('\n【第十步】撤回 ' + plate3 + ' 的欠费（模拟车牌识别错误）');
  console.log('--------------------------------------------\n');

  const withdrawResult = svc.withdrawArrears(plate3, '车牌识别错误，实际应为京C11112', { operator: '李管理员' });
  console.log(withdrawResult.message);

  console.log('\n【第十一步】查看 ' + plate3 + ' 的操作历史');
  console.log('--------------------------------------\n');

  await showHistory(plate3);

  console.log('\n【第十二步】重跑同一批次数据（验证幂等性）');
  console.log('--------------------------------------\n');

  const reimportResult = svc.importRecords(records, { batchId });
  console.log(reimportResult.message);
  if (reimportResult.warnings.length > 0) {
    reimportResult.warnings.forEach(w => console.log(`⚠️  ${w}`));
  }

  console.log('\n【第十三步】生成追缴报告');
  console.log('------------------------\n');

  const report = svc.generateReport();
  console.log(report.summary);

  console.log('\n========================================');
  console.log('           演示流程完成！');
  console.log('========================================\n');
  console.log('关键业务场景验证:');
  console.log('  ✅ 跨泊位/停车场的欠费合并');
  console.log('  ✅ 车牌识别记录的关联');
  console.log('  ✅ 自动追缴策略（小金额短信、大金额拉黑）');
  console.log('  ✅ 支付回调处理（部分结清/全额结清）');
  console.log('  ✅ 黑名单自动加入/移除');
  console.log('  ✅ 欠费撤回功能');
  console.log('  ✅ 操作历史记录');
  console.log('  ✅ 批次幂等性（重复导入自动去重）');
  console.log('  ✅ 追缴报告生成');
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'import':
        if (args.length < 2) {
          console.error('❌ 请提供批次号');
          showHelp();
          process.exit(1);
        }
        await importRecords(args[1]);
        break;

      case 'query':
        if (args.length < 2) {
          console.error('❌ 请提供车牌号');
          showHelp();
          process.exit(1);
        }
        await queryArrears(args[1]);
        break;

      case 'collect':
        if (args.length < 2) {
          console.error('❌ 请提供车牌号');
          showHelp();
          process.exit(1);
        }
        await collectArrears(args[1], args[2]);
        break;

      case 'pay':
        if (args.length < 5) {
          console.error('❌ 参数不完整，请提供: 订单号 车牌号 金额 支付渠道');
          showHelp();
          process.exit(1);
        }
        await processPayment(args[1], args[2], args[3], args[4]);
        break;

      case 'withdraw':
        if (args.length < 3) {
          console.error('❌ 请提供车牌号和撤回原因');
          showHelp();
          process.exit(1);
        }
        await withdrawArrears(args[1], args.slice(2).join(' '));
        break;

      case 'history':
        if (args.length < 2) {
          console.error('❌ 请提供车牌号');
          showHelp();
          process.exit(1);
        }
        await showHistory(args[1]);
        break;

      case 'report':
        await generateReport();
        break;

      case 'pending':
        await showPending();
        break;

      case 'demo':
        await runDemo();
        break;

      default:
        console.error(`❌ 未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (e: any) {
    console.error(`❌ 执行出错: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
