#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const commands = require('../src/commands');
const logger = require('../src/utils/logger');

function printUsage() {
  console.log(`
仓库盘点差异 CLI (inv-diff)
============================

用法: inv-diff <command> [options]

命令:
  init [--name <盘点名称>]              初始化新的盘点任务
  import <type> <file>                  导入数据
                                         type: book|scan|freeze|manual|recheck
  check                                 检查数据一致性
  detail [--sku <sku>|--location <loc>] 查看详细差异
  report                                生成盘点报告
  list                                  列出所有盘点任务
  switch <id>                           切换到指定盘点任务
  status                                查看当前盘点任务状态
  log                                   查看操作历史记录

选项:
  --work-dir <path>                     指定工作目录 (默认: ./inventory-data)
  --help, -h                            显示帮助信息

示例:
  inv-diff init --name "2026年5月月度盘点"
  inv-diff import book data/book.json
  inv-diff check
  inv-diff report
`);
}

function parseArgs(args) {
  const result = {
    command: null,
    options: {},
    positional: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const equalsIndex = arg.indexOf('=');
      let key, value;
      
      if (equalsIndex !== -1) {
        key = arg.slice(2, equalsIndex);
        value = arg.slice(equalsIndex + 1);
      } else {
        key = arg.slice(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          value = args[i + 1];
          i++;
        } else {
          value = true;
        }
      }
      
      result.options[key] = value;
    } else if (arg.startsWith('-')) {
      result.options[arg.slice(1)] = true;
    } else {
      if (!result.command) {
        result.command = arg;
      } else {
        result.positional.push(arg);
      }
    }
    i++;
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const workDir = parsed.options['work-dir'] || path.join(process.cwd(), 'inventory-data');
  
  try {
    switch (parsed.command) {
      case 'init':
        await commands.init({
          name: parsed.options.name,
          workDir
        });
        break;

      case 'import':
        if (parsed.positional.length < 2) {
          logger.error('请指定导入类型和文件路径');
          console.log('用法: inv-diff import <type> <file>');
          console.log('type: book|scan|freeze|manual|recheck');
          process.exit(1);
        }
        await commands.import({
          type: parsed.positional[0],
          filePath: parsed.positional[1],
          workDir,
          operator: process.env.USER || 'system'
        });
        break;

      case 'check':
        await commands.check({
          workDir
        });
        break;

      case 'detail':
        await commands.detail({
          sku: parsed.options.sku,
          location: parsed.options.location,
          workDir
        });
        break;

      case 'report':
        await commands.report({
          workDir
        });
        break;

      case 'list':
        await commands.list({
          workDir
        });
        break;

      case 'switch':
        if (parsed.positional.length < 1) {
          logger.error('请指定盘点任务ID');
          process.exit(1);
        }
        await commands.switch({
          auditId: parsed.positional[0],
          workDir
        });
        break;

      case 'status':
        await commands.status({
          workDir
        });
        break;

      case 'log':
        await commands.log({
          workDir,
          limit: parsed.options.limit || 50
        });
        break;

      default:
        logger.error(`未知命令: ${parsed.command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
