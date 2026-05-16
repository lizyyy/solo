const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { LogParser } = require('./log-parser');
const { MatrixAnalyzer } = require('./matrix-analyzer');
const { Reporter } = require('./reporter');

class SelfTest {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.testDataDir = path.join(outputDir, 'test-logs');
    this.tests = [];
  }

  async run() {
    console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
    console.log(chalk.bold.cyan('           GitHub Actions 矩阵抖动 CLI 自检'));
    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');

    try {
      this.createTestData();
      await this.testLogParser();
      await this.testMatrixAnalyzer();
      await this.testReporter();
      await this.testEdgeCases();
      this.printSummary();
      
      console.log(chalk.bold.green('\n✅ 所有自检通过!'));
      console.log(chalk.gray(`测试报告目录: ${path.resolve(this.outputDir)}`));
    } catch (error) {
      console.error(chalk.red('\n❌ 自检失败:'), error.message);
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  }

  createTestData() {
    console.log(chalk.blue('📝 生成测试数据...'));
    fs.mkdirSync(this.testDataDir, { recursive: true });

    const testScenarios = [
      {
        name: 'ubuntu-node18-critical.log',
        matrix: { os: 'ubuntu-latest', 'node-version': '18' },
        status: 'failed',
        rerunCount: 3,
        errors: [
          'Error: Connection timeout',
          'AssertionError: expected 200 to equal 500'
        ],
        count: 5
      },
      {
        name: 'windows-node16-high.log',
        matrix: { os: 'windows-latest', 'node-version': '16' },
        status: 'failed',
        rerunCount: 2,
        errors: [
          'Error: EPERM: operation not permitted',
          'npm ERR! code EINTEGRITY'
        ],
        count: 4
      },
      {
        name: 'macos-node20-medium.log',
        matrix: { os: 'macos-latest', 'node-version': '20' },
        status: 'mixed',
        rerunCount: 1,
        errors: [
          'Error: Socket hang up'
        ],
        count: 3
      },
      {
        name: 'ubuntu-node14-low.log',
        matrix: { os: 'ubuntu-latest', 'node-version': '14' },
        status: 'success',
        rerunCount: 0,
        errors: [],
        count: 2
      },
      {
        name: 'ubuntu-node20-1.log',
        matrix: { os: 'ubuntu-latest', 'node-version': '20' },
        status: 'failed',
        rerunCount: 1,
        errors: [
          'Traceback (most recent call last):',
          '  File "/app/test.py", line 42, in <module>',
          '    raise ValueError("Invalid response")',
          'ValueError: Invalid response'
        ],
        count: 1
      }
    ];

    let totalFiles = 0;
    for (const scenario of testScenarios) {
      for (let i = 0; i < scenario.count; i++) {
        const fileName = scenario.name.replace('.log', `-${i}.log`);
        const content = this.generateLogContent(scenario, i);
        fs.writeFileSync(path.join(this.testDataDir, fileName), content);
        totalFiles++;
      }
    }

    this.addTest('生成测试数据', true, `生成了 ${totalFiles} 个测试日志文件`);
  }

  generateLogContent(scenario, index) {
    const timestamp = new Date(Date.now() - index * 3600000).toISOString();
    const isSuccess = scenario.status === 'success' || 
      (scenario.status === 'mixed' && index % 2 === 1);

    let content = '';
    content += `${timestamp} Starting job: ${JSON.stringify(scenario.matrix)}\n`;
    content += `${timestamp} matrix.os = ${scenario.matrix.os}\n`;
    content += `${timestamp} matrix.node-version = ${scenario.matrix['node-version']}\n`;
    content += `${timestamp} Running tests...\n`;

    if (scenario.rerunCount > 0) {
      for (let r = 0; r < scenario.rerunCount; r++) {
        content += `${timestamp} Re-run attempt #${r + 1}\n`;
      }
    }

    if (!isSuccess && scenario.errors.length > 0) {
      for (const error of scenario.errors) {
        content += `${timestamp} ${error}\n`;
      }
      content += `${timestamp} Process completed with exit code 1\n`;
    } else {
      content += `${timestamp} All tests passed\n`;
      content += `${timestamp} Process completed with exit code 0\n`;
    }

    return content;
  }

  async testLogParser() {
    console.log(chalk.blue('🔍 测试日志解析器...'));

    const args = {
      logsDir: this.testDataDir,
      outputDir: this.outputDir,
      matrixKeys: ['os', 'node-version'],
      rerunThreshold: 1,
      formats: ['terminal'],
      verbose: false
    };

    const parser = new LogParser(args);
    const parsedLogs = await parser.parseDirectory();

    this.addTest('日志文件解析', parsedLogs.length > 0, `解析了 ${parsedLogs.length} 个日志文件`);

    const testLog = parsedLogs[0];
    this.addTest('矩阵参数提取', 
      testLog.matrix.os !== undefined && testLog.matrix['node-version'] !== undefined,
      `提取到矩阵参数: ${JSON.stringify(testLog.matrix)}`
    );

    this.addTest('状态检测', 
      ['failed', 'success', 'unknown'].includes(testLog.status),
      `检测到状态: ${testLog.status}`
    );

    this.addTest('重跑次数检测', 
      typeof testLog.rerunCount === 'number',
      `重跑次数: ${testLog.rerunCount}`
    );

    const failedLogs = parsedLogs.filter(l => l.status === 'failed');
    if (failedLogs.length > 0) {
      this.addTest('失败片段提取', 
        failedLogs[0].failureSnippets.length > 0,
        `提取到 ${failedLogs[0].failureSnippets.length} 个失败片段`
      );
    }
  }

  async testMatrixAnalyzer() {
    console.log(chalk.blue('📊 测试矩阵分析器...'));

    const args = {
      matrixKeys: ['os', 'node-version'],
      rerunThreshold: 1
    };

    const testLogs = [
      {
        filePath: 'test1.log',
        fileName: 'test1.log',
        matrix: { os: 'ubuntu', 'node-version': '18' },
        status: 'failed',
        rerunCount: 3,
        failureSnippets: [{ snippet: 'Error: test', lineNumber: 1, filePath: 'test1.log' }],
        timestamps: []
      },
      {
        filePath: 'test2.log',
        fileName: 'test2.log',
        matrix: { os: 'ubuntu', 'node-version': '18' },
        status: 'success',
        rerunCount: 1,
        failureSnippets: [],
        timestamps: []
      },
      {
        filePath: 'test3.log',
        fileName: 'test3.log',
        matrix: { os: 'windows', 'node-version': '16' },
        status: 'failed',
        rerunCount: 0,
        failureSnippets: [{ snippet: 'Error: windows', lineNumber: 1, filePath: 'test3.log' }],
        timestamps: []
      }
    ];

    const analyzer = new MatrixAnalyzer(args);
    const analysis = analyzer.analyze(testLogs);

    this.addTest('分析结果生成', 
      analysis.summary !== undefined && analysis.groups !== undefined,
      '生成了摘要和分组数据'
    );

    this.addTest('矩阵分组', 
      analysis.groups.length === 2,
      `分组数: ${analysis.groups.length} (期望: 2)`
    );

    const group = analysis.groups[0];
    this.addTest('抖动分数计算', 
      group.flakeScore >= 0 && group.flakeScore <= 100,
      `抖动分数: ${group.flakeScore.toFixed(1)}`
    );

    this.addTest('抖动级别分类', 
      ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(group.flakeLevel),
      `抖动级别: ${group.flakeLevel}`
    );

    this.addTest('失败率计算', 
      group.failureRate >= 0 && group.failureRate <= 1,
      `失败率: ${(group.failureRate * 100).toFixed(1)}%`
    );
  }

  async testReporter() {
    console.log(chalk.blue('📄 测试报告生成器...'));

    const args = {
      outputDir: this.outputDir,
      formats: ['json', 'csv', 'html'],
      verbose: false
    };

    const testAnalysis = {
      summary: {
        totalLogs: 10,
        totalFailed: 5,
        totalSuccess: 5,
        totalReruns: 8,
        totalMatrixGroups: 2,
        criticalGroups: 1,
        highGroups: 1,
        overallFailureRate: 0.5,
        mostUnstable: {
          matrix: { os: 'ubuntu', 'node-version': '18' },
          flakeScore: 85,
          flakeLevel: 'CRITICAL'
        }
      },
      groups: [
        {
          key: 'ubuntu|18',
          matrix: { os: 'ubuntu', 'node-version': '18' },
          totalRuns: 5,
          failedRuns: 4,
          successRuns: 1,
          failureRate: 0.8,
          totalReruns: 6,
          avgReruns: 1.2,
          highRerunCount: 3,
          flakeScore: 85,
          flakeLevel: 'CRITICAL',
          failureSnippets: [
            {
              lineNumber: 42,
              filePath: 'test.log',
              logFile: 'test.log',
              pattern: 'error',
              snippet: 'Error: Connection timeout',
              matrix: { os: 'ubuntu', 'node-version': '18' }
            }
          ],
          logs: []
        }
      ],
      allLogs: []
    };

    const reporter = new Reporter(args);
    await reporter.generateAll(testAnalysis);

    const jsonPath = path.join(this.outputDir, 'matrix-flake-report.json');
    this.addTest('JSON报告生成', 
      fs.existsSync(jsonPath),
      `生成 JSON 报告: ${path.basename(jsonPath)}`
    );

    const csvPath = path.join(this.outputDir, 'matrix-flake-report.csv');
    this.addTest('CSV报告生成', 
      fs.existsSync(csvPath),
      `生成 CSV 报告: ${path.basename(csvPath)}`
    );

    const htmlPath = path.join(this.outputDir, 'matrix-flake-report.html');
    this.addTest('HTML报告生成', 
      fs.existsSync(htmlPath),
      `生成 HTML 报告: ${path.basename(htmlPath)}`
    );
  }

  async testEdgeCases() {
    console.log(chalk.blue('⚡ 测试边界情况...'));

    const args = {
      matrixKeys: ['os', 'node-version'],
      rerunThreshold: 1
    };

    const analyzer = new MatrixAnalyzer(args);

    const emptyAnalysis = analyzer.analyze([]);
    this.addTest('空日志处理', 
      emptyAnalysis.summary.totalLogs === 0,
      '正确处理空日志数组'
    );

    const singleLog = [{
      filePath: 'single.log',
      fileName: 'single.log',
      matrix: {},
      status: 'unknown',
      rerunCount: 0,
      failureSnippets: [],
      timestamps: []
    }];
    const singleAnalysis = analyzer.analyze(singleLog);
    this.addTest('未知参数处理', 
      singleAnalysis.groups.length === 1,
      '正确处理未知矩阵参数'
    );

    const mixedMatrix = [
      { matrix: { os: 'a', 'node-version': 'x' }, status: 'failed', rerunCount: 0 },
      { matrix: { os: 'a', 'node-version': 'y' }, status: 'success', rerunCount: 0 },
      { matrix: { os: 'b', 'node-version': 'x' }, status: 'failed', rerunCount: 0 }
    ].map(l => ({
      ...l,
      filePath: 'test.log',
      fileName: 'test.log',
      failureSnippets: [],
      timestamps: []
    }));

    const mixedAnalysis = analyzer.analyze(mixedMatrix);
    this.addTest('多矩阵分组', 
      mixedAnalysis.groups.length === 3,
      `正确分组 ${mixedAnalysis.groups.length} 个矩阵组合`
    );
  }

  addTest(name, passed, detail = '') {
    this.tests.push({ name, passed, detail });
    const status = passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(`  ${status} ${name}`);
    if (detail) {
      console.log(`     ${chalk.gray(detail)}`);
    }
  }

  printSummary() {
    const passed = this.tests.filter(t => t.passed).length;
    const total = this.tests.length;

    console.log('\n' + chalk.bold('='.repeat(60)));
    console.log(chalk.bold('📋 自检结果汇总'));
    console.log(chalk.bold('='.repeat(60)));
    console.log(`\n  通过: ${chalk.green(passed)} / ${total}`);
    console.log(`  成功率: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (passed !== total) {
      console.log(chalk.red('  失败的测试:'));
      for (const test of this.tests.filter(t => !t.passed)) {
        console.log(`    - ${test.name}`);
      }
      throw new Error('部分测试未通过');
    }
  }
}

if (require.main === module) {
  const outputDir = process.argv[2] || './self-test-results';
  const selfTest = new SelfTest(outputDir);
  selfTest.run();
}

module.exports = { SelfTest };
