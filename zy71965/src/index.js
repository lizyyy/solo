#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { importCommand } = require('./commands/import');
const { reviewCommand } = require('./commands/review');
const { fixCommand } = require('./commands/fix');
const { historyCommand } = require('./commands/history');
const { exportCommand } = require('./commands/export');
const { statusCommand } = require('./commands/status');

const program = new Command();

program
  .name('defect-review')
  .description('图像缺陷复核工具 - 面向算法工程师的CLI工作流')
  .version('1.0.0');

program.addCommand(statusCommand);
program.addCommand(importCommand);
program.addCommand(reviewCommand);
program.addCommand(fixCommand);
program.addCommand(historyCommand);
program.addCommand(exportCommand);

program.addHelpText('before', `
${chalk.blue.bold('图像缺陷复核工具')}
${chalk.gray('训练日志 → 标注样本 → 人工复核 → 修正导出')}
`);

program.addHelpText('after', `

${chalk.bold('工作流示例:')}
  ${chalk.cyan('1. 导入数据')}
     defect-review import ./training_logs.json
     defect-review import ./annotations.json

  ${chalk.cyan('2. 查看状态')}
     defect-review status --details --consistency

  ${chalk.cyan('3. 开始复核')}
     defect-review review
     defect-review review --status pending
     defect-review review --severity critical

  ${chalk.cyan('4. 检查和修复问题')}
     defect-review fix --check
     defect-review fix --auto

  ${chalk.cyan('5. 导出结果')}
     defect-review export summary -f md
     defect-review export defects --status confirmed
     defect-review export full

${chalk.bold('数据文件位置:')}
  ${chalk.gray('./data/defects/defects.json')}      - 缺陷记录
  ${chalk.gray('./data/defects/annotations.json')}  - 标注样本
  ${chalk.gray('./data/logs/training_logs.json')}   - 训练日志
  ${chalk.gray('./data/reviews/review_history.json')} - 复核历史
  ${chalk.gray('./data/exports/')}                  - 导出文件
`);

program.parseAsync().catch(err => {
  console.error(chalk.red('错误:'), err.message);
  process.exit(1);
});
