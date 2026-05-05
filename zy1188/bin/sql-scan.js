#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const Scanner = require('../src/scanner');
const ReportGenerator = require('../src/report');
const BaselineManager = require('../src/baseline');

program
  .name('sql-scan')
  .description('SQL注入风险扫描工具 - 用于小团队上线前安全检查')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描代码目录中的SQL注入风险')
  .option('-c, --code <path>', '待扫描的代码目录路径', '.')
  .option('-d, --database <path>', 'SQLite数据库文件路径 (可选)')
  .option('-b, --baseline <path>', 'Baseline文件路径，用于忽略已知风险')
  .option('-o, --output <format>', '输出格式: markdown, json, both', 'markdown')
  .option('-f, --output-file <filename>', '输出文件名 (不含扩展名)', 'scan-report')
  .option('-l, --level <level>', '最小风险级别: critical, high, medium, low', 'low')
  .option('--no-color', '禁用彩色输出')
  .action(async (options) => {
    try {
      if (options.noColor) {
        chalk.level = 0;
      }

      console.log(chalk.blue('======================================='));
      console.log(chalk.blue('  SQL注入风险扫描工具 v1.0.0'));
      console.log(chalk.blue('======================================='));
      console.log();

      const scanner = new Scanner({
        codeDir: options.code,
        databasePath: options.database,
        minRiskLevel: options.level
      });

      let baseline = null;
      if (options.baseline) {
        const baselineManager = new BaselineManager(options.baseline);
        baseline = baselineManager.load();
        console.log(chalk.gray(`已加载Baseline: ${options.baseline}`));
      }

      console.log(chalk.gray(`扫描目录: ${options.code}`));
      if (options.database) {
        console.log(chalk.gray(`数据库: ${options.database}`));
      }
      console.log(chalk.gray(`风险级别阈值: ${options.level}`));
      console.log();

      console.log(chalk.yellow('开始扫描...'));
      const results = await scanner.scan();

      if (baseline) {
        const baselineManager = new BaselineManager(options.baseline);
        const filtered = baselineManager.filterResults(results, baseline);
        console.log(chalk.gray(`通过Baseline忽略了 ${results.issues.length - filtered.issues.length} 个已知风险`));
        results.issues = filtered.issues;
      }

      console.log();
      console.log(chalk.green('扫描完成!'));
      console.log();

      const reportGenerator = new ReportGenerator();
      
      if (options.output === 'markdown' || options.output === 'both') {
        const markdownReport = reportGenerator.toMarkdown(results, options);
        const mdFilename = `${options.outputFile}.md`;
        await reportGenerator.saveReport(markdownReport, mdFilename);
        console.log(chalk.green(`✓ Markdown报告已保存: ${mdFilename}`));
      }

      if (options.output === 'json' || options.output === 'both') {
        const jsonReport = reportGenerator.toJSON(results);
        const jsonFilename = `${options.outputFile}.json`;
        await reportGenerator.saveReport(jsonReport, jsonFilename);
        console.log(chalk.green(`✓ JSON报告已保存: ${jsonFilename}`));
      }

      console.log();
      console.log(chalk.blue('======================================='));
      console.log(chalk.blue('  扫描摘要'));
      console.log(chalk.blue('======================================='));
      console.log();
      
      const stats = results.stats;
      console.log(`扫描文件数: ${stats.totalFiles}`);
      console.log(`发现问题数: ${stats.totalIssues}`);
      console.log();
      
      if (stats.bySeverity) {
        for (const [level, count] of Object.entries(stats.bySeverity)) {
          if (count > 0) {
            const levelColor = {
              critical: chalk.red,
              high: chalk.magenta,
              medium: chalk.yellow,
              low: chalk.blue
            }[level] || chalk.gray;
            console.log(`${levelColor(level.toUpperCase().padEnd(10))}: ${count} 个问题`);
          }
        }
      }

      if (stats.totalIssues > 0) {
        console.log();
        console.log(chalk.red('⚠ 发现安全风险，请查看报告详情!'));
        process.exitCode = 1;
      } else {
        console.log();
        console.log(chalk.green('✓ 未发现明显的SQL注入风险'));
      }

    } catch (error) {
      console.error(chalk.red('\n错误:'));
      
      if (error.code === 'ENOENT') {
        console.error(chalk.red(`  路径不存在: ${error.path}`));
        console.error(chalk.yellow('  提示: 请确保指定的代码目录和数据库文件存在'));
      } else if (error.code === 'EACCES') {
        console.error(chalk.red(`  权限不足: ${error.path}`));
        console.error(chalk.yellow('  提示: 请检查文件或目录的读取权限'));
      } else if (error.message.includes('not a valid SQLite')) {
        console.error(chalk.red('  不是有效的SQLite数据库文件'));
        console.error(chalk.yellow('  提示: 请确保指定的是正确的SQLite .db或.sqlite文件'));
      } else {
        console.error(chalk.red(`  ${error.message}`));
        console.error(chalk.gray(`  ${error.stack}`));
      }
      
      process.exitCode = 2;
    }
  });

program
  .command('baseline')
  .description('管理Baseline - 用于忽略已知的安全风险')
  .option('-c, --create <path>', '基于当前扫描结果创建新的Baseline')
  .option('-s, --scan-dir <path>', '用于创建Baseline的扫描目录', '.')
  .option('-a, --add <file:line>', '向Baseline添加特定的风险 (格式: 文件路径:行号)')
  .option('-r, --remove <file:line>', '从Baseline移除特定的风险 (格式: 文件路径:行号)')
  .option('-l, --list', '列出Baseline中的所有条目')
  .option('-b, --baseline <path>', 'Baseline文件路径', '.sql-scan-baseline.json')
  .action(async (options) => {
    try {
      const baselineManager = new BaselineManager(options.baseline);

      if (options.create) {
        console.log(chalk.yellow(`扫描目录 ${options.scanDir} 并创建Baseline...`));
        const scanner = new Scanner({ codeDir: options.scanDir });
        const results = await scanner.scan();
        
        await baselineManager.createFromResults(results, options.create);
        console.log(chalk.green(`✓ Baseline已创建: ${options.create}`));
        console.log(chalk.gray(`  包含 ${results.issues.length} 个风险项`));
      } else if (options.add) {
        const [file, line] = options.add.split(':');
        if (!file || !line) {
          throw new Error('格式错误，应为: 文件路径:行号');
        }
        
        let baseline = baselineManager.exists() ? baselineManager.load() : { ignored: [] };
        baselineManager.addIgnore(baseline, file, parseInt(line));
        await baselineManager.save(baseline);
        
        console.log(chalk.green(`✓ 已添加到Baseline: ${file}:${line}`));
      } else if (options.remove) {
        const [file, line] = options.remove.split(':');
        if (!file || !line) {
          throw new Error('格式错误，应为: 文件路径:行号');
        }
        
        if (!baselineManager.exists()) {
          console.log(chalk.yellow('Baseline文件不存在'));
          return;
        }
        
        const baseline = baselineManager.load();
        const removed = baselineManager.removeIgnore(baseline, file, parseInt(line));
        
        if (removed) {
          await baselineManager.save(baseline);
          console.log(chalk.green(`✓ 已从Baseline移除: ${file}:${line}`));
        } else {
          console.log(chalk.yellow('在Baseline中未找到该条目'));
        }
      } else if (options.list) {
        if (!baselineManager.exists()) {
          console.log(chalk.yellow('Baseline文件不存在'));
          return;
        }
        
        const baseline = baselineManager.load();
        console.log(chalk.blue('======================================='));
        console.log(chalk.blue('  Baseline 条目列表'));
        console.log(chalk.blue('======================================='));
        console.log();
        
        if (baseline.ignored && baseline.ignored.length > 0) {
          baseline.ignored.forEach((item, index) => {
            console.log(`${index + 1}. ${item.file}:${item.line}`);
            if (item.reason) {
              console.log(`   原因: ${item.reason}`);
            }
            console.log();
          });
        } else {
          console.log(chalk.gray('Baseline为空'));
        }
      }
    } catch (error) {
      console.error(chalk.red(`\n错误: ${error.message}`));
      process.exitCode = 2;
    }
  });

program
  .command('seed')
  .description('创建包含SQL注入风险示例的Seed项目，用于测试扫描器')
  .option('-o, --output <path>', 'Seed项目输出目录', './sql-injection-examples')
  .action(async (options) => {
    try {
      const SeedProject = require('../src/seed');
      const seed = new SeedProject();
      
      console.log(chalk.yellow(`创建Seed项目到: ${options.output}`));
      console.log();
      
      const result = await seed.create(options.output);
      
      console.log(chalk.green('✓ Seed项目创建成功!'));
      console.log();
      console.log(chalk.blue('======================================='));
      console.log(chalk.blue('  Seed项目内容'));
      console.log(chalk.blue('======================================='));
      console.log();
      
      result.files.forEach(file => {
        console.log(chalk.gray(`  - ${file.relativePath}`));
      });
      
      console.log();
      console.log(chalk.yellow('示例风险类型:'));
      result.issueTypes.forEach(type => {
        console.log(`  - ${type}`);
      });
      
      console.log();
      console.log(chalk.blue('提示: 运行以下命令测试扫描器:'));
      console.log(chalk.gray(`  sql-scan scan -c ${options.output}`));
      
    } catch (error) {
      console.error(chalk.red(`\n错误: ${error.message}`));
      process.exitCode = 2;
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
