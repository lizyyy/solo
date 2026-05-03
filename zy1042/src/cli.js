#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import chalk from 'chalk';

import { parseOpenAPI, parseSamples } from './parser.js';
import { checkCompatibility, SEVERITY } from './checker.js';
import { validateSamples } from './sample-validator.js';
import {
  generateConsoleSummary,
  generateDetailedConsoleReport,
  generateMarkdownReport,
  generateJSONReport,
  writeReport
} from './reporter.js';
import { isExpectedError, formatErrorForConsole } from './errors.js';

const pkg = JSON.parse(`{
  "version": "1.0.0",
  "name": "api-contract-doctor",
  "description": "OpenAPI 3 兼容性检查工具 - 检查 API 变更对客户端的影响"
}`);

program
  .name('api-contract-doctor')
  .description('OpenAPI 3 兼容性检查工具 - 检查 API 变更对客户端的影响')
  .version(pkg.version);

program
  .command('scan')
  .description('检查旧版和新版 OpenAPI 规范的兼容性，并验证请求样例')
  .option('--old <path>', '旧版 OpenAPI 规范文件路径 (JSON/YAML)')
  .option('--new <path>', '新版 OpenAPI 规范文件路径 (JSON/YAML)')
  .option('--samples <path>', '请求样例 JSON 文件路径')
  .option('--out <path>', '输出报告文件路径 (支持 .md 和 .json 格式)')
  .option('--format <format>', '输出格式 (markdown|json)', 'markdown')
  .option('--verbose, -v', '显示详细报告')
  .option('--no-exit-code', '即使发现问题也返回 0 退出码')
  .action(handleScanCommand);

async function handleScanCommand(options) {
  try {
    const { old: oldPath, new: newPath, samples: samplesPath, out, format, verbose, exitCode } = options;
    
    if (!oldPath && !newPath && !samplesPath) {
      console.error(chalk.red('错误: 至少需要提供 --old/--new 或 --samples 中的一个参数'));
      console.log('');
      console.log('使用示例:');
      console.log('  api-contract-doctor scan --old old.yaml --new new.yaml');
      console.log('  api-contract-doctor scan --new new.yaml --samples requests.json');
      console.log('  api-contract-doctor scan --old old.yaml --new new.yaml --samples requests.json --out report.md');
      process.exit(1);
    }
    
    let oldSpec = null;
    let newSpec = null;
    let samples = null;
    
    if (oldPath) {
      const absOldPath = path.resolve(oldPath);
      console.log(chalk.gray(`  解析旧版规范: ${oldPath}`));
      oldSpec = parseOpenAPI(absOldPath);
    }
    
    if (newPath) {
      const absNewPath = path.resolve(newPath);
      console.log(chalk.gray(`  解析新版规范: ${newPath}`));
      newSpec = parseOpenAPI(absNewPath);
    }
    
    if (samplesPath) {
      const absSamplesPath = path.resolve(samplesPath);
      console.log(chalk.gray(`  解析请求样例: ${samplesPath}`));
      samples = parseSamples(absSamplesPath);
    }
    
    console.log('');
    
    let compatibilityResult = null;
    let sampleResult = null;
    
    if (oldSpec && newSpec) {
      console.log(chalk.gray('  正在检查版本兼容性...'));
      compatibilityResult = checkCompatibility(oldSpec, newSpec);
    }
    
    if (samples && newSpec) {
      console.log(chalk.gray('  正在校验请求样例...'));
      sampleResult = validateSamples(samples, newSpec);
    } else if (samples && !newSpec) {
      console.log(chalk.yellow('  警告: 校验请求样例需要 --new 参数指定新版规范'));
    }
    
    console.log('');
    
    const reportOptions = {
      oldPath,
      newPath,
      samplesPath
    };
    
    const summary = generateConsoleSummary(compatibilityResult, sampleResult, reportOptions);
    console.log(summary);
    
    if (verbose) {
      if (compatibilityResult && compatibilityResult.issues.length > 0) {
        const compatReport = generateDetailedConsoleReport(
          compatibilityResult.issues,
          '版本兼容性问题详情'
        );
        console.log(compatReport);
      }
      
      if (sampleResult && sampleResult.issues.length > 0) {
        const sampleReport = generateDetailedConsoleReport(
          sampleResult.issues,
          '请求样例校验问题详情'
        );
        console.log(sampleReport);
      }
    }
    
    if (out) {
      const absOutPath = path.resolve(out);
      const ext = path.extname(absOutPath).toLowerCase();
      
      let reportContent;
      let outputFormat = format;
      
      if (ext === '.json' || (outputFormat === 'json')) {
        reportContent = generateJSONReport(compatibilityResult, sampleResult, reportOptions);
      } else {
        reportContent = generateMarkdownReport(compatibilityResult, sampleResult, reportOptions);
      }
      
      writeReport(reportContent, absOutPath);
      console.log(`  ${chalk.green('✓')} 报告已写入: ${absOutPath}`);
      console.log('');
    }
    
    let hasCriticalIssues = false;
    
    if (compatibilityResult && compatibilityResult.summary) {
      if (compatibilityResult.summary.bySeverity.critical > 0 || 
          compatibilityResult.summary.bySeverity.high > 0) {
        hasCriticalIssues = true;
      }
    }
    
    if (sampleResult && sampleResult.summary) {
      if (sampleResult.summary.bySeverity.critical > 0 || 
          sampleResult.summary.bySeverity.high > 0) {
        hasCriticalIssues = true;
      }
    }
    
    if (exitCode !== false && hasCriticalIssues) {
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (err) {
    handleError(err);
  }
}

function handleError(err) {
  if (isExpectedError(err)) {
    const { code, message } = formatErrorForConsole(err);
    console.error('');
    console.error(chalk.red('╔═══════════════════════════════════════════════════════════════╗'));
    console.error(chalk.red('║                        错误                                      ║'));
    console.error(chalk.red('╚═══════════════════════════════════════════════════════════════╝'));
    console.error('');
    console.error(`  ${chalk.bold('错误代码:')} ${code}`);
    console.error(`  ${chalk.bold('错误信息:')} ${message}`);
    console.error('');
  } else {
    console.error('');
    console.error(chalk.red('╔═══════════════════════════════════════════════════════════════╗'));
    console.error(chalk.red('║                      未知错误                                    ║'));
    console.error(chalk.red('╚═══════════════════════════════════════════════════════════════╝'));
    console.error('');
    console.error(`  ${chalk.bold('错误:')} ${err.message || err}`);
    console.error('');
    console.error(`  ${chalk.gray('这可能是一个程序 Bug，请报告此问题。')}`);
    console.error('');
    
    if (process.env.DEBUG) {
      console.error(chalk.gray('  详细堆栈:'));
      console.error(chalk.gray(err.stack));
      console.error('');
    }
  }
  
  process.exit(1);
}

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
