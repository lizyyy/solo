const path = require('path');
const chalk = require('chalk');
const TemplateLoader = require('../template-loader');
const DriftManager = require('../drift-manager');
const CheckerManager = require('../checkers');
const config = require('../config');

const SEVERITY_LABELS = {
  critical: { label: 'CRITICAL', color: chalk.red.bold },
  high: { label: 'HIGH', color: chalk.red },
  medium: { label: 'MEDIUM', color: chalk.yellow },
  low: { label: 'LOW', color: chalk.cyan },
  info: { label: 'INFO', color: chalk.blue }
};

async function execute(projectPaths, options) {
  const templateLoader = new TemplateLoader(options.templateDir);
  const rules = options.rules ? options.rules.split(',') : Object.keys(config.RULE_DEFINITIONS);
  const checkerManager = new CheckerManager(templateLoader, { rules });

  const results = [];

  for (const rawPath of projectPaths) {
    const projectPath = path.resolve(rawPath);
    console.log(chalk.bold(`\n${'='.repeat(70)}`));
    console.log(chalk.bold(`扫描项目: ${projectPath}`));
    console.log(chalk.bold(`${'='.repeat(70)}`));

    try {
      const scanResult = checkerManager.scanProject(projectPath);
      const driftManager = new DriftManager(projectPath);

      console.log(`\n模板: ${scanResult.template.name} v${scanResult.template.version}`);
      console.log(`扫描时间: ${new Date(scanResult.scannedAt).toLocaleString('zh-CN')}`);

      const processedIssues = [];
      for (const issue of scanResult.issues) {
        const driftInfo = driftManager.isDriftAllowed(issue);
        const processed = {
          ...issue,
          driftAllowed: driftInfo.allowed,
          driftInfo: driftInfo
        };
        processedIssues.push(processed);
      }

      const nonAllowedIssues = processedIssues.filter(i => !i.driftAllowed);
      const allowedIssues = processedIssues.filter(i => i.driftAllowed);

      const riskScore = config.calculateRiskScore(nonAllowedIssues);
      const riskLevel = config.getRiskLevel(riskScore);

      console.log(`\n${chalk.bold('风险评估:')} ${chalk[riskLevel.color](riskLevel.label)} (分数: ${riskScore})`);

      console.log(`\n${chalk.bold('问题汇总:')}`);
      console.log(`  总计: ${processedIssues.length} 个问题`);
      console.log(`  待修复: ${nonAllowedIssues.length} 个`);
      console.log(`  已允许: ${allowedIssues.length} 个`);

      if (allowedIssues.length > 0) {
        console.log(`\n${chalk.green.bold('已允许的漂移:')}`);
        for (const issue of allowedIssues) {
          const sevLabel = SEVERITY_LABELS[issue.severity] || SEVERITY_LABELS.info;
          let line = `  ${sevLabel.color(sevLabel.label)} [${issue.ruleId}] ${issue.message}`;
          if (issue.driftInfo.allowedUntil) {
            line += ` (到期: ${issue.driftInfo.allowedUntil}, 剩余 ${issue.driftInfo.daysUntilExpiry} 天)`;
          }
          console.log(line);
          if (options.verbose && issue.driftInfo.reason) {
            console.log(`      理由: ${issue.driftInfo.reason}`);
          }
        }
      }

      if (nonAllowedIssues.length > 0) {
        console.log(`\n${chalk.red.bold('需要修复的问题:')}`);

        const sortedIssues = [...nonAllowedIssues].sort((a, b) => {
          const weightA = config.getSeverityWeight(a.severity);
          const weightB = config.getSeverityWeight(b.severity);
          return weightB - weightA;
        });

        for (const issue of sortedIssues) {
          const sevLabel = SEVERITY_LABELS[issue.severity] || SEVERITY_LABELS.info;
          console.log(`\n  ${sevLabel.color(sevLabel.label)} [${issue.ruleId}] ${issue.message}`);
          if (issue.details) {
            if (issue.details.expected !== undefined) {
              console.log(`    期望: ${issue.details.expected}`);
            }
            if (issue.details.actual !== undefined) {
              console.log(`    实际: ${issue.details.actual}`);
            }
          }
          console.log(`    建议: ${issue.fixSuggestion}`);
        }
      } else if (!options.onlyErrors) {
        console.log(`\n${chalk.green.bold('✓ 项目合规，未发现需要修复的问题')}`);
      }

      const expiredDrifts = driftManager.getExpiredDrifts();
      if (expiredDrifts.length > 0) {
        console.log(`\n${chalk.red.bold('警告: 发现已过期的允许漂移:')}`);
        for (const drift of expiredDrifts) {
          console.log(`  - ${drift.ruleId}: 允许期已于 ${drift.allowedUntil} 到期`);
        }
      }

      results.push({
        projectPath,
        ...scanResult,
        processedIssues,
        riskScore,
        riskLevel,
        expiredDrifts
      });

    } catch (err) {
      console.error(chalk.red(`扫描失败: ${err.message}`));
      if (options.verbose) {
        console.error(err.stack);
      }
      results.push({
        projectPath,
        error: err.message,
        processedIssues: [],
        riskScore: 0,
        riskLevel: config.getRiskLevel(0)
      });
    }
  }

  console.log(`\n${chalk.bold('='.repeat(70))}`);
  console.log(chalk.bold('扫描完成'));
  console.log(chalk.bold(`${'='.repeat(70)}`));

  const totalProjects = results.length;
  const failedProjects = results.filter(r => r.error).length;
  const issuesProjects = results.filter(r => r.processedIssues && r.processedIssues.length > 0).length;
  const compliantProjects = totalProjects - failedProjects - issuesProjects;

  console.log(`\n${chalk.bold('总体统计:')}`);
  console.log(`  扫描项目数: ${totalProjects}`);
  console.log(`  合规项目: ${chalk.green(compliantProjects)}`);
  console.log(`  有问题项目: ${chalk.yellow(issuesProjects)}`);
  console.log(`  扫描失败: ${chalk.red(failedProjects)}`);

  if (options.output) {
    const fs = require('fs');
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n扫描结果已保存到: ${outputPath}`);
  }

  const hasHighRisk = results.some(r =>
    r.riskLevel && ['critical', 'high'].includes(r.riskLevel.level)
  );
  process.exit(hasHighRisk ? 1 : 0);
}

module.exports = { execute };
