#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const { RuleLoader } = require('./rules');
const { Scanner } = require('./scanner');
const { Whitelist } = require('./whitelist');
const { ReportGenerator } = require('./report');

const program = new Command();

program
  .name('log-scan')
  .description('日志脱敏发布检查 CLI - 检查日志中是否包含敏感信息')
  .version('1.0.0');

program
  .command('rules')
  .description('查看和管理规则集')
  .option('-f, --file <path>', '从文件加载规则')
  .option('-d, --dir <path>', '从目录加载规则')
  .option('--no-default', '不加载默认规则')
  .action((options) => {
    runRulesCommand(options);
  });

program
  .command('scan')
  .description('扫描日志文件或文本')
  .argument('<target>', '扫描目标：文件路径、目录路径或文本（用 - 表示从 stdin 读取）')
  .option('-r, --rules <path>', '规则文件或目录')
  .option('-w, --whitelist <path>', '白名单文件或目录')
  .option('-f, --format <format>', '输出格式：console, json, md, html', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .option('--no-block', '即使发现问题也不阻断（exit code 0）')
  .action((target, options) => {
    runScanCommand(target, options);
  });

program
  .command('check')
  .description('完整检查流程：加载规则 → 扫描 → 应用白名单 → 导出报告')
  .argument('<target>', '扫描目标：文件或目录路径')
  .option('-r, --rules <path>', '规则文件或目录')
  .option('-w, --whitelist <path>', '白名单文件或目录')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-n, --name <name>', '报告名称', 'scan-report')
  .option('--formats <formats>', '导出格式，用逗号分隔：json,md,html', 'json,md,html')
  .option('--no-block', '即使发现问题也不阻断')
  .action((target, options) => {
    runCheckCommand(target, options);
  });

program.parse(process.argv);

function runRulesCommand(options) {
  console.log(chalk.bold('\n📋 规则集管理'));
  console.log(chalk.gray('─'.repeat(60)));

  const loader = new RuleLoader();
  const results = [];

  if (options.default !== false) {
    const result = loader.loadDefaultRules();
    results.push({ type: 'default', ...result });
    printRuleLoadResult(result, '默认规则');
  }

  if (options.file) {
    const result = loader.loadFromFile(options.file);
    results.push({ type: 'file', ...result });
    printRuleLoadResult(result, `文件: ${options.file}`);
  }

  if (options.dir) {
    const result = loader.loadFromDirectory(options.dir);
    results.push({ type: 'dir', ...result });
    if (result.success) {
      result.files.forEach((f, i) => {
        printRuleLoadResult(f, `文件 ${i + 1}: ${path.basename(f.filePath)}`);
      });
    } else {
      console.log(chalk.red(`❌ 目录加载失败: ${result.error}`));
    }
  }

  const rules = loader.getRules();
  console.log('\n' + chalk.bold('已加载规则列表:'));
  console.log(chalk.gray('─'.repeat(60)));

  if (rules.length === 0) {
    console.log(chalk.yellow('  没有加载任何规则'));
  } else {
    rules.forEach(rule => {
      const severityColor = {
        critical: chalk.red,
        high: chalk.yellow,
        medium: chalk.blue,
        low: chalk.gray
      }[rule.severity] || chalk.white;

      console.log(`\n  ${chalk.bold(rule.name)} (${rule.id})`);
      console.log(`    严重级别: ${severityColor(rule.severity.toUpperCase())}`);
      console.log(`    阻断码: ${chalk.cyan(rule.blockCode)}`);
      console.log(`    来源: ${chalk.gray(rule.source)}`);
      if (rule.description) {
        console.log(`    描述: ${rule.description}`);
      }
    });
  }

  console.log('');
}

function printRuleLoadResult(result, label) {
  if (!result.success) {
    console.log(chalk.red(`❌ ${label}: ${result.error}`));
    if (result.details) {
      console.log(chalk.red(`   ${result.details}`));
    }
    return;
  }

  if (result.isRepeat) {
    if (result.hasChanged) {
      console.log(chalk.blue(`🔄 ${label}: 文件已更新，重新加载`));
    } else {
      console.log(chalk.gray(`⏭️  ${label}: 重复导入，文件未变化，跳过`));
    }
  }

  if (result.added && result.added.length > 0) {
    console.log(chalk.green(`✅ ${label}: 新增 ${result.added.length} 条规则`));
  }
  if (result.updated && result.updated.length > 0) {
    console.log(chalk.blue(`🔄 ${label}: 更新 ${result.updated.length} 条规则`));
  }
  if (result.invalid && result.invalid.length > 0) {
    console.log(chalk.yellow(`⚠️  ${label}: ${result.invalid.length} 条规则无效`));
    result.invalid.forEach(inv => {
      console.log(chalk.yellow(`    - ${inv.key}: ${inv.reason}`));
    });
  }
  if (result.disabled && result.disabled.length > 0) {
    console.log(chalk.gray(`⏹️  ${label}: ${result.disabled.length} 条规则被禁用`));
  }
}

function runScanCommand(target, options) {
  console.log(chalk.bold('\n🔍 日志脱敏扫描'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`目标: ${chalk.cyan(target)}`);

  const loader = new RuleLoader();
  loader.loadDefaultRules();

  if (options.rules) {
    const result = loadRulesFromPath(loader, options.rules);
    if (!result.success) {
      console.log(chalk.red(`❌ 规则加载失败: ${result.error}`));
      process.exit(1);
    }
  }

  const whitelist = new Whitelist();
  if (options.whitelist) {
    const result = loadWhitelistFromPath(whitelist, options.whitelist);
    if (!result.success) {
      console.log(chalk.red(`❌ 白名单加载失败: ${result.error}`));
      process.exit(1);
    }
  }

  const rules = loader.getRules();
  console.log(`加载规则: ${chalk.green(rules.length)} 条`);
  console.log(`白名单条目: ${chalk.green(whitelist.getEntries().length)} 条\n`);

  const scanner = new Scanner(rules);
  let scanResult;

  if (target === '-') {
    let text = '';
    process.stdin.on('data', chunk => { text += chunk; });
    process.stdin.on('end', () => {
      scanResult = scanner.scanText(text, 'stdin');
      handleScanResult(scanResult, whitelist, options);
    });
  } else {
    const fs = require('fs');
    const fullPath = path.resolve(target);

    if (!fs.existsSync(fullPath)) {
      console.log(chalk.red(`❌ 目标不存在: ${fullPath}`));
      process.exit(1);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanResult = scanner.scanDirectory(fullPath);
      console.log(chalk.gray(`扫描目录: ${fullPath}`));
      console.log(chalk.gray(`扫描文件数: ${scanResult.fileCount || 0}\n`));
    } else {
      scanResult = scanner.scanFile(fullPath);
      console.log(chalk.gray(`扫描文件: ${fullPath}\n`));
    }

    handleScanResult(scanResult, whitelist, options);
  }
}

function loadRulesFromPath(loader, pathStr) {
  const fs = require('fs');
  const fullPath = path.resolve(pathStr);

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: '路径不存在' };
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return loader.loadFromDirectory(fullPath);
  } else {
    return loader.loadFromFile(fullPath);
  }
}

function loadWhitelistFromPath(whitelist, pathStr) {
  const fs = require('fs');
  const fullPath = path.resolve(pathStr);

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: '路径不存在' };
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    return whitelist.loadFromDirectory(fullPath);
  } else {
    return whitelist.loadFromFile(fullPath);
  }
}

function handleScanResult(scanResult, whitelist, options) {
  if (!scanResult.success) {
    console.log(chalk.red(`❌ 扫描失败: ${scanResult.error}`));
    process.exit(1);
  }

  const { allowed, excluded } = whitelist.filterFindings(scanResult.findings);

  printScanResults(allowed, excluded, scanResult.stats);

  const reportGen = new ReportGenerator();
  const report = reportGen.generate(
    scanResult.stats,
    allowed,
    excluded,
    {
      scanTarget: options.target || 'unknown',
      scanType: 'scan',
      rulesLoaded: whitelist.getEntries().length + allowed.length,
      whitelistEntries: whitelist.getEntries().length,
      filesScanned: scanResult.fileCount || 1
    }
  );

  if (options.output) {
    const format = options.format || 'json';
    let result;

    if (format === 'json') {
      result = reportGen.exportJSON(report, options.output);
    } else if (format === 'md' || format === 'markdown') {
      result = reportGen.exportMarkdown(report, options.output);
    } else if (format === 'html') {
      result = reportGen.exportHTML(report, options.output);
    }

    if (result && result.success) {
      console.log(chalk.green(`\n📄 报告已导出: ${result.filePath}`));
    }
  }

  const shouldExit = scanResult.stats.shouldBlock && options.block !== false;
  if (shouldExit) {
    console.log(chalk.red(`\n❌ 发现阻断级别问题，发布被阻断`));
    console.log(chalk.red(`   阻断码: ${scanResult.stats.blockCodes.join(', ')}`));
    process.exit(1);
  }

  console.log(chalk.green('\n✅ 扫描完成'));
}

function printScanResults(allowed, excluded, stats) {
  console.log(chalk.bold('扫描结果:'));
  console.log(chalk.gray('─'.repeat(60)));

  const severityLabels = [
    { key: 'critical', color: chalk.red, label: 'Critical (致命)' },
    { key: 'high', color: chalk.yellow, label: 'High (高危)' },
    { key: 'medium', color: chalk.blue, label: 'Medium (中危)' },
    { key: 'low', color: chalk.gray, label: 'Low (低危)' }
  ];

  for (const { key, color, label } of severityLabels) {
    if (stats[key] > 0) {
      console.log(`  ${color(`● ${label}: ${stats[key]}`)}`);
    }
  }
  console.log(`  ${chalk.magenta('○ 白名单排除:')} ${excluded.length}`);
  console.log(`  ${chalk.bold('总计:')} ${allowed.length + excluded.length}`);

  if (allowed.length > 0) {
    console.log('\n' + chalk.bold('发现的问题:'));
    console.log(chalk.gray('─'.repeat(60)));

    allowed.forEach((f, i) => {
      const severityColor = {
        critical: chalk.red,
        high: chalk.yellow,
        medium: chalk.blue,
        low: chalk.gray
      }[f.severity] || chalk.white;

      console.log(`\n  ${chalk.bold(`${i + 1}. [${f.blockCode}] ${f.ruleName}`)} ${severityColor(`[${f.severity.toUpperCase()}]`)}`);
      console.log(`     匹配: ${chalk.cyan(f.match)}`);
      console.log(`     位置: ${f.source}:${f.line}:${f.column}`);
      if (f.description) {
        console.log(`     描述: ${f.description}`);
      }
    });
  }

  if (excluded.length > 0) {
    console.log('\n' + chalk.bold('白名单排除的问题:'));
    console.log(chalk.gray('─'.repeat(60)));

    excluded.forEach((f, i) => {
      console.log(`  ${chalk.gray(`${i + 1}. ${f.ruleName}: ${f.match}`)}`);
      console.log(`     ${chalk.gray(`原因: ${f.whitelistEntry?.reason || '未指定'}`)}`);
    });
  }
}

function runCheckCommand(target, options) {
  console.log(chalk.bold('\n🧪 完整检查流程'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`目标: ${chalk.cyan(target)}`);
  console.log(`报告目录: ${chalk.cyan(options.output)}`);
  console.log(`报告名称: ${chalk.cyan(options.name)}`);
  console.log(`导出格式: ${chalk.cyan(options.formats)}`);
  console.log('');

  const steps = [
    { name: '加载规则集', fn: (ctx) => stepLoadRules(ctx, options) },
    { name: '扫描样例', fn: (ctx) => stepScan(ctx, target) },
    { name: '应用白名单', fn: (ctx) => stepApplyWhitelist(ctx, options) },
    { name: '生成报告', fn: (ctx) => stepGenerateReport(ctx, options, target) }
  ];

  const context = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(chalk.bold(`步骤 ${i + 1}/${steps.length}: ${step.name}`));
    console.log(chalk.gray('─'.repeat(40)));

    try {
      const result = step.fn(context);
      if (!result || !result.success) {
        console.log(chalk.red(`❌ ${step.name}失败`));
        if (result && result.error) {
          console.log(chalk.red(`   ${result.error}`));
        }
        process.exit(1);
      }
      console.log(chalk.green(`✅ ${step.name}完成\n`));
    } catch (e) {
      console.log(chalk.red(`❌ ${step.name}异常: ${e.message}`));
      process.exit(1);
    }
  }

  console.log(chalk.bold('📊 检查摘要:'));
  console.log(chalk.gray('─'.repeat(60)));

  const stats = context.scanResult?.stats || {};
  console.log(`  扫描文件数: ${context.scanResult?.fileCount || 1}`);
  console.log(`  加载规则数: ${context.rulesCount || 0}`);
  console.log(`  白名单条目: ${context.whitelistCount || 0}`);
  console.log(`  发现问题: ${stats.total || 0}`);
  console.log(`  白名单排除: ${context.excluded?.length || 0}`);
  console.log(`  有效问题: ${context.allowed?.length || 0}`);

  if (stats.blockCodes?.length > 0) {
    console.log(`  阻断码: ${chalk.red(stats.blockCodes.join(', '))}`);
  }

  const shouldBlock = stats.shouldBlock && options.block !== false;
  if (shouldBlock) {
    console.log(chalk.red(`\n❌ 检查结果: 阻断发布`));
    console.log(chalk.red(`   存在 Critical 或 High 级别的问题`));
    process.exit(1);
  } else {
    console.log(chalk.green(`\n✅ 检查结果: 通过`));
    process.exit(0);
  }
}

function stepLoadRules(ctx, options) {
  const loader = new RuleLoader();
  loader.loadDefaultRules();
  console.log(`  已加载默认规则: ${loader.getRules().length} 条`);

  if (options.rules) {
    const result = loadRulesFromPath(loader, options.rules);
    if (!result.success) {
      return result;
    }
    console.log(`  已加载自定义规则`);
    if (result.added) console.log(`    - 新增: ${result.added.length} 条`);
    if (result.updated) console.log(`    - 更新: ${result.updated.length} 条`);
  }

  ctx.loader = loader;
  ctx.rulesCount = loader.getRules().length;
  return { success: true };
}

function stepScan(ctx, target) {
  const fs = require('fs');
  const fullPath = path.resolve(target);

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `目标不存在: ${fullPath}` };
  }

  const scanner = new Scanner(ctx.loader.getRules());
  const stat = fs.statSync(fullPath);

  let result;
  if (stat.isDirectory()) {
    result = scanner.scanDirectory(fullPath);
    console.log(`  扫描目录: ${fullPath}`);
    console.log(`  扫描文件数: ${result.fileCount || 0}`);
  } else {
    result = scanner.scanFile(fullPath);
    console.log(`  扫描文件: ${fullPath}`);
  }

  if (!result.success) {
    return result;
  }

  console.log(`  初始发现: ${result.findings.length} 条`);

  ctx.scanResult = result;
  ctx.rulesCount = ctx.loader.getRules().length;

  return { success: true };
}

function stepApplyWhitelist(ctx, options) {
  const whitelist = new Whitelist();

  if (options.whitelist) {
    const result = loadWhitelistFromPath(whitelist, options.whitelist);
    if (!result.success) {
      return result;
    }
    console.log(`  加载白名单条目: ${whitelist.getEntries().length} 条`);
  } else {
    console.log(`  未加载白名单`);
  }

  const { allowed, excluded } = whitelist.filterFindings(ctx.scanResult.findings);

  console.log(`  白名单排除: ${excluded.length} 条`);
  console.log(`  有效问题: ${allowed.length} 条`);

  ctx.whitelist = whitelist;
  ctx.whitelistCount = whitelist.getEntries().length;
  ctx.allowed = allowed;
  ctx.excluded = excluded;

  return { success: true };
}

function stepGenerateReport(ctx, options, target) {
  const reportGen = new ReportGenerator();

  const report = reportGen.generate(
    ctx.scanResult.stats,
    ctx.allowed,
    ctx.excluded,
    {
      scanTarget: target,
      scanType: 'full-check',
      rulesLoaded: ctx.rulesCount,
      whitelistEntries: ctx.whitelistCount,
      filesScanned: ctx.scanResult.fileCount || 1
    }
  );

  const formats = options.formats.split(',').map(f => f.trim());
  const exported = [];

  for (const format of formats) {
    const ext = format === 'md' ? 'md' : format;
    const filePath = path.join(options.output, `${options.name}.${ext}`);

    let result;
    if (format === 'json') {
      result = reportGen.exportJSON(report, filePath);
    } else if (format === 'md' || format === 'markdown') {
      result = reportGen.exportMarkdown(report, filePath);
    } else if (format === 'html') {
      result = reportGen.exportHTML(report, filePath);
    }

    if (result && result.success) {
      exported.push(filePath);
      console.log(`  已导出: ${filePath}`);
    }
  }

  ctx.report = report;
  ctx.exportedFiles = exported;

  return { success: true };
}
