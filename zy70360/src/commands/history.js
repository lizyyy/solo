const chalk = require('chalk');
const Table = require('cli-table3');
const HistoryStore = require('../storage/historyStore');
const PlanStore = require('../storage/planStore');

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

function historyCommand(options = {}) {
  const historyStore = new HistoryStore();
  const planStore = new PlanStore();

  let records;

  if (options.plan) {
    const plan = planStore.get(options.plan);
    if (!plan) {
      console.error(chalk.red(`❌ 计划不存在: ${options.plan}`));
      process.exit(1);
    }
    records = historyStore.getByPlan(plan.id);
  } else if (options.businessKey) {
    records = historyStore.getByBusinessKey(options.businessKey);
  } else if (options.topic) {
    records = historyStore.getByTopic(options.topic);
  } else if (options.deadLetter) {
    records = historyStore.getDeadLetters();
  } else {
    records = historyStore.getAll();
  }

  if (records.length === 0) {
    console.log(chalk.yellow('暂无历史记录'));
    return;
  }

  if (options.detail) {
    records.forEach(record => {
      console.log('');
      console.log(chalk.cyan('══════════════════════════════════════════════════════'));
      console.log(chalk.cyan(`  消息: ${record.messageId}`));
      console.log(chalk.cyan('══════════════════════════════════════════════════════'));
      console.log('');
      console.log(`业务键: ${chalk.yellow(record.businessKey || '-')}`);
      console.log(`主题: ${chalk.yellow(record.topic)}`);
      console.log(`投递次数: ${chalk.yellow(record.deliveryCount)}`);
      console.log(`状态: ${record.status === 'success' ? chalk.green(record.status) : chalk.red(record.status)}`);
      console.log(`死信: ${record.isDeadLetter ? chalk.yellow('是') : '否'}`);
      console.log(`重复忽略: ${record.isDuplicateIgnored ? chalk.green('是') : '否'}`);
      console.log('');

      if (record.deliveries.length > 0) {
        console.log(chalk.magenta('投递记录:'));
        record.deliveries.forEach((delivery, idx) => {
          const isDuplicate = delivery.isDuplicate ? chalk.blue('[重复]') : '';
          const statusColor = delivery.status === 'success' ? chalk.green : chalk.red;
          console.log(`  ${idx + 1}. 尝试 ${delivery.attempt} - ${statusColor(delivery.status)} ${isDuplicate}`);
          console.log(`     时间: ${formatDate(delivery.timestamp)}`);
          if (delivery.result) {
            console.log(`     原因: ${delivery.result.reason || '-'}`);
          }
        });
      }

      if (record.consumerResult) {
        console.log('');
        console.log(chalk.magenta('消费者结果:'));
        console.log(`  成功: ${record.consumerResult.success ? chalk.green('是') : chalk.red('否')}`);
        console.log(`  原因: ${record.consumerResult.reason || '-'}`);
      }
    });
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan('消息ID'),
      chalk.cyan('业务键'),
      chalk.cyan('主题'),
      chalk.cyan('投递次数'),
      chalk.cyan('状态'),
      chalk.cyan('死信'),
      chalk.cyan('创建时间')
    ],
    colWidths: [20, 20, 20, 10, 12, 6, 20]
  });

  records.forEach(record => {
    const statusColor = record.status === 'success' ? chalk.green : 
                       record.status === 'dead_letter' ? chalk.yellow : chalk.red;
    table.push([
      record.messageId ? record.messageId.substring(0, 8) + '...' : '-',
      record.businessKey || '-',
      record.topic,
      record.deliveryCount,
      statusColor(record.status),
      record.isDeadLetter ? chalk.yellow('是') : '-',
      formatDate(record.createdAt)
    ]);
  });

  console.log(chalk.cyan(`共 ${records.length} 条记录`));
  console.log('');
  console.log(table.toString());
  console.log('');
  console.log('使用 --detail 查看详细投递记录');
}

module.exports = historyCommand;
