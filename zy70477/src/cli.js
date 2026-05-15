#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');

const CacheCleaner = require('./cacheCleaner');
const ParamValidator = require('./paramValidator');
const ReportGenerator = require('./reportGenerator');

const program = new Command();

program
  .name('cache-cleaner')
  .description('缓存清理命令行工具 - 安全、可追溯、带完整报告')
  .version('1.0.0');

program
  .option('-d, --cache-dirs <dirs...>', '指定要清理的缓存目录，多个用空格分隔')
  .option('-p, --patterns <patterns...>', '文件匹配模式，默认: *.tmp *.cache', ['*.tmp', '*.cache'])
  .option('--no-dry-run', '执行真实清理（默认仅预览）')
  .option('-f, --force', '强制执行，忽略保护文件检测')
  .option('-i, --input <file>', '输入背景文件（网关错误摘录等）')
  .option('-o, --output <dir>', '输出报告目录，默认: ./output')
  .option('-b, --backup <dir>', '备份目录（用于回滚）')
  .option('-r, --rollback', '执行回滚操作')
  .option('--self-test', '运行自检脚本，覆盖边界情况')
  .action(async (options) => {
    console.log(chalk.cyan('\n🚀 缓存清理工具启动\n'));

    if (options.selfTest) {
      console.log(chalk.yellow('📋 运行自检脚本...\n'));
      const selfTestPath = require('path').join(__dirname, '../tests/self-check.js');
      if (fs.existsSync(selfTestPath)) {
        require(selfTestPath);
      } else {
        console.log(chalk.red('❌ 自检脚本不存在'));
      }
      return;
    }

    const validator = new ParamValidator();
    const validationReport = validator.generateValidationReport({
      cacheDirs: options.cacheDirs,
      dryRun: options.dryRun,
      force: options.force,
      input: options.input,
      output: options.output,
      backup: options.backup,
      rollback: options.rollback
    });

    const { isValid, blockedReasons } = validationReport.validationResult;
    
    if (blockedReasons && blockedReasons.some(r => r.blocked)) {
      console.log(chalk.red('\n❌ 操作被拦截！原因如下：'));
      console.log(validationReport.blockedExplanation);
      console.log(chalk.yellow('\n💡 建议操作：'));
      validationReport.recommendations.forEach((rec, idx) => {
        console.log(`  ${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.action}: ${rec.detail}`);
      });
      process.exit(1);
    }

    if (!isValid) {
      console.log(chalk.red('\n⚠️  参数验证存在问题：'));
      validationReport.validationResult.errors.forEach(err => {
        console.log(`  - ${err.param}: ${err.reason}`);
      });
      console.log(validationReport.blockedExplanation);
      process.exit(1);
    }

    let inputContext = null;
    if (options.input) {
      try {
        inputContext = fs.readFileSync(options.input, 'utf-8');
        console.log(chalk.green(`✓ 已加载输入背景: ${options.input}`));
      } catch (error) {
        console.log(chalk.yellow(`⚠️  无法读取输入文件: ${error.message}`));
      }
    }

    const outputDir = options.output || './output';
    const reporter = new ReportGenerator(outputDir);
    const cleaner = new CacheCleaner({
      cacheDirs: options.cacheDirs || [],
      dryRun: options.dryRun,
      force: options.force
    });

    if (options.rollback) {
      console.log(chalk.yellow('\n🔄 执行回滚操作...'));
      const auditLog = cleaner.rollback();
      reporter.saveAuditLog(auditLog);
      console.log(chalk.green('✓ 回滚操作记录已保存'));
      return;
    }

    console.log(chalk.yellow('\n📋 生成候选清单...'));
    const candidateResult = cleaner.generateCandidateList(options.patterns);
    const candidates = cleaner.getCandidateList();
    
    console.log(chalk.green(`✓ 找到 ${candidates.length} 个候选文件`));
    reporter.saveCandidateList(candidates);

    console.log(chalk.yellow('\n🧹 执行清理...'));
    const cleanResult = cleaner.executeClean();
    
    const failedItems = cleaner.getFailedItems();
    const boundaryResults = cleaner.getBoundaryResults();
    const auditLog = cleaner.getAuditLog();

    reporter.printConsoleSummary(cleanResult, candidates, failedItems, boundaryResults);

    console.log(chalk.yellow('📊 生成报告...'));
    const { reportPath } = reporter.generateFullReport(
      cleanResult,
      candidates,
      failedItems,
      boundaryResults,
      validationReport,
      inputContext
    );

    if (failedItems.length > 0) {
      const failedPath = reporter.saveFailedItems(failedItems);
      console.log(chalk.red(`✗ 失败项已保存至: ${failedPath}`));
    }

    if (boundaryResults.length > 0) {
      const boundaryPath = reporter.saveBoundaryResults(boundaryResults);
      console.log(chalk.yellow(`⚠️  边界处理结果已保存至: ${boundaryPath}`));
    }

    if (auditLog.length > 0) {
      const auditPath = reporter.saveAuditLog(auditLog);
      console.log(chalk.green(`✓ 审计日志已保存至: ${auditPath}`));
    }

    console.log(chalk.green(`\n✓ 完整报告已生成: ${reportPath}`));
    
    console.log(chalk.cyan('\n✅ 操作完成！\n'));
  });

program.parse();
