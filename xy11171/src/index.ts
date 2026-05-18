#!/usr/bin/env node

import * as yargs from 'yargs';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ParcelProcessor } from './parcelProcessor';
import { ProcessingResult } from './types';

const processor = new ParcelProcessor();

async function main() {
  const argv = await yargs
    .command('process <files...>', '处理包裹数据文件', (yargs) => {
      return yargs.positional('files', {
        describe: '要处理的CSV文件路径（支持多个文件）',
        type: 'string',
        array: true,
      });
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出报告文件路径',
    })
    .option('fail-fast', {
      type: 'boolean',
      description: '遇到错误时立即停止',
      default: false,
    })
    .demandCommand(1, '请指定要执行的命令')
    .help()
    .argv;

  const command = argv._[0] as string;

  if (command === 'process') {
    const files = argv.files as string[];
    const outputPath = argv.output as string | undefined;
    const failFast = argv['fail-fast'] as boolean;

    console.log(chalk.blue('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue('              快递驿站包裹找回 CLI 工具'));
    console.log(chalk.blue('═══════════════════════════════════════════════════════════════\n'));

    const results: ProcessingResult[] = [];
    let hasError = false;

    for (const file of files) {
      const absolutePath = path.resolve(file);
      console.log(chalk.yellow(`处理文件: ${path.basename(file)}`));
      
      try {
        const result = await processor.processFile(absolutePath);
        results.push(result);

        if (result.success) {
          console.log(chalk.green(`  ✓ 成功处理: ${result.validRecords} 条有效记录`));
          if (result.anomalies.length > 0) {
            console.log(chalk.yellow(`  ⚠ 发现 ${result.anomalies.length} 条异常`));
          }
        } else {
          hasError = true;
          console.log(chalk.red(`  ✗ 处理失败`));
          result.errors.forEach(error => {
            console.log(chalk.red(`    - ${error.message}`));
          });
          
          if (failFast) {
            console.log(chalk.red('\n启用了 fail-fast 模式，停止后续处理'));
            break;
          }
        }
        console.log('');
      } catch (error) {
        hasError = true;
        console.log(chalk.red(`  ✗ 处理异常: ${(error as Error).message}`));
        
        if (failFast) {
          break;
        }
      }
    }

    const report = processor.generateSummaryReport(results);
    console.log(report);

    if (outputPath) {
      const absoluteOutput = path.resolve(outputPath);
      fs.writeFileSync(absoluteOutput, report, 'utf-8');
      console.log(chalk.green(`\n报告已保存至: ${absoluteOutput}`));
    }

    if (hasError) {
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error(chalk.red('执行失败:'), error);
  process.exit(1);
});
