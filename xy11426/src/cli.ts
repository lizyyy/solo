#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { importCommand, listCommand } from './commands/import';
import { checkCommand, failuresCommand } from './commands/check';
import { fixCommand, fixedCommand } from './commands/fix';
import { reportCommand } from './commands/report';
import { historyCommand } from './commands/history';
import { exportCommand } from './commands/export';
import { tasksCommand } from './commands/tasks';

const program = new Command();

program
  .name('park-inspect')
  .description('园区访客通行多源导入巡检 CLI')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据库')
  .action(async () => {
    const exitCode = await initCommand();
    process.exit(exitCode);
  });

program
  .command('import <file>')
  .description('导入数据文件')
  .requiredOption('-s, --source <type>', '数据源类型: visitor_appointment|gate_record|temp_plate|refund_flow')
  .option('-t, --strategy <strategy>', '导入策略: ignore|overwrite|append', 'append')
  .option('-o, --operator <name>', '操作员名称')
  .action(async (file, options) => {
    const exitCode = await importCommand(file, options);
    process.exit(exitCode);
  });

program
  .command('list')
  .description('列出导入批次')
  .action(async () => {
    const exitCode = await listCommand();
    process.exit(exitCode);
  });

program
  .command('check <batchId>')
  .description('校验批次数据')
  .option('-o, --operator <name>', '操作员名称')
  .action(async (batchId, options) => {
    const exitCode = await checkCommand(batchId, options);
    process.exit(exitCode);
  });

program
  .command('failures <batchId>')
  .description('查看批次失败记录')
  .action(async (batchId) => {
    const exitCode = await failuresCommand(batchId);
    process.exit(exitCode);
  });

program
  .command('fix <batchId>')
  .description('修复数据问题')
  .option('-a, --auto', '自动修复可自动修复的问题')
  .option('-r, --record <recordId>', '指定记录ID进行手动修复')
  .option('-f, --field <field>', '要修复的字段名')
  .option('-v, --value <value>', '修复后的值')
  .option('--reason <reason>', '修复原因')
  .option('-o, --operator <name>', '操作员名称')
  .action(async (batchId, options) => {
    const exitCode = await fixCommand(batchId, options);
    process.exit(exitCode);
  });

program
  .command('fixed <batchId>')
  .description('查看已修复记录')
  .action(async (batchId) => {
    const exitCode = await fixedCommand(batchId);
    process.exit(exitCode);
  });

program
  .command('report <batchId>')
  .description('生成巡检报表')
  .action(async (batchId) => {
    const exitCode = await reportCommand(batchId);
    process.exit(exitCode);
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-b, --batch <batchId>', '按批次筛选')
  .option('-r, --record <recordId>', '按记录筛选')
  .option('-o, --operator <name>', '按操作员筛选')
  .option('-l, --limit <number>', '显示条数', '100')
  .action(async (options) => {
    const exitCode = await historyCommand(options);
    process.exit(exitCode);
  });

program
  .command('export <batchId>')
  .description('导出数据')
  .option('-f, --format <format>', '导出格式: csv|excel', 'csv')
  .option('--failures', '仅导出失败记录')
  .option('--audit', '导出审计日志')
  .option('--report', '导出报表文本')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (batchId, options) => {
    const exitCode = await exportCommand(batchId, options);
    process.exit(exitCode);
  });

program
  .command('tasks')
  .description('管理异步任务')
  .option('-s, --status <status>', '按状态筛选: pending|retry|manual|failed')
  .option('--retry <taskId>', '标记任务为重试')
  .option('--manual <taskId>', '标记任务为等待人工处理')
  .action(async (options) => {
    const exitCode = await tasksCommand(options);
    process.exit(exitCode);
  });

program.addHelpText('before', `
${chalk.cyan('╔══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}              园区访客通行多源导入巡检 CLI                  ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════╝')}
`);

program.addHelpText('after', `
${chalk.bold('数据源类型:')}
  visitor_appointment  - 访客预约表
  gate_record          - 闸机记录
  temp_plate           - 临时车牌
  refund_flow          - 退款流水

${chalk.bold('导入策略:')}
  ignore    - 如果文件已导入过则忽略
  overwrite - 覆盖同类型旧数据
  append    - 追加数据（默认）

${chalk.bold('退出码:')}
  0 - 成功
  1 - 错误
  2 - 存在问题记录（校验、报表时）

${chalk.bold('常用流程:')}
  1. 初始化:   park-inspect init
  2. 导入:     park-inspect import data.csv -s visitor_appointment
  3. 查看列表: park-inspect list
  4. 校验:     park-inspect check <batchId>
  5. 修复:     park-inspect fix <batchId> --auto
  6. 报表:     park-inspect report <batchId>
  7. 导出:     park-inspect export <batchId>
`);

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('错误:'), err.message);
  process.exit(1);
});
