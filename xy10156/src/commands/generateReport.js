const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const DataStore = require('../dataStore');

async function generateReportCommand(options) {
  const store = new DataStore();
  const spinner = ora('开始生成证据报告...').start();

  try {
    const requirements = store.loadRequirements();
    const testCases = store.loadTestCases();
    const coverage = store.loadCoverage();
    const failures = store.loadFailures();

    if (requirements.items.length === 0) {
      spinner.fail('没有找到需求数据');
      console.log(chalk.yellow('  提示: 请先导入需求数据'));
      process.exit(1);
    }

    spinner.text = '构建证据映射关系...';
    
    const requirementMap = new Map();
    requirements.items.forEach(req => {
      requirementMap.set(req.id, {
        ...req,
        testCases: [],
        codePaths: [],
        isCovered: false
      });
    });

    const testCaseMap = new Map();
    testCases.items.forEach(tc => {
      testCaseMap.set(tc.id, {
        ...tc,
        requirements: tc.requirements || [],
        codePaths: tc.codePaths || []
      });

      if (tc.requirements) {
        tc.requirements.forEach(reqId => {
          if (requirementMap.has(reqId)) {
            const req = requirementMap.get(reqId);
            req.testCases.push(tc.id);
            req.isCovered = true;
          }
        });
      }
    });

    if (coverage.items.length > 0) {
      coverage.items.forEach(cp => {
        if (cp.testCases && cp.testCases.length > 0) {
          cp.testCases.forEach(tcId => {
            if (testCaseMap.has(tcId)) {
              const tc = testCaseMap.get(tcId);
              const codePathRef = cp.functionName ? `${cp.path}:${cp.functionName}` : cp.path;
              if (!tc.codePaths.includes(codePathRef)) {
                tc.codePaths.push(codePathRef);
              }
            }
          });
        }
      });

      testCaseMap.forEach((tc, tcId) => {
        if (tc.requirements) {
          tc.requirements.forEach(reqId => {
            if (requirementMap.has(reqId) && tc.codePaths) {
              const req = requirementMap.get(reqId);
              tc.codePaths.forEach(cp => {
                if (!req.codePaths.includes(cp)) {
                  req.codePaths.push(cp);
                }
              });
            }
          });
        }
      });
    }

    const stats = {
      totalRequirements: requirements.items.length,
      coveredRequirements: Array.from(requirementMap.values()).filter(r => r.isCovered).length,
      uncoveredRequirements: Array.from(requirementMap.values()).filter(r => !r.isCovered).length,
      totalTestCases: testCases.items.length,
      passedTestCases: testCases.items.filter(tc => tc.status === 'passed').length,
      failedTestCases: testCases.items.filter(tc => tc.status === 'failed').length,
      pendingTestCases: testCases.items.filter(tc => !tc.status || tc.status === 'pending').length,
      totalCodePaths: coverage.items.length,
      linkedCodePaths: coverage.items.filter(cp => cp.testCases && cp.testCases.length > 0).length,
      unlinkedCodePaths: coverage.items.filter(cp => !cp.testCases || cp.testCases.length === 0).length,
      totalFailures: failures.items.length
    };

    stats.requirementsCoverageRate = stats.totalRequirements > 0 
      ? ((stats.coveredRequirements / stats.totalRequirements) * 100).toFixed(2)
      : 0;

    stats.testCasesPassRate = stats.totalTestCases > 0
      ? ((stats.passedTestCases / stats.totalTestCases) * 100).toFixed(2)
      : 0;

    stats.codeCoverageRate = stats.totalCodePaths > 0
      ? ((stats.linkedCodePaths / stats.totalCodePaths) * 100).toFixed(2)
      : 0;

    const evidenceMap = [];
    requirementMap.forEach((req, reqId) => {
      evidenceMap.push({
        requirement: {
          id: req.id,
          title: req.title,
          description: req.description,
          status: req.status,
          tags: req.tags
        },
        isCovered: req.isCovered,
        testCases: req.testCases.map(tcId => {
          const tc = testCaseMap.get(tcId);
          return tc ? {
            id: tc.id,
            title: tc.title,
            description: tc.description,
            status: tc.status,
            lastRun: tc.lastRun,
            codePaths: tc.codePaths
          } : null;
        }).filter(Boolean),
        codePaths: req.codePaths
      });
    });

    const report = {
      project: store.config.project,
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      stats: stats,
      evidenceMap: evidenceMap,
      failures: failures.items,
      summary: {
        overallStatus: determineOverallStatus(stats),
        keyFindings: generateKeyFindings(stats, evidenceMap)
      }
    };

    const timestamp = Date.now();
    const jsonReportPath = path.join(
      store.config.paths.output,
      `evidence-report-${timestamp}.json`
    );

    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2), 'utf8');

    if (options.format === 'html' || options.format === 'all') {
      const htmlReportPath = path.join(
        store.config.paths.output,
        `evidence-report-${timestamp}.html`
      );
      const htmlContent = generateHtmlReport(report);
      fs.writeFileSync(htmlReportPath, htmlContent, 'utf8');
      console.log(chalk.green(`  HTML报告: ${htmlReportPath}`));
    }

    if (options.format === 'markdown' || options.format === 'all') {
      const mdReportPath = path.join(
        store.config.paths.output,
        `evidence-report-${timestamp}.md`
      );
      const mdContent = generateMarkdownReport(report);
      fs.writeFileSync(mdReportPath, mdContent, 'utf8');
      console.log(chalk.green(`  Markdown报告: ${mdReportPath}`));
    }

    spinner.succeed('证据报告生成完成');
    console.log(chalk.green('\n  报告统计:'));
    console.log(chalk.green(`    ✓ 需求总数: ${stats.totalRequirements}`));
    console.log(chalk.green(`    ✓ 已覆盖需求: ${stats.coveredRequirements} (${stats.requirementsCoverageRate}%)`));
    console.log(chalk.green(`    ✓ 测试用例: ${stats.totalTestCases}`));
    console.log(chalk.green(`    ✓ 通过: ${stats.passedTestCases} (${stats.testCasesPassRate}%)`));
    console.log(chalk.red(`    ✗ 失败: ${stats.failedTestCases}`));
    console.log(chalk.yellow(`    ⚠ 待执行: ${stats.pendingTestCases}`));
    
    if (stats.totalCodePaths > 0) {
      console.log(chalk.cyan(`    ✓ 代码路径: ${stats.totalCodePaths}`));
      console.log(chalk.cyan(`    ✓ 已关联: ${stats.linkedCodePaths} (${stats.codeCoverageRate}%)`));
    }

    console.log(chalk.green(`\n  JSON报告: ${jsonReportPath}`));

    return report;
  } catch (error) {
    spinner.fail('生成报告过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    store.addFailure('unexpected_error', 'report', '生成证据报告时发生未知错误', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

function determineOverallStatus(stats) {
  if (stats.failedTestCases > 0 || stats.requirementsCoverageRate < 80) {
    return 'warning';
  }
  if (stats.pendingTestCases > 0 || stats.requirementsCoverageRate < 100) {
    return 'partial';
  }
  return 'complete';
}

function generateKeyFindings(stats, evidenceMap) {
  const findings = [];

  if (stats.requirementsCoverageRate === '100.00') {
    findings.push('所有需求均已覆盖');
  } else {
    findings.push(`需求覆盖率为 ${stats.requirementsCoverageRate}%，仍有 ${stats.uncoveredRequirements} 个需求未覆盖`);
  }

  if (stats.testCasesPassRate === '100.00') {
    findings.push('所有测试用例均已通过');
  } else {
    findings.push(`测试用例通过率为 ${stats.testCasesPassRate}%，有 ${stats.failedTestCases} 个用例失败`);
  }

  const uncoveredRequirements = evidenceMap.filter(e => !e.isCovered);
  if (uncoveredRequirements.length > 0) {
    findings.push(`未覆盖的需求: ${uncoveredRequirements.slice(0, 5).map(r => r.requirement.id).join(', ')}${uncoveredRequirements.length > 5 ? '...' : ''}`);
  }

  return findings;
}

function generateHtmlReport(report) {
  const statusColors = {
    passed: '#28a745',
    failed: '#dc3545',
    pending: '#ffc107',
    complete: '#28a745',
    partial: '#ffc107',
    warning: '#dc3545'
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>测试覆盖证据报告 - ${report.project.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #007bff; }
    .stat-label { color: #666; margin-top: 5px; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; }
    tr:hover { background: #f9f9f9; }
    .evidence-item { margin: 20px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; }
    .evidence-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .test-case { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .code-path { font-family: monospace; background: #f1f3f4; padding: 5px 10px; border-radius: 4px; margin: 5px 0; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>测试覆盖证据报告</h1>
    <p><strong>项目:</strong> ${report.project.name} | <strong>生成时间:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value">${report.stats.requirementsCoverageRate}%</div>
        <div class="stat-label">需求覆盖率</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.stats.testCasesPassRate}%</div>
        <div class="stat-label">测试通过率</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.stats.coveredRequirements}/${report.stats.totalRequirements}</div>
        <div class="stat-label">已覆盖需求</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${report.stats.passedTestCases}/${report.stats.totalTestCases}</div>
        <div class="stat-label">通过用例</div>
      </div>
    </div>

    <h2>关键发现</h2>
    <ul>
      ${report.summary.keyFindings.map(f => `<li>${f}</li>`).join('')}
    </ul>

    <h2>证据映射详情</h2>
    ${report.evidenceMap.map(item => `
      <div class="evidence-item">
        <div class="evidence-header">
          <h3>[${item.requirement.id}] ${item.requirement.title}</h3>
          <span class="status-badge" style="background: ${item.isCovered ? statusColors.passed : statusColors.failed}">
            ${item.isCovered ? '已覆盖' : '未覆盖'}
          </span>
        </div>
        <p><strong>描述:</strong> ${item.requirement.description || '无'}</p>
        
        ${item.testCases.length > 0 ? `
          <h4>关联测试用例 (${item.testCases.length})</h4>
          ${item.testCases.map(tc => `
            <div class="test-case">
              <strong>[${tc.id}] ${tc.title}</strong>
              <span class="status-badge" style="background: ${statusColors[tc.status] || statusColors.pending}; margin-left: 10px;">
                ${tc.status || '待执行'}
              </span>
              ${tc.codePaths && tc.codePaths.length > 0 ? `
                <div style="margin-top: 10px;">
                  <strong>代码路径:</strong><br>
                  ${tc.codePaths.map(cp => `<span class="code-path">${cp}</span>`).join(' ')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        ` : '<p style="color: #666;">无关联测试用例</p>'}
      </div>
    `).join('')}
  </div>
</body>
</html>`;
}

function generateMarkdownReport(report) {
  let md = `# 测试覆盖证据报告\n\n`;
  md += `**项目:** ${report.project.name}  \n`;
  md += `**生成时间:** ${new Date(report.generatedAt).toLocaleString()}  \n\n`;
  
  md += `## 统计概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 需求总数 | ${report.stats.totalRequirements} |\n`;
  md += `| 已覆盖需求 | ${report.stats.coveredRequirements} |\n`;
  md += `| 未覆盖需求 | ${report.stats.uncoveredRequirements} |\n`;
  md += `| **需求覆盖率** | **${report.stats.requirementsCoverageRate}%** |\n`;
  md += `| 测试用例总数 | ${report.stats.totalTestCases} |\n`;
  md += `| 通过 | ${report.stats.passedTestCases} |\n`;
  md += `| 失败 | ${report.stats.failedTestCases} |\n`;
  md += `| 待执行 | ${report.stats.pendingTestCases} |\n`;
  md += `| **测试通过率** | **${report.stats.testCasesPassRate}%** |\n\n`;

  md += `## 关键发现\n\n`;
  report.summary.keyFindings.forEach((finding, index) => {
    md += `${index + 1}. ${finding}\n`;
  });
  md += `\n`;

  md += `## 证据映射详情\n\n`;
  report.evidenceMap.forEach(item => {
    md += `### [${item.requirement.id}] ${item.requirement.title}\n\n`;
    md += `- **状态:** ${item.isCovered ? '✅ 已覆盖' : '❌ 未覆盖'}\n`;
    md += `- **描述:** ${item.requirement.description || '无'}\n\n`;

    if (item.testCases.length > 0) {
      md += `#### 关联测试用例 (${item.testCases.length})\n\n`;
      item.testCases.forEach(tc => {
        const statusIcon = tc.status === 'passed' ? '✅' : tc.status === 'failed' ? '❌' : '⏳';
        md += `- **${statusIcon} [${tc.id}] ${tc.title}**\n`;
        if (tc.codePaths && tc.codePaths.length > 0) {
          md += `  - 代码路径: ${tc.codePaths.map(cp => `\`${cp}\``).join(', ')}\n`;
        }
      });
      md += `\n`;
    } else {
      md += `> ⚠️ 无关联测试用例\n\n`;
    }
  });

  return md;
}

module.exports = generateReportCommand;
