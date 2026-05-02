#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { ScenarioParser } from '../services/parser.js';
import { Evaluator } from '../services/evaluator.js';
import { Reporter, ComparisonReportInput } from '../services/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('gls')
  .description('房间补光灯摆放和用电模拟器')
  .version('1.0.0');

program
  .command('validate')
  .description('校验场景 JSON 文件')
  .argument('<file>', '场景 JSON 文件路径')
  .option('-j, --json', '输出 JSON 格式结果')
  .action(async (file: string, options: { json?: boolean }) => {
    const parser = new ScenarioParser();
    const result = parser.parseFileSync(file, true);

    if (options.json) {
      console.log(JSON.stringify({
        success: result.success,
        validation: result.validation,
        error: result.error,
      }, null, 2));
      return;
    }

    console.log(chalk.bold('\n📋 场景校验结果'));
    console.log('─'.repeat(50));

    if (result.success && result.validation) {
      console.log(chalk.green('\n✅ 校验通过！'));
      
      if (result.validation.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️  发现 ${result.validation.warnings.length} 个警告:`));
        for (const w of result.validation.warnings) {
          console.log(chalk.yellow(`   - [${w.field}] ${w.message}`));
        }
      } else {
        console.log(chalk.green('\n没有警告信息。'));
      }
      
      if (result.scenario) {
        console.log(chalk.cyan('\n📊 场景概览:'));
        console.log(`   方案名称: ${result.scenario.name}`);
        console.log(`   房间: ${result.scenario.room.width}m × ${result.scenario.room.depth}m × ${result.scenario.room.height}m`);
        console.log(`   植物托盘: ${result.scenario.plantTrays.length} 个`);
        console.log(`   灯具: ${result.scenario.fixtures.length} 个`);
      }
    } else {
      console.log(chalk.red('\n❌ 校验失败！'));
      
      if (result.error) {
        console.log(chalk.red(`\n错误: ${result.error}`));
      }
      
      if (result.validation?.errors.length) {
        console.log(chalk.red(`\n发现 ${result.validation.errors.length} 个错误:`));
        for (const e of result.validation.errors) {
          console.log(chalk.red(`   - [${e.field}] ${e.message}`));
        }
      }
      
      if (result.validation?.warnings.length) {
        console.log(chalk.yellow(`\n同时有 ${result.validation.warnings.length} 个警告:`));
        for (const w of result.validation.warnings) {
          console.log(chalk.yellow(`   - [${w.field}] ${w.message}`));
        }
      }
    }
    
    console.log('');
  });

program
  .command('evaluate')
  .description('评估单个方案')
  .argument('<file>', '场景 JSON 文件路径')
  .option('-j, --json', '输出 JSON 格式结果')
  .option('-o, --output <dir>', '输出报告的目录')
  .option('-f, --format <format>', '报告格式: html|md|both', 'html')
  .action(async (file: string, options: { 
    json?: boolean; 
    output?: string;
    format?: string;
  }) => {
    const parser = new ScenarioParser();
    const parseResult = parser.parseFileSync(file, true);

    if (!parseResult.success || !parseResult.scenario) {
      if (options.json) {
        console.log(JSON.stringify({
          success: false,
          error: parseResult.error,
          validation: parseResult.validation,
        }, null, 2));
      } else {
        console.error(chalk.red('\n❌ 场景解析失败！'));
        if (parseResult.error) {
          console.error(chalk.red(`错误: ${parseResult.error}`));
        }
        console.error('');
      }
      process.exit(1);
    }

    const evaluator = new Evaluator();
    const result = evaluator.evaluate(parseResult.scenario);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.bold('\n🌱 补光灯方案评估报告'));
    console.log('─'.repeat(60));
    console.log(`\n方案: ${result.scenarioName} (ID: ${result.scenarioId})`);

    console.log(chalk.bold('\n📊 综合评分'));
    console.log(`   总分: ${chalk.blue.bold(result.score.total.toFixed(1))} / ${result.score.maxTotal}`);
    console.log(`   等级: ${getGradeColored(result.score.letterGrade)}`);
    console.log(`\n   分项:`);
    console.log(`      覆盖率: ${result.score.breakdown.coverage.toFixed(1)} 分`);
    console.log(`      费用效率: ${result.score.breakdown.costEfficiency.toFixed(1)} 分`);
    console.log(`      温升风险: ${result.score.breakdown.heatRisk.toFixed(1)} 分`);
    console.log(`      排程: ${result.score.breakdown.scheduling.toFixed(1)} 分`);

    console.log(chalk.bold('\n💡 光照覆盖率'));
    const coveragePercent = (result.overallCoverage.coverageRatio * 100).toFixed(1);
    console.log(`   整体覆盖率: ${getCoverageColor(coveragePercent)}% (${result.overallCoverage.coveredPoints}/${result.overallCoverage.totalPoints} 采样点)`);
    
    console.log(`\n   各托盘详情:`);
    for (const tray of result.trayCoverages) {
      const name = tray.trayName || tray.trayId;
      const cov = (tray.coverageRatio * 100).toFixed(1);
      const status = tray.meetsRequirement ? chalk.green('✅') : chalk.red('❌');
      console.log(`   ${status} ${name}: ${cov}% (最小: ${tray.minLux.toFixed(0)} lux, 平均: ${tray.avgLux.toFixed(0)} lux)`);
      
      if (tray.darkZones.length > 0) {
        console.log(`      ${chalk.yellow(`⚠️ 有 ${tray.darkZones.length} 个采样点光照不足`)}`);
      }
    }

    console.log(chalk.bold('\n⚡ 用电与费用'));
    console.log(`   每日用电量: ${chalk.cyan(result.consumption.totalKwh.toFixed(2))} kWh`);
    console.log(`   每日电费: ${chalk.magenta('¥' + result.consumption.totalCost.toFixed(2))}`);
    console.log(`   预算状态: ${result.consumption.budgetExceeded ? chalk.red('❌ 超出预算') : chalk.green('✅ 预算内')}`);
    if (result.consumption.budgetExceeded) {
      console.log(`   超出金额: ${chalk.red('¥' + result.consumption.budgetExcess.toFixed(2))}`);
    }
    
    if (result.consumption.perLight.length > 0) {
      console.log(`\n   各灯具用电:`);
      for (const light of result.consumption.perLight) {
        const name = light.lightName || light.lightId;
        console.log(`      - ${name}: ${light.dailyHours.toFixed(1)}h/天, ${light.dailyKwh.toFixed(2)}kWh, ¥${light.dailyCost.toFixed(2)}`);
      }
    }

    if (result.risks.length > 0) {
      console.log(chalk.bold('\n⚠️ 风险警告'));
      
      const highRisks = result.risks.filter(r => r.severity === 'high');
      const mediumRisks = result.risks.filter(r => r.severity === 'medium');
      const lowRisks = result.risks.filter(r => r.severity === 'low');

      if (highRisks.length > 0) {
        console.log(chalk.red(`\n   🔴 高风险 (${highRisks.length}):`));
        for (const r of highRisks) {
          console.log(chalk.red(`      - ${r.message}`));
        }
      }

      if (mediumRisks.length > 0) {
        console.log(chalk.yellow(`\n   🟡 中风险 (${mediumRisks.length}):`));
        for (const r of mediumRisks) {
          console.log(chalk.yellow(`      - ${r.message}`));
        }
      }

      if (lowRisks.length > 0) {
        console.log(chalk.gray(`\n   🟢 低风险/提示 (${lowRisks.length}):`));
        for (const r of lowRisks) {
          console.log(chalk.gray(`      - ${r.message}`));
        }
      }
    } else {
      console.log(chalk.bold('\n✅ 风险状态'));
      console.log(chalk.green('   未检测到风险，方案状态良好。'));
    }

    if (options.output) {
      const reporter = new Reporter();
      const outputDir = path.resolve(options.output);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const baseName = path.basename(file, '.json');

      if (options.format === 'html' || options.format === 'both') {
        const htmlReport = reporter.generateHtmlReport(result);
        const htmlPath = path.join(outputDir, `${baseName}-report.html`);
        fs.writeFileSync(htmlPath, htmlReport.content, 'utf-8');
        console.log(chalk.cyan(`\n💾 HTML 报告已保存: ${htmlPath}`));
      }

      if (options.format === 'md' || options.format === 'both') {
        const mdReport = reporter.generateMarkdownReport(result);
        const mdPath = path.join(outputDir, `${baseName}-report.md`);
        fs.writeFileSync(mdPath, mdReport.content, 'utf-8');
        console.log(chalk.cyan(`💾 Markdown 报告已保存: ${mdPath}`));
      }
    }

    console.log('');
  });

program
  .command('compare')
  .description('比较多个方案')
  .argument('<files...>', '场景 JSON 文件路径列表')
  .option('-j, --json', '输出 JSON 格式结果')
  .option('-o, --output <dir>', '输出报告的目录')
  .option('-f, --format <format>', '报告格式: html|md|both', 'html')
  .action(async (files: string[], options: { 
    json?: boolean;
    output?: string;
    format?: string;
  }) => {
    const parser = new ScenarioParser();
    const evaluator = new Evaluator();
    const results = [];
    const errors = [];

    for (const file of files) {
      const parseResult = parser.parseFileSync(file, true);
      
      if (!parseResult.success || !parseResult.scenario) {
        errors.push({ file, error: parseResult.error || '解析失败' });
        continue;
      }

      const result = evaluator.evaluate(parseResult.scenario);
      results.push(result);
    }

    if (errors.length > 0 && !options.json) {
      console.log(chalk.yellow(`\n⚠️  以下文件解析失败:`));
      for (const e of errors) {
        console.log(chalk.yellow(`   - ${e.file}: ${e.error}`));
      }
    }

    if (results.length === 0) {
      console.error(chalk.red('\n❌ 没有可比较的有效方案！'));
      process.exit(1);
    }

    const sorted = [...results].sort((a, b) => b.score.total - a.score.total);

    if (options.json) {
      console.log(JSON.stringify({
        count: sorted.length,
        results: sorted,
      }, null, 2));
      return;
    }

    console.log(chalk.bold('\n🌱 方案对比报告'));
    console.log('─'.repeat(70));
    console.log(`\n共比较 ${sorted.length} 个方案\n`);

    console.log(chalk.bold('排名  方案名称              总分    等级  覆盖率  日电费    风险'));
    console.log('─'.repeat(70));

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const rank = i + 1;
      const coverage = (r.overallCoverage.coverageRatio * 100).toFixed(0);
      const cost = `¥${r.consumption.totalCost.toFixed(2)}`;
      const riskCount = r.risks.length;
      const hasHighRisk = r.risks.some(risk => risk.severity === 'high');
      
      const rankStr = rank === 1 ? chalk.yellow('🏆 第1') : `第${rank} `;
      const gradeStr = getGradeColored(r.score.letterGrade);
      const riskStr = hasHighRisk ? chalk.red(`${riskCount}`) : riskCount > 0 ? chalk.yellow(`${riskCount}`) : chalk.green(`${riskCount}`);
      
      console.log(`${rankStr.padEnd(5)} ${(r.scenarioName).padEnd(20)} ${String(r.score.total.toFixed(1)).padEnd(6)} ${gradeStr.padEnd(4)} ${coverage.padEnd(6)} ${cost.padEnd(8)} ${riskStr}`);
    }

    console.log(`\n${chalk.yellow('🏆 推荐方案:')} ${sorted[0].scenarioName} (评分: ${sorted[0].score.total.toFixed(1)}, 等级: ${sorted[0].score.letterGrade})`);

    if (options.output) {
      const reporter = new Reporter();
      const outputDir = path.resolve(options.output);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const input: ComparisonReportInput = { results: sorted };

      if (options.format === 'html' || options.format === 'both') {
        const htmlReport = reporter.generateComparisonHtmlReport(input);
        const htmlPath = path.join(outputDir, 'comparison-report.html');
        fs.writeFileSync(htmlPath, htmlReport.content, 'utf-8');
        console.log(chalk.cyan(`\n💾 HTML 对比报告已保存: ${htmlPath}`));
      }

      if (options.format === 'md' || options.format === 'both') {
        const mdReport = reporter.generateComparisonMarkdownReport(input);
        const mdPath = path.join(outputDir, 'comparison-report.md');
        fs.writeFileSync(mdPath, mdReport.content, 'utf-8');
        console.log(chalk.cyan(`💾 Markdown 对比报告已保存: ${mdPath}`));
      }
    }

    console.log('');
  });

program
  .command('export')
  .description('导出单个方案的报告')
  .argument('<file>', '场景 JSON 文件路径')
  .argument('[outputDir]', '输出目录', './reports')
  .option('-f, --format <format>', '报告格式: html|md|both', 'both')
  .action(async (file: string, outputDir: string, options: { format?: string }) => {
    const parser = new ScenarioParser();
    const evaluator = new Evaluator();
    const reporter = new Reporter();

    const parseResult = parser.parseFileSync(file, true);

    if (!parseResult.success || !parseResult.scenario) {
      console.error(chalk.red('\n❌ 场景解析失败！'));
      if (parseResult.error) {
        console.error(chalk.red(`错误: ${parseResult.error}`));
      }
      console.error('');
      process.exit(1);
    }

    const result = evaluator.evaluate(parseResult.scenario);

    const outDir = path.resolve(outputDir);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const baseName = path.basename(file, '.json');

    if (options.format === 'html' || options.format === 'both') {
      const htmlReport = reporter.generateHtmlReport(result);
      const htmlPath = path.join(outDir, `${baseName}-report.html`);
      fs.writeFileSync(htmlPath, htmlReport.content, 'utf-8');
      console.log(chalk.cyan(`💾 HTML 报告已保存: ${htmlPath}`));
    }

    if (options.format === 'md' || options.format === 'both') {
      const mdReport = reporter.generateMarkdownReport(result);
      const mdPath = path.join(outDir, `${baseName}-report.md`);
      fs.writeFileSync(mdPath, mdReport.content, 'utf-8');
      console.log(chalk.cyan(`💾 Markdown 报告已保存: ${mdPath}`));
    }

    console.log(chalk.green('\n✅ 报告导出完成！\n'));
  });

function getGradeColored(grade: string): string {
  if (grade === 'S') return chalk.yellow.bold(grade);
  if (grade.startsWith('A')) return chalk.green.bold(grade);
  if (grade.startsWith('B')) return chalk.cyan.bold(grade);
  if (grade.startsWith('C')) return chalk.yellow.bold(grade);
  if (grade === 'D') return chalk.red.bold(grade);
  return chalk.red.bold(grade);
}

function getCoverageColor(percent: string): string {
  const num = parseFloat(percent);
  if (num >= 95) return chalk.green.bold(percent);
  if (num >= 80) return chalk.green(percent);
  if (num >= 60) return chalk.yellow(percent);
  return chalk.red(percent);
}

program.parse(process.argv);
