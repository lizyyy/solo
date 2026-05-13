const chalk = require('chalk');
const Table = require('cli-table3');
const Message = require('../models/message');
const DeliveryPlan = require('../models/deliveryPlan');
const TopicStore = require('../storage/topicStore');
const PlanStore = require('../storage/planStore');
const HistoryStore = require('../storage/historyStore');
const DeliveryEngine = require('../engine/deliveryEngine');
const { v4: uuidv4 } = require('uuid');

function createDemoPlans() {
  return [
    {
      name: 'order-demo-normal',
      description: '正常投递演示',
      topic: 'order.created',
      messages: [
        { businessKey: 'ORDER-2024-001', payload: { orderId: 'ORDER-2024-001', userId: 'user-001', amount: 99.00 } },
        { businessKey: 'ORDER-2024-002', payload: { orderId: 'ORDER-2024-002', userId: 'user-002', amount: 199.00 } }
      ],
      rules: {}
    },
    {
      name: 'order-demo-duplicate',
      description: '重复投递演示',
      topic: 'order.created',
      messages: [
        { businessKey: 'ORDER-2024-003', payload: { orderId: 'ORDER-2024-003', userId: 'user-003', amount: 299.00 } }
      ],
      rules: {
        duplicateDelivery: { enabled: true, probability: 1.0, count: 2 }
      }
    },
    {
      name: 'inventory-demo-outoforder',
      description: '乱序投递演示',
      topic: 'inventory.deducted',
      messages: [
        { businessKey: 'SKU-001', payload: { skuId: 'SKU-001', quantity: 1 }, sequence: 1 },
        { businessKey: 'SKU-001', payload: { skuId: 'SKU-001', quantity: 2 }, sequence: 2 },
        { businessKey: 'SKU-001', payload: { skuId: 'SKU-001', quantity: 3 }, sequence: 3 }
      ],
      rules: {
        outOfOrder: { enabled: true, probability: 1.0 },
        mergeByBusinessKey: { enabled: true }
      }
    },
    {
      name: 'sms-demo-retry',
      description: '重试和死信演示',
      topic: 'notification.sms',
      messages: [
        { businessKey: 'SMS-2024-001', payload: { phone: '13800138000', message: '您的订单已发货' } }
      ],
      rules: {
        consumerFailure: { enabled: true, probability: 1.0 },
        ignoreHistory: true
      }
    },
    {
      name: 'sms-demo-delay',
      description: '延迟投递演示',
      topic: 'notification.sms',
      messages: [
        { businessKey: 'SMS-2024-002', payload: { phone: '13900139000', message: '验证码: 123456' } }
      ],
      rules: {
        delay: { enabled: true, min: 500, max: 1500 }
      }
    }
  ];
}

function printExecutionResult(result) {
  console.log('');
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log(chalk.cyan('  执行结果'));
  console.log(chalk.cyan('══════════════════════════════════════════════════════'));
  console.log('');
  console.log(`计划: ${chalk.yellow(result.planName)}`);
  console.log(`主题: ${chalk.yellow(result.topic)}`);
  console.log(`耗时: ${chalk.yellow(result.duration)}ms`);
  console.log('');

  const summary = {
    total: result.messages.length,
    success: 0,
    failed: 0,
    deadLetter: 0,
    skipped: 0,
    duplicates: 0
  };

  result.messages.forEach(m => {
    if (m.skipped) summary.skipped++;
    else if (m.finalStatus === 'success') summary.success++;
    else if (m.finalStatus === 'dead_letter') summary.deadLetter++;
    else summary.failed++;

    m.deliveries.forEach(d => {
      if (d.attempt && String(d.attempt).startsWith('duplicate')) {
        summary.duplicates++;
      }
    });
  });

  const summaryTable = new Table({
    head: [chalk.cyan('统计项'), chalk.cyan('数量')],
    colWidths: [20, 15]
  });

  summaryTable.push(
    ['总消息数', summary.total],
    ['成功', chalk.green(summary.success)],
    ['失败', chalk.red(summary.failed)],
    ['死信', chalk.yellow(summary.deadLetter)],
    ['跳过(历史)', chalk.gray(summary.skipped)],
    ['重复投递', chalk.blue(summary.duplicates)]
  );

  console.log(summaryTable.toString());
  console.log('');

  if (result.consumerLog.length > 0) {
    console.log(chalk.magenta('消费者触发记录:'));
    const consumerTable = new Table({
      head: [chalk.cyan('#'), chalk.cyan('消息ID'), chalk.cyan('业务键'), chalk.cyan('尝试'), chalk.cyan('动作'), chalk.cyan('结果')],
      colWidths: [5, 20, 20, 15, 10, 15]
    });

    result.consumerLog.forEach((log, idx) => {
      if (log.action === 'received') {
        consumerTable.push([
          idx + 1,
          log.messageId ? log.messageId.substring(0, 8) + '...' : '-',
          log.businessKey || '-',
          log.attempt,
          '触发',
          log.action
        ]);
      }
    });

    console.log(consumerTable.toString());
    console.log('');
    console.log(chalk.magenta('💡 请检查消费者是否正确处理重复消息！'));
    console.log('');
  }

  if (result.messages.length > 0) {
    console.log(chalk.magenta('消息详情:'));
    const msgTable = new Table({
      head: [chalk.cyan('消息ID'), chalk.cyan('业务键'), chalk.cyan('状态'), chalk.cyan('投递次数')],
      colWidths: [20, 25, 15, 15]
    });

    result.messages.forEach(m => {
      const statusColor = m.finalStatus === 'success' ? chalk.green : 
                         m.finalStatus === 'dead_letter' ? chalk.yellow : chalk.red;
      msgTable.push([
        m.messageId ? m.messageId.substring(0, 8) + '...' : '-',
        m.businessKey || '-',
        statusColor(m.finalStatus),
        m.deliveries.length
      ]);
    });

    console.log(msgTable.toString());
  }
}

async function runCommand(planName, options = {}) {
  const topicStore = new TopicStore();
  const planStore = new PlanStore();
  const historyStore = new HistoryStore();

  let plan;

  if (options.demo) {
    console.log(chalk.cyan('运行演示模式...'));
    const demoPlans = createDemoPlans();

    for (const demoData of demoPlans) {
      console.log('');
      console.log(chalk.cyan(`═════════════════════════════════════════════`));
      console.log(chalk.cyan(`  演示: ${demoData.name}`));
      console.log(chalk.cyan(`  ${demoData.description}`));
      console.log(chalk.cyan(`═════════════════════════════════════════════`));
      console.log('');

      const messages = demoData.messages.map((msg, idx) => {
        msg.topic = demoData.topic;
        msg.id = msg.id || uuidv4();
        return new Message(msg).toJSON();
      });

      plan = new DeliveryPlan({
        name: demoData.name,
        description: demoData.description,
        topic: demoData.topic,
        messages,
        rules: demoData.rules
      });

      const engine = new DeliveryEngine({
        topicStore,
        historyStore,
        planStore,
        consumerHandler: options.handler
      });

      try {
        const result = await engine.executePlan(plan, options);
        printExecutionResult(result);
      } catch (error) {
        console.error(chalk.red(`❌ 执行失败: ${error.message}`));
      }

      if (demoPlans.indexOf(demoData) < demoPlans.length - 1) {
        console.log('');
        console.log(chalk.gray('按 Enter 继续下一个演示...'));
        await new Promise(resolve => {
          process.stdin.once('data', resolve);
        });
      }
    }

    console.log('');
    console.log(chalk.green('✅ 所有演示完成！'));
    console.log(chalk.yellow('运行 mq-sim report 查看详细报告'));
    return;
  }

  plan = planStore.get(planName);
  if (!plan) {
    console.error(chalk.red(`❌ 计划不存在: ${planName}`));
    console.log(chalk.yellow('可用计划:'));
    planStore.getAll().forEach(p => console.log(`  • ${p.name}`));
    process.exit(1);
  }

  console.log(chalk.cyan(`执行计划: ${plan.name}`));
  console.log(chalk.cyan(`主题: ${plan.topic}`));
  console.log(chalk.cyan(`消息数: ${plan.messages.length}`));
  console.log('');

  const engine = new DeliveryEngine({
    topicStore,
    historyStore,
    planStore,
    consumerHandler: options.handler
  });

  try {
    const result = await engine.executePlan(plan, options);
    printExecutionResult(result);
  } catch (error) {
    console.error(chalk.red(`❌ 执行失败: ${error.message}`));
    process.exit(1);
  }
}

module.exports = runCommand;
