#!/usr/bin/env node
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const LeaseConflictChecker = require('./index');

const argv = yargs(hideBin(process.argv))
  .command('check', '检测租赁订单续租冲突', {
    input: {
      description: '输入目录路径',
      alias: 'i',
      type: 'string',
      demandOption: true
    },
    output: {
      description: '输出报告文件路径',
      alias: 'o',
      type: 'string',
      default: 'lease-conflict-report.json'
    },
    'overwrite': {
      description: '覆盖现有输出文件（默认覆盖，确保结果稳定）',
      type: 'boolean',
      default: true
    }
  })
  .demandCommand(1, '请指定要执行的命令')
  .help()
  .argv;

async function main() {
  const checker = new LeaseConflictChecker({
    outputFile: argv.output,
    overwrite: argv.overwrite
  });

  try {
    const result = await checker.check(argv.input);
    console.log('\n=== 租赁订单续租冲突检测完成 ===');
    console.log(`输入目录: ${argv.input}`);
    console.log(`输出报告: ${argv.output}`);
    console.log(`处理文件数: ${result.summary.totalFiles}`);
    console.log(`有效记录数: ${result.summary.validRecords}`);
    console.log(`发现问题数: ${result.summary.totalIssues}`);
    console.log(`  - 格式错误: ${result.summary.formatErrors}`);
    console.log(`  - 续租重复: ${result.summary.duplicateRenewals}`);
    console.log(`  - 租期重叠: ${result.summary.overlappingLeases}`);
    console.log(`  - 手动续租: ${result.summary.manualRenewals}`);
    console.log(`  - 扣款失败: ${result.summary.paymentFailures}`);
    process.exit(0);
  } catch (error) {
    console.error('检测失败:', error.message);
    process.exit(1);
  }
}

main();