#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const { readPreOccupation, readPaymentFlow, readInventory } = require('./file-reader');
const { reconcile } = require('./reconciliation-engine');
const { generateReports } = require('./report-generator');

const argv = yargs(hideBin(process.argv))
  .option('pre-occupation', {
    alias: 'p',
    describe: '预占单CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('payment', {
    alias: 'm',
    describe: '支付流水CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('inventory', {
    alias: 'i',
    describe: '库存表CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: '输出目录路径',
    type: 'string',
    default: './output'
  })
  .help()
  .example('$0 -p data/pre.csv -m data/payment.csv -i data/inventory.csv -o output')
  .epilog('商城库存快照预占释放对账工具 - 自动识别未释放预占库存')
  .argv;

async function main() {
  try {
    console.log('========================================');
    console.log('  商城库存快照预占释放对账工具');
    console.log('========================================\n');

    console.log('📂 正在读取数据文件...');
    console.log(`   预占单: ${argv.preOccupation}`);
    console.log(`   支付流水: ${argv.payment}`);
    console.log(`   库存表: ${argv.inventory}`);
    console.log('');

    const [preOccupations, payments, inventory] = await Promise.all([
      readPreOccupation(argv.preOccupation),
      readPaymentFlow(argv.payment),
      readInventory(argv.inventory)
    ]);

    console.log('✅ 数据读取完成:');
    console.log(`   预占单: ${preOccupations.length} 条`);
    console.log(`   支付流水: ${payments.length} 条`);
    console.log(`   库存SKU: ${inventory.length} 个`);
    console.log('');

    console.log('🔍 正在执行对账逻辑...');
    const result = reconcile(preOccupations, payments, inventory);

    console.log('✅ 对账完成:');
    console.log(`   未释放预占总数: ${result.summary.totalUnreleased}`);
    console.log(`   ├─ 支付失败: ${result.summary.paymentFailedCount} 条`);
    console.log(`   ├─ 超时取消: ${result.summary.timeoutCount} 条`);
    console.log(`   ├─ 手工兑换: ${result.summary.manualExchangeCount} 条`);
    console.log(`   └─ 正常释放: ${result.summary.normalReleasedCount} 条`);
    console.log('');

    console.log('📄 正在生成对账报告...');
    const files = await generateReports(result, argv.output);
    
    console.log('✅ 报告生成完成:');
    console.log(`   输出目录: ${argv.output}`);
    console.log(`   生成文件: ${files.length} 个`);
    console.log('');

    console.log('========================================');
    console.log('  对账完成！请查看输出目录中的报告');
    console.log('========================================\n');

    console.log('📋 未释放预占摘要:');
    result.unreleasedList.forEach((item, index) => {
      console.log(`\n  ${index + 1}. 预占单号: ${item.preOccupationId}`);
      console.log(`     SKU: ${item.skuName} (${item.skuCode})`);
      console.log(`     数量: ${item.quantity}`);
      console.log(`     对账类型: ${item.reconciliationType}`);
      console.log(`     对账状态: ${item.reconciliationStatus}`);
      console.log(`     对账备注: ${item.reconciliationRemark}`);
    });

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
