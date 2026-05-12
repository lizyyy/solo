#!/usr/bin/env node
const path = require('path');
const cli = require('../src/cli');

const WORKSPACE = process.env.CLAIM_WORKSPACE || process.cwd();

function printHeader() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         保险理赔材料审核系统 v1.0           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}

function printHelp() {
  console.log('使用方法: claim <command> [options]\n');
  console.log('可用命令:');
  console.log('  init                          初始化工作目录');
  console.log('  import --case <caseId>        导入案件数据');
  console.log('  import --sample               导入内置样例数据');
  console.log('  check --case <caseId>         检查单个案件');
  console.log('  check --all                   检查所有案件');
  console.log('  detail --case <caseId>        查看案件详情');
  console.log('  report                        生成审核报告');
  console.log('  report --all                  详细报告');
  console.log('  history --case <caseId>       查看案件历史');
  console.log('  correct --case <caseId>       人工修正案件');
  console.log('  list                          列出所有案件');
  console.log('  help                          显示帮助信息\n');
  console.log('环境变量:');
  console.log('  CLAIM_WORKSPACE               指定工作目录 (默认: 当前目录)');
}

function parseArgs(args) {
  const result = { command: args[0] || 'help', options: {} };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result.options[key] = args[i + 1];
        i++;
      } else {
        result.options[key] = true;
      }
    }
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const { command, options } = parseArgs(args);

  if (command === 'help' || !command) {
    printHeader();
    printHelp();
    return;
  }

  printHeader();
  console.log(`工作目录: ${WORKSPACE}\n`);

  try {
    switch (command) {
      case 'init':
        await cli.init(WORKSPACE);
        break;
      case 'import':
        if (options.sample) {
          await cli.importSample(WORKSPACE);
        } else if (options.case) {
          await cli.importCase(WORKSPACE, options.case, options);
        } else {
          console.log('请指定 --sample 或 --case <caseId>');
        }
        break;
      case 'check':
        if (options.case) {
          await cli.checkCase(WORKSPACE, options.case);
        } else if (options.all) {
          await cli.checkAll(WORKSPACE);
        } else {
          console.log('请指定 --case <caseId> 或 --all');
        }
        break;
      case 'detail':
        if (options.case) {
          await cli.showDetail(WORKSPACE, options.case);
        } else {
          console.log('请指定 --case <caseId>');
        }
        break;
      case 'report':
        if (options.all) {
          await cli.generateFullReport(WORKSPACE);
        } else {
          await cli.generateReport(WORKSPACE);
        }
        break;
      case 'history':
        if (options.case) {
          await cli.showHistory(WORKSPACE, options.case);
        } else {
          console.log('请指定 --case <caseId>');
        }
        break;
      case 'correct':
        if (options.case) {
          await cli.manualCorrect(WORKSPACE, options.case, options);
        } else {
          console.log('请指定 --case <caseId>');
        }
        break;
      case 'list':
        await cli.listCases(WORKSPACE);
        break;
      default:
        console.log(`未知命令: ${command}`);
        printHelp();
    }
  } catch (error) {
    console.error('\n❌ 执行出错:');
    console.error(error.message);
    console.error('\n堆栈信息:');
    console.error(error.stack);
    process.exit(1);
  }
}

main();
