const { Command } = require('commander');
const chalk = require('chalk');

const initCommand = require('./commands/init');
const publishCommand = require('./commands/publish');
const runCommand = require('./commands/run');
const historyCommand = require('./commands/history');
const { reportCommand, ackCommand } = require('./commands/report');

function createCLI() {
  const program = new Command();

  program
    .name('mq-sim')
    .description('本地消息投递模拟CLI - 测试消息幂等性')
    .version('1.0.0');

  program
    .command('init')
    .description('初始化模拟器，创建默认主题和配置')
    .option('--force', '强制重新初始化')
    .action((options) => {
      initCommand(options);
    });

  program
    .command('publish <planFile>')
    .description('发布投递计划')
    .option('-k, --business-key <key>', '默认业务键')
    .action((planFile, options) => {
      publishCommand(planFile, options);
    });

  program
    .command('run [planName]')
    .description('执行投递计划')
    .option('--demo', '运行演示模式')
    .option('--delay <ms>', '消费者延迟(ms)', '100')
    .option('--always-fail', '模拟消费者总是失败')
    .action((planName, options) => {
      runCommand(planName, options);
    });

  program
    .command('history')
    .description('查看投递历史')
    .option('-p, --plan <name>', '按计划过滤')
    .option('-k, --business-key <key>', '按业务键过滤')
    .option('-t, --topic <name>', '按主题过滤')
    .option('--dead-letter', '只看死信消息')
    .option('--detail', '显示详细信息')
    .action((options) => {
      historyCommand(options);
    });

  program
    .command('report')
    .description('生成模拟报告')
    .option('--dead-letter', '只看死信报告')
    .action((options) => {
      reportCommand(options);
    });

  program
    .command('ack [messageId]')
    .description('手动确认消息或重新投递死信')
    .option('--redelivery <messageId>', '重新投递死信消息')
    .action((messageId, options) => {
      ackCommand(messageId, options);
    });

  return program;
}

async function main() {
  try {
    const program = createCLI();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(`\n❌ 错误: ${error.message}`));
    process.exit(1);
  }
}

module.exports = {
  createCLI,
  main
};
