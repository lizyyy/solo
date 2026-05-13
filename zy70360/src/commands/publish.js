const chalk = require('chalk');
const Table = require('cli-table3');
const Message = require('../models/message');
const DeliveryPlan = require('../models/deliveryPlan');
const TopicStore = require('../storage/topicStore');
const PlanStore = require('../storage/planStore');

function publishCommand(planFile, options = {}) {
  const topicStore = new TopicStore();
  const planStore = new PlanStore();

  const fs = require('fs');
  const path = require('path');

  let planData;
  try {
    const content = fs.readFileSync(path.resolve(planFile), 'utf8');
    planData = JSON.parse(content);
  } catch (error) {
    console.error(chalk.red(`❌ 读取计划文件失败: ${error.message}`));
    process.exit(1);
  }

  if (!planData.topic) {
    console.error(chalk.red('❌ 计划文件缺少 topic 字段'));
    process.exit(1);
  }

  if (!topicStore.exists(planData.topic)) {
    console.error(chalk.red(`❌ 主题不存在: ${planData.topic}`));
    console.log(chalk.yellow('可用主题:'));
    topicStore.getAll().forEach(t => console.log(`  • ${t.name}`));
    process.exit(1);
  }

  const messages = planData.messages.map((msg, index) => {
    if (options.businessKey && !msg.businessKey) {
      msg.businessKey = options.businessKey;
    }
    msg.topic = planData.topic;
    msg.sequence = index;
    return new Message(msg).toJSON();
  });

  const plan = new DeliveryPlan({
    name: planData.name || `plan-${Date.now()}`,
    description: planData.description || '',
    topic: planData.topic,
    messages,
    rules: planData.rules || {},
    schedule: planData.schedule || 'immediate'
  });

  try {
    plan.validate();
    planStore.save(plan);
  } catch (error) {
    console.error(chalk.red(`❌ ${error.message}`));
    process.exit(1);
  }

  const table = new Table({
    head: [chalk.cyan('字段'), chalk.cyan('值')],
    colWidths: [15, 60]
  });

  table.push(
    ['计划ID', plan.id],
    ['名称', plan.name],
    ['主题', plan.topic],
    ['消息数', messages.length],
    ['规则', JSON.stringify(plan.rules, null, 2)]
  );

  console.log(chalk.green('✅ 投递计划已发布！'));
  console.log('');
  console.log(table.toString());
  console.log('');
  console.log(`运行: mq-sim run ${plan.name}`);
}

module.exports = publishCommand;
