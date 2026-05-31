const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Storage } = require('../utils/Storage');

const historyCommand = new Command('history')
  .description('查看复核历史和操作记录')
  .option('-d, --defect <id>', '查看指定缺陷的历史')
  .option('-n, --limit <n>', '显示最近N条', '50')
  .option('--action <type>', '按操作类型筛选')
  .option('--reviewer <name>', '按复核人筛选')
  .action(async (options) => {
    const storage = new Storage();
    let reviews = storage.getReviewHistory();
    
    if (options.defect) {
      reviews = reviews.filter(r => r.defectId === options.defect);
    }
    if (options.action) {
      reviews = reviews.filter(r => r.action === options.action);
    }
    if (options.reviewer) {
      reviews = reviews.filter(r => r.reviewer && r.reviewer.includes(options.reviewer));
    }
    
    reviews = reviews
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(options.limit));

    if (reviews.length === 0) {
      console.log(chalk.yellow('没有找到历史记录'));
      return;
    }

    console.log(chalk.blue.bold(`\n复核历史 (${reviews.length} 条)\n`));

    const table = new Table({
      head: ['时间', '操作', '缺陷ID', '变更', '复核人', '备注'],
      colWidths: [20, 14, 12, 18, 10, 28]
    });

    reviews.forEach(r => {
      const change = r.oldValue !== null && r.newValue !== null
        ? `${r.oldValue}→${r.newValue}`
        : r.newValue || '-';
      table.push([
        new Date(r.timestamp).toLocaleString(),
        r.action,
        (r.defectId || r.annotationId || r.logId || '').substring(0, 10),
        change.substring(0, 16),
        r.reviewer || '-',
        (r.comment || '').substring(0, 25)
      ]);
    });

    console.log(table.toString());
  });

module.exports = { historyCommand };
