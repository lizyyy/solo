#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';

import {
  parseDeviceProfiles,
  parseCalibrationRecords,
  parseBatchRecords,
  parseSerialLog,
} from './parser';

import { runAnalysis } from './rules';

import {
  generateIssuesCsv,
  generateWeighingReport,
  generateHtmlTimeline,
} from './reporter';

const program = new Command();

program
  .name('weighing-analyzer')
  .description('离线回放串口称重仪表日志分析工具')
  .version('1.0.0')
  .option('--log <path>', '串口日志文件路径 (serial.log)')
  .option('--profiles <path>', '设备配置文件路径 (device_profiles.yaml)')
  .option('--calibration <path>', '校准记录文件路径 (calibration.csv)')
  .option('--batches <path>', '批次记录文件路径 (batches.csv)')
  .option('--output <dir>', '输出目录路径', './output')
  .option('--demo', '使用示例数据运行演示')
  .parse(process.argv);

interface CliOptions {
  log?: string;
  profiles?: string;
  calibration?: string;
  batches?: string;
  output: string;
  demo?: boolean;
}

async function main() {
  const options = program.opts<CliOptions>();
  
  console.log(chalk.blue.bold('\n称重日志分析工具 v1.0.0\n'));

  if (options.demo) {
    console.log(chalk.yellow('运行演示模式...\n'));
    const samplesDir = path.join(__dirname, '..', 'samples');
    options.log = path.join(samplesDir, 'serial.log');
    options.profiles = path.join(samplesDir, 'device_profiles.yaml');
    options.calibration = path.join(samplesDir, 'calibration.csv');
    options.batches = path.join(samplesDir, 'batches.csv');
  }

  validateOptions(options);

  console.log(chalk.blue('正在加载配置文件...'));
  
  try {
    const logContent = readFileOrThrow(options.log, '串口日志');
    const profilesContent = readFileOrThrow(options.profiles, '设备配置');
    const calibrationContent = readFileOrThrow(options.calibration, '校准记录');
    const batchesContent = readFileOrThrow(options.batches, '批次记录');

    console.log(chalk.green('✓ 所有配置文件加载成功'));

    console.log(chalk.blue('\n正在解析数据...'));
    
    const deviceProfiles = parseDeviceProfiles(profilesContent);
    console.log(chalk.green(`✓ 解析到 ${deviceProfiles.length} 个工位配置`));

    const calibrationRecords = parseCalibrationRecords(calibrationContent);
    console.log(chalk.green(`✓ 解析到 ${calibrationRecords.length} 条校准记录`));

    const batchRecords = parseBatchRecords(batchesContent);
    console.log(chalk.green(`✓ 解析到 ${batchRecords.length} 个批次记录`));

    const { frames, issues: parseIssues } = parseSerialLog(logContent, deviceProfiles);
    console.log(chalk.green(`✓ 解析到 ${frames.length} 个数据帧`));
    if (parseIssues.length > 0) {
      console.log(chalk.yellow(`  ⚠ 解析过程中发现 ${parseIssues.length} 个问题`));
    }

    console.log(chalk.blue('\n正在运行分析引擎...'));
    
    const analysisResult = runAnalysis({
      frames,
      deviceProfiles,
      calibrationRecords,
      batchRecords,
      currentTime: new Date(),
    });

    const allIssues = [...parseIssues, ...analysisResult.issues];
    console.log(chalk.green('✓ 分析完成'));
    console.log(`  - 称重事件: ${analysisResult.summary.weighingEvents}`);
    console.log(`  - 问题总数: ${allIssues.length}`);

    if (allIssues.length > 0) {
      const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
      const highCount = allIssues.filter(i => i.severity === 'high').length;
      
      if (criticalCount > 0 || highCount > 0) {
        console.log(chalk.red(`  ⚠ 严重/高优先级问题: ${criticalCount + highCount}`));
      }
    }

    console.log(chalk.blue('\n正在生成报告...'));
    
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
      console.log(chalk.green(`✓ 创建输出目录: ${options.output}`));
    }

    const issuesCsvPath = path.join(options.output, 'issues.csv');
    fs.writeFileSync(issuesCsvPath, generateIssuesCsv(allIssues));
    console.log(chalk.green(`✓ 生成问题报告: ${issuesCsvPath}`));

    const reportPath = path.join(options.output, 'weighing_report.md');
    fs.writeFileSync(reportPath, generateWeighingReport({
      ...analysisResult,
      issues: allIssues,
    }));
    console.log(chalk.green(`✓ 生成详细报告: ${reportPath}`));

    const timelinePath = path.join(options.output, 'timeline.html');
    fs.writeFileSync(timelinePath, generateHtmlTimeline({
      ...analysisResult,
      issues: allIssues,
    }));
    console.log(chalk.green(`✓ 生成时间线视图: ${timelinePath}`));

    console.log(chalk.bold.green('\n✓ 分析完成！'));
    console.log(chalk.blue(`\n输出文件:`));
    console.log(`  - ${path.relative(process.cwd(), issuesCsvPath)}`);
    console.log(`  - ${path.relative(process.cwd(), reportPath)}`);
    console.log(`  - ${path.relative(process.cwd(), timelinePath)}`);

    if (allIssues.length > 0) {
      console.log(chalk.yellow(`\n检测到 ${allIssues.length} 个问题，请查看报告了解详情。`));
    } else {
      console.log(chalk.green('\n所有数据检查通过，未发现任何问题！'));
    }

    console.log('');

  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error(chalk.red(`\n✗ 错误: ${message}`));
    
    if (error instanceof Error && error.stack) {
      console.error(chalk.gray('\n详细信息:'));
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

function validateOptions(options: CliOptions): void {
  const missing: string[] = [];
  
  if (!options.log) missing.push('--log <串口日志文件>');
  if (!options.profiles) missing.push('--profiles <设备配置文件>');
  if (!options.calibration) missing.push('--calibration <校准记录文件>');
  if (!options.batches) missing.push('--batches <批次记录文件>');

  if (missing.length > 0) {
    console.error(chalk.red('错误: 缺少必需的参数:'));
    missing.forEach(m => console.error(chalk.red(`  - ${m}`)));
    console.error(chalk.yellow('\n使用 --help 查看帮助信息，或使用 --demo 运行演示。'));
    process.exit(1);
  }
}

function readFileOrThrow(filePath: string | undefined, description: string): string {
  if (!filePath) {
    throw new Error(`${description}文件路径未指定`);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`${description}文件不存在: ${filePath}`);
  }

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取失败';
    throw new Error(`无法读取${description}文件 ${filePath}: ${message}`);
  }
}

main().catch((error) => {
  console.error(chalk.red('未处理的错误:'), error);
  process.exit(1);
});
