const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table');
const path = require('path');
const fs = require('fs');

const Store = require('./storage/Store');
const Importer = require('./importers/Importer');
const WaveGenerator = require('./services/WaveGenerator');
const InventoryManager = require('./services/InventoryManager');
const ExportManager = require('./services/ExportManager');
const Wave = require('./models/Wave');
const Order = require('./models/Order');

const program = new Command();

let store;

function initStore(dataDir) {
  const dir = dataDir || process.env.WAVE_DATA_DIR || path.join(process.cwd(), 'data');
  store = new Store(dir);
  return store;
}

function printWavePreview(result, generator) {
  const { waves, exceptions, orders } = result;

  if (waves.length === 0 && exceptions.length === 0) {
    console.log(chalk.yellow('\n没有符合条件的订单可以生成波次。'));
    return;
  }

  console.log(chalk.cyan.bold('\n========== 波次预览 ==========\n'));

  if (waves.length > 0) {
    console.log(chalk.green.bold(`✓ 生成 ${waves.length} 个波次\n`));

    for (const wave of waves) {
      const waveTable = new Table({
        head: [chalk.cyan('项目'), chalk.white('内容')],
        colWidths: [15, 60]
      });

      waveTable.push(['波次 ID', wave.waveId]);
      waveTable.push(['状态', wave.status]);
      waveTable.push(['分组规则', generator.getWaveGroupingReason(wave)]);
      waveTable.push(['订单数量', wave.orderIds.length]);
      waveTable.push(['分配项数', wave.allocations.length]);

      console.log(chalk.magenta.bold(`\n--- ${wave.waveId} ---`));
      console.log(waveTable.toString());

      const orderTable = new Table({
        head: [
          chalk.cyan('订单号'),
          chalk.cyan('承运商'),
          chalk.cyan('商品数'),
          chalk.cyan('总金额')
        ]
      });

      for (const orderId of wave.orderIds) {
        const order = store.getOrderById(orderId);
        if (order) {
          orderTable.push([
            order.orderNumber,
            order.carrierCode,
            order.items.length,
            order.totalAmount.toFixed(2)
          ]);
        }
      }
      console.log(chalk.white('\n包含订单：'));
      console.log(orderTable.toString());

      if (wave.allocations.length > 0) {
        const allocTable = new Table({
          head: [
            chalk.cyan('订单号'),
            chalk.cyan('SKU'),
            chalk.cyan('库位'),
            chalk.cyan('数量')
          ]
        });
        for (const alloc of wave.allocations) {
          allocTable.push([
            alloc.orderNumber,
            alloc.sku,
            alloc.locationCode,
            alloc.qty
          ]);
        }
        console.log(chalk.white('\n库存分配：'));
        console.log(allocTable.toString());
      }
    }
  }

  if (exceptions.length > 0) {
    console.log(chalk.red.bold(`\n✗ ${exceptions.length} 条异常记录\n`));

    const exTable = new Table({
      head: [
        chalk.red('订单号'),
        chalk.red('异常类型'),
        chalk.red('详细信息')
      ]
    });

    for (const ex of exceptions) {
      const reasons = ex.reasons || [];
      for (const reason of reasons) {
        exTable.push([
          ex.orderNumber || (ex.waveId ? '波次关联' : '-'),
          reason.code,
          reason.message
        ]);
      }
    }
    console.log(chalk.white('异常订单：'));
    console.log(exTable.toString());
  }

  console.log(chalk.cyan.bold('\n==============================\n'));
}

program
  .name('wave')
  .description('仓库拣货波次合并 CLI 工具')
  .version('1.0.0')
  .option('-d, --data-dir <dir>', '数据目录路径', '')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    initStore(opts.dataDir);
  });

program
  .command('import')
  .description('导入数据文件（carrier/product/location/inventory/order）')
  .argument('<file>', '数据文件路径 (支持 .json 或 .csv)')
  .action((file) => {
    try {
      const absPath = path.resolve(file);
      if (!fs.existsSync(absPath)) {
        console.error(chalk.red(`文件不存在: ${absPath}`));
        process.exit(1);
      }

      const result = Importer.importFromFile(absPath, store);
      store.save();

      console.log(chalk.green(`\n✓ 成功导入 ${result.imported} 条 ${result.type} 记录\n`));
    } catch (err) {
      console.error(chalk.red(`\n✗ 导入失败: ${err.message}\n`));
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('预览生成的拣货波次')
  .action(() => {
    const generator = new WaveGenerator(store);
    const result = generator.generateWaves();

    for (const wave of result.waves) {
      store.addWave(wave.toJSON());
    }
    store.save();

    printWavePreview(result, generator);
  });

program
  .command('confirm')
  .description('确认波次并锁定库存')
  .argument('<waveId>', '波次 ID')
  .action((waveId) => {
    const manager = new InventoryManager(store);
    const result = manager.confirmWave(waveId.toUpperCase());

    if (result.success) {
      console.log(chalk.green(`\n✓ 波次 ${waveId} 确认成功`));
      console.log(chalk.green(`  - 锁定库存: ${result.lockCount} 项`));
      console.log(chalk.green(`  - 涉及订单: ${result.orderCount} 个\n`));
    } else {
      console.error(chalk.red(`\n✗ 波次确认失败: ${result.error}`));
      if (result.failedAllocations) {
        for (const fail of result.failedAllocations) {
          console.error(chalk.yellow(`  - ${fail.orderNumber} SKU:${fail.sku} - ${fail.reason}`));
        }
      }
      console.log('');
      process.exit(1);
    }
  });

program
  .command('release')
  .description('释放失败或预览状态的波次库存')
  .argument('[waveId]', '波次 ID（不指定则释放所有失败/预览波次）')
  .action((waveId) => {
    const manager = new InventoryManager(store);

    if (waveId) {
      const result = manager.releaseWave(waveId.toUpperCase());
      if (result.success) {
        console.log(chalk.green(`\n✓ 波次 ${waveId} 已释放`));
        console.log(chalk.green(`  - 释放锁定: ${result.releasedCount} 项\n`));
      } else {
        console.error(chalk.red(`\n✗ 释放失败: ${result.error}\n`));
        process.exit(1);
      }
    } else {
      const result = manager.releaseFailedWaves();
      console.log(chalk.cyan(`\n处理波次: ${result.totalProcessed} 个`));
      console.log(chalk.green(`成功释放: ${result.successfullyReleased} 个\n`));
    }
  });

program
  .command('export')
  .description('导出已确认波次的拣货单')
  .argument('<waveId>', '波次 ID')
  .option('-o, --output <dir>', '输出目录', './exports')
  .option('-c, --csv', '同时导出 CSV 格式')
  .action((waveId, options) => {
    const exporter = new ExportManager(store);
    const outputDir = path.resolve(options.output);

    const jsonResult = exporter.exportWave(waveId.toUpperCase(), outputDir);

    if (!jsonResult.success) {
      console.error(chalk.red(`\n✗ 导出失败: ${jsonResult.error}\n`));
      process.exit(1);
    }

    console.log(chalk.green(`\n✓ 波次 ${waveId} 导出成功`));
    console.log(chalk.white(`  - 订单数: ${jsonResult.orderCount}`));
    console.log(chalk.white(`  - 拣货项数: ${jsonResult.pickingItemCount}`));
    console.log(chalk.white(`  - 输出目录: ${path.dirname(jsonResult.files.summary)}\n`));

    console.log(chalk.white('  生成文件：'));
    console.log(chalk.gray(`    ${jsonResult.files.summary}`));
    console.log(chalk.gray(`    ${jsonResult.files.pickingList}`));
    console.log(chalk.gray(`    ${jsonResult.files.pickingTickets}\n`));

    if (options.csv) {
      const csvResult = exporter.exportWaveAsCsv(waveId.toUpperCase(), outputDir);
      if (csvResult.success) {
        console.log(chalk.gray(`    ${csvResult.file}\n`));
      }
    }
  });

program
  .command('status')
  .description('查看当前状态概览')
  .action(() => {
    const carriers = store.getAllCarriers();
    const products = store.getAllProducts();
    const locations = store.getAllLocations();
    const inventories = store.getAllInventories();
    const orders = store.getAllOrders();
    const waves = store.getAllWaves();
    const locks = store.getAllLocks().filter(l => l.isActive);

    const summaryTable = new Table({
      head: [chalk.cyan('数据类型'), chalk.cyan('数量')]
    });
    summaryTable.push(['承运商', carriers.length]);
    summaryTable.push(['商品', products.length]);
    summaryTable.push(['库位配置', locations.length]);
    summaryTable.push(['库存记录', inventories.length]);
    summaryTable.push(['订单', orders.length]);
    summaryTable.push(['波次', waves.length]);
    summaryTable.push(['活动库存锁定', locks.length]);

    console.log(chalk.cyan.bold('\n========== 系统状态 ==========\n'));
    console.log(summaryTable.toString());

    const orderStatusCount = {};
    for (const order of orders) {
      orderStatusCount[order.status] = (orderStatusCount[order.status] || 0) + 1;
    }

    if (Object.keys(orderStatusCount).length > 0) {
      console.log(chalk.white('\n订单状态分布：'));
      const orderTable = new Table({
        head: [chalk.cyan('状态'), chalk.cyan('数量')]
      });
      for (const [status, count] of Object.entries(orderStatusCount)) {
        orderTable.push([status, count]);
      }
      console.log(orderTable.toString());
    }

    const waveStatusCount = {};
    for (const wave of waves) {
      waveStatusCount[wave.status] = (waveStatusCount[wave.status] || 0) + 1;
    }

    if (Object.keys(waveStatusCount).length > 0) {
      console.log(chalk.white('\n波次状态分布：'));
      const waveTable = new Table({
        head: [chalk.cyan('状态'), chalk.cyan('数量')]
      });
      for (const [status, count] of Object.entries(waveStatusCount)) {
        waveTable.push([status, count]);
      }
      console.log(waveTable.toString());
    }

    console.log(chalk.cyan.bold('\n==============================\n'));
  });

program
  .command('check-order')
  .description('检查订单锁定状态')
  .argument('<orderNumber>', '订单号')
  .action((orderNumber) => {
    const manager = new InventoryManager(store);
    const result = manager.checkOrderLockStatus(orderNumber);

    if (!result.exists) {
      console.log(chalk.yellow(`\n${result.message}\n`));
      return;
    }

    console.log(chalk.cyan.bold('\n========== 订单状态 ==========\n'));
    console.log(chalk.white(`订单号: ${result.orderNumber}`));
    console.log(chalk.white(`订单ID: ${result.orderId}`));
    console.log(chalk.white(`当前状态: ${result.status}`));
    console.log(chalk.white(`关联波次: ${result.waveId || '无'}`));
    console.log(chalk.white(`活动锁定数: ${result.activeLockCount}\n`));

    if (result.locks.length > 0) {
      const table = new Table({
        head: [
          chalk.cyan('锁定ID'),
          chalk.cyan('波次ID'),
          chalk.cyan('SKU'),
          chalk.cyan('库位'),
          chalk.cyan('数量')
        ]
      });
      for (const lock of result.locks) {
        table.push([lock.lockId, lock.waveId, lock.sku, lock.locationCode, lock.qty]);
      }
      console.log(table.toString());
    }

    console.log(chalk.cyan.bold('\n==============================\n'));
  });

program.parse(process.argv);
