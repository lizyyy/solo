#!/usr/bin/env node

const { init } = require('./commands/init');
const { importCmd } = require('./commands/import');
const { checkCmd } = require('./commands/check');
const { detailCmd } = require('./commands/detail');
const { reportCmd } = require('./commands/report');

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};
  const positional = [];
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        const [key, value] = arg.slice(2).split('=');
        options[key] = value === 'true' ? true : value === 'false' ? false : value;
      } else {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith('--')) {
          options[arg.slice(2)] = nextArg;
          i++;
        } else {
          options[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  
  return { command, options, positional };
}

function printHelp() {
  console.log(`
巡店问题整改 CLI 工具

用法:
  inspect <command> [options]

命令:
  init                    初始化系统
  import <type> <file>    导入数据 (类型: stores, inspections, issues, corrections, reinspections)
  check                   检查问题状态
  detail <issueId>        查看问题详情
  report                  生成月度报告

选项:
  --force                 强制操作 (用于 init)
  --operator <name>       指定操作者 (用于 import)
  --verbose               显示详细信息 (用于 check)
  --history               显示审计日志 (用于 detail)
  --month <YYYY-MM>       指定月份 (用于 report)

示例:
  inspect init
  inspect import stores data/stores.json --operator 张三
  inspect import inspections data/inspections.json
  inspect check --verbose
  inspect detail issue_xxx --history
  inspect report --month 2026-05
`);
}

function main() {
  const { command, options, positional } = parseArgs();
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  
  switch (command) {
    case 'init':
      init(options);
      break;
      
    case 'import':
      if (positional.length < 2) {
        console.log('[错误] 请指定导入类型和文件路径');
        console.log('用法: inspect import <type> <file>');
        process.exit(1);
      }
      importCmd(positional[0], positional[1], options);
      break;
      
    case 'check':
      checkCmd(options);
      break;
      
    case 'detail':
      if (positional.length < 1) {
        console.log('[错误] 请指定问题ID');
        console.log('用法: inspect detail <issueId>');
        process.exit(1);
      }
      detailCmd(positional[0], options);
      break;
      
    case 'report':
      reportCmd(options);
      break;
      
    default:
      console.log('[错误] 未知命令: ' + command);
      printHelp();
      process.exit(1);
  }
}

main();
