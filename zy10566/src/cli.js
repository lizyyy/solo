#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { AuditOrchestrator } = require('./auditor');
const { Reporter } = require('./reporter');

const program = new Command();

program
  .name('cron-audit')
  .description('Cron表达式时区巡检工具 - 检测夏令时切换时的任务时间异常')
  .version('1.0.0');

program
  .command('audit')
  .description('运行时区巡检')
  .requiredOption('-i, --input <path>', '输入文件路径 (CSV或JSON)')
  .option('-o, --output-dir <dir>', '输出目录', 'reports')
  .option('-s, --start-date <date>', '审计开始日期 (ISO格式)')
  .option('-e, --end-date <date>', '审计结束日期 (ISO格式)')
  .option('-w, --window-days <days>', 'DST前后检查天数', '7')
  .option('--no-color', '禁用彩色输出')
  .action(async (options) => {
    try {
      const auditor = new AuditOrchestrator({
        dstWindowDays: parseInt(options.windowDays)
      });

      const result = auditor.runAudit(options.input, {
        startDate: options.startDate,
        endDate: options.endDate
      });

      if (!result.success) {
        console.error(chalk.red(`\n❌ 审计失败: ${result.error}\n`));
        process.exit(1);
      }

      const reporter = new Reporter({
        outputDir: options.outputDir,
        colors: options.color
      });

      reporter.generateAllReports(result);
    } catch (error) {
      console.error(chalk.red('\n❌ 发生错误:'));
      console.error(chalk.red(`  ${error.message}`));
      console.error(chalk.gray('\n  请检查输入文件格式是否正确。'));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查单个Cron表达式')
  .requiredOption('-c, --cron <expression>', 'Cron表达式')
  .requiredOption('-t, --timezone <timezone>', '时区')
  .option('-o, --output-dir <dir>', '输出目录', 'reports')
  .option('-s, --start-date <date>', '审计开始日期')
  .option('-e, --end-date <date>', '审计结束日期')
  .action(async (options) => {
    try {
      const auditor = new AuditOrchestrator();
      const result = auditor.runSingleTaskAudit(options.cron, options.timezone, {
        startDate: options.startDate,
        endDate: options.endDate
      });

      console.log('\n' + chalk.bold.blue('='.repeat(60)));
      console.log(chalk.bold.blue('              Cron 单个检查结果'));
      console.log(chalk.bold.blue('='.repeat(60)) + '\n');

      console.log(chalk.bold('📝 任务信息'));
      console.log(`  Cron表达式: ${chalk.cyan(options.cron)}`);
      console.log(`  时区: ${chalk.cyan(options.timezone)}`);
      console.log(`  状态: ${result.hasAnomalies ? chalk.yellow('⚠️ 发现异常') : chalk.green('✅ 正常')}\n`);

      if (result.hasAnomalies) {
        console.log(chalk.bold('🚨 异常详情'));
        result.anomalies.forEach((anomaly, idx) => {
          const severity = anomaly.severity === 'critical' ? chalk.red('🔴 严重') :
                          anomaly.severity === 'high' ? chalk.yellow('🟡 高') : chalk.blue('🟢 中');
          console.log(`  ${idx + 1}. ${severity}: ${anomaly.message}`);
          console.log(`     切换时间: ${anomaly.transitionDate}`);
          console.log(`     切换类型: ${anomaly.transition === 'spring-forward' ? '夏令时开始' : '冬令时开始'}\n`);
        });
      }

      if (result.runWindow) {
        console.log(chalk.bold('⏰ 下次执行时间 (前5次)'));
        result.runWindow.sampleRuns.forEach((run, idx) => {
          console.log(`  ${idx + 1}. UTC: ${run.utc}`);
          console.log(`     本地: ${run.local}`);
        });
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 发生错误:'));
      console.error(chalk.red(`  ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('convert')
  .description('转换Cron表达式时区')
  .requiredOption('-c, --cron <expression>', 'Cron表达式')
  .requiredOption('-f, --from <timezone>', '源时区')
  .requiredOption('-t, --to <timezone>', '目标时区')
  .action(async (options) => {
    try {
      const auditor = new AuditOrchestrator();
      const result = auditor.convertTimezone(options.cron, options.from, options.to);

      if (!result.valid) {
        console.log(chalk.red(`❌ 转换失败: ${result.error}`));
        process.exit(1);
      }

      console.log('\n' + chalk.bold.blue('='.repeat(60)));
      console.log(chalk.bold.blue('              Cron 时区转换结果'));
      console.log(chalk.bold.blue('='.repeat(60)) + '\n');

      console.log(chalk.bold('📌 原始'));
      console.log(`  Cron: ${chalk.cyan(result.original.expression)}`);
      console.log(`  时区: ${chalk.cyan(result.original.timezone)}\n`);

      console.log(chalk.bold('✨ 转换后'));
      console.log(`  Cron: ${chalk.green(result.converted.expression)}`);
      console.log(`  时区: ${chalk.green(result.converted.timezone)}\n`);

      if (result.note) {
        console.log(chalk.yellow(`⚠️  ${result.note}\n`));
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 发生错误:'));
      console.error(chalk.red(`  ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('example')
  .description('生成示例输入文件')
  .option('-f, --format <type>', '格式: csv 或 json', 'csv')
  .option('-o, --output <path>', '输出路径', 'examples/tasks.csv')
  .action(async (options) => {
    const fs = require('fs');
    const path = require('path');

    const csvContent = `taskName,cronExpression,timezone,service,owner,description
每日数据备份,0 2 * * *,America/New_York,infra,team-a,每日凌晨2点备份数据库
用户统计报表,0 3 * * ?,Europe/London,billing,team-b,每日生成用户消费报表
订单同步任务,*/30 * * * *,Asia/Tokyo,order,team-c,每30分钟同步订单
库存检查,0 9 * * 1-5,America/Los_Angeles,inventory,team-d,工作日早9点检查库存
邮件发送队列,*/15 8-18 * * *,Australia/Sydney,notifications,team-e,工作时间每15分钟发送邮件
,,InvalidTimezone,,,这是一条坏数据
UTC时间任务,0 12 * * *,UTC,global,team-f,UTC中午12点执行
北京时区任务,0 9 * * *,Asia/Shanghai,china,team-g,北京时间早9点
`;

    const jsonContent = JSON.stringify([
      { taskName: '每日数据备份', cronExpression: '0 2 * * *', timezone: 'America/New_York', service: 'infra', owner: 'team-a', description: '每日凌晨2点备份数据库' },
      { taskName: '用户统计报表', cronExpression: '0 3 * * ?', timezone: 'Europe/London', service: 'billing', owner: 'team-b', description: '每日生成用户消费报表' },
      { taskName: '订单同步任务', cronExpression: '*/30 * * * *', timezone: 'Asia/Tokyo', service: 'order', owner: 'team-c', description: '每30分钟同步订单' },
      { taskName: '库存检查', cronExpression: '0 9 * * 1-5', timezone: 'America/Los_Angeles', service: 'inventory', owner: 'team-d', description: '工作日早9点检查库存' },
      { taskName: '邮件发送队列', cronExpression: '*/15 8-18 * * *', timezone: 'Australia/Sydney', service: 'notifications', owner: 'team-e', description: '工作时间每15分钟发送邮件' },
      { cronExpression: '0 12 * * *', timezone: 'UTC', service: 'global', owner: 'team-f', description: 'UTC中午12点执行' },
      { taskName: '北京时区任务', cronExpression: '0 9 * * *', timezone: 'Asia/Shanghai', service: 'china', owner: 'team-g', description: '北京时间早9点' }
    ], null, 2);

    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const content = options.format === 'json' ? jsonContent : csvContent;
    const outputPath = options.format === 'json' ? options.output.replace(/\.csv$/, '.json') : options.output;
    
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(chalk.green(`✅ 示例文件已生成: ${outputPath}`));
    console.log(chalk.gray(`\n运行以下命令开始巡检:`));
    console.log(chalk.cyan(`  cron-audit audit -i ${outputPath}\n`));
  });

program.parse();
