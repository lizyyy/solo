const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { initDatabase, databaseExists } = require('../database');
const { DATA_DIR } = require('../config');

const sampleLocations = [
  { id: 'LOC001', name: '地铁站A出口售货机', address: '地铁1号线A出口' },
  { id: 'LOC002', name: '写字楼B1层售货机', address: '科技大厦B座B1层' },
  { id: 'LOC003', name: '医院门诊大厅', address: '市人民医院门诊大厅' },
  { id: 'LOC004', name: '高校图书馆', address: '市立大学图书馆一楼' }
];

const sampleProducts = [
  { id: 'PRD001', name: '瓶装矿泉水', category: '饮料', unit: '瓶', price: 2.5 },
  { id: 'PRD002', name: '鲜牛奶', category: '乳制品', unit: '盒', price: 6.0 },
  { id: 'PRD003', name: '三明治', category: '食品', unit: '个', price: 12.0 },
  { id: 'PRD004', name: '酸奶', category: '乳制品', unit: '杯', price: 5.5 },
  { id: 'PRD005', name: '果汁', category: '饮料', unit: '瓶', price: 8.0 }
];

function getDaysAfterToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

const sampleInventory = [
  { location_id: 'LOC001', product_id: 'PRD001', quantity: 20, batch_number: 'B20260401', expiry_date: getDaysAfterToday(30) },
  { location_id: 'LOC001', product_id: 'PRD002', quantity: 15, batch_number: 'B20260505', expiry_date: getDaysAfterToday(5) },
  { location_id: 'LOC001', product_id: 'PRD003', quantity: 8, batch_number: 'B20260508', expiry_date: getDaysAfterToday(2) },
  { location_id: 'LOC002', product_id: 'PRD002', quantity: 5, batch_number: 'B20260506', expiry_date: getDaysAfterToday(15) },
  { location_id: 'LOC002', product_id: 'PRD004', quantity: 25, batch_number: 'B20260503', expiry_date: getDaysAfterToday(3) },
  { location_id: 'LOC003', product_id: 'PRD001', quantity: 30, batch_number: 'B20260402', expiry_date: getDaysAfterToday(25) },
  { location_id: 'LOC003', product_id: 'PRD002', quantity: 12, batch_number: 'B20260504', expiry_date: getDaysAfterToday(6) },
  { location_id: 'LOC003', product_id: 'PRD005', quantity: 18, batch_number: 'B20260507', expiry_date: getDaysAfterToday(1) },
  { location_id: 'LOC004', product_id: 'PRD003', quantity: 3, batch_number: 'B20260509', expiry_date: getDaysAfterToday(4) },
  { location_id: 'LOC004', product_id: 'PRD004', quantity: 10, batch_number: 'B20260502', expiry_date: getDaysAfterToday(7) }
];

const sampleExpiryScans = [
  { location_id: 'LOC001', product_id: 'PRD002', batch_number: 'B20260505', expiry_date: getDaysAfterToday(5), scan_date: getDaysAfterToday(0), source: 'manual' },
  { location_id: 'LOC001', product_id: 'PRD003', batch_number: 'B20260508', expiry_date: getDaysAfterToday(2), scan_date: getDaysAfterToday(0), source: 'manual' },
  { location_id: 'LOC002', product_id: 'PRD004', batch_number: 'B20260503', expiry_date: getDaysAfterToday(3), scan_date: getDaysAfterToday(0), source: 'auto' },
  { location_id: 'LOC003', product_id: 'PRD002', batch_number: 'B20260504', expiry_date: getDaysAfterToday(6), scan_date: getDaysAfterToday(-1), source: 'auto' },
  { location_id: 'LOC003', product_id: 'PRD005', batch_number: 'B20260507', expiry_date: getDaysAfterToday(1), scan_date: getDaysAfterToday(0), source: 'manual' },
  { location_id: 'LOC004', product_id: 'PRD003', batch_number: 'B20260509', expiry_date: getDaysAfterToday(4), scan_date: getDaysAfterToday(-2), source: 'manual' }
];

async function initCommand(options) {
  console.log(chalk.cyan('正在初始化售货机临期品调拨系统...'));

  if (databaseExists() && !options.force) {
    console.log(chalk.yellow('检测到已有数据。使用 --force 选项可覆盖现有数据。'));
    return;
  }

  if (options.force && databaseExists()) {
    const dbPath = path.join(DATA_DIR, 'vending.db');
    fs.unlinkSync(dbPath);
    console.log(chalk.yellow('已清除现有数据。'));
  }

  const db = initDatabase();
  const insertLocation = db.prepare(`
    INSERT INTO locations (id, name, address) VALUES (?, ?, ?)
  `);

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, unit, price) VALUES (?, ?, ?, ?, ?)
  `);

  const insertInventory = db.prepare(`
    INSERT INTO inventory (location_id, product_id, quantity, batch_number, expiry_date) 
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertExpiryScan = db.prepare(`
    INSERT INTO expiry_scans (location_id, product_id, batch_number, expiry_date, scan_date, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    console.log(chalk.cyan('  插入点位数据...'));
    sampleLocations.forEach(loc => {
      insertLocation.run(loc.id, loc.name, loc.address);
    });
    console.log(chalk.green(`    ✓ 插入了 ${sampleLocations.length} 个点位`));

    console.log(chalk.cyan('  插入商品数据...'));
    sampleProducts.forEach(prod => {
      insertProduct.run(prod.id, prod.name, prod.category, prod.unit, prod.price);
    });
    console.log(chalk.green(`    ✓ 插入了 ${sampleProducts.length} 个商品`));

    console.log(chalk.cyan('  插入库存数据...'));
    sampleInventory.forEach(inv => {
      insertInventory.run(inv.location_id, inv.product_id, inv.quantity, inv.batch_number, inv.expiry_date);
    });
    console.log(chalk.green(`    ✓ 插入了 ${sampleInventory.length} 条库存记录`));

    console.log(chalk.cyan('  插入效期扫描数据...'));
    sampleExpiryScans.forEach(scan => {
      insertExpiryScan.run(
        scan.location_id, 
        scan.product_id, 
        scan.batch_number, 
        scan.expiry_date, 
        scan.scan_date, 
        scan.source
      );
    });
    console.log(chalk.green(`    ✓ 插入了 ${sampleExpiryScans.length} 条效期扫描记录`));
  });

  transaction();
  db.close();

  console.log(chalk.green('\n✓ 初始化完成！'));
  console.log(chalk.cyan('\n下一步操作：'));
  console.log(chalk.gray('  $ vending-transfer check          执行全面检查'));
  console.log(chalk.gray('  $ vending-transfer check -v       执行详细检查'));
  console.log(chalk.gray('  $ vending-transfer import 文件    导入新数据'));
}

module.exports = initCommand;
