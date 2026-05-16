#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ComposeParser } from './parser';
import { ConflictDetector } from './detector';
import { Reporter } from './reporter';
import { CLIOptions } from './types';

const program = new Command();

program
  .name('compose-port-check')
  .description('检测多个 Docker Compose 文件之间的端口冲突和服务名冲突')
  .version('1.0.0')
  .argument('[paths...]', '要扫描的 Compose 文件或目录路径（默认当前目录）')
  .option('-o, --output <dir>', '输出报告的目录路径', './compose-reports')
  .option('-f, --format <formats...>', '输出格式: json, md, html, all (默认 all)', ['all'])
  .option('-v, --verbose', '显示详细输出信息', false)
  .option('-s, --strict', '严格模式：任何冲突都返回非零退出码', false)
  .action(async (paths: string[], options: CLIOptions) => {
    try {
      const inputPaths = paths.length > 0 ? paths : [process.cwd()];
      
      validateOptions(inputPaths, options);

      const parser = new ComposeParser();
      const detector = new ConflictDetector();
      const reporter = new Reporter(options.output);

      if (options.verbose) {
        console.log(chalk.blue(`🔍 开始扫描路径: ${inputPaths.join(', ')}`));
      }

      const composeFiles = parser.findComposeFiles(inputPaths);

      if (composeFiles.length === 0) {
        console.log(chalk.yellow('⚠️  未找到任何 Docker Compose 文件'));
        process.exit(0);
      }

      if (options.verbose) {
        console.log(chalk.blue(`📄 找到 ${composeFiles.length} 个 Compose 文件:`));
        composeFiles.forEach(f => console.log(`   - ${f}`));
      }

      const parsedFiles = composeFiles.map(file => {
        try {
          return parser.parseFile(file);
        } catch (error: any) {
          console.error(chalk.red(`❌ 解析文件失败: ${file}`));
          console.error(chalk.red(`   ${error.message}`));
          return null;
        }
      }).filter(Boolean);

      const result = detector.detect(parsedFiles as any);
      const suggestions = detector.generateSuggestions(result);

      reporter.printSummary(result, suggestions, options.verbose);

      const outputFiles: string[] = [];

      if (options.format.includes('json') || options.format.includes('all')) {
        outputFiles.push(reporter.writeJsonReport(result, suggestions));
      }

      if (options.format.includes('md') || options.format.includes('all')) {
        outputFiles.push(reporter.writeMarkdownReport(result, suggestions));
      }

      if (options.format.includes('html') || options.format.includes('all')) {
        outputFiles.push(reporter.writeHtmlReport(result, suggestions));
      }

      if (outputFiles.length > 0) {
        console.log(chalk.bold('📁 已生成报告文件:'));
        for (const file of outputFiles) {
          console.log(`   - ${chalk.cyan(file)}`);
        }
        console.log();
      }

      const exitCode = detector.getExitCode(result, options.strict);
      process.exit(exitCode);

    } catch (error: any) {
      console.error(chalk.red(`\n❌ 发生错误: ${error.message}\n`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(2);
    }
  });

function validateOptions(paths: string[], options: CLIOptions): void {
  for (const inputPath of paths) {
    const resolvedPath = path.resolve(inputPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`路径不存在: ${inputPath}`);
    }
  }

  const validFormats = ['json', 'md', 'html', 'all'];
  for (const format of options.format) {
    if (!validFormats.includes(format.toLowerCase())) {
      throw new Error(`不支持的输出格式: ${format}。支持的格式: ${validFormats.join(', ')}`);
    }
  }
}

program.parse(process.argv);