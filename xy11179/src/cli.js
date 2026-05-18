#!/usr/bin/env node

const chalk = require('chalk');
const { readCsv, verifyPickupCodes, writeResults, generateSummary, KEY_COLUMNS } = require('./verifier');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    printUsage();
    process.exit(1);
  }

  const ordersFile = args[0];
  const pickupsFile = args[1];
  const outputFile = args[2] || 'output/verification-results.csv';
  const jsonOutput = args.includes('--json') || args.includes('-j');

  try {
    const orders = await readCsv(ordersFile);
    const pickups = await readCsv(pickupsFile);
    const { results, boundaryCases } = verifyPickupCodes(orders, pickups);
    const summary = generateSummary(results, boundaryCases);
    
    if (jsonOutput) {
      console.log(JSON.stringify({ summary, results, boundaryCases }, null, 2));
    } else {
      console.log(chalk.blue('[蛋糕预订台取货码核对工具]'));
      console.log(chalk.gray('-----------------------------------'));
      console.log(chalk.yellow('读取订单数据...'));
      console.log(chalk.green('读取 ' + orders.length + ' 条订单记录'));
      console.log(chalk.yellow('读取取货数据...'));
      console.log(chalk.green('读取 ' + pickups.length + ' 条取货记录'));
      console.log(chalk.yellow('进行取货码核对...'));
      console.log(chalk.green('完成 ' + results.length + ' 条核对记录'));
      printHumanReadableSummary(summary, boundaryCases);
    }

    const outputDir = outputFile.substring(0, outputFile.lastIndexOf('/'));
    if (outputDir && !require('fs').existsSync(outputDir)) {
      require('fs').mkdirSync(outputDir, { recursive: true });
    }

    await writeResults(results, outputFile);
    
    if (!jsonOutput) {
      console.log(chalk.green('\n结果已保存至: ' + outputFile));
      await writeBoundaryCases(boundaryCases, outputDir || 'output');
    } else {
      await writeBoundaryCases(boundaryCases, outputDir || 'output', true);
    }

  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(chalk.red('处理失败: '), error.message);
    }
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
${chalk.bold('蛋糕预订台取货码核对 CLI')}

${chalk.underline('用法:')}
  cake-pickup-verifier <订单文件> <取货文件> [输出文件] [选项]

${chalk.underline('选项:')}
  --json, -j      输出 JSON 格式的机器可读结果

${chalk.underline('示例:')}
  cake-pickup-verifier data/orders.csv data/pickups.csv output/results.csv
  cake-pickup-verifier data/orders.csv data/pickups.csv --json

${chalk.underline('边界情况处理:')}
  - 代取          检测代取人信息
  - 手输码        检测手工输入的取货码
  - 跨店取货      检测订单门店与取货门店不一致
  - 可复跑输出     标记可重新核对的记录
`);
}

function printHumanReadableSummary(summary, boundaryCases) {
  console.log('\n' + chalk.bold('[核对结果汇总]'));
  console.log(chalk.gray('-----------------------------------'));
  
  console.log('总记录数: ' + chalk.bold(summary.total));
  console.log('成功: ' + chalk.green(summary.success));
  console.log('警告: ' + chalk.yellow(summary.warnings));
  console.log('异常: ' + chalk.red(summary.errors));
  
  console.log('\n' + chalk.bold('[边界情况统计]'));
  console.log(chalk.gray('-----------------------------------'));
  
  console.log('代取记录: ' + chalk.cyan(summary.boundaryCases.proxyPickup) + ' 条');
  if (boundaryCases.proxyPickup.length > 0) {
    boundaryCases.proxyPickup.forEach(r => {
      console.log('  - 订单 ' + r.orderId + ': ' + r.customerName + ' 由 ' + (r.proxyName || '未知') + ' 代取');
    });
  }
  
  console.log('手输码记录: ' + chalk.magenta(summary.boundaryCases.manualCode) + ' 条');
  if (boundaryCases.manualCode.length > 0) {
    boundaryCases.manualCode.forEach(r => {
      console.log('  - 取货码 ' + r.pickupCode + ' (订单: ' + r.orderId + ')');
    });
  }
  
  console.log('跨店取货: ' + chalk.yellow(summary.boundaryCases.crossStore) + ' 条');
  if (boundaryCases.crossStore.length > 0) {
    boundaryCases.crossStore.forEach(r => {
      console.log('  - 订单 ' + r.orderId + ': ' + r.orderStore + ' -> ' + r.pickupStore);
    });
  }
  
  console.log('可复跑记录: ' + chalk.blue(summary.boundaryCases.rerunnable) + ' 条');
  if (boundaryCases.rerunnable.length > 0) {
    boundaryCases.rerunnable.forEach(r => {
      console.log('  - 订单 ' + r.orderId + ': ' + (r.remark || '信息不完整'));
    });
  }

  console.log('\n' + chalk.gray('-----------------------------------'));
}

async function writeBoundaryCases(boundaryCases, outputDir, silent = false) {
  const fs = require('fs');
  const createCsvWriter = require('csv-writer').createObjectCsvWriter;
  
  const cases = [
    { name: 'proxy-pickup', data: boundaryCases.proxyPickup, desc: '代取记录' },
    { name: 'manual-code', data: boundaryCases.manualCode, desc: '手输码记录' },
    { name: 'cross-store', data: boundaryCases.crossStore, desc: '跨店取货记录' },
    { name: 'rerunnable', data: boundaryCases.rerunnable, desc: '可复跑记录' }
  ];

  for (const c of cases) {
    if (c.data.length > 0) {
      const filePath = outputDir + '/boundary-' + c.name + '.csv';
      const csvWriter = createCsvWriter({
        path: filePath,
        header: KEY_COLUMNS.map(col => ({ id: col, title: col }))
      });
      
      const orderedData = c.data.map(r => {
        const ordered = {};
        KEY_COLUMNS.forEach(col => {
          ordered[col] = r[col] !== undefined ? r[col] : '';
        });
        return ordered;
      });
      
      await csvWriter.writeRecords(orderedData);
      if (!silent) {
        console.log(chalk.gray('  - ' + c.desc + '已保存: ' + filePath));
      }
    }
  }
}

main();
