const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class ReportGenerator {
  static printConsoleReport(settlementResult, inputFile) {
    console.log('\n' + chalk.bold.blue('='.repeat(70)));
    console.log(chalk.bold.blue('          摄影器材租赁店相机租金结算报告'));
    console.log(chalk.bold.blue('='.repeat(70)));
    console.log(chalk.gray(`处理文件: ${inputFile}`));
    console.log(chalk.gray(`处理时间: ${new Date().toLocaleString('zh-CN')}`));
    console.log();

    this.printSummary(settlementResult.summary);
    this.printResults(settlementResult.results);
    this.printWarnings(settlementResult.warnings);
    this.printExceptions(settlementResult.exceptions);

    console.log('\n' + chalk.bold.green('✓ 处理完成，支持复跑。修复数据后重新执行命令即可重新计算'));
  }

  static printSummary(summary) {
    console.log(chalk.bold.yellow('【结算汇总】'));
    console.log(chalk.white(`  订单总数: ${summary.totalOrders} 单`));
    console.log(chalk.green(`  租金总额: ¥${summary.totalRevenue.toFixed(2)}`));
    console.log(chalk.red(`  逾期订单: ${summary.overdueOrders} 单`));
    console.log(chalk.yellow(`  分批归还: ${summary.partialReturns} 单`));
    console.log(chalk.magenta(`  滤镜丢失: ${summary.missingFilters} 单`));
    console.log(chalk.red(`  物品损坏: ${summary.damagedItems} 单`));
    console.log();
  }

  static printResults(results) {
    if (results.length === 0) return;

    console.log(chalk.bold.green('【结算明细】'));
    results.forEach((r, index) => {
      console.log(chalk.white(`\n  ${index + 1}. 订单 ${r.orderId} - ${r.customerName}`));
      console.log(`    设备: ${r.cameraModel}${r.lensModel ? ' + ' + r.lensModel : ''}`);
      console.log(`    租期: ${r.rentalPeriod.start} 至 ${r.rentalPeriod.end}`);
      console.log(`    实际归还: ${r.rentalPeriod.actualReturn}`);
      console.log(`    租用天数: ${r.rentalPeriod.actualDays} 天 (计划 ${r.rentalPeriod.plannedDays} 天)`);
      console.log(`    基础租金: ¥${r.pricing.baseRental.toFixed(2)} (¥${r.pricing.dailyRate}/天)`);

      if (r.pricing.overdueFee > 0) {
        console.log(chalk.red(`    逾期费用: ¥${r.pricing.overdueFee.toFixed(2)} (逾期 ${r.rentalPeriod.overdueDays} 天)`));
      }

      if (r.pricing.compensation > 0) {
        console.log(chalk.red(`    赔偿费用: ¥${r.pricing.compensation.toFixed(2)}`));
        r.pricing.compensationBreakdown.forEach(b => {
          console.log(chalk.red(`      - ${b.item}: ¥${b.fee} (${b.note})`));
        });
      }

      console.log(chalk.bold.green(`    应收总额: ¥${r.pricing.totalAmount.toFixed(2)}`));
      console.log(`    押金: ¥${r.deposit.amount.toFixed(2)}`);

      if (r.deposit.refundAmount > 0) {
        console.log(chalk.green(`    应退押金: ¥${r.deposit.refundAmount.toFixed(2)}`));
      }
      if (r.deposit.payableAmount > 0) {
        console.log(chalk.red(`    需补差价: ¥${r.deposit.payableAmount.toFixed(2)}`));
      }

      if (r.returnStatus.missingItems) {
        console.log(chalk.yellow(`    归还状态: 缺少 ${r.returnStatus.missingItems}`));
      }
    });
    console.log();
  }

  static printWarnings(warnings) {
    if (warnings.length === 0) return;

    console.log(chalk.bold.yellow('【业务预警】'));
    warnings.forEach((w, index) => {
      console.log(chalk.yellow(`\n  ${index + 1}. ${w.type}警告`));
      console.log(chalk.gray(`    文件: ${w.sourceFile} 第 ${w.lineNumber} 行`));
      console.log(`    订单: ${w.orderId} - ${w.customerName}`);

      if (w.type === '分批归还') {
        console.log(chalk.cyan(`    已归还: ${w.returnedItems}`));
        console.log(chalk.yellow(`    未归还: ${w.missingItems}`));
      }

      if (w.type === '镜头滤镜丢失') {
        console.log(chalk.red(`    赔偿费用: ¥${w.compensationFee}`));
      }

      console.log(chalk.bold.blue(`    建议: ${w.suggestion}`));
    });
    console.log();
  }

  static printExceptions(exceptions) {
    if (exceptions.length === 0) return;

    console.log(chalk.bold.red('【数据异常摘要】'));
    console.log(chalk.gray('  运营同事可根据以下信息直接修改原始数据文件\n'));

    exceptions.forEach((e, index) => {
      console.log(chalk.red(`  ${index + 1}. 数据错误`));
      console.log(chalk.gray(`    来源文件: ${e.sourceFile}`));
      console.log(chalk.gray(`    行号: 第 ${e.lineNumber} 行`));
      console.log(chalk.red(`    错误原因: ${e.error}`));
      console.log(`    订单信息: 订单号=${e.record.orderId || '未知'}, 客户=${e.record.customerName || '未知'}`);
      console.log(chalk.bold.green(`    修复建议: ${e.suggestion}`));
      console.log();
    });
  }

  static async exportResults(settlementResult, outputDir, baseName) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await this.exportSettlementCSV(settlementResult.results, path.join(outputDir, `${baseName}-结算结果.csv`));
    await this.exportWarningsCSV(settlementResult.warnings, path.join(outputDir, `${baseName}-业务预警.csv`));
    await this.exportExceptionsCSV(settlementResult.exceptions, path.join(outputDir, `${baseName}-数据异常.csv`));

    console.log(chalk.green(`\n✓ 结果已导出到: ${outputDir}`));
  }

  static async exportSettlementCSV(results, filePath) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'orderId', title: '订单号' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'cameraModel', title: '相机型号' },
        { id: 'lensModel', title: '镜头型号' },
        { id: 'rentalStart', title: '租用开始日期' },
        { id: 'rentalEnd', title: '租用结束日期' },
        { id: 'actualReturn', title: '实际归还日期' },
        { id: 'plannedDays', title: '计划天数' },
        { id: 'actualDays', title: '实际天数' },
        { id: 'overdueDays', title: '逾期天数' },
        { id: 'dailyRate', title: '日租金' },
        { id: 'baseRental', title: '基础租金' },
        { id: 'overdueFee', title: '逾期费用' },
        { id: 'compensation', title: '赔偿费用' },
        { id: 'totalAmount', title: '应收总额' },
        { id: 'deposit', title: '押金' },
        { id: 'refundAmount', title: '应退押金' },
        { id: 'payableAmount', title: '需补差价' },
        { id: 'returnedItems', title: '已归还物品' },
        { id: 'missingItems', title: '缺失物品' },
        { id: 'notes', title: '备注' }
      ]
    });

    const records = results.map(r => ({
      orderId: r.orderId,
      customerName: r.customerName,
      cameraModel: r.cameraModel,
      lensModel: r.lensModel || '',
      rentalStart: r.rentalPeriod.start,
      rentalEnd: r.rentalPeriod.end,
      actualReturn: r.rentalPeriod.actualReturn,
      plannedDays: r.rentalPeriod.plannedDays,
      actualDays: r.rentalPeriod.actualDays,
      overdueDays: r.rentalPeriod.overdueDays,
      dailyRate: r.pricing.dailyRate,
      baseRental: r.pricing.baseRental,
      overdueFee: r.pricing.overdueFee,
      compensation: r.pricing.compensation,
      totalAmount: r.pricing.totalAmount,
      deposit: r.deposit.amount,
      refundAmount: r.deposit.refundAmount,
      payableAmount: r.deposit.payableAmount,
      returnedItems: r.returnStatus.returnedItems,
      missingItems: r.returnStatus.missingItems,
      notes: r.notes
    }));

    await csvWriter.writeRecords(records);
  }

  static async exportWarningsCSV(warnings, filePath) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'sourceFile', title: '来源文件' },
        { id: 'lineNumber', title: '行号' },
        { id: 'type', title: '预警类型' },
        { id: 'orderId', title: '订单号' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'returnedItems', title: '已归还物品' },
        { id: 'missingItems', title: '缺失物品' },
        { id: 'compensationFee', title: '赔偿费用' },
        { id: 'suggestion', title: '处理建议' }
      ]
    });

    await csvWriter.writeRecords(warnings);
  }

  static async exportExceptionsCSV(exceptions, filePath) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'sourceFile', title: '来源文件' },
        { id: 'lineNumber', title: '行号' },
        { id: 'orderId', title: '订单号' },
        { id: 'customerName', title: '客户姓名' },
        { id: 'error', title: '错误原因' },
        { id: 'suggestion', title: '修复建议' }
      ]
    });

    const records = exceptions.map(e => ({
      sourceFile: e.sourceFile,
      lineNumber: e.lineNumber,
      orderId: e.record.orderId || '',
      customerName: e.record.customerName || '',
      error: e.error,
      suggestion: e.suggestion
    }));

    await csvWriter.writeRecords(records);
  }
}

module.exports = ReportGenerator;
