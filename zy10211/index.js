#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const commands = {};
const commandsDir = path.join(__dirname, 'src', 'commands');

if (fs.existsSync(commandsDir)) {
  fs.readdirSync(commandsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const cmd = require(path.join(commandsDir, file));
      commands[cmd.name] = cmd;
    }
  });
}

function printUsage() {
  console.log('\n饭堂备餐余量复盘 CLI');
  console.log('========================\n');
  console.log('使用方法: canteen-review <command> [options]\n');
  console.log('可用命令:');
  console.log('  import <file>     导入数据文件');
  console.log('  check <date>      检查指定日期的数据');
  console.log('  confirm <date>    确认并保存复盘结果');
  console.log('  query <date>      查询已确认的复盘记录');
  console.log('  export <date>     导出复盘数据为JSON');
  console.log('  list              列出所有已确认的复盘记录');
  console.log('  help              显示帮助信息\n');
  console.log('示例:');
  console.log('  canteen-review import ./data/2026-05-11.json');
  console.log('  canteen-review check 2026-05-11');
  console.log('  canteen-review confirm 2026-05-11');
  console.log('  canteen-review query 2026-05-11');
  console.log('  canteen-review export 2026-05-11');
  console.log('  canteen-review list\n');
}

const [,, cmd, ...args] = process.argv;

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printUsage();
  process.exit(0);
}

const command = commands[cmd];
if (!command) {
  console.error(`\n错误: 未知命令 "${cmd}"\n`);
  printUsage();
  process.exit(1);
}

try {
  command.execute(args);
} catch (error) {
  console.error(`\n执行失败: ${error.message}\n`);
  process.exit(1);
}
