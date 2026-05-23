import { parseCLIArgs } from './cli/parser';
import { readVisitFile, readChannelFile } from './io/reader';
import { mergeData } from './core/merger';
import { writeOutput } from './io/writer';
import chalk from 'chalk';

async function main() {
  try {
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('🏢 售楼处来访合并工具'));
    console.log(chalk.cyan('='.repeat(60)));

    const options = parseCLIArgs();

    const visitResult = readVisitFile(options.来访表路径);
    const channelResult = readChannelFile(options.渠道表路径);

    const allBadRecords = [...visitResult.badRecords, ...channelResult.badRecords];

    const result = mergeData(
      visitResult.records,
      channelResult.records,
      allBadRecords,
      visitResult.totalCount,
      channelResult.totalCount
    );

    writeOutput(result, options.输出目录);

  } catch (error) {
    console.error(chalk.red('\n❌ 程序运行出错:'));
    console.error(chalk.red(`  ${(error as Error).message}`));
    console.error(chalk.gray('\n  请检查输入文件格式和路径是否正确\n'));
    process.exit(1);
  }
}

main();
