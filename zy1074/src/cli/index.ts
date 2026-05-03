#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { scanProject } from '../core/project-scanner';
import { runHealthCheck } from '../core/health-check';
import { generateFixSuggestions, formatSuggestionsForDisplay } from '../suggestions/fix-suggestions';
import { generateReport } from '../reporters/report-generator';
import { createPackage, PackageOptions } from '../packager/packager';
import { ProjectValidationResult, ProjectConfig } from '../types';

const packageJson = require('../../package.json');

const program = new Command();

program
  .name('subtitle-health-check')
  .description('播客字幕章节校对 CLI 工具 - 字幕交付体检')
  .version(packageJson.version, '-v, --version', '显示版本号')
  .helpOption('-h, --help', '显示帮助信息');

function formatValidationResultForDisplay(result: ProjectValidationResult): string {
  let output = '';
  
  const statusEmoji = result.overallStatus === 'passed' ? '✅' : 
                      result.overallStatus === 'warning' ? '⚠️' : '❌';
  const statusText = result.overallStatus === 'passed' ? '通过' :
                     result.overallStatus === 'warning' ? '存在警告' : '存在错误';
  const statusColor = result.overallStatus === 'passed' ? chalk.green :
                      result.overallStatus === 'warning' ? chalk.yellow : chalk.red;

  output += chalk.bold('\n' + '='.repeat(60) + '\n');
  output += chalk.bold('           🎬 字幕交付体检报告\n');
  output += chalk.bold('='.repeat(60) + '\n\n');

  output += `📅 检查时间: ${result.timestamp}\n`;
  output += `📁 项目路径: ${result.projectPath}\n`;
  output += `📊 整体状态: ${statusColor(statusEmoji + ' ' + statusText)}\n\n`;

  output += '-'.repeat(60) + '\n';
  output += '检查统计\n';
  output += '-'.repeat(60) + '\n\n';
  
  output += `  ${chalk.red('🔴 错误:')} ${result.summary.totalErrors} 项\n`;
  output += `  ${chalk.yellow('🟡 警告:')} ${result.summary.totalWarnings} 项\n`;
  output += `  ${chalk.blue('🔵 信息:')} ${result.summary.totalInfos} 项\n\n`;

  if (result.results.subtitles.length > 0) {
    output += '-'.repeat(60) + '\n';
    output += '🎬 字幕文件检查\n';
    output += '-'.repeat(60) + '\n\n';

    for (const subResult of result.results.subtitles) {
      const subStatus = subResult.passed ? 
        (subResult.warningCount > 0 ? chalk.yellow('⚠️ 存在警告') : chalk.green('✅ 通过')) : 
        chalk.red('❌ 存在错误');
      
      output += `  📄 ${subResult.fileName}\n`;
      output += `     状态: ${subStatus}\n`;
      output += `     统计: ${chalk.red(`错误 ${subResult.errorCount}`)} | ${chalk.yellow(`警告 ${subResult.warningCount}`)}\n`;

      if (subResult.errors.length > 0) {
        output += `\n     问题列表:\n`;
        for (const error of subResult.errors) {
          const severityEmoji = error.severity === 'error' ? '🔴' : 
                                error.severity === 'warning' ? '🟡' : '🔵';
          const timeStr = error.startTimeStr ? `[${error.startTimeStr} - ${error.endTimeStr || ''}] ` : '';
          output += `        ${severityEmoji} ${timeStr}${error.message}\n`;
        }
      }
      output += '\n';
    }
  }

  if (result.results.chapters) {
    output += '-'.repeat(60) + '\n';
    output += '📑 章节文件检查\n';
    output += '-'.repeat(60) + '\n\n';

    const chResult = result.results.chapters;
    const chStatus = chResult.passed ? 
      (chResult.warningCount > 0 ? chalk.yellow('⚠️ 存在警告') : chalk.green('✅ 通过')) : 
      chalk.red('❌ 存在错误');
    
    output += `  📄 ${chResult.fileName}\n`;
    output += `     状态: ${chStatus}\n`;
    output += `     统计: ${chalk.red(`错误 ${chResult.errorCount}`)} | ${chalk.yellow(`警告 ${chResult.warningCount}`)}\n`;

    if (chResult.errors.length > 0) {
      output += `\n     问题列表:\n`;
      for (const error of chResult.errors) {
        const severityEmoji = error.severity === 'error' ? '🔴' : 
                              error.severity === 'warning' ? '🟡' : '🔵';
        const timeStr = error.startTimeStr ? `[${error.startTimeStr} - ${error.endTimeStr || ''}] ` : '';
        output += `        ${severityEmoji} ${timeStr}${error.message}\n`;
      }
    }
    output += '\n';
  }

  if (result.results.adPoints) {
    output += '-'.repeat(60) + '\n';
    output += '📢 广告点位检查\n';
    output += '-'.repeat(60) + '\n\n';

    const adResult = result.results.adPoints;
    const adStatus = adResult.passed ? 
      (adResult.warningCount > 0 ? chalk.yellow('⚠️ 存在警告') : chalk.green('✅ 通过')) : 
      chalk.red('❌ 存在错误');
    
    output += `  📄 ${adResult.fileName}\n`;
    output += `     状态: ${adStatus}\n`;
    output += `     统计: ${chalk.red(`错误 ${adResult.errorCount}`)} | ${chalk.yellow(`警告 ${adResult.warningCount}`)}\n`;

    if (adResult.errors.length > 0) {
      output += `\n     问题列表:\n`;
      for (const error of adResult.errors) {
        const severityEmoji = error.severity === 'error' ? '🔴' : 
                              error.severity === 'warning' ? '🟡' : '🔵';
        const timeStr = error.startTimeStr ? `[${error.startTimeStr} - ${error.endTimeStr || ''}] ` : '';
        output += `        ${severityEmoji} ${timeStr}${error.message}\n`;
      }
    }
    output += '\n';
  }

  output += '='.repeat(60) + '\n';

  return output;
}

program
  .command('validate')
  .description('验证项目中的字幕、章节和广告点位')
  .argument('<projectPath>', '项目目录路径')
  .option('-c, --config <config>', '配置文件路径')
  .option('-v, --verbose', '显示详细信息')
  .action(async (projectPath: string, options: { config?: string; verbose?: boolean }) => {
    try {
      const absolutePath = path.resolve(projectPath);
      
      console.log(chalk.blue(`🔍 扫描项目目录: ${absolutePath}`));
      
      const projectFiles = await scanProject(absolutePath);
      
      console.log(chalk.green(`  ✅ 发现 ${projectFiles.subtitles.length} 个字幕文件`));
      if (projectFiles.chapters) {
        console.log(chalk.green(`  ✅ 发现章节文件: ${path.basename(projectFiles.chapters)}`));
      }
      if (projectFiles.adPoints) {
        console.log(chalk.green(`  ✅ 发现广告点位文件: ${path.basename(projectFiles.adPoints)}`));
      }
      if (projectFiles.deliveryFiles.length > 0) {
        console.log(chalk.green(`  ✅ 发现 ${projectFiles.deliveryFiles.length} 个交付文件`));
      }

      console.log(chalk.blue('\n🔎 开始检查...'));
      
      const result = await runHealthCheck(absolutePath, projectFiles);
      
      console.log(formatValidationResultForDisplay(result));

      process.exit(result.overallStatus === 'failed' ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'));
      if (error instanceof Error) {
        console.error(chalk.red(`   ${error.message}`));
      } else {
        console.error(chalk.red(`   未知错误`));
      }
      console.error('\n使用 --help 查看帮助信息');
      process.exit(1);
    }
  });

program
  .command('fix-suggest')
  .description('生成修复建议')
  .argument('<projectPath>', '项目目录路径')
  .option('-c, --config <config>', '配置文件路径')
  .action(async (projectPath: string, options: { config?: string }) => {
    try {
      const absolutePath = path.resolve(projectPath);
      
      console.log(chalk.blue(`🔍 扫描项目目录: ${absolutePath}`));
      
      const projectFiles = await scanProject(absolutePath);
      
      console.log(chalk.blue('\n🔎 开始检查...'));
      
      const validationResult = await runHealthCheck(absolutePath, projectFiles);
      
      const suggestions = generateFixSuggestions(validationResult);
      
      console.log(formatSuggestionsForDisplay(suggestions));

      process.exit(validationResult.overallStatus === 'failed' ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'));
      if (error instanceof Error) {
        console.error(chalk.red(`   ${error.message}`));
      } else {
        console.error(chalk.red(`   未知错误`));
      }
      process.exit(1);
    }
  });

program
  .command('package')
  .description('打包交付文件')
  .argument('<projectPath>', '项目目录路径')
  .option('-o, --output <outputDir>', '输出目录路径', './output')
  .option('--include-warnings', '即使有警告也打包 (默认: true)')
  .option('--no-include-warnings', '有警告时不打包')
  .option('--copy-source', '复制源文件 (默认: true)')
  .option('--no-copy-source', '不复制源文件')
  .option('--reports', '生成报告 (默认: true)')
  .option('--no-reports', '不生成报告')
  .action(async (projectPath: string, options: { 
    output: string;
    includeWarnings: boolean;
    copySource: boolean;
    reports: boolean;
  }) => {
    try {
      const absolutePath = path.resolve(projectPath);
      const outputDir = path.resolve(options.output);
      
      console.log(chalk.blue(`🔍 扫描项目目录: ${absolutePath}`));
      
      const projectFiles = await scanProject(absolutePath);
      
      console.log(chalk.blue('\n🔎 开始检查...'));
      
      const validationResult = await runHealthCheck(absolutePath, projectFiles);
      
      console.log(formatValidationResultForDisplay(validationResult));
      
      if (validationResult.overallStatus === 'failed' && !options.includeWarnings) {
        console.log(chalk.red('\n❌ 打包失败: 存在错误且 --no-include-warnings 已设置'));
        process.exit(1);
      }

      console.log(chalk.blue(`\n📦 开始打包到: ${outputDir}`));

      let report = undefined;
      if (options.reports) {
        report = generateReport(validationResult);
      }

      const packageOptions: PackageOptions = {
        outputDir,
        includeWarnings: options.includeWarnings,
        copySourceFiles: options.copySource,
        generateReports: options.reports
      };

      const packageResult = await createPackage(
        absolutePath,
        validationResult,
        projectFiles,
        packageOptions,
        report
      );

      console.log(chalk.green('\n✅ 打包完成！'));
      console.log(chalk.blue(`   输出目录: ${packageResult.outputDir}`));
      
      const copiedCount = packageResult.files.filter(f => f.status === 'copied').length;
      const errorCount = packageResult.files.filter(f => f.status === 'error').length;
      
      console.log(chalk.green(`   复制文件: ${copiedCount} 个`));
      if (errorCount > 0) {
        console.log(chalk.red(`   复制失败: ${errorCount} 个`));
      }

      if (options.reports) {
        console.log(chalk.blue('\n📄 生成的报告:'));
        if (packageResult.reports.markdown) {
          console.log(chalk.green(`   - ${path.relative(outputDir, packageResult.reports.markdown)}`));
        }
        if (packageResult.reports.json) {
          console.log(chalk.green(`   - ${path.relative(outputDir, packageResult.reports.json)}`));
        }
        if (packageResult.reports.html) {
          console.log(chalk.green(`   - ${path.relative(outputDir, packageResult.reports.html)}`));
        }
      }

      console.log(chalk.blue('\n📋 打包清单:'));
      console.log(`   包含文件: ${packageResult.manifest.includedFiles.length} 个`);
      console.log(`   排除文件: ${packageResult.manifest.excludedFiles.length} 个`);

      process.exit(validationResult.overallStatus === 'failed' ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'));
      if (error instanceof Error) {
        console.error(chalk.red(`   ${error.message}`));
      } else {
        console.error(chalk.red(`   未知错误`));
      }
      process.exit(1);
    }
  });

program
  .command('export-report')
  .description('导出检查报告')
  .argument('<projectPath>', '项目目录路径')
  .option('-o, --output <outputDir>', '输出目录路径', './reports')
  .option('-f, --format <format>', '输出格式: all, markdown, json, html', 'all')
  .action(async (projectPath: string, options: { output: string; format: string }) => {
    try {
      const absolutePath = path.resolve(projectPath);
      const outputDir = path.resolve(options.output);
      
      await fs.ensureDir(outputDir);
      
      console.log(chalk.blue(`🔍 扫描项目目录: ${absolutePath}`));
      
      const projectFiles = await scanProject(absolutePath);
      
      console.log(chalk.blue('\n🔎 开始检查...'));
      
      const validationResult = await runHealthCheck(absolutePath, projectFiles);
      
      console.log(formatValidationResultForDisplay(validationResult));

      console.log(chalk.blue(`\n📄 生成报告到: ${outputDir}`));

      const report = generateReport(validationResult);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `health-check-report-${timestamp}`;

      const formats = options.format.toLowerCase().split(',');
      const exportAll = formats.includes('all') || formats.length === 0;

      if (exportAll || formats.includes('markdown')) {
        const mdPath = path.join(outputDir, `${baseName}.md`);
        await fs.writeFile(mdPath, report.markdown, 'utf-8');
        console.log(chalk.green(`   ✅ Markdown: ${path.relative(outputDir, mdPath)}`));
      }

      if (exportAll || formats.includes('json')) {
        const jsonPath = path.join(outputDir, `${baseName}.json`);
        await fs.writeFile(jsonPath, report.json, 'utf-8');
        console.log(chalk.green(`   ✅ JSON: ${path.relative(outputDir, jsonPath)}`));
      }

      if (exportAll || formats.includes('html')) {
        const htmlPath = path.join(outputDir, `${baseName}.html`);
        await fs.writeFile(htmlPath, report.html, 'utf-8');
        console.log(chalk.green(`   ✅ HTML: ${path.relative(outputDir, htmlPath)}`));
      }

      console.log(chalk.green('\n✅ 报告导出完成！'));

      process.exit(validationResult.overallStatus === 'failed' ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ 错误:'));
      if (error instanceof Error) {
        console.error(chalk.red(`   ${error.message}`));
      } else {
        console.error(chalk.red(`   未知错误`));
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.outputHelp();
}
