#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';

import { Scanner } from './scanner';
import { Parser } from './parser';
import { Validator } from './validator';
import { SnippetRunner } from './snippet-runner';
import { Reporter } from './reporter';
import { Config, defaultConfig, ParsedDocument } from './types';
import { readFileAsync, ensureDirAsync, normalizePath } from './utils';

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);
const VERSION = packageJson.version;

function loadConfig(configPath?: string): Config {
  let config: Config = { ...defaultConfig };

  const possibleConfigPaths = [
    configPath,
    '.course-checker.json',
    '.course-checker.config.json',
    'course-checker.json',
  ].filter(Boolean) as string[];

  for (const cfgPath of possibleConfigPaths) {
    const fullPath = path.resolve(cfgPath);
    if (fs.existsSync(fullPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        config = {
          ...defaultConfig,
          ...userConfig,
          ignore: {
            ...defaultConfig.ignore,
            ...userConfig.ignore,
          },
          validation: {
            ...defaultConfig.validation,
            ...userConfig.validation,
          },
          execution: {
            ...defaultConfig.execution,
            ...userConfig.execution,
          },
          report: {
            ...defaultConfig.report,
            ...userConfig.report,
          },
        };
        console.log(chalk.gray(`已加载配置: ${fullPath}`));
        break;
      } catch (error) {
        console.error(chalk.red(`加载配置文件失败: ${fullPath}`));
      }
    }
  }

  return config;
}

async function scanAndParseDocuments(
  rootPath: string,
  config: Config
): Promise<Map<string, ParsedDocument>> {
  const scanner = new Scanner({
    rootPath,
    ignorePatterns: config.ignore.patterns,
  });

  const docFiles = await scanner.scanDocuments();
  const parser = new Parser({ basePath: rootPath });
  const documents = new Map<string, ParsedDocument>();

  for (const docFile of docFiles) {
    const fullPath = path.join(rootPath, docFile);
    const content = await readFileAsync(fullPath);

    let doc: ParsedDocument;
    if (docFile.endsWith('.md') || docFile.endsWith('.markdown')) {
      doc = await parser.parseMarkdown(content, docFile);
    } else {
      doc = await parser.parseHtml(content, docFile);
    }

    documents.set(docFile, doc);
  }

  return documents;
}

const program = new Command();

program
  .name('course-checker')
  .description('课程讲义检查工具 - 扫描、验证、测试代码片段并生成报告')
  .version(VERSION);

program
  .command('scan')
  .description('递归扫描课程目录，列出所有文件')
  .argument('[path]', '课程目录路径', '.')
  .option('-c, --config <path>', '配置文件路径')
  .option('--json', '以 JSON 格式输出')
  .option('--summary', '只显示汇总信息')
  .action(async (pathArg: string, options: { config?: string; json?: boolean; summary?: boolean }) => {
    const rootPath = path.resolve(pathArg);
    const config = loadConfig(options.config);

    console.log(chalk.blue.bold(`\n📁 扫描目录: ${rootPath}\n`));

    const scanner = new Scanner({
      rootPath,
      ignorePatterns: config.ignore.patterns,
    });

    const result = await scanner.scan();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('📊 扫描结果汇总:'));
    const summaryTable = [
      ['文件类型', '数量'],
      ...Object.entries(result.summary.byType)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => [type, count.toString()]),
    ];
    console.log(table(summaryTable));
    console.log(`总计: ${chalk.green(result.summary.totalFiles)} 个文件\n`);

    if (!options.summary && result.files.length > 0) {
      console.log(chalk.bold('📋 文件列表:'));
      const fileTable = [
        ['路径', '类型', '大小 (KB)'],
        ...result.files
          .sort((a, b) => a.path.localeCompare(b.path))
          .map(f => [
            f.path,
            f.type,
            (f.size / 1024).toFixed(2),
          ]),
      ];
      console.log(table(fileTable));
    }
  });

program
  .command('validate')
  .description('验证链接、图片、锚点是否存在')
  .argument('[path]', '课程目录路径', '.')
  .option('-c, --config <path>', '配置文件路径')
  .option('--json', '以 JSON 格式输出')
  .option('--ignore-errors', '遇到错误继续执行')
  .action(async (pathArg: string, options: { config?: string; json?: boolean; ignoreErrors?: boolean }) => {
    const rootPath = path.resolve(pathArg);
    const config = loadConfig(options.config);

    console.log(chalk.blue.bold(`\n🔍 验证目录: ${rootPath}\n`));

    const documents = await scanAndParseDocuments(rootPath, config);

    const scanner = new Scanner({
      rootPath,
      ignorePatterns: config.ignore.patterns,
    });
    const scanResult = await scanner.scan();

    const validator = new Validator({
      rootPath,
      config,
      documents,
    });

    const result = await validator.validate();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('📊 验证结果汇总:'));
    console.log(`扫描文件: ${chalk.cyan(result.scannedFiles)} 个文档`);
    console.log(`总问题数: ${chalk.red(result.summary.totalIssues)} 个`);
    console.log(`  错误: ${chalk.red(result.summary.bySeverity.errors)} 个`);
    console.log(`  警告: ${chalk.yellow(result.summary.bySeverity.warnings)} 个`);
    console.log(`  信息: ${chalk.blue(result.summary.bySeverity.info)} 个\n`);

    if (result.issues.length > 0) {
      console.log(chalk.bold('❌ 问题详情:'));
      console.log('');

      for (const issue of result.issues) {
        const severityColor = issue.severity === 'error' ? chalk.red :
                             issue.severity === 'warning' ? chalk.yellow : chalk.blue;
        
        console.log(severityColor(`[${issue.severity.toUpperCase()}] ${issue.type}`));
        console.log(`  文件: ${issue.file}:${issue.line}`);
        console.log(`  问题: ${issue.message}`);
        console.log(`  建议: ${issue.suggestion}`);
        if (issue.context) {
          console.log(`  上下文: ${issue.context}`);
        }
        console.log('');
      }
    } else {
      console.log(chalk.green.bold('✅ 没有发现任何问题！'));
    }

    if (result.summary.bySeverity.errors > 0 && !options.ignoreErrors) {
      process.exit(1);
    }
  });

program
  .command('run-snippets')
  .description('运行代码片段并检查是否能正常执行')
  .argument('[path]', '课程目录路径', '.')
  .option('-c, --config <path>', '配置文件路径')
  .option('--json', '以 JSON 格式输出')
  .option('--section <section...>', '只运行指定章节的代码片段')
  .option('--timeout <ms>', '超时时间（毫秒）', '30000')
  .option('--allow-dangerous', '允许运行危险命令')
  .action(async (pathArg: string, options: { 
    config?: string; 
    json?: boolean; 
    section?: string[];
    timeout?: string;
    allowDangerous?: boolean;
  }) => {
    const rootPath = path.resolve(pathArg);
    const config = loadConfig(options.config);

    if (options.allowDangerous) {
      config.validation.allowDangerousCommands = true;
    }

    const timeout = parseInt(options.timeout || '30000', 10);

    console.log(chalk.blue.bold(`\n🧪 运行代码片段: ${rootPath}\n`));

    const documents = await scanAndParseDocuments(rootPath, config);

    const allSnippets = Array.from(documents.values()).flatMap(d => d.codeSnippets);

    console.log(`找到 ${allSnippets.length} 个代码片段\n`);

    if (allSnippets.length === 0) {
      console.log(chalk.yellow('没有找到可运行的代码片段。'));
      return;
    }

    const runner = new SnippetRunner({
      rootPath,
      config,
      snippets: allSnippets,
      sections: options.section,
      timeout,
    });

    const result = await runner.run();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('📊 执行结果汇总:'));
    console.log(`总代码片段: ${chalk.cyan(result.summary.totalSnippets)} 个`);
    console.log(`通过: ${chalk.green(result.summary.passed)} 个 ✅`);
    console.log(`失败: ${chalk.red(result.summary.failed)} 个 ❌`);
    console.log(`跳过: ${chalk.gray(result.summary.skipped)} 个 ⏭️\n`);

    if (Object.keys(result.summary.byLanguage).length > 0) {
      console.log(chalk.bold('📝 按语言统计:'));
      const langTable = [
        ['语言', '数量'],
        ...Object.entries(result.summary.byLanguage).map(([lang, count]) => [lang, count.toString()]),
      ];
      console.log(table(langTable));
    }

    if (result.issues.length > 0) {
      console.log(chalk.bold('\n⚠️ 执行问题:'));
      console.log('');
      for (const issue of result.issues) {
        const severityColor = issue.severity === 'error' ? chalk.red :
                             issue.severity === 'warning' ? chalk.yellow : chalk.blue;
        
        console.log(severityColor(`[${issue.severity.toUpperCase()}] ${issue.type}`));
        console.log(`  文件: ${issue.file}:${issue.line}`);
        console.log(`  问题: ${issue.message}`);
        if (issue.context) {
          console.log(`  代码: ${issue.context}`);
        }
        console.log('');
      }
    }

    if (result.results.length > 0) {
      console.log(chalk.bold('\n📋 执行详情:'));
      console.log('');
      for (const execResult of result.results) {
        const snippet = result.snippets.find(s => s.id === execResult.snippetId);
        if (!snippet) continue;

        const statusColor = execResult.success ? chalk.green : chalk.red;
        console.log(statusColor(`${execResult.success ? '✅' : '❌'} ${snippet.file}:${snippet.line}`));
        console.log(`  语言: ${snippet.language}`);
        console.log(`  耗时: ${execResult.duration}ms`);
        if (execResult.timedOut) {
          console.log(`  超时: 是 ⏰`);
        }
        if (execResult.stdout) {
          console.log(`  输出: ${execResult.stdout.substring(0, 100)}${execResult.stdout.length > 100 ? '...' : ''}`);
        }
        if (execResult.stderr) {
          console.log(`  错误: ${execResult.stderr.substring(0, 100)}${execResult.stderr.length > 100 ? '...' : ''}`);
        }
        console.log('');
      }
    }

    if (result.summary.failed > 0) {
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出完整的检查报告')
  .argument('[path]', '课程目录路径', '.')
  .option('-c, --config <path>', '配置文件路径')
  .option('--json', '以 JSON 格式输出到标准输出')
  .option('--no-run-snippets', '不运行代码片段')
  .option('--section <section...>', '只运行指定章节的代码片段')
  .option('--output-dir <dir>', '报告输出目录')
  .action(async (pathArg: string, options: { 
    config?: string; 
    json?: boolean; 
    noRunSnippets?: boolean;
    section?: string[];
    outputDir?: string;
  }) => {
    const rootPath = path.resolve(pathArg);
    const config = loadConfig(options.config);

    if (options.outputDir) {
      config.report.outputDir = options.outputDir;
    }

    console.log(chalk.blue.bold(`\n📊 生成完整报告: ${rootPath}\n`));

    console.log(chalk.gray('步骤 1/5: 扫描文件...'));
    const scanner = new Scanner({
      rootPath,
      ignorePatterns: config.ignore.patterns,
    });
    const scanResult = await scanner.scan();

    console.log(chalk.gray('步骤 2/5: 解析文档...'));
    const documents = await scanAndParseDocuments(rootPath, config);

    console.log(chalk.gray('步骤 3/5: 验证链接和图片...'));
    const validator = new Validator({
      rootPath,
      config,
      documents,
    });
    const validateResult = await validator.validate();

    let runSnippetsResult: Awaited<ReturnType<SnippetRunner['run']>> | undefined;

    if (!options.noRunSnippets) {
      console.log(chalk.gray('步骤 4/5: 运行代码片段...'));
      const allSnippets = Array.from(documents.values()).flatMap(d => d.codeSnippets);

      if (allSnippets.length > 0) {
        const runner = new SnippetRunner({
          rootPath,
          config,
          snippets: allSnippets,
          sections: options.section,
        });
        runSnippetsResult = await runner.run();
      }
    } else {
      console.log(chalk.gray('步骤 4/5: 跳过代码片段运行 (--no-run-snippets)'));
    }

    console.log(chalk.gray('步骤 5/5: 生成报告...'));

    const reporter = new Reporter({
      rootPath,
      config,
      scanResult,
      validateResult,
      runSnippetsResult,
      version: VERSION,
    });

    if (options.json) {
      const { json } = await reporter.exportReport();
      console.log(json);
      return;
    }

    const { jsonPath, htmlPath, markdownPath } = await reporter.writeToFiles();

    const report = reporter.generateReport();

    console.log(chalk.green.bold('\n✅ 报告生成完成！\n'));

    console.log(chalk.bold('📊 报告摘要:'));
    console.log(`  评分: ${chalk.cyan(report.summary.score)}/100`);
    console.log(`  风险等级: ${
      report.summary.riskLevel === 'low' ? chalk.green('低 🟢') :
      report.summary.riskLevel === 'medium' ? chalk.yellow('中 🟡') :
      chalk.red('高 🔴')
    }`);
    console.log(`  总检查数: ${report.summary.totalChecks}`);
    console.log(`  通过: ${chalk.green(report.summary.passedChecks)}`);
    console.log(`  失败: ${chalk.red(report.summary.failedChecks)}`);
    console.log(`  跳过: ${chalk.gray(report.summary.skippedChecks)}`);
    console.log('');

    console.log(chalk.bold('📁 报告文件:'));
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  Markdown: ${markdownPath}`);
    console.log('');

    if (report.summary.riskLevel === 'high') {
      console.log(chalk.red.bold('⚠️  检测到高风险问题，请查看报告详情并修复！'));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('执行完整的检查流程：扫描 + 验证 + 运行代码片段 + 导出报告')
  .argument('[path]', '课程目录路径', '.')
  .option('-c, --config <path>', '配置文件路径')
  .option('--section <section...>', '只运行指定章节的代码片段')
  .option('--output-dir <dir>', '报告输出目录')
  .action(async (pathArg: string, options: { 
    config?: string; 
    section?: string[];
    outputDir?: string;
  }) => {
    const programPath = process.argv[1];
    const args = ['export', pathArg];
    
    if (options.config) args.push('--config', options.config);
    if (options.section) {
      for (const section of options.section) {
        args.push('--section', section);
      }
    }
    if (options.outputDir) args.push('--output-dir', options.outputDir);

    const exportCmd = program.commands.find(c => c.name() === 'export');
    if (exportCmd) {
      await exportCmd.parseAsync(args, { from: 'user' });
    }
  });

program.parse(process.argv);
