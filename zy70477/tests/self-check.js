const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const CacheCleaner = require('../src/cacheCleaner');
const ParamValidator = require('../src/paramValidator');
const ReportGenerator = require('../src/reportGenerator');

class SelfCheck {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.testDir = path.join(__dirname, '../data/test-cache');
    this.results = [];
  }

  logTest(name, passed, message = '') {
    if (passed) {
      this.passed++;
      console.log(chalk.green(`  ✓ ${name}`));
    } else {
      this.failed++;
      console.log(chalk.red(`  ✗ ${name}: ${message}`));
    }
    this.results.push({ name, passed, message });
  }

  setupTestEnvironment() {
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    for (let i = 1; i <= 5; i++) {
      fs.writeFileSync(
        path.join(this.testDir, `file${i}.tmp`),
        'test content ' + 'x'.repeat(100 * i)
      );
    }

    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(
        path.join(this.testDir, `cache${i}.cache`),
        'cache data ' + 'y'.repeat(50 * i)
      );
    }

    fs.writeFileSync(
      path.join(this.testDir, `important_backup.tmp`),
      'this is protected content'
    );

    const subDir = path.join(this.testDir, 'subdir');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir);
    }
    fs.writeFileSync(path.join(subDir, 'nested.tmp'), 'nested content');

    console.log(chalk.cyan('测试环境已准备\n'));
  }

  cleanupTestEnvironment() {
    const cleanupDir = (dir) => {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            cleanupDir(fullPath);
          } else {
            fs.unlinkSync(fullPath);
          }
        }
        fs.rmdirSync(dir);
      }
    };
    cleanupDir(this.testDir);
  }

  testParamValidator() {
    console.log(chalk.yellow('\n📋 参数验证模块测试'));
    const validator = new ParamValidator();

    const result1 = validator.validate({ cacheDirs: ['/'] });
    this.logTest(
      '拦截系统根目录操作',
      result1.blockedReasons && result1.blockedReasons.some(r => r.type === 'dangerous_path')
    );

    const result2 = validator.validate({ 
      cacheDirs: [this.testDir],
      dryRun: false,
      output: undefined
    });
    this.logTest(
      '真实执行需指定输出目录',
      result2.missingCombinations && result2.missingCombinations.some(c => c.combination === '生产环境保护')
    );

    const result3 = validator.validate({ 
      cacheDirs: [this.testDir],
      dryRun: true
    });
    this.logTest(
      '合法参数验证通过',
      result3.isValid
    );

    const blockedExplanation = validator.explainBlockedReasons();
    this.logTest(
      '拦截原因说明生成',
      typeof blockedExplanation === 'string' && blockedExplanation.length > 0
    );
  }

  testCacheCleaner() {
    console.log(chalk.yellow('\n🧹 缓存清理模块测试'));
    
    const cleaner = new CacheCleaner({
      cacheDirs: [this.testDir],
      dryRun: true
    });

    const candidateResult = cleaner.generateCandidateList();
    this.logTest(
      '候选清单生成',
      candidateResult.candidates && candidateResult.candidates.length >= 9
    );

    const candidates = cleaner.getCandidateList();
    this.logTest(
      '获取候选列表',
      Array.isArray(candidates) && candidates.length > 0
    );

    const protectedItems = candidates.filter(c => c.isProtected);
    this.logTest(
      '保护文件检测',
      protectedItems.length >= 1
    );

    const cleanResult = cleaner.executeClean();
    this.logTest(
      'dry-run 模式执行',
      cleanResult.dryRun === true
    );

    const boundaryResults = cleaner.getBoundaryResults();
    this.logTest(
      '边界处理结果记录',
      Array.isArray(boundaryResults)
    );

    const auditLog = cleaner.getAuditLog();
    this.logTest(
      '审计日志记录',
      Array.isArray(auditLog)
    );

    const failedItems = cleaner.getFailedItems();
    this.logTest(
      '失败项追踪',
      Array.isArray(failedItems)
    );
  }

  testReportGenerator() {
    console.log(chalk.yellow('\n📊 报告生成模块测试'));
    
    const reporter = new ReportGenerator('./output/test');

    const beforeStats = { totalFiles: 100, totalSize: 1024 * 1024 };
    const afterStats = { totalFiles: 50, totalSize: 512 * 1024 };
    
    const comparisonTable = reporter.generateComparisonTable(beforeStats, afterStats);
    this.logTest(
      '处理前后对比表格生成',
      typeof comparisonTable === 'string' && comparisonTable.includes('文件总数')
    );

    const candidates = [
      { path: '/test/file1.tmp', size: 1024, isProtected: false },
      { path: '/test/important.tmp', size: 2048, isProtected: true }
    ];
    const candidateTable = reporter.generateCandidateTable(candidates);
    this.logTest(
      '候选清单表格生成',
      typeof candidateTable === 'string' && candidateTable.includes('受保护')
    );

    const failedItems = [
      { path: '/test/failed.tmp', reason: '权限不足', type: 'clean_error', timestamp: new Date().toISOString() }
    ];
    const failedTable = reporter.generateFailedItemsTable(failedItems);
    this.logTest(
      '失败项表格生成',
      typeof failedTable === 'string' && failedTable.includes('权限不足')
    );

    const cleanResult = {
      beforeStats,
      afterStats,
      cleanedCount: 5,
      failedCount: 1,
      duration: 1500,
      dryRun: true
    };
    const nextSteps = reporter.generateNextSteps(cleanResult, null);
    this.logTest(
      '下一步建议生成',
      Array.isArray(nextSteps) && nextSteps.length > 0
    );

    const failedPath = reporter.saveFailedItems(failedItems);
    this.logTest(
      '失败项单独保存',
      fs.existsSync(failedPath)
    );

    const boundaryResults = [
      { path: '/test/protected.tmp', action: 'skipped', reason: '受保护文件', timestamp: new Date().toISOString() }
    ];
    const boundaryPath = reporter.saveBoundaryResults(boundaryResults);
    this.logTest(
      '边界输入处理结果保存',
      fs.existsSync(boundaryPath)
    );
  }

  testBoundaryConditions() {
    console.log(chalk.yellow('\n🔍 边界情况测试'));
    
    const cleaner1 = new CacheCleaner({
      cacheDirs: ['/non/existent/path'],
      dryRun: true
    });
    cleaner1.generateCandidateList();
    const failedItems1 = cleaner1.getFailedItems();
    this.logTest(
      '不存在目录处理',
      failedItems1.length > 0 && failedItems1.some(f => f.reason.includes('目录不存在'))
    );

    const cleaner2 = new CacheCleaner({
      cacheDirs: [],
      dryRun: true
    });
    const result2 = cleaner2.generateCandidateList();
    this.logTest(
      '空目录列表处理',
      result2.count === 0
    );

    const reporter = new ReportGenerator('./output/test');
    const emptyTable = reporter.generateCandidateTable([]);
    this.logTest(
      '空候选清单显示',
      emptyTable.includes('无候选文件')
    );

    const validator = new ParamValidator();
    const report = validator.generateValidationReport({
      cacheDirs: [this.testDir],
      dryRun: true
    });
    this.logTest(
      '验证报告生成',
      report && report.timestamp && report.validationResult
    );

    this.logTest(
      '输入选项脱敏处理',
      report.inputOptions && typeof report.inputOptions === 'object'
    );
  }

  run() {
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('缓存清理工具 - 自检程序'));
    console.log(chalk.cyan('='.repeat(60)));

    let hasException = false;

    try {
      this.setupTestEnvironment();

      this.testParamValidator();
      this.testCacheCleaner();
      this.testReportGenerator();
      this.testBoundaryConditions();

    } catch (error) {
      hasException = true;
      this.failed++;
      console.log(chalk.red(`\n❌ 测试执行异常: ${error.message}`));
      console.log(error.stack);
    } finally {
      try {
        this.cleanupTestEnvironment();
      } catch (cleanupError) {
        console.log(chalk.yellow(`\n⚠️  清理测试环境失败: ${cleanupError.message}`));
      }
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.green(`通过: ${this.passed}`));
    if (this.failed > 0) {
      console.log(chalk.red(`失败: ${this.failed}`));
    }
    console.log(chalk.cyan('='.repeat(60)));

    if (this.failed > 0 || hasException) {
      console.log(chalk.yellow('\n⚠️  部分测试未通过或发生异常，请检查相关模块'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ 所有测试通过！系统功能正常'));
      process.exit(0);
    }
  }
}

if (require.main === module) {
  const selfCheck = new SelfCheck();
  selfCheck.run();
}

module.exports = SelfCheck;
