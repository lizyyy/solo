const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const validator = require('./validator');
const ChangelogParser = require('./parser');
const TicketMatcher = require('./ticketMatcher');
const ModuleAnalyzer = require('./moduleAnalyzer');
const RiskAnalyzer = require('./riskAnalyzer');
const Reporter = require('./reporter');

const program = new Command();

async function main() {
  program
    .name('changelog-ticket')
    .description('变更日志工单链接 CLI 工具 - 解析发布日志、匹配工单、分析模块归属和风险分级')
    .version('1.0.0', '-v, --version', '显示版本号');

  program
    .requiredOption('-c, --changelog <path>', 'Markdown 格式变更日志文件路径')
    .option('-o, --owners <path>', '负责人表 JSON 文件路径，用于关联模块负责人')
    .option('-r, --risk-words <path>', '自定义风险词 JSON 文件路径')
    .option('-m, --module-tags <path>', '模块标签 JSON 文件路径')
    .option('-t, --ticket-patterns <path>', '自定义工单匹配模式 JSON 文件路径')
    .option('-d, --output-dir <dir>', '输出目录，默认: ./output', './output')
    .option('-f, --format <format>', '输出格式: terminal|json|markdown|all', 'all')
    .option('--no-color', '禁用彩色输出')
    .option('--strict', '严格模式，发现问题时以错误码退出')
    .option('--verbose', '显示详细处理信息');

  program.parse();

  const options = program.opts();

  if (options.noColor) {
    chalk.level = 0;
  }

  console.log(chalk.blue('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║          变更日志工单链接 CLI 工具 v1.0.0                     ║'));
  console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝\n'));

  if (options.verbose) {
    console.log(chalk.gray('配置加载中...'));
  }

  config.load();

  if (options.ticketPatterns) {
    const customPatterns = require(path.resolve(options.ticketPatterns));
    config.set('ticket.patterns', customPatterns);
  }

  if (options.moduleTags) {
    const customModules = require(path.resolve(options.moduleTags));
    config.set('modules', customModules);
  }

  if (options.riskWords) {
    const customRisk = require(path.resolve(options.riskWords));
    config.set('risk.keywords', customRisk);
  }

  if (options.verbose) {
    console.log(chalk.gray('输入校验中...'));
  }

  const validation = validator.validate(options);

  if (!validation.isValid) {
    console.error(chalk.red('\n❌ 输入校验失败:'));
    validation.errors.forEach(err => console.error(chalk.red(`   • ${err}`)));
    process.exit(config.get('exitCodes.ERROR_VALIDATION_FAILED'));
  }

  if (validation.warnings.length > 0 && options.verbose) {
    console.log(chalk.yellow('\n⚠️  警告:'));
    validation.warnings.forEach(warn => console.log(chalk.yellow(`   • ${warn}`)));
  }

  try {
    if (options.verbose) {
      console.log(chalk.gray('\n正在解析变更日志...'));
    }

    const changelogContent = fs.readFileSync(path.resolve(options.changelog), 'utf-8');
    const parser = new ChangelogParser();
    const entries = parser.parse(changelogContent);

    if (options.verbose) {
      console.log(chalk.green(`   ✓ 解析完成，共 ${entries.length} 条变更记录`));
    }

    if (entries.length === 0) {
      console.error(chalk.red('\n❌ 未解析到任何变更记录'));
      process.exit(config.get('exitCodes.ERROR_PARSE_FAILED'));
    }

    if (options.verbose) {
      console.log(chalk.gray('\n正在匹配工单...'));
    }

    const ticketMatcher = new TicketMatcher();
    const entriesWithTickets = entries.map(entry => ({
      ...entry,
      tickets: ticketMatcher.match(entry.content),
      ticketCount: 0
    }));

    entriesWithTickets.forEach(entry => {
      entry.ticketCount = entry.tickets.reduce((sum, t) => sum + t.matches.length, 0);
    });

    const totalTickets = entriesWithTickets.reduce((sum, e) => sum + e.ticketCount, 0);
    const entriesWithoutTickets = entriesWithTickets.filter(e => e.ticketCount === 0).length;

    if (options.verbose) {
      console.log(chalk.green(`   ✓ 匹配完成，共找到 ${totalTickets} 个工单，${entriesWithoutTickets} 条记录无工单`));
    }

    if (options.verbose) {
      console.log(chalk.gray('\n正在分析模块归属...'));
    }

    const moduleAnalyzer = new ModuleAnalyzer();
    let owners = null;
    if (options.owners) {
      owners = require(path.resolve(options.owners));
    }

    const entriesWithModules = entriesWithTickets.map(entry => ({
      ...entry,
      modules: moduleAnalyzer.analyze(entry.content, owners)
    }));

    const moduleStats = moduleAnalyzer.getStats(entriesWithModules);

    if (options.verbose) {
      console.log(chalk.green(`   ✓ 分析完成，涉及 ${Object.keys(moduleStats).length} 个模块`));
    }

    if (options.verbose) {
      console.log(chalk.gray('\n正在进行风险分级...'));
    }

    const riskAnalyzer = new RiskAnalyzer();
    const entriesWithRisk = entriesWithModules.map(entry => ({
      ...entry,
      risk: riskAnalyzer.analyze(entry.content)
    }));

    const riskStats = riskAnalyzer.getStats(entriesWithRisk);

    if (options.verbose) {
      console.log(chalk.green(`   ✓ 风险分析完成`));
    }

    const result = {
      meta: {
        generatedAt: new Date().toISOString(),
        sourceFile: options.changelog,
        totalEntries: entriesWithRisk.length,
        totalTickets,
        entriesWithoutTickets
      },
      statistics: {
        tickets: {
          total: totalTickets,
          withTickets: entriesWithRisk.length - entriesWithoutTickets,
          withoutTickets: entriesWithoutTickets
        },
        modules: moduleStats,
        risk: riskStats
      },
      entries: entriesWithRisk
    };

    if (options.verbose) {
      console.log(chalk.gray('\n正在生成报告...'));
    }

    const reporter = new Reporter(options);
    const formats = options.format === 'all' ? ['terminal', 'json', 'markdown'] : [options.format];

    if (formats.includes('terminal')) {
      reporter.printTerminal(result);
    }

    if (formats.includes('json')) {
      await reporter.writeJson(result);
    }

    if (formats.includes('markdown')) {
      await reporter.writeMarkdown(result);
    }

    let exitCode = config.get('exitCodes.SUCCESS');

    if (entriesWithoutTickets > 0) {
      if (options.strict) {
        exitCode = config.get('exitCodes.WARNING_MISSING_TICKETS');
      }
    }

    if (riskStats.high.count > 0) {
      if (options.strict) {
        exitCode = config.get('exitCodes.WARNING_HIGH_RISK');
      }
    }

    console.log(chalk.green('\n✓ 处理完成!'));
    console.log(chalk.gray(`退出码: ${exitCode}`));

    process.exit(exitCode);

  } catch (error) {
    console.error(chalk.red('\n❌ 处理失败:'));
    console.error(chalk.red(`   ${error.message}`));
    if (options.verbose) {
      console.error(chalk.red(error.stack));
    }
    process.exit(config.get('exitCodes.ERROR_PARSE_FAILED'));
  }
}

main().catch(err => {
  console.error(chalk.red('未预期的错误:'), err);
  process.exit(1);
});
