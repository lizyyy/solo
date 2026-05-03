#!/usr/bin/env node

import * as yargs from 'yargs';
import * as path from 'path';
import chalk from 'chalk';
import { RuleParser, RuleMatcher } from './rules';
import { FileScanner } from './scanner';
import { FileExecutor } from './executor';
import { UndoManager } from './undo';
import { ReportGenerator } from './report';
import { ArchiveOptions, ReportFormat, ReportData } from './types';

const parser = new RuleParser();
const reportGenerator = new ReportGenerator();
const undoManager = new UndoManager();

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function printScanResult(result: any): void {
  console.log('\n' + chalk.bold.blue('📊 扫描结果'));
  console.log(chalk.dim('─'.repeat(60)));
  
  console.log(`\n${chalk.bold('📁 总文件数:')} ${chalk.green(result.totalFiles)}`);
  console.log(`${chalk.bold('✅ 已匹配:')} ${chalk.green(result.matchedFiles.length)}`);
  console.log(`${chalk.bold('⚠️ 无匹配:')} ${chalk.yellow(result.unmatchedFiles.length)}`);
  console.log(`${chalk.bold('🔄 潜在重复:')} ${chalk.yellow(result.duplicateFiles.length)} 组`);
  console.log(`${chalk.bold('⚡ 潜在冲突:')} ${chalk.red(result.potentialConflicts.length)}`);

  if (result.matchedFiles.length > 0) {
    console.log('\n' + chalk.bold.green('📋 已匹配文件:'));
    console.log(chalk.dim('─'.repeat(60)));
    
    for (const file of result.matchedFiles.slice(0, 10)) {
      console.log(`  ${chalk.cyan(file.name)}`);
      console.log(`    规则: ${chalk.magenta(file.ruleName)}`);
      console.log(`    目标: ${chalk.gray(file.destinationPath)}`);
      console.log(`    大小: ${chalk.gray(formatSize(file.size))}`);
      console.log();
    }
    
    if (result.matchedFiles.length > 10) {
      console.log(`  ... 还有 ${chalk.gray(result.matchedFiles.length - 10)} 个文件`);
    }
  }

  if (result.unmatchedFiles.length > 0) {
    console.log('\n' + chalk.bold.yellow('⚠️ 无匹配规则的文件:'));
    console.log(chalk.dim('─'.repeat(60)));
    
    for (const file of result.unmatchedFiles.slice(0, 10)) {
      console.log(`  ${chalk.yellow(file.name)} (${chalk.gray(formatSize(file.size))})`);
    }
    
    if (result.unmatchedFiles.length > 10) {
      console.log(`  ... 还有 ${chalk.gray(result.unmatchedFiles.length - 10)} 个文件`);
    }
  }

  if (result.duplicateFiles.length > 0) {
    console.log('\n' + chalk.bold.magenta('🔄 潜在重复文件:'));
    console.log(chalk.dim('─'.repeat(60)));
    
    for (const group of result.duplicateFiles.slice(0, 5)) {
      console.log(`\n  ${chalk.bold(`分组: ${group.hash.substring(0, 20)}...`)}`);
      for (const file of group.files) {
        console.log(`    - ${chalk.gray(file)}`);
      }
    }
    
    if (result.duplicateFiles.length > 5) {
      console.log(`\n  ... 还有 ${chalk.gray(result.duplicateFiles.length - 5)} 组`);
    }
  }

  if (result.potentialConflicts.length > 0) {
    console.log('\n' + chalk.bold.red('⚡ 潜在冲突:'));
    console.log(chalk.dim('─'.repeat(60)));
    
    for (const conflict of result.potentialConflicts.slice(0, 5)) {
      console.log(`\n  ${chalk.red('冲突:')}`);
      console.log(`    源文件: ${chalk.gray(conflict.originalPath)}`);
      console.log(`    目标: ${chalk.gray(conflict.targetPath)}`);
      console.log(`    策略: ${chalk.yellow(conflict.strategy)}`);
    }
    
    if (result.potentialConflicts.length > 5) {
      console.log(`\n  ... 还有 ${chalk.gray(result.potentialConflicts.length - 5)} 个冲突`);
    }
  }
}

function printExecutionResult(result: any): void {
  console.log('\n' + chalk.bold.blue('📊 执行结果'));
  console.log(chalk.dim('─'.repeat(60)));
  
  console.log(`\n${chalk.bold('✅ 成功:')} ${chalk.green(result.successfulOperations)}`);
  console.log(`${chalk.bold('❌ 失败:')} ${chalk.red(result.failedOperations)}`);
  console.log(`${chalk.bold('⏭️ 跳过:')} ${chalk.yellow(result.skippedOperations)}`);

  if (result.errors && result.errors.length > 0) {
    console.log('\n' + chalk.bold.red('❌ 错误详情:'));
    for (const error of result.errors) {
      console.log(`  - ${chalk.red(error)}`);
    }
  }

  if (result.manifest) {
    console.log('\n' + chalk.bold.magenta('📋 Manifest 信息:'));
    console.log(`  ID: ${chalk.cyan(result.manifest.id)}`);
    console.log(`  时间: ${chalk.gray(result.manifest.timestamp)}`);
    console.log(`  源目录: ${chalk.gray(result.manifest.sourceDirectory)}`);
  }
}

function printUndoResult(result: any): void {
  console.log('\n' + chalk.bold.blue('📊 撤销结果'));
  console.log(chalk.dim('─'.repeat(60)));
  
  console.log(`\n${chalk.bold('Manifest ID:')} ${chalk.cyan(result.manifestId)}`);
  console.log(`${chalk.bold('总记录数:')} ${chalk.green(result.totalEntries)}`);
  console.log(`${chalk.bold('✅ 成功恢复:')} ${chalk.green(result.successfulRestores)}`);
  console.log(`${chalk.bold('❌ 失败:')} ${chalk.red(result.failedRestores)}`);
  console.log(`${chalk.bold('⏭️ 跳过:')} ${chalk.yellow(result.skippedRestores)}`);

  if (result.errors && result.errors.length > 0) {
    console.log('\n' + chalk.bold.red('❌ 错误详情:'));
    for (const error of result.errors) {
      console.log(`  - ${chalk.red(error)}`);
    }
  }

  if (result.restoredFiles && result.restoredFiles.length > 0) {
    console.log('\n' + chalk.bold.green('✅ 已恢复文件:'));
    for (const file of result.restoredFiles.slice(0, 10)) {
      console.log(`  ${chalk.gray(file.current)}`);
    }
    if (result.restoredFiles.length > 10) {
      console.log(`  ... 还有 ${chalk.gray(result.restoredFiles.length - 10)} 个文件`);
    }
  }
}

const argv = yargs
  .scriptName('file-archiver')
  .usage('$0 <command> [options]')
  .command(
    'scan <directory> <rules>',
    '扫描目录并预览将执行的操作（dry-run 模式）',
    (yargs) => {
      return yargs
        .positional('directory', {
          describe: '要扫描的目录路径',
          type: 'string',
          demandOption: true
        })
        .positional('rules', {
          describe: '规则文件路径（YAML 或 JSON）',
          type: 'string',
          demandOption: true
        })
        .option('hash', {
          alias: 'H',
          describe: '计算文件哈希用于检测重复',
          type: 'boolean',
          default: false
        })
        .option('report', {
          alias: 'r',
          describe: '生成报告',
          type: 'string',
          choices: ['json', 'markdown', 'html'],
          demandOption: false
        })
        .option('output', {
          alias: 'o',
          describe: '报告输出路径',
          type: 'string',
          demandOption: false
        })
        .option('verbose', {
          alias: 'v',
          describe: '显示详细信息',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      try {
        console.log(chalk.bold.blue('🔍 扫描目录...'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`\n${chalk.bold('目录:')} ${argv.directory}`);
        console.log(`${chalk.bold('规则:')} ${argv.rules}`);

        const rulesConfig = await parser.parseFile(argv.rules);
        const scanner = new FileScanner(rulesConfig);
        const result = await scanner.scan(argv.directory, {
          calculateHash: argv.hash,
          verbose: argv.verbose
        });

        printScanResult(result);

        if (argv.report) {
          const reportData: ReportData = {
            type: 'scan',
            timestamp: new Date().toISOString(),
            scanResult: result
          };

          const content = await reportGenerator.generate(
            reportData,
            argv.report as ReportFormat,
            argv.output
          );

          if (!argv.output) {
            console.log('\n' + chalk.bold.magenta('📄 报告:'));
            console.log(content);
          } else {
            console.log(`\n${chalk.bold.green('✅ 报告已保存:')} ${argv.output}`);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ 错误: ${error.message}`));
        process.exit(1);
      }
    }
  )
  .command(
    'run <directory> <rules>',
    '执行归档操作',
    (yargs) => {
      return yargs
        .positional('directory', {
          describe: '要归档的目录路径',
          type: 'string',
          demandOption: true
        })
        .positional('rules', {
          describe: '规则文件路径（YAML 或 JSON）',
          type: 'string',
          demandOption: true
        })
        .option('dry-run', {
          alias: 'd',
          describe: '预览操作而不实际执行',
          type: 'boolean',
          default: true
        })
        .option('operation', {
          alias: 'o',
          describe: '操作类型',
          type: 'string',
          choices: ['move', 'copy'],
          default: 'move'
        })
        .option('conflict', {
          alias: 'c',
          describe: '冲突处理策略',
          type: 'string',
          choices: ['rename', 'skip', 'error'],
          default: 'rename'
        })
        .option('manifest', {
          alias: 'm',
          describe: 'Manifest 输出路径',
          type: 'string',
          demandOption: false
        })
        .option('hash', {
          alias: 'H',
          describe: '计算文件哈希',
          type: 'boolean',
          default: true
        })
        .option('report', {
          alias: 'r',
          describe: '生成报告',
          type: 'string',
          choices: ['json', 'markdown', 'html'],
          demandOption: false
        })
        .option('report-output', {
          alias: 'R',
          describe: '报告输出路径',
          type: 'string',
          demandOption: false
        })
        .option('verbose', {
          alias: 'v',
          describe: '显示详细信息',
          type: 'boolean',
          default: false
        })
        .option('force', {
          alias: 'f',
          describe: '强制执行（禁用 dry-run）',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      try {
        const dryRun = argv.force ? false : argv.dryRun;

        console.log(chalk.bold.blue('📦 执行归档...'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`\n${chalk.bold('目录:')} ${argv.directory}`);
        console.log(`${chalk.bold('规则:')} ${argv.rules}`);
        console.log(`${chalk.bold('模式:')} ${dryRun ? chalk.yellow('预览 (dry-run)') : chalk.green('执行')}`);
        console.log(`${chalk.bold('操作:')} ${argv.operation === 'move' ? '移动' : '复制'}`);
        console.log(`${chalk.bold('冲突策略:')} ${argv.conflict}`);

        const rulesConfig = await parser.parseFile(argv.rules);
        const scanner = new FileScanner(rulesConfig);
        const executor = new FileExecutor(scanner);

        const options: ArchiveOptions = {
          dryRun,
          operation: argv.operation as 'move' | 'copy',
          conflictStrategy: argv.conflict as 'rename' | 'skip' | 'error',
          outputManifest: argv.manifest,
          calculateHash: argv.hash,
          verbose: argv.verbose
        };

        const result = await executor.execute(argv.directory, options);

        if (dryRun) {
          printScanResult(result);
        } else {
          printExecutionResult(result);
        }

        if (argv.report) {
          const reportData: ReportData = {
            type: dryRun ? 'scan' : 'execution',
            timestamp: new Date().toISOString(),
            scanResult: result,
            executionResult: dryRun ? undefined : result,
            manifest: result.manifest
          };

          const content = await reportGenerator.generate(
            reportData,
            argv.report as ReportFormat,
            argv.reportOutput
          );

          if (!argv.reportOutput) {
            console.log('\n' + chalk.bold.magenta('📄 报告:'));
            console.log(content);
          } else {
            console.log(`\n${chalk.bold.green('✅ 报告已保存:')} ${argv.reportOutput}`);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ 错误: ${error.message}`));
        process.exit(1);
      }
    }
  )
  .command(
    'undo <manifest>',
    '撤销之前的归档操作',
    (yargs) => {
      return yargs
        .positional('manifest', {
          describe: 'Manifest 文件路径',
          type: 'string',
          demandOption: true
        })
        .option('dry-run', {
          alias: 'd',
          describe: '预览操作而不实际执行',
          type: 'boolean',
          default: false
        })
        .option('report', {
          alias: 'r',
          describe: '生成报告',
          type: 'string',
          choices: ['json', 'markdown', 'html'],
          demandOption: false
        })
        .option('output', {
          alias: 'o',
          describe: '报告输出路径',
          type: 'string',
          demandOption: false
        })
        .option('verbose', {
          alias: 'v',
          describe: '显示详细信息',
          type: 'boolean',
          default: false
        });
    },
    async (argv) => {
      try {
        console.log(chalk.bold.blue('↩️ 撤销操作...'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(`\n${chalk.bold('Manifest:')} ${argv.manifest}`);
        console.log(`${chalk.bold('模式:')} ${argv.dryRun ? chalk.yellow('预览 (dry-run)') : chalk.green('执行')}`);

        const manifest = await undoManager.loadManifest(argv.manifest);
        const result = await undoManager.undo(manifest, argv.dryRun);

        printUndoResult(result);

        if (argv.report) {
          const reportData: ReportData = {
            type: 'undo',
            timestamp: new Date().toISOString(),
            manifest,
            undoResult: result
          };

          const content = await reportGenerator.generate(
            reportData,
            argv.report as ReportFormat,
            argv.output
          );

          if (!argv.output) {
            console.log('\n' + chalk.bold.magenta('📄 报告:'));
            console.log(content);
          } else {
            console.log(`\n${chalk.bold.green('✅ 报告已保存:')} ${argv.output}`);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ 错误: ${error.message}`));
        process.exit(1);
      }
    }
  )
  .command(
    'report <type> <input>',
    '从 manifest 或扫描结果生成报告',
    (yargs) => {
      return yargs
        .positional('type', {
          describe: '报告类型',
          type: 'string',
          choices: ['manifest', 'scan'],
          demandOption: true
        })
        .positional('input', {
          describe: '输入文件路径（manifest 或扫描结果 JSON）',
          type: 'string',
          demandOption: true
        })
        .option('format', {
          alias: 'f',
          describe: '报告格式',
          type: 'string',
          choices: ['json', 'markdown', 'html'],
          default: 'markdown'
        })
        .option('output', {
          alias: 'o',
          describe: '输出路径',
          type: 'string',
          demandOption: false
        });
    },
    async (argv) => {
      try {
        console.log(chalk.bold.blue('📄 生成报告...'));
        console.log(chalk.gray('─'.repeat(60)));

        const fs = require('fs-extra');
        const content = await fs.readFile(argv.input, 'utf-8');
        const data = JSON.parse(content);

        let reportData: ReportData;

        if (argv.type === 'manifest') {
          reportData = {
            type: 'execution',
            timestamp: data.timestamp || new Date().toISOString(),
            manifest: data
          };
        } else {
          reportData = {
            type: 'scan',
            timestamp: new Date().toISOString(),
            scanResult: data
          };
        }

        const report = await reportGenerator.generate(
          reportData,
          argv.format as ReportFormat,
          argv.output
        );

        if (!argv.output) {
          console.log(report);
        } else {
          console.log(`\n${chalk.bold.green('✅ 报告已保存:')} ${argv.output}`);
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ 错误: ${error.message}`));
        process.exit(1);
      }
    }
  )
  .example('$0 scan ./Downloads ./rules.yaml', '扫描下载目录并预览')
  .example('$0 run ./Downloads ./rules.yaml --force', '执行归档操作')
  .example('$0 undo ./manifest_xxx.json', '撤销之前的归档')
  .example('$0 run ./Downloads ./rules.yaml --report html --report-output ./report.html', '执行并生成 HTML 报告')
  .demandCommand(1, '请指定一个命令')
  .help('h')
  .alias('h', 'help')
  .version()
  .epilog('文件归档工具 - 让你的下载目录井井有条')
  .argv;
