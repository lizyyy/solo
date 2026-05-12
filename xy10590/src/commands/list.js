const chalk = require('chalk');
const Table = require('cli-table3');
const config = require('../utils/config');

function listCommand(options) {
  try {
    config.ensureInitialized();
    console.log(chalk.blue('\n=== 数据概览 ===\n'));
    
    const type = options.type;
    const types = type === 'all' ? ['send', 'bounce', 'retry', 'source'] : [type];
    
    types.forEach((t) => {
      const data = config.getData(t);
      console.log(chalk.cyan(`[${t.toUpperCase()}] 总数: ${data.length}`));
      
      if (data.length === 0) {
        console.log(chalk.gray('  (无数据)\n'));
        return;
      }
      
      if (t === 'send') {
        const table = new Table({
          head: ['ID', '邮箱', '活动', '发送时间', '状态'],
          colWidths: [12, 35, 20, 20, 10]
        });
        data.slice(0, 5).forEach(item => {
          table.push([
            item.id,
            item.email,
            item.campaign,
            item.sentAt ? new Date(item.sentAt).toLocaleString() : '-',
            item.status
          ]);
        });
        console.log(table.toString());
        if (data.length > 5) {
          console.log(chalk.gray(`  ... 还有 ${data.length - 5} 条记录\n`));
        } else {
          console.log('');
        }
      } else if (t === 'bounce') {
        const table = new Table({
          head: ['ID', '邮箱', '退信码', '时间'],
          colWidths: [14, 35, 12, 25]
        });
        data.slice(0, 5).forEach(item => {
          table.push([
            item.id,
            item.email,
            item.bounceCode || 'N/A',
            new Date(item.timestamp).toLocaleString()
          ]);
        });
        console.log(table.toString());
        if (data.length > 5) {
          console.log(chalk.gray(`  ... 还有 ${data.length - 5} 条记录\n`));
        } else {
          console.log('');
        }
      } else if (t === 'retry') {
        const table = new Table({
          head: ['ID', '邮箱', '成功', '重试时间'],
          colWidths: [14, 35, 8, 25]
        });
        data.slice(0, 5).forEach(item => {
          table.push([
            item.id,
            item.email,
            item.success ? chalk.green('是') : chalk.red('否'),
            new Date(item.attemptedAt).toLocaleString()
          ]);
        });
        console.log(table.toString());
        if (data.length > 5) {
          console.log(chalk.gray(`  ... 还有 ${data.length - 5} 条记录\n`));
        } else {
          console.log('');
        }
      } else if (t === 'source') {
        const table = new Table({
          head: ['名称', '描述', '邮箱数', '有效', '退信'],
          colWidths: [20, 30, 10, 8, 8]
        });
        data.forEach(item => {
          table.push([
            item.name,
            item.description,
            item.totalEmails,
            item.validEmails,
            item.bounceCount
          ]);
        });
        console.log(table.toString() + '\n');
      }
    });
    
    const unsubscribed = config.getData('unsubscribed');
    if (unsubscribed.length > 0) {
      console.log(chalk.magenta(`[UNSUBSCRIBED] 退订名单: ${unsubscribed.length} 个邮箱`));
      console.log(chalk.gray('  ' + unsubscribed.join(', ') + '\n'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n✗ 错误：'), error.message);
    process.exit(1);
  }
}

module.exports = {
  listCommand
};
