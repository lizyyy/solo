const chalk = require('chalk');
const Table = require('cli-table3');
const HistoryStore = require('../storage/historyStore');
const DeliveryEngine = require('../engine/deliveryEngine');
const TopicStore = require('../storage/topicStore');

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

function printBusinessKeyAggregation(records) {
  const grouped = new Map();

  records.forEach(record => {
    const key = record.businessKey || record.messageId;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(record);
  });

  console.log('');
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log(chalk.cyan('  按业务键聚合报告'));
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log('');

  const summaryTable = new Table({
    head: [
      chalk.cyan('业务键'),
      chalk.cyan('消息数'),
      chalk.cyan('总投递'),
      chalk.cyan('重复投递'),
      chalk.cyan('死信'),
      chalk.cyan('状态')
    ],
    colWidths: [20, 10, 10, 12, 8, 12]
  });

  grouped.forEach((group, key) => {
    const totalDeliveries = group.reduce((sum, r) => sum + r.deliveryCount, 0);
    const duplicateDeliveries = group.reduce((sum, r) => {
      return sum + r.deliveries.filter(d => d.isDuplicate).length;
    }, 0);
    const hasDeadLetter = group.some(r => r.isDeadLetter);
    const allSuccess = group.every(r => r.status === 'success');
    const anyIgnored = group.some(r => r.isDuplicateIgnored);

    let status;
    if (hasDeadLetter) status = chalk.yellow('死信');
    else if (duplicateDeliveries > 0 && anyIgnored) status = chalk.green('幂等✅');
    else if (duplicateDeliveries > 0) status = chalk.red('需检查⚠️');
    else if (allSuccess) status = chalk.green('成功');
    else status = chalk.red('失败');

    summaryTable.push([
      key,
      group.length,
      totalDeliveries,
      duplicateDeliveries,
      hasDeadLetter ? chalk.yellow('是') : '-',
      status
    ]);
  });

  console.log(summaryTable.toString());
  console.log('');

  grouped.forEach((group, key) => {
    const hasDuplicates = group.some(r => 
      r.deliveries.some(d => d.isDuplicate)
    );
    const hasIgnored = group.some(r => r.isDuplicateIgnored);

    if (hasDuplicates) {
      console.log(chalk.magenta(`业务键 ${chalk.yellow(key)} 的投递详情:`));
      
      group.forEach(record => {
        const duplicateDeliveries = record.deliveries.filter(d => d.isDuplicate);
        if (duplicateDeliveries.length > 0) {
          console.log(`  消息 ${record.messageId.substring(0, 8)}...:`);
          console.log(`    正常投递: ${record.deliveries.filter(d => !d.isDuplicate).length} 次`);
          console.log(`    重复投递: ${chalk.blue(duplicateDeliveries.length)} 次`);
          console.log(`    消费者忽略: ${record.isDuplicateIgnored ? chalk.green('是 ✅') : chalk.red('否 ⚠️')}`);
          
          if (!record.isDuplicateIgnored) {
            console.log(chalk.red(`      ⚠️ 警告: 重复消息未被忽略，可能导致幂等问题！`));
          }
        }
      });
      console.log('');
    }
  });
}

function printDeadLetterReport(records) {
  const deadLetters = records.filter(r => r.isDeadLetter);

  if (deadLetters.length === 0) {
    console.log('');
    console.log(chalk.green('✅ 暂无死信消息'));
    return;
  }

  console.log('');
  console.log(chalk.yellow('══════════════════════════════════════════════════════'));
  console.log(chalk.yellow('  死信消息报告'));
  console.log(chalk.yellow('══════════════════════════════════════════════════════'));
  console.log('');

  const table = new Table({
    head: [
      chalk.cyan('消息ID'),
      chalk.cyan('业务键'),
      chalk.cyan('主题'),
      chalk.cyan('投递次数'),
      chalk.cyan('最后失败原因')
    ],
    colWidths: [20, 20, 20, 10, 30]
  });

  deadLetters.forEach(record => {
    const lastDelivery = record.deliveries[record.deliveries.length - 1];
    const reason = lastDelivery?.result?.reason || '-';
    table.push([
      record.messageId.substring(0, 8) + '...',
      record.businessKey || '-',
      record.topic,
      record.deliveryCount,
      reason
    ]);
  });

  console.log(table.toString());
  console.log('');
  console.log(chalk.yellow(`共 ${deadLetters.length} 条死信消息`));
  console.log('');
  console.log('使用 mq-sim ack --redelivery <消息ID> 重新投递死信消息');
}

async function reportCommand(options = {}) {
  const historyStore = new HistoryStore();
  const records = historyStore.getAll();

  if (records.length === 0) {
    console.log(chalk.yellow('暂无历史记录，无法生成报告'));
    return;
  }

  if (options.deadLetter) {
    printDeadLetterReport(records);
    return;
  }

  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log(chalk.cyan('  消息投递模拟报告'));
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log('');
  console.log(`生成时间: ${chalk.yellow(formatDate(Date.now()))}`);
  console.log('');

  const totalMessages = records.length;
  const successMessages = records.filter(r => r.status === 'success').length;
  const failedMessages = records.filter(r => r.status === 'failed').length;
  const deadLetters = records.filter(r => r.isDeadLetter).length;
  const totalDeliveries = records.reduce((sum, r) => sum + r.deliveryCount, 0);
  const duplicateDeliveries = records.reduce((sum, r) => {
    return sum + r.deliveries.filter(d => d.isDuplicate).length;
  }, 0);
  const ignoredDuplicates = records.filter(r => r.isDuplicateIgnored).length;

  const summaryTable = new Table({
    head: [chalk.cyan('指标'), chalk.cyan('数值')],
    colWidths: [25, 25]
  });

  summaryTable.push(
    ['总消息数', totalMessages],
    ['成功处理', chalk.green(successMessages)],
    ['处理失败', chalk.red(failedMessages)],
    ['死信消息', chalk.yellow(deadLetters)],
    ['总投递次数', totalDeliveries],
    ['重复投递次数', chalk.blue(duplicateDeliveries)],
    ['正确忽略重复', chalk.green(ignoredDuplicates)],
    ['幂等通过率', duplicateDeliveries > 0 
      ? chalk.green(`${Math.round((ignoredDuplicates / records.filter(r => 
          r.deliveries.some(d => d.isDuplicate)
        ).length) * 100)}%`) 
      : chalk.gray('N/A')]
  );

  console.log(summaryTable.toString());

  printBusinessKeyAggregation(records);
  printDeadLetterReport(records);

  console.log('');
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log(chalk.magenta('💡 审核建议:'));
  if (duplicateDeliveries > 0) {
    console.log('  • 检查消费者是否正确忽略重复消息');
    console.log('  • 确保业务键唯一性');
  }
  if (deadLetters > 0) {
    console.log('  • 分析死信原因，是否需要调整重试策略');
    console.log('  • 考虑手动重新投递死信消息');
  }
  console.log('');
}

async function ackCommand(messageId, options = {}) {
  const historyStore = new HistoryStore();
  const topicStore = new TopicStore();

  if (options.redelivery) {
    const record = historyStore.get(options.redelivery);
    if (!record) {
      console.error(chalk.red(`❌ 消息不存在: ${options.redelivery}`));
      process.exit(1);
    }

    if (!record.isDeadLetter) {
      console.log(chalk.yellow('该消息不是死信消息，无需重新投递'));
      return;
    }

    console.log(chalk.cyan(`重新投递死信消息: ${record.messageId}`));
    console.log(chalk.cyan(`业务键: ${record.businessKey}`));

    const engine = new DeliveryEngine({
      topicStore,
      historyStore
    });

    try {
      const result = await engine.redeliverDeadLetter(record);
      if (result.success) {
        console.log(chalk.green('✅ 重新投递成功！'));
      } else {
        console.log(chalk.red('❌ 重新投递失败'));
        console.log(`原因: ${result.result.reason}`);
      }
    } catch (error) {
      console.error(chalk.red(`❌ 重投递失败: ${error.message}`));
      process.exit(1);
    }
    return;
  }

  const record = historyStore.get(messageId);
  if (!record) {
    console.error(chalk.red(`❌ 消息不存在: ${messageId}`));
    process.exit(1);
  }

  console.log(chalk.cyan(`手动确认消息: ${messageId}`));
  record.status = 'success';
  record.setConsumerResult({
    success: true,
    reason: 'MANUAL_ACK',
    timestamp: Date.now()
  }, false);
  historyStore.update(record);

  console.log(chalk.green('✅ 消息已手动确认'));
}

module.exports = { reportCommand, ackCommand };
