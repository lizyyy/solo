#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ensureDataDir, ITEM_STATUS } = require('./models');
const importer = require('./importer');
const reviewer = require('./reviewer');
const fixer = require('./fixer');
const runner = require('./runner');
const history = require('./history');
const exporter = require('./exporter');

function printHelp() {
  console.log(`
批量图片重命名 (Batch Image Renamer)
用法: bir <command> [options]

命令:
  import <file>     导入变更单 (JSON 或 CSV 格式)
  review            复核当前变更单，检测冲突和异常
  fix [itemId]      修正指定条目或全部需要修正的条目
  run [--operator=<name>] [--dry-run]  执行重命名
  rollback <runId>  回滚指定运行记录
  history [runId]   查看运行账本，指定 runId 查看详情
  export <format>   导出账本 (json 或 md 格式)
  status            查看当前变更单状态
  clear             清除当前变更单（谨慎操作）

示例:
  bir import change-order.json
  bir review
  bir fix ITEM-xxx
  bir run --operator=张三
  bir history RUN-xxx
  bir export md
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const options = {};
  const positional = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        options[key] = value;
      } else {
        options[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

async function main() {
  ensureDataDir();

  const { command, options, positional } = parseArgs(process.argv);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'import':
        if (positional.length < 1) {
          console.error('错误: 请指定要导入的文件路径');
          process.exit(1);
        }
        await importer.importChangeOrder(positional[0]);
        break;

      case 'review':
        await reviewer.review();
        break;

      case 'fix':
        const itemId = positional[0];
        await fixer.fix(itemId);
        break;

      case 'run':
        await runner.run(options);
        break;

      case 'rollback':
        if (positional.length < 1) {
          console.error('错误: 请指定要回滚的 runId');
          process.exit(1);
        }
        await runner.rollback(positional[0]);
        break;

      case 'history':
        const runId = positional[0];
        await history.show(runId);
        break;

      case 'export':
        const format = positional[0] || 'json';
        await exporter.export(format);
        break;

      case 'status':
        await showStatus();
        break;

      case 'clear':
        await clearData();
        break;

      default:
        console.error(`未知命令: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error(`\n执行失败: ${e.message}`);
    if (e.stack) {
      console.error('\n详细错误:');
      console.error(e.stack);
    }
    process.exit(1);
  }
}

async function showStatus() {
  const { getChangeOrder } = require('./models');
  const co = getChangeOrder();

  if (!co) {
    console.log('当前没有导入的变更单，使用 bir import <file> 导入');
    return;
  }

  console.log(`\n变更单: ${co.id}`);
  console.log(`批次名称: ${co.batchName}`);
  console.log(`导入时间: ${co.importedAt}`);
  console.log(`状态: ${co.status}`);
  console.log(`条目总数: ${co.items.length}`);

  const statusCounts = {};
  co.items.forEach(item => {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  });

  console.log('\n状态统计:');
  Object.keys(statusCounts).forEach(status => {
    console.log(`  ${status}: ${statusCounts[status]}`);
  });

  const needsAttention = co.items.filter(i =>
    i.status === ITEM_STATUS.FAILED ||
    i.status === ITEM_STATUS.NEEDS_FIX
  );

  if (needsAttention.length > 0) {
    console.log(`\n需要处理: ${needsAttention.length} 条`);
    needsAttention.forEach(item => {
      const lastHistory = item.history[item.history.length - 1];
      console.log(`  [${item.seq}] ${item.originalName} -> ${item.newName}`);
      console.log(`    状态: ${item.status}, 原因: ${lastHistory.detail || lastHistory.error || '未知'}`);
    });
  }
}

async function clearData() {
  const { CHANGE_ORDER_FILE, PENDING_FILE, LEDGER_FILE, DATA_DIR } = require('./models');
  const readline = require('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    rl.question('确认要清除所有数据吗？此操作不可恢复 (yes/no): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'yes') {
        const files = [CHANGE_ORDER_FILE, PENDING_FILE, LEDGER_FILE];
        files.forEach(f => {
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        });
        console.log('已清除所有数据');
        resolve();
      } else {
        console.log('已取消');
        resolve();
      }
    });
  });
}

main().catch(e => {
  console.error('未处理的异常:', e);
  process.exit(1);
});
