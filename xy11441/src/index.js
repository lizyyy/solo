#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const initCommand = require('./commands/init');
const importCommand = require('./commands/import');
const checkCommand = require('./commands/check');
const fixCommand = require('./commands/fix');
const reportCommand = require('./commands/report');
const historyCommand = require('./commands/history');
const exportCommand = require('./commands/export');

const { login, logout, getCurrentUser, createUser, ROLES } = require('./utils/auth');
const { printSuccess, printError, printInfo, printWarning } = require('./utils/helpers');

const program = new Command();

program
  .name('fli')
  .description('生鲜分拣损耗多源导入巡检工具 CLI')
  .version('1.0.0');

program
  .command('init')
  .description('初始化系统，创建数据库和目录结构')
  .option('-f, --force', '强制重新初始化，删除旧数据')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('login')
  .description('用户登录')
  .argument('<username>', '用户名')
  .argument('<password>', '密码')
  .action(async (username, password) => {
    try {
      const user = login(username, password);
      const roleConfig = ROLES[user.role];
      printSuccess(`登录成功! 欢迎 ${username} (${roleConfig.name})`);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('退出登录')
  .action(() => {
    logout();
    printSuccess('已退出登录');
  });

program
  .command('whoami')
  .description('显示当前登录用户')
  .action(() => {
    const user = getCurrentUser();
    if (!user) {
      printWarning('未登录');
      return;
    }
    const roleConfig = ROLES[user.role];
    printInfo(`当前用户: ${user.username} (${roleConfig.name})`);
  });

program
  .command('user:create')
  .description('创建新用户 (仅主管)')
  .argument('<username>', '用户名')
  .argument('<password>', '密码')
  .argument('<role>', '角色: entry|review|manager|readonly')
  .action(async (username, password, role) => {
    try {
      const id = createUser(username, password, role);
      printSuccess(`用户创建成功! ID: ${id}`);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('导入数据文件')
  .argument('<file>', '数据文件路径 (CSV/Excel)')
  .option('-t, --type <type>', '数据源类型: delivery|weight|return_basket|price_adjust', 'delivery')
  .option('-f, --force', '强制重新导入已存在的文件')
  .option('--skip-duplicates', '跳过重复记录，不更新')
  .action(async (file, options) => {
    try {
      await importCommand(file, options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('数据质量检查')
  .option('-t, --type <type>', '检查类型: missing_field|cross_date|name_change|amount_conflict|quantity_conflict|all', 'all')
  .option('--date-range <days>', '跨日检查阈值天数', '7')
  .option('--threshold <amount>', '金额差异阈值', '0.01')
  .option('--dry-run', '仅显示结果，不保存到数据库')
  .action(async (options) => {
    try {
      await checkCommand(options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('fix')
  .description('修复脏记录')
  .argument('[id]', '脏记录ID')
  .option('-l, --list', '列出待处理的脏记录')
  .option('-t, --type <type>', '按错误类型筛选')
  .option('--fact-id <id>', '按事实记录ID筛选')
  .option('--limit <number>', '显示数量', '50')
  .action(async (id, options) => {
    try {
      await fixCommand(id, options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('生成巡检报告')
  .option('-t, --type <type>', '报告类型: summary|source|failures|fixed|detail|all', 'all')
  .option('--start-date <date>', '开始日期 YYYY-MM-DD')
  .option('--end-date <date>', '结束日期 YYYY-MM-DD')
  .option('--limit <number>', '明细记录数量', '20')
  .action(async (options) => {
    try {
      await reportCommand(options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-a, --action <action>', '按操作类型筛选')
  .option('--user-id <id>', '按用户ID筛选')
  .option('--record-id <id>', '按记录ID筛选')
  .option('-l, --limit <number>', '显示数量', '50')
  .option('-d, --detail', '显示详细变更内容')
  .action(async (options) => {
    try {
      await historyCommand(options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出数据')
  .argument('[file]', '导出文件路径')
  .option('-t, --type <type>', '导出类型: facts|dirty|sources|history|all', 'all')
  .option('-f, --format <format>', '导出格式: xlsx|csv|json', 'xlsx')
  .action(async (file, options) => {
    try {
      await exportCommand(file, options);
    } catch (e) {
      printError(e.message);
      process.exit(1);
    }
  });

program.addHelpText('before', `
${chalk.bold.cyan('╔══════════════════════════════════════════════════════════════╗')}
${chalk.bold.cyan('║          生鲜分拣损耗多源导入巡检工具 CLI v1.0.0              ║')}
${chalk.bold.cyan('╚══════════════════════════════════════════════════════════════╝')}
`);

program.addHelpText('after', `
${chalk.bold.yellow('快速开始:')}
  1. ${chalk.cyan('fli init')}                    # 初始化系统
  2. ${chalk.cyan('fli login admin admin123')}    # 登录 (默认管理员账号)
  3. ${chalk.cyan('fli import data.csv -t delivery')}  # 导入数据
  4. ${chalk.cyan('fli check')}                   # 质量检查
  5. ${chalk.cyan('fli fix --list')}              # 查看脏记录
  6. ${chalk.cyan('fli report')}                  # 生成报告

${chalk.bold.yellow('角色说明:')}
  ${chalk.green('entry')}      录入员    - 导入数据、查看、修复自己导入的
  ${chalk.blue('review')}     复核员    - 导入数据、查看、修复、复核
  ${chalk.magenta('manager')}    主管      - 全部权限 + 报表导出 + 用户管理
  ${chalk.gray('readonly')}   只读查看  - 只能查看数据
`);

program.parseAsync(process.argv);
