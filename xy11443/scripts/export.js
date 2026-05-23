const { sequelize, Batch } = require('../src/models');
const { BatchService, ExportService } = require('../src/services');
const chalk = require('chalk');
const Table = require('cli-table3');

async function exportData() {
  console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                     生鲜分拣损耗导出工具                     ║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    await sequelize.sync();
    const operator = 'manager_001';

    const batches = await Batch.findAll({
      where: { status: 'reconciled' },
      limit: 5
    });

    if (batches.length === 0) {
      console.log(chalk.yellow('没有找到已对账的批次，请先运行: npm run reconcile'));
      process.exit(0);
    }

    const batchId = batches[0].id;
    const batchNo = batches[0].batchNo;

    console.log(chalk.yellow(`导出批次: ${batchNo}`));
    console.log(chalk.yellow(`供应商: ${batches[0].supplierName}`));

    console.log(chalk.yellow('\n步骤1: 冻结批次（防止导出后修改）...'));
    await BatchService.freezeBatch(batchId, operator);
    console.log(chalk.green('✓ 批次已冻结'));

    console.log(chalk.yellow('\n步骤2: 导出JSON格式数据...'));
    const result = await ExportService.exportBatch(batchId, operator, 'json');
    console.log(chalk.green('✓ JSON数据导出成功'));

    const table = new Table({
      head: [chalk.cyan('项目'), chalk.cyan('内容')],
      colWidths: [20, 60]
    });

    table.push(
      ['导出编号', result.exportRecord.exportNo],
      ['文件名称', result.exportRecord.fileName],
      ['文件路径', result.filePath],
      ['文件大小', `${(result.fileSize / 1024).toFixed(2)} KB`],
      ['记录数量', result.recordCount.toString()],
      ['导出时间', result.exportRecord.exportedAt.toLocaleString()],
      ['导出人', result.exportRecord.exportedBy]
    );

    console.log('\n' + table.toString());

    console.log(chalk.green('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green('                      导出完成!'));
    console.log(chalk.green('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.cyan('下一步操作:'));
    console.log(chalk.cyan('  npm run replay         回放异常查看历史\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n导出失败:'), error.message);
    process.exit(1);
  }
}

exportData();
