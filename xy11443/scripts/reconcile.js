const { sequelize, Batch } = require('../src/models');
const { ReconcileService, BatchService } = require('../src/services');
const chalk = require('chalk');
const Table = require('cli-table3');

async function reconcile() {
  console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                     生鲜分拣损耗对账工具                     ║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    await sequelize.sync();
    const operator = 'accountant_001';

    const batches = await Batch.findAll({
      where: { status: 'submitted' },
      limit: 5
    });

    if (batches.length === 0) {
      console.log(chalk.yellow('没有找到已提交的批次，请先运行: npm run seed'));
      process.exit(0);
    }

    console.log(chalk.yellow(`找到 ${batches.length} 个待对账批次，开始处理第一个批次...`));
    const batchId = batches[0].id;
    const batchNo = batches[0].batchNo;

    console.log(chalk.yellow(`\n对账批次: ${batchNo}`));
    console.log(chalk.yellow(`供应商: ${batches[0].supplierName}`));

    const result = await ReconcileService.reconcile(batchId, operator);

    console.log(chalk.green('\n✓ 对账完成!'));

    const table = new Table({
      head: [chalk.cyan('项目'), chalk.cyan('数值'), chalk.cyan('单位')],
      colWidths: [30, 20, 10]
    });

    table.push(
      ['送货总重量', result.summary.deliveryWeight, 'kg'],
      ['净重量', result.summary.netWeight, 'kg'],
      ['分拣后重量', result.summary.sortingWeight, 'kg'],
      ['─'.repeat(30), '─'.repeat(20), '─'.repeat(10)],
      ['坏果损耗', chalk.red(result.summary.badFruitLoss.toString()), 'kg'],
      ['二次分拣损耗', chalk.red(result.summary.secondarySortingLoss.toString()), 'kg'],
      ['总损耗重量', chalk.red.bold(result.summary.totalLossWeight.toString()), 'kg'],
      ['总损耗率', chalk.red.bold(`${result.summary.totalLossRate}%`), '%'],
      ['─'.repeat(30), '─'.repeat(20), '─'.repeat(10)],
      ['总扣款金额', chalk.yellow.bold(result.summary.totalDeduction.toString()), '元'],
      ['重量差异', result.summary.differenceWeight > 0 ? chalk.yellow(result.summary.differenceWeight.toString()) : result.summary.differenceWeight.toString(), 'kg']
    );

    console.log('\n' + table.toString());

    const detailsTable = new Table({
      head: [chalk.cyan('类型'), chalk.cyan('数量')],
      colWidths: [30, 20]
    });

    detailsTable.push(
      ['送货单数量', result.details.deliveryCount],
      ['称重记录数量', result.details.weighingCount],
      ['损耗记录数量', result.details.lossCount]
    );

    console.log('\n' + detailsTable.toString());

    console.log(chalk.green('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green('                      对账完成!'));
    console.log(chalk.green(`                      对账单号: ${result.reconciliation.reconcileNo}`));
    console.log(chalk.green('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.cyan('下一步操作:'));
    console.log(chalk.cyan('  npm run export         冻结并导出数据'));
    console.log(chalk.cyan('  npm run replay         回放异常\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n对账失败:'), error.message);
    process.exit(1);
  }
}

reconcile();
