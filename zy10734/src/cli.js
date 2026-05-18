#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const CsvHandler = require('./csvHandler');
const CompensationCalculator = require('./calculator');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('用法: $0 [选项]')
    .option('redispatch', {
      alias: 'r',
      describe: '改派记录 CSV 文件路径',
      type: 'string',
      demandOption: true,
      default: './data/redispatch_records.csv'
    })
    .option('settlement', {
      alias: 's',
      describe: '骑手结算 CSV 文件路径',
      type: 'string',
      demandOption: true,
      default: './data/rider_settlements.csv'
    })
    .option('rejection', {
      alias: 'j',
      describe: '拒单原因 CSV 文件路径',
      type: 'string',
      demandOption: true,
      default: './data/rejection_reasons.csv'
    })
    .option('output', {
      alias: 'o',
      describe: '输出核算结果 CSV 文件路径',
      type: 'string',
      default: './output/compensation_results.csv'
    })
    .option('error-output', {
      alias: 'e',
      describe: '错误日志输出路径',
      type: 'string',
      default: './output/error_log.csv'
    })
    .example('$0 -r ./data/redispatch.csv -s ./data/settlement.csv -j ./data/rejection.csv', '核算骑手补偿')
    .help('h')
    .alias('h', 'help')
    .epilog('配送改派记录骑手补偿核算 CLI v1.0.0')
    .argv;

  console.log('========================================');
  console.log('  配送改派记录骑手补偿核算 CLI');
  console.log('========================================\n');

  try {
    console.log('[1/4] 正在读取输入文件...\n');
    
    const [redispatchRecords, riderSettlements, rejectionReasons] = await Promise.all([
      CsvHandler.readRedispatchRecords(argv.redispatch),
      CsvHandler.readRiderSettlements(argv.settlement),
      CsvHandler.readRejectionReasons(argv.rejection)
    ]);

    console.log(`✓ 改派记录: ${redispatchRecords.length} 条`);
    console.log(`✓ 骑手结算记录: ${riderSettlements.length} 条`);
    console.log(`✓ 拒单原因配置: ${rejectionReasons.length} 条\n`);

    if (redispatchRecords.length === 0) {
      console.warn('⚠ 警告: 改派记录为空');
    }

    console.log('[2/4] 正在核算补偿金额...\n');
    
    const calculator = new CompensationCalculator(
      redispatchRecords,
      riderSettlements,
      rejectionReasons
    );

    const { results, errors, summary } = calculator.calculate();

    console.log('[3/4] 核算统计信息：\n');
    console.log(`  总记录数: ${summary.totalRecords}`);
    console.log(`  核算成功: ${summary.totalRecords - summary.errorRecords}`);
    console.log(`  核算失败: ${summary.errorRecords}`);
    console.log(`  重复记录: ${summary.duplicateRecords}`);
    console.log(`  实际补偿记录: ${summary.compensatedRecords}`);
    console.log(`  跳过补偿记录: ${summary.skippedRecords}`);
    console.log(`  补偿总金额: ¥${summary.totalCompensation.toFixed(2)}\n`);

    if (errors.length > 0) {
      console.log('[错误明细]');
      errors.forEach(err => {
        console.log(`  行 ${err.recordIndex + 1} [${err.orderId}]: ${err.error}`);
      });
      console.log('');
    }

    console.log('[4/4] 正在写入输出文件...\n');

    const path = require('path');
    const fs = require('fs');
    const outputDir = path.dirname(argv.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await Promise.all([
      CsvHandler.writeCompensationResults(argv.output, results, summary),
      errors.length > 0 ? CsvHandler.writeErrorLog(argv.errorOutput, errors) : Promise.resolve()
    ]);

    console.log(`✓ 核算结果已保存到: ${argv.output}`);
    if (errors.length > 0) {
      console.log(`✓ 错误日志已保存到: ${argv.errorOutput}`);
    }

    console.log('\n========================================');
    console.log('  配送改派补偿核算完成!');
    console.log('========================================\n');

    console.log('补偿状态分布:');
    const statusGroups = {};
    results.forEach(r => {
      statusGroups[r.compensationStatus] = (statusGroups[r.compensationStatus] || 0) + 1;
    });
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} 条`);
    });

  } catch (error) {
    console.error('\n❌ 程序执行出错:');
    console.error(`  ${error.message}\n`);
    
    if (error.message.includes('文件不存在')) {
      console.error('请检查文件路径是否正确，或使用 --help 查看帮助信息');
    }
    
    process.exit(1);
  }
}

main();
