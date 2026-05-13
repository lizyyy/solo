const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const TemplateLoader = require('../template-loader');
const DriftManager = require('../drift-manager');
const CheckerManager = require('../checkers');
const config = require('../config');

function execute(projectPaths, options) {
  const templateLoader = new TemplateLoader(options.templateDir);
  const checkerManager = new CheckerManager(templateLoader, { rules: Object.keys(config.RULE_DEFINITIONS) });

  console.log(chalk.bold(`\n${'='.repeat(70)}`));
  console.log(chalk.bold('生成治理报告'));
  console.log(chalk.bold(`${'='.repeat(70)}`));

  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalProjects: projectPaths.length,
      compliantProjects: 0,
      problematicProjects: 0,
      totalIssues: 0,
      allowedIssues: 0,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      byRisk: { critical: 0, high: 0, medium: 0, low: 0 },
      byRule: {},
      byCategory: {},
      expiredDrifts: []
    },
    projects: [],
    recommendations: []
  };

  for (const rawPath of projectPaths) {
    const projectPath = path.resolve(rawPath);
    const projectName = path.basename(projectPath);
    const projectReport = {
      name: projectName,
      path: projectPath,
      template: null,
      riskScore: 0,
      riskLevel: null,
      issues: [],
      allowedDrifts: [],
      expiredDrifts: [],
      status: 'unknown'
    };

    try {
      const scanResult = checkerManager.scanProject(projectPath);
      const driftManager = new DriftManager(projectPath);

      projectReport.template = scanResult.template;

      const processedIssues = [];
      for (const issue of scanResult.issues) {
        const driftInfo = driftManager.isDriftAllowed(issue);
        const processed = {
          ...issue,
          driftAllowed: driftInfo.allowed,
          driftInfo: driftInfo
        };
        processedIssues.push(processed);

        if (!processed.driftAllowed) {
          reportData.summary.byRisk[issue.severity] = (reportData.summary.byRisk[issue.severity] || 0);
          reportData.summary.byRisk[issue.severity]++;
          reportData.summary[`${issue.severity}Issues`] = (reportData.summary[`${issue.severity}Issues`] || 0);
          reportData.summary[`${issue.severity}Issues`]++;

          reportData.summary.byRule[issue.ruleId] = (reportData.summary.byRule[issue.ruleId] || 0);
          reportData.summary.byRule[issue.ruleId]++;

          reportData.summary.byCategory[issue.category] = (reportData.summary.byCategory[issue.category] || 0);
          reportData.summary.byCategory[issue.category]++;
        }
      }

      const nonAllowedIssues = processedIssues.filter(i => !i.driftAllowed);
      const allowedIssues = processedIssues.filter(i => i.driftAllowed);

      const riskScore = config.calculateRiskScore(nonAllowedIssues);
      const riskLevel = config.getRiskLevel(riskScore);

      projectReport.riskScore = riskScore;
      projectReport.riskLevel = riskLevel;
      projectReport.issues = nonAllowedIssues;
      projectReport.allowedDrifts = allowedIssues.map(i => ({
        ...i.driftInfo,
        ruleId: i.ruleId,
        ruleName: i.ruleName,
        message: i.message
      }));
      projectReport.expiredDrifts = driftManager.getExpiredDrifts();

      if (projectReport.expiredDrifts.length > 0) {
        reportData.summary.expiredDrifts.push({
          project: projectName,
          drifts: projectReport.expiredDrifts
        });
      }

      reportData.summary.totalIssues += nonAllowedIssues.length;
      reportData.summary.allowedIssues += allowedIssues.length;

      if (nonAllowedIssues.length > 0) {
        projectReport.status = 'problematic';
        reportData.summary.problematicProjects++;
      } else {
        projectReport.status = 'compliant';
        reportData.summary.compliantProjects++;
      }

    } catch (err) {
      projectReport.status = 'error';
      projectReport.error = err.message;
    }

    reportData.projects.push(projectReport);
  }

  reportData.recommendations = generateRecommendations(reportData);

  if (options.format === 'markdown') {
    const mdContent = generateMarkdownReport(reportData, options.groupBy);
    console.log(mdContent);
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, mdContent, 'utf-8');
      console.log(chalk.green(`\n✓ 报告已保存到: ${outputPath}`));
    }
  } else {
    const jsonContent = JSON.stringify(reportData, null, 2);
    if (options.output) {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, jsonContent, 'utf-8');
      console.log(chalk.green(`\n✓ 报告已保存到: ${outputPath}`));
    } else {
      console.log(jsonContent);
    }
  }
}

function generateRecommendations(reportData) {
  const recommendations = [];

  if (reportData.summary.criticalIssues > 0) {
    recommendations.push({
      priority: 'critical',
      title: '紧急修复严重问题',
      description: `发现 ${reportData.summary.criticalIssues} 个严重问题需要立即修复。涉及健康检查、核心配置等关键方面。`,
      action: '优先处理所有严重级别的问题，确保服务可用性和安全性。'
    });
  }

  if (reportData.summary.highIssues > 0) {
    recommendations.push({
      priority: 'high',
      title: '修复高风险问题',
      description: `发现 ${reportData.summary.highIssues} 个高风险问题。涉及模板版本、Dockerfile配置等方面。`,
      action: '在本迭代内完成修复，安排专项测试验证。'
    });
  }

  if (reportData.summary.mediumIssues > 0) {
    recommendations.push({
      priority: 'medium',
      title: '逐步修复中等问题',
      description: `发现 ${reportData.summary.mediumIssues} 个中等问题。涉及脚本、依赖、日志等方面。`,
      action: '纳入技术债务计划，在下个迭代内完成修复。'
    });
  }

  if (reportData.summary.expiredDrifts.length > 0) {
    recommendations.push({
      priority: 'high',
      title: '清理过期漂移',
      description: `发现 ${reportData.summary.expiredDrifts.length} 个项目存在过期的允许漂移。`,
      action: '立即复审并决定是否续期或修复。'
    });
  }

  const byRuleSorted = Object.entries(reportData.summary.byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (byRuleSorted.length > 0) {
    const topRules = byRuleSorted.map(([ruleId, count]) => {
      const ruleDef = config.getRuleDefinition(ruleId);
      return `${ruleDef?.name || ruleId} (${count}次)`;
    });
    recommendations.push({
      priority: 'medium',
      title: '关注高频问题',
      description: `高频问题: ${topRules.join(', ')}.`,
      action: '分析根本原因，考虑统一升级模板或提供自动化迁移工具。'
    });
  }

  if (reportData.summary.problematicProjects > 0) {
    recommendations.push({
      priority: 'medium',
      title: '整体合规性提升',
      description: `${reportData.summary.problematicProjects}/${reportData.summary.totalProjects} 个项目存在问题。`,
      action: '制定整体整改计划，分配给对应团队跟进。'
    });
  }

  return recommendations;
}

function generateMarkdownReport(reportData, groupBy) {
  let md = '# 工程脚手架一致性治理报告\n\n';
  md += `> 生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}\n\n`;

  md += '## 1. 执行摘要\n\n';
  md += '### 1.1 总体统计\n\n';
  md += '| 指标 | 数值 |\n';
  md += '|------|------|\n';
  md += `| 扫描项目总数 | ${reportData.summary.totalProjects} |\n`;
  md += `| 合规项目 | ${reportData.summary.compliantProjects} |\n`;
  md += `| 有问题项目 | ${reportData.summary.problematicProjects} |\n`;
  md += `| 待修复问题总数 | ${reportData.summary.totalIssues} |\n`;
  md += `| 已允许漂移 | ${reportData.summary.allowedIssues} |\n`;
  md += `| 过期漂移 | ${reportData.summary.expiredDrifts.length} |\n\n`;

  md += '### 1.2 按风险等级分布\n\n';
  md += '| 风险等级 | 问题数 |\n';
  md += '|----------|--------|\n';
  md += `| 🔴 CRITICAL | ${reportData.summary.criticalIssues || 0} |\n`;
  md += `| 🔴 HIGH | ${reportData.summary.highIssues || 0} |\n`;
  md += `| 🟡 MEDIUM | ${reportData.summary.mediumIssues || 0} |\n`;
  md += `| 🔵 LOW | ${reportData.summary.lowIssues || 0} |\n\n`;

  if (Object.keys(reportData.summary.byRule).length > 0) {
    md += '### 1.3 按规则统计\n\n';
    md += '| 规则 | 出现次数 |\n';
    md += '|------|----------|\n';
    const sortedRules = Object.entries(reportData.summary.byRule)
      .sort((a, b) => b[1] - a[1]);
    for (const [ruleId, count] of sortedRules) {
      const ruleDef = config.getRuleDefinition(ruleId);
      md += `| ${ruleDef?.name || ruleId} (${ruleId}) | ${count} |\n`;
    }
    md += '\n';
  }

  if (Object.keys(reportData.summary.byCategory).length > 0) {
    md += '### 1.4 按分类统计\n\n';
    md += '| 分类 | 问题数 |\n';
    md += '|------|--------|\n';
    const sortedCats = Object.entries(reportData.summary.byCategory)
      .sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sortedCats) {
      md += `| ${category} | ${count} |\n`;
    }
    md += '\n';
  }

  md += '---\n\n';
  md += '## 2. 建议动作\n\n';

  for (const rec of reportData.recommendations) {
    const priorityLabels = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
    md += `### ${priorityLabels[rec.priority] || ''} ${rec.title}\n\n`;
    md += `**描述**: ${rec.description}\n\n`;
    md += `**建议动作**: ${rec.action}\n\n`;
  }

  md += '---\n\n';
  md += '## 3. 项目详情\n\n';

  if (groupBy === 'risk') {
    md += generateByRiskSection(reportData);
  } else if (groupBy === 'rule') {
    md += generateByRuleSection(reportData);
  } else {
    md += generateByProjectSection(reportData);
  }

  if (reportData.summary.expiredDrifts.length > 0) {
    md += '---\n\n';
    md += '## 4. 过期漂移清单\n\n';
    md += '⚠️ 以下项目的允许漂移已过期，需要复审或修复：\n\n';
    for (const item of reportData.summary.expiredDrifts) {
      md += `### ${item.project}\n\n`;
      for (const drift of item.drifts) {
        md += `- **规则**: ${drift.ruleId}\n`;
        md += `  - **到期日**: ${drift.allowedUntil}\n`;
        if (drift.reason) md += `  - **理由**: ${drift.reason}\n\n`;
      }
    }
  }

  return md;
}

function generateByProjectSection(reportData) {
  let md = '';

  const sortedProjects = [...reportData.projects].sort((a, b) => {
    const scoreOrder = b.riskScore - a.riskScore;
    if (scoreOrder !== 0) return scoreOrder;
    return a.name.localeCompare(b.name);
  });

  for (const project of sortedProjects) {
    const statusEmoji = {
      compliant: '✅', problematic: '⚠️', error: '❌'
    }[project.status] || '❓';

    md += `### ${statusEmoji} ${project.name}\n\n`;
    md += `- **路径**: ${project.path}\n`;
    if (project.template) {
      md += `- **模板**: ${project.template.name} v${project.template.version}\n`;
    }
    if (project.riskLevel) {
      md += `- **风险等级**: ${project.riskLevel.label} (${project.riskScore}分)\n`;
    }
    md += `- **状态**: ${project.status}\n`;

    if (project.issues.length > 0) {
      md += '\n#### 问题清单\n\n';
      const grouped = groupBySeverity(project.issues);
      for (const [severity, issues] of Object.entries(grouped)) {
        const sevLabel = { critical: '🔴 CRITICAL', high: '🟠 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW' }[severity] || severity;
        md += `**${sevLabel}** (${issues.length}个)\n\n`;
        for (const issue of issues) {
          md += `- **[${issue.ruleId}]** ${issue.message}\n`;
          if (issue.details?.expected !== undefined && issue.details?.actual !== undefined) {
            md += `  - 期望: ${issue.details.expected}\n`;
            md += `  - 实际: ${issue.details.actual}\n`;
          }
          md += `  - 建议: ${issue.fixSuggestion}\n\n`;
        }
      }
    }

    if (project.allowedDrifts.length > 0) {
      md += '\n#### 已允许的漂移\n\n';
      for (const drift of project.allowedDrifts) {
        const expiryText = drift.allowedUntil ? ` (到期: ${drift.allowedUntil})` : '';
        md += `- **[${drift.ruleId}]** ${drift.message}${expiryText}\n`;
        if (drift.reason) md += `  - 理由: ${drift.reason}\n`;
        if (drift.approvedBy) md += `  - 批准人: ${drift.approvedBy}\n`;
        md += '\n';
      }
    }

    if (project.expiredDrifts.length > 0) {
      md += '\n#### ⚠️ 过期漂移\n\n';
      for (const drift of project.expiredDrifts) {
        md += `- **${drift.ruleId}**: 已过期 ${drift.allowedUntil}\n`;
      }
      md += '\n';
    }

    if (project.error) {
      md += `\n**扫描错误**: ${project.error}\n\n`;
    }
  }

  return md;
}

function generateByRiskSection(reportData) {
  let md = '';

  const byRisk = { critical: [], high: [], medium: [], low: [] };

  for (const project of reportData.projects) {
    for (const issue of project.issues) {
      byRisk[issue.severity] = byRisk[issue.severity] || [];
      byRisk[issue.severity].push({ ...issue, projectName: project.name, projectPath: project.path });
    }
  }

  const severities = ['critical', 'high', 'medium', 'low'];
  for (const sev of severities) {
    const issues = byRisk[sev] || [];
    if (issues.length === 0) continue;

    const sevLabel = { critical: '🔴 CRITICAL', high: '🟠 HIGH', medium: '🟡 MEDIUM', low: '🔵 LOW' }[sev];
    md += `### ${sevLabel}\n\n`;

    for (const issue of issues) {
      md += `#### ${issue.projectName}\n\n`;
      md += `- **规则**: ${issue.ruleId}\n`;
      md += `- **问题**: ${issue.message}\n`;
      md += `- **建议**: ${issue.fixSuggestion}\n`;
      if (issue.details?.expected !== undefined && issue.details?.actual !== undefined) {
        md += `- **期望**: ${issue.details.expected}\n`;
        md += `- **实际**: ${issue.details.actual}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

function generateByRuleSection(reportData) {
  let md = '';

  const byRule = {};

  for (const project of reportData.projects) {
    for (const issue of project.issues) {
      byRule[issue.ruleId] = byRule[issue.ruleId] || [];
      byRule[issue.ruleId].push({ ...issue, projectName: project.name, projectPath: project.path });
    }
  }

  const sortedRuleIds = Object.keys(byRule).sort((a, b) => byRule[b].length - byRule[a].length);

  for (const ruleId of sortedRuleIds) {
    const ruleDef = config.getRuleDefinition(ruleId);
    const issues = byRule[ruleId];

    md += `### ${ruleDef?.name || ruleId}\n\n`;
    md += `- **规则ID**: ${ruleId}\n`;
    md += `- **描述**: ${ruleDef?.description || ''}\n`;
    md += `- **影响项目数**: ${issues.length}\n\n`;

    for (const issue of issues) {
      md += `#### ${issue.projectName}\n\n`;
      md += `- **路径**: ${issue.projectPath}\n`;
      md += `- **问题**: ${issue.message}\n`;
      md += `- **建议**: ${issue.fixSuggestion}\n\n`;
    }
  }

  return md;
}

function groupBySeverity(issues) {
  const grouped = {};
  for (const issue of issues) {
    grouped[issue.severity] = grouped[issue.severity] || [];
    grouped[issue.severity].push(issue);
  }
  return grouped;
}

module.exports = { execute };
