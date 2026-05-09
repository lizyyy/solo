const chalk = require('chalk');
const ora = require('ora');
const DataStore = require('../dataStore');

async function analyzeGapsCommand(options) {
  const store = new DataStore();
  const spinner = ora('开始分析覆盖缺口...').start();

  try {
    const requirements = store.loadRequirements();
    const testCases = store.loadTestCases();
    const coverage = store.loadCoverage();

    if (requirements.items.length === 0) {
      spinner.fail('没有找到需求数据');
      console.log(chalk.yellow('  提示: 请先导入需求数据'));
      process.exit(1);
    }

    if (testCases.items.length === 0) {
      spinner.fail('没有找到测试用例数据');
      console.log(chalk.yellow('  提示: 请先映射测试用例'));
      process.exit(1);
    }

    spinner.text = '分析需求覆盖缺口...';
    const gaps = [];

    const coveredRequirements = new Set();
    const testCaseRequirements = new Map();

    testCases.items.forEach(tc => {
      if (tc.requirements) {
        tc.requirements.forEach(reqId => {
          coveredRequirements.add(reqId);
          if (!testCaseRequirements.has(reqId)) {
            testCaseRequirements.set(reqId, []);
          }
          testCaseRequirements.get(reqId).push(tc.id);
        });
      }
    });

    requirements.items.forEach(req => {
      if (!coveredRequirements.has(req.id)) {
        gaps.push({
          type: 'requirement',
          id: req.id,
          title: req.title,
          description: `需求 "${req.title}" 没有关联任何测试用例`,
          severity: 'high'
        });
      }
    });

    spinner.text = '分析测试用例状态...';
    testCases.items.forEach(tc => {
      if (tc.status === 'failed') {
        gaps.push({
          type: 'test_failed',
          id: tc.id,
          title: tc.title,
          description: `测试用例 "${tc.title}" 执行失败`,
          severity: 'high',
          details: {
            lastRun: tc.lastRun
          }
        });
      } else if (tc.status === 'pending' || !tc.status) {
        gaps.push({
          type: 'test_pending',
          id: tc.id,
          title: tc.title,
          description: `测试用例 "${tc.title}" 尚未执行`,
          severity: 'medium'
        });
      }
    });

    if (coverage.items.length > 0) {
      spinner.text = '分析代码覆盖缺口...';
      
      const unlinkedCodePaths = coverage.items.filter(cp => !cp.testCases || cp.testCases.length === 0);
      unlinkedCodePaths.forEach(cp => {
        const display = cp.functionName ? `${cp.path}:${cp.functionName}` : cp.path;
        gaps.push({
          type: 'code',
          id: cp.path + (cp.functionName ? `:${cp.functionName}` : ''),
          title: display,
          description: `代码路径 "${display}" 没有关联任何测试用例`,
          severity: 'medium'
        });
      });
    }

    spinner.text = '分析无效关联...';
    testCases.items.forEach(tc => {
      if (tc.requirements) {
        tc.requirements.forEach(reqId => {
          const exists = requirements.items.some(req => req.id === reqId);
          if (!exists) {
            gaps.push({
              type: 'invalid_link',
              id: `${tc.id}->${reqId}`,
              title: `测试用例 ${tc.id}`,
              description: `测试用例 "${tc.title}" 关联了不存在的需求: ${reqId}`,
              severity: 'low'
            });
          }
        });
      }

      if (tc.codePaths && coverage.items.length > 0) {
        tc.codePaths.forEach(cpRef => {
          const exists = coverage.items.some(cp => {
            return cp.path === cpRef || 
                   cp.functionName === cpRef ||
                   `${cp.path}:${cp.functionName}` === cpRef;
          });
          if (!exists) {
            gaps.push({
              type: 'invalid_code_link',
              id: `${tc.id}->${cpRef}`,
              title: `测试用例 ${tc.id}`,
              description: `测试用例 "${tc.title}" 关联了不存在的代码路径: ${cpRef}`,
              severity: 'low'
            });
          }
        });
      }
    });

    const groupedGaps = {
      high: gaps.filter(g => g.severity === 'high'),
      medium: gaps.filter(g => g.severity === 'medium'),
      low: gaps.filter(g => g.severity === 'low')
    };

    const gapStats = {
      total: gaps.length,
      high: groupedGaps.high.length,
      medium: groupedGaps.medium.length,
      low: groupedGaps.low.length
    };

    const gapReport = {
      generatedAt: new Date().toISOString(),
      stats: {
        requirements: {
          total: requirements.items.length,
          covered: coveredRequirements.size,
          uncovered: requirements.items.length - coveredRequirements.size,
          coverageRate: requirements.items.length > 0 
            ? ((coveredRequirements.size / requirements.items.length) * 100).toFixed(2)
            : 0
        },
        testCases: {
          total: testCases.items.length,
          passed: testCases.items.filter(tc => tc.status === 'passed').length,
          failed: testCases.items.filter(tc => tc.status === 'failed').length,
          pending: testCases.items.filter(tc => !tc.status || tc.status === 'pending').length
        },
        codeCoverage: coverage.items.length > 0 ? {
          total: coverage.items.length,
          linked: coverage.items.filter(cp => cp.testCases && cp.testCases.length > 0).length,
          unlinked: coverage.items.filter(cp => !cp.testCases || cp.testCases.length === 0).length
        } : null,
        gaps: gapStats
      },
      gaps: gaps
    };

    const gapReportPath = require('path').join(
      store.config.paths.output,
      `gap-report-${Date.now()}.json`
    );
    require('fs').writeFileSync(gapReportPath, JSON.stringify(gapReport, null, 2), 'utf8');

    spinner.succeed('覆盖缺口分析完成');
    console.log(chalk.green('\n  分析统计:'));
    console.log(chalk.green(`    ✓ 总缺口数: ${gapStats.total}`));
    console.log(chalk.red(`    ✗ 严重: ${gapStats.high}`));
    console.log(chalk.yellow(`    ⚠ 中等: ${gapStats.medium}`));
    console.log(chalk.cyan(`    ℹ 轻微: ${gapStats.low}`));

    console.log(chalk.cyan('\n  需求覆盖:'));
    console.log(chalk.cyan(`    ✓ 总计: ${requirements.items.length}`));
    console.log(chalk.cyan(`    ✓ 已覆盖: ${coveredRequirements.size}`));
    console.log(chalk.cyan(`    ✗ 未覆盖: ${requirements.items.length - coveredRequirements.size}`));
    console.log(chalk.cyan(`    ✓ 覆盖率: ${gapReport.stats.requirements.coverageRate}%`));

    if (gapStats.total > 0) {
      console.log(chalk.yellow('\n  缺口详情:'));
      
      if (groupedGaps.high.length > 0) {
        console.log(chalk.red('\n  【严重】'));
        groupedGaps.high.slice(0, options.limit ? parseInt(options.limit) : 10).forEach((gap, index) => {
          console.log(chalk.red(`    ${index + 1}. [${gap.type}] ${gap.title}`));
          console.log(chalk.red(`       ${gap.description}`));
        });
      }

      if (groupedGaps.medium.length > 0) {
        console.log(chalk.yellow('\n  【中等】'));
        groupedGaps.medium.slice(0, options.limit ? parseInt(options.limit) : 10).forEach((gap, index) => {
          console.log(chalk.yellow(`    ${index + 1}. [${gap.type}] ${gap.title}`));
          console.log(chalk.yellow(`       ${gap.description}`));
        });
      }
    }

    console.log(chalk.green(`\n  报告已保存: ${gapReportPath}`));

    return gapReport;
  } catch (error) {
    spinner.fail('分析过程出错');
    console.log(chalk.red(`  错误: ${error.message}`));
    console.log(chalk.red(`  堆栈: ${error.stack}`));
    store.addFailure('unexpected_error', 'gap-analysis', '分析覆盖缺口时发生未知错误', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

module.exports = analyzeGapsCommand;
