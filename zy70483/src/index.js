#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const readline = require('readline');
const DependencyManager = require('./core/DependencyManager');
const CertificateManager = require('./core/CertificateManager');
const HistoryManager = require('./core/HistoryManager');
const BusReservationManager = require('./core/BusReservationManager');
const RuleManager = require('./core/RuleManager');

const depManager = new DependencyManager();
const certManager = new CertificateManager();
const historyManager = new HistoryManager();
const busManager = new BusReservationManager();
const ruleManager = new RuleManager();

program
  .name('depmgr')
  .description('依赖管理命令行工具')
  .version('1.0.0');

program
  .command('start-order')
  .description('计算依赖启动顺序')
  .option('-s, --services <items>', '服务列表，逗号分隔')
  .action((options) => {
    console.log(chalk.blue('\n=== 依赖启动顺序计算 ===\n'));
    const services = options.services ? options.services.split(',') : null;
    const result = depManager.calculateStartOrder(services);
    depManager.printResult(result);
  });

program
  .command('cert-issue')
  .description('签发离线证书')
  .option('-d, --demo', '使用演示数据')
  .option('-n, --name <name>', '证书名称')
  .option('-o, --operator <operator>', '操作者')
  .action((options) => {
    console.log(chalk.blue('\n=== 离线证书签发 ===\n'));
    const result = certManager.issueCertificate(options);
    certManager.printResult(result);
    historyManager.record('cert-issue', options.operator || 'system', result);
  });

program
  .command('rollback')
  .description('回滚操作')
  .option('-b, --batch <batchId>', '批次ID')
  .option('-t, --type <type>', '操作类型')
  .option('-p, --preview', '仅生成候选清单，不执行回滚')
  .option('-y, --yes', '跳过确认，直接执行回滚')
  .action(async (options) => {
    console.log(chalk.blue('\n=== 回滚操作 ===\n'));
    const candidates = certManager.generateRollbackCandidates(options);
    certManager.printCandidates(candidates);

    if (candidates.total === 0) {
      console.log(chalk.yellow('⚠️  没有可回滚的候选记录'));
      return;
    }

    if (options.preview) {
      console.log(chalk.green('✅ 预览模式，仅生成候选清单，不执行回滚'));
      console.log(chalk.gray('如需执行回滚，请移除 --preview 参数并确认操作'));
      return;
    }

    if (!options.yes) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question(chalk.yellow('⚠️  请确认是否执行回滚？此操作不可撤销 (yes/no): '), resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log(chalk.yellow('⚠️  用户取消操作，未执行回滚'));
        return;
      }
    }

    console.log(chalk.green('\n✅ 开始执行回滚...\n'));
    const result = certManager.executeRollback(candidates);
    certManager.printRollbackResult(result);
    historyManager.record('rollback', 'system', result);
  });

program
  .command('history')
  .description('历史查询')
  .option('-b, --batch <batchId>', '按批次过滤')
  .option('-o, --operator <operator>', '按操作者过滤')
  .option('-r, --risk <riskType>', '按风险类型过滤')
  .action((options) => {
    console.log(chalk.blue('\n=== 历史查询 ===\n'));
    const records = historyManager.query(options);
    historyManager.printRecords(records);
  });

program
  .command('bus-import')
  .description('导入班车预约名单')
  .option('-f, --file <path>', '文件路径')
  .action((options) => {
    console.log(chalk.blue('\n=== 班车预约名单导入 ===\n'));
    const result = busManager.importReservations(options.file);
    busManager.printResult(result);
    historyManager.record('bus-import', 'system', result);
  });

program
  .command('bus-query')
  .description('查询班车预约')
  .option('-l, --line <lineNumber>', '按原始行号查询')
  .action((options) => {
    console.log(chalk.blue('\n=== 班车预约查询 ===\n'));
    const record = busManager.queryByLineNumber(options.line);
    busManager.printRecord(record);
  });

program
  .command('rule-list')
  .description('列出规则版本')
  .action(() => {
    console.log(chalk.blue('\n=== 规则版本列表 ===\n'));
    const rules = ruleManager.listRules();
    ruleManager.printRules(rules);
  });

program
  .command('rule-explain')
  .description('解释批次规则口径')
  .option('-b, --batch <batchId>', '批次ID')
  .action((options) => {
    console.log(chalk.blue('\n=== 规则口径解释 ===\n'));
    const explanation = ruleManager.explainBatchRules(options.batch);
    ruleManager.printExplanation(explanation);
  });

program.parse(process.argv);
