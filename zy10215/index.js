#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const commands = require('./lib/commands');

function showHelp() {
  console.log(`
烘焙中央厨房配方批次 CLI (bakery-batch-cli)

用法: bakery <命令> [选项]

命令:
  init                     初始化数据目录
  import <类型> <文件>     导入数据 (recipes, orders, inventory, substitutes, losses)
  validate                 校验数据并生成生产单预览
  confirm <批次号>         确认批次，扣减库存，生成正式批次
  query <类型> [选项]      查询历史数据 (batches, orders, inventory)
  export <类型> <文件>     导出数据 (production, batches, shortages)

选项:
  --data-dir <目录>        指定数据目录 (默认: ./data)
  --help, -h               显示帮助信息
  --version, -v            显示版本号

导入数据类型:
  recipes     配方数据 (JSON)
  orders      门店订单 (JSON)
  inventory   原料库存 (JSON)
  substitutes 替代规则 (JSON)
  losses      实际损耗记录 (JSON)

查询类型:
  batches     批次历史
  orders      订单历史
  inventory   库存状态

导类型:
  production  生产单
  batches     批次历史
  shortages   缺料清单

示例:
  bakery init
  bakery import recipes ./examples/recipes.json
  bakery import orders ./examples/orders-20260511.json
  bakery validate
  bakery confirm B20260511-001
  bakery query batches --date 20260511
  bakery export production ./output/production-20260511.json
`);
}

function showVersion() {
  const pkgPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    console.log(pkg.version);
  }
}

function parseArgs(args) {
  const result = {
    command: null,
    params: [],
    options: {
      dataDir: null,
      date: null,
      force: false
    }
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      if (arg === '--help' || arg === '-h') {
        result.options.help = true;
      } else if (arg === '--version' || arg === '-v') {
        result.options.version = true;
      } else if (arg === '--data-dir' && args[i + 1]) {
        result.options.dataDir = args[++i];
      } else if (arg === '--date' && args[i + 1]) {
        result.options.date = args[++i];
      } else if (arg === '--force') {
        result.options.force = true;
      } else {
        const eqIdx = arg.indexOf('=');
        if (eqIdx > 0) {
          const key = arg.slice(2, eqIdx);
          const value = arg.slice(eqIdx + 1);
          if (key === 'data-dir') result.options.dataDir = value;
          else if (key === 'date') result.options.date = value;
        }
      }
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.params.push(arg);
    }
    i++;
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.options.help) {
    showHelp();
    return;
  }

  if (parsed.options.version) {
    showVersion();
    return;
  }

  if (!parsed.command) {
    showHelp();
    return;
  }

  const dataDir = parsed.options.dataDir || path.join(process.cwd(), 'data');

  try {
    switch (parsed.command) {
      case 'init':
        await commands.init(dataDir);
        break;
      case 'import':
        if (parsed.params.length < 2) {
          console.error('错误: import 命令需要指定类型和文件路径');
          showHelp();
          process.exit(1);
        }
        await commands.import(dataDir, parsed.params[0], parsed.params[1], parsed.options.force);
        break;
      case 'validate':
        await commands.validate(dataDir);
        break;
      case 'confirm':
        if (parsed.params.length < 1) {
          console.error('错误: confirm 命令需要指定批次号');
          showHelp();
          process.exit(1);
        }
        await commands.confirm(dataDir, parsed.params[0]);
        break;
      case 'query':
        if (parsed.params.length < 1) {
          console.error('错误: query 命令需要指定类型');
          showHelp();
          process.exit(1);
        }
        await commands.query(dataDir, parsed.params[0], parsed.options);
        break;
      case 'export':
        if (parsed.params.length < 2) {
          console.error('错误: export 命令需要指定类型和文件路径');
          showHelp();
          process.exit(1);
        }
        await commands.export(dataDir, parsed.params[0], parsed.params[1]);
        break;
      default:
        console.error(`未知命令: ${parsed.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n错误: ${err.message}`);
    process.exit(1);
  }
}

main();
