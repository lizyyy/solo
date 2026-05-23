const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/pricetag.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function initTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT UNIQUE NOT NULL,
        store_name TEXT NOT NULL,
        address TEXT,
        manager TEXT,
        phone TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        category TEXT,
        base_price DECIMAL(10,2) NOT NULL,
        unit TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS price_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_code TEXT UNIQUE NOT NULL,
        version_name TEXT NOT NULL,
        barcode TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        price_type TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'pending',
        effective_start DATETIME,
        effective_end DATETIME,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS promotion_windows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        promotion_code TEXT UNIQUE NOT NULL,
        promotion_name TEXT NOT NULL,
        price_version_id INTEGER,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        store_codes TEXT,
        status TEXT DEFAULT 'scheduled',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS confirmations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        confirmation_code TEXT UNIQUE NOT NULL,
        store_code TEXT NOT NULL,
        price_version_id INTEGER NOT NULL,
        confirmer TEXT NOT NULL,
        confirmation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'confirmed',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discrepancy_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_code TEXT UNIQUE NOT NULL,
        store_code TEXT NOT NULL,
        barcode TEXT NOT NULL,
        price_version_id INTEGER,
        expected_price DECIMAL(10,2),
        actual_price DECIMAL(10,2),
        discrepancy_type TEXT,
        status TEXT DEFAULT 'pending_review',
        reported_by TEXT,
        reviewed_by TEXT,
        review_time DATETIME,
        resolution TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exception_code TEXT UNIQUE NOT NULL,
        api_endpoint TEXT,
        original_input TEXT,
        error_message TEXT,
        processing_conclusion TEXT,
        status TEXT DEFAULT 'pending',
        handled_by TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        correction_code TEXT UNIQUE NOT NULL,
        discrepancy_id INTEGER,
        store_code TEXT,
        barcode TEXT,
        old_price DECIMAL(10,2),
        new_price DECIMAL(10,2),
        corrected_by TEXT NOT NULL,
        correction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

const sampleStores = [
  { store_code: 'ST001', store_name: '北京朝阳店', address: '北京市朝阳区建国路88号', manager: '张三', phone: '13800138001', status: 'active' },
  { store_code: 'ST002', store_name: '上海浦东店', address: '上海市浦东新区陆家嘴环路100号', manager: '李四', phone: '13800138002', status: 'active' },
  { store_code: 'ST003', store_name: '广州天河店', address: '广州市天河区天河路385号', manager: '王五', phone: '13800138003', status: 'active' },
  { store_code: 'ST004', store_name: '深圳南山店', address: '深圳市南山区科技园路1号', manager: '赵六', phone: '13800138004', status: 'active' },
  { store_code: 'ST005', store_name: '杭州西湖店', address: '杭州市西湖区文三路478号', manager: '钱七', phone: '13800138005', status: 'active' }
];

const sampleProducts = [
  { barcode: '6901234567890', product_name: '可口可乐500ml', category: '饮料', base_price: 3.50, unit: '瓶' },
  { barcode: '6901234567891', product_name: '百事可乐500ml', category: '饮料', base_price: 3.50, unit: '瓶' },
  { barcode: '6901234567892', product_name: '农夫山泉550ml', category: '饮料', base_price: 2.00, unit: '瓶' },
  { barcode: '6901234567893', product_name: '康师傅方便面', category: '食品', base_price: 4.50, unit: '包' },
  { barcode: '6901234567894', product_name: '统一老坛酸菜面', category: '食品', base_price: 5.00, unit: '包' },
  { barcode: '6901234567895', product_name: '奥利奥饼干100g', category: '食品', base_price: 8.50, unit: '盒' },
  { barcode: '6901234567896', product_name: '蒙牛纯牛奶250ml', category: '乳品', base_price: 3.50, unit: '盒' },
  { barcode: '6901234567897', product_name: '伊利酸奶100g', category: '乳品', base_price: 5.50, unit: '杯' },
  { barcode: '6901234567898', product_name: '乐事薯片75g', category: '零食', base_price: 7.50, unit: '袋' },
  { barcode: '6901234567899', product_name: '德芙巧克力43g', category: '零食', base_price: 12.50, unit: '块' }
];

const now = moment();
const samplePriceVersions = [
  { version_code: 'PV2024010101', version_name: '可口可乐促销价', barcode: '6901234567890', price: 6.90, price_type: 'promotion', status: 'active', effective_start: now.subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss'), effective_end: now.add(30, 'days').format('YYYY-MM-DD HH:mm:ss'), created_by: 'admin' },
  { version_code: 'PV2024010102', version_name: '农夫山泉促销价', barcode: '6901234567892', price: 1.90, price_type: 'promotion', status: 'active', effective_start: now.subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss'), effective_end: now.add(30, 'days').format('YYYY-MM-DD HH:mm:ss'), created_by: 'admin' },
  { version_code: 'PV2024010103', version_name: '康师傅方便面促销价', barcode: '6901234567893', price: 3.90, price_type: 'promotion', status: 'pending', effective_start: now.format('YYYY-MM-DD HH:mm:ss'), effective_end: now.add(15, 'days').format('YYYY-MM-DD HH:mm:ss'), created_by: 'admin' },
  { version_code: 'PV2024010104', version_name: '奥利奥饼干促销价', barcode: '6901234567895', price: 6.90, price_type: 'promotion', status: 'pending_review', effective_start: now.format('YYYY-MM-DD HH:mm:ss'), effective_end: now.add(15, 'days').format('YYYY-MM-DD HH:mm:ss'), created_by: 'admin' },
  { version_code: 'PV2024010105', version_name: '乐事薯片促销价', barcode: '6901234567898', price: 5.90, price_type: 'special', status: 'active', effective_start: now.subtract(3, 'days').format('YYYY-MM-DD HH:mm:ss'), effective_end: now.add(7, 'days').format('YYYY-MM-DD HH:mm:ss'), created_by: 'admin' }
];

const samplePromotions = [
  { promotion_code: 'PROMO20240501', promotion_name: '五一劳动节促销', price_version_id: 1, start_time: now.subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss'), end_time: now.add(3, 'days').format('YYYY-MM-DD HH:mm:ss'), store_codes: 'ST001,ST002,ST003', status: 'active', created_by: 'admin' },
  { promotion_code: 'PROMO20240601', promotion_name: '六一儿童节促销', price_version_id: 2, start_time: now.format('YYYY-MM-DD HH:mm:ss'), end_time: now.add(7, 'days').format('YYYY-MM-DD HH:mm:ss'), store_codes: 'ST001,ST002,ST003,ST004,ST005', status: 'scheduled', created_by: 'admin' },
  { promotion_code: 'PROMO20240401', promotion_name: '四月促销活动', price_version_id: 5, start_time: now.subtract(15, 'days').format('YYYY-MM-DD HH:mm:ss'), end_time: now.subtract(3, 'days').format('YYYY-MM-DD HH:mm:ss'), store_codes: 'ST001,ST002', status: 'expired', created_by: 'admin' }
];

const sampleConfirmations = [
  { confirmation_code: 'CONF001', store_code: 'ST001', price_version_id: 1, confirmer: '店员A', confirmation_time: now.subtract(5, 'days').format('YYYY-MM-DD HH:mm:ss'), status: 'confirmed', remarks: '价签已更换完毕' },
  { confirmation_code: 'CONF002', store_code: 'ST002', price_version_id: 1, confirmer: '店员B', confirmation_time: now.subtract(5, 'days').format('YYYY-MM-DD HH:mm:ss'), status: 'confirmed', remarks: '价签已更换完毕' },
  { confirmation_code: 'CONF003', store_code: 'ST003', price_version_id: 1, confirmer: '店员C', confirmation_time: now.subtract(4, 'days').format('YYYY-MM-DD HH:mm:ss'), status: 'confirmed', remarks: '' },
  { confirmation_code: 'CONF004', store_code: 'ST001', price_version_id: 5, confirmer: '店员A', confirmation_time: now.subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'), status: 'confirmed', remarks: '特价商品价签已设置' }
];

const sampleDiscrepancies = [
  { report_code: 'DISP001', store_code: 'ST004', barcode: '6901234567890', price_version_id: 1, expected_price: 6.90, actual_price: 8.80, discrepancy_type: 'price_mismatch', status: 'pending_review', reported_by: '巡检员A', remarks: '价签未更新，仍显示原价' },
  { report_code: 'DISP002', store_code: 'ST005', barcode: '6901234567892', price_version_id: 2, expected_price: 1.90, actual_price: 2.00, discrepancy_type: 'price_mismatch', status: 'reviewed', reviewed_by: '主管A', review_time: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'), resolution: '已通知门店更换价签', reported_by: '巡检员B', remarks: '' },
  { report_code: 'DISP003', store_code: 'ST001', barcode: '6901234567893', price_version_id: null, expected_price: 4.50, actual_price: 5.00, discrepancy_type: 'tag_missing', status: 'compensated', reviewed_by: '主管B', review_time: now.format('YYYY-MM-DD HH:mm:ss'), resolution: '已补偿差价给顾客', reported_by: '顾客投诉', remarks: '顾客结账时发现价格不符' },
  { report_code: 'DISP004', store_code: 'ST002', barcode: '6901234567898', price_version_id: 5, expected_price: 5.90, actual_price: 7.50, discrepancy_type: 'expired_promotion', status: 'rejected', reviewed_by: '主管A', review_time: now.format('YYYY-MM-DD HH:mm:ss'), resolution: '促销已结束，价格正常', reported_by: '巡检员A', remarks: '促销活动已到期' }
];

const sampleCorrections = [
  { correction_code: 'CORR001', discrepancy_id: 3, store_code: 'ST001', barcode: '6901234567893', old_price: 5.00, new_price: 4.50, corrected_by: '店长A', correction_time: now.format('YYYY-MM-DD HH:mm:ss'), reason: '补偿顾客差价', status: 'completed' },
  { correction_code: 'CORR002', discrepancy_id: null, store_code: 'ST004', barcode: '6901234567890', old_price: 8.80, new_price: 6.90, corrected_by: '店长B', correction_time: now.format('YYYY-MM-DD HH:mm:ss'), reason: '价签更新错误，人工修正', status: 'completed' }
];

function clearTables() {
  return new Promise((resolve, reject) => {
    console.log('清空现有数据...');
    const tables = ['manual_corrections', 'exception_logs', 'discrepancy_reports', 'confirmations', 'promotion_windows', 'price_versions', 'products', 'stores'];
    let completed = 0;
    
    tables.forEach(table => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err) reject(err);
        db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table], () => {
          completed++;
          if (completed === tables.length) {
            console.log('✓ 已清空所有数据表\n');
            resolve();
          }
        });
      });
    });
  });
}

function insertData() {
  return new Promise((resolve, reject) => {
    console.log('开始插入示例数据...\n');
    
    let completed = 0;
    const total = 7;
    
    function checkDone() {
      completed++;
      if (completed === total) {
        console.log('\n示例数据插入完成！');
        resolve();
      }
    }

    const storeStmt = db.prepare('INSERT OR REPLACE INTO stores (store_code, store_name, address, manager, phone, status) VALUES (?, ?, ?, ?, ?, ?)');
    sampleStores.forEach(store => {
      storeStmt.run(store.store_code, store.store_name, store.address, store.manager, store.phone, store.status);
    });
    storeStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${sampleStores.length} 条门店数据`);
      checkDone();
    });

    const productStmt = db.prepare('INSERT OR REPLACE INTO products (barcode, product_name, category, base_price, unit) VALUES (?, ?, ?, ?, ?)');
    sampleProducts.forEach(product => {
      productStmt.run(product.barcode, product.product_name, product.category, product.base_price, product.unit);
    });
    productStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${sampleProducts.length} 条商品数据`);
      checkDone();
    });

    const pvStmt = db.prepare('INSERT OR REPLACE INTO price_versions (id, version_code, version_name, barcode, price, price_type, status, effective_start, effective_end, created_by) VALUES ((SELECT id FROM price_versions WHERE version_code = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    samplePriceVersions.forEach((pv, idx) => {
      pvStmt.run(pv.version_code, pv.version_code, pv.version_name, pv.barcode, pv.price, pv.price_type, pv.status, pv.effective_start, pv.effective_end, pv.created_by);
    });
    pvStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${samplePriceVersions.length} 条价签版本数据`);
      checkDone();
    });

    const promoStmt = db.prepare('INSERT OR REPLACE INTO promotion_windows (id, promotion_code, promotion_name, price_version_id, start_time, end_time, store_codes, status, created_by) VALUES ((SELECT id FROM promotion_windows WHERE promotion_code = ?), ?, ?, ?, ?, ?, ?, ?, ?)');
    samplePromotions.forEach(promo => {
      promoStmt.run(promo.promotion_code, promo.promotion_code, promo.promotion_name, promo.price_version_id, promo.start_time, promo.end_time, promo.store_codes, promo.status, promo.created_by);
    });
    promoStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${samplePromotions.length} 条促销窗口数据`);
      checkDone();
    });

    const confStmt = db.prepare('INSERT OR REPLACE INTO confirmations (id, confirmation_code, store_code, price_version_id, confirmer, confirmation_time, status, remarks) VALUES ((SELECT id FROM confirmations WHERE confirmation_code = ?), ?, ?, ?, ?, ?, ?, ?)');
    sampleConfirmations.forEach(conf => {
      confStmt.run(conf.confirmation_code, conf.confirmation_code, conf.store_code, conf.price_version_id, conf.confirmer, conf.confirmation_time, conf.status, conf.remarks);
    });
    confStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${sampleConfirmations.length} 条确认记录数据`);
      checkDone();
    });

    const dispStmt = db.prepare('INSERT OR REPLACE INTO discrepancy_reports (id, report_code, store_code, barcode, price_version_id, expected_price, actual_price, discrepancy_type, status, reported_by, reviewed_by, review_time, resolution, remarks) VALUES ((SELECT id FROM discrepancy_reports WHERE report_code = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    sampleDiscrepancies.forEach(disp => {
      dispStmt.run(disp.report_code, disp.report_code, disp.store_code, disp.barcode, disp.price_version_id, disp.expected_price, disp.actual_price, disp.discrepancy_type, disp.status, disp.reported_by, disp.reviewed_by, disp.review_time, disp.resolution, disp.remarks);
    });
    dispStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${sampleDiscrepancies.length} 条差异报告数据`);
      checkDone();
    });

    const corrStmt = db.prepare('INSERT OR REPLACE INTO manual_corrections (id, correction_code, discrepancy_id, store_code, barcode, old_price, new_price, corrected_by, correction_time, reason, status) VALUES ((SELECT id FROM manual_corrections WHERE correction_code = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    sampleCorrections.forEach(corr => {
      corrStmt.run(corr.correction_code, corr.correction_code, corr.discrepancy_id, corr.store_code, corr.barcode, corr.old_price, corr.new_price, corr.corrected_by, corr.correction_time, corr.reason, corr.status);
    });
    corrStmt.finalize((err) => {
      if (err) reject(err);
      console.log(`✓ 已插入 ${sampleCorrections.length} 条人工修正数据`);
      checkDone();
    });
  });
}

console.log('='.repeat(50));
console.log('可重复示例数据初始化工具');
console.log('='.repeat(50) + '\n');

initTables()
  .then(() => {
    console.log('✓ 数据表初始化完成\n');
    return clearTables();
  })
  .then(() => {
    return insertData();
  })
  .then(() => {
    db.close();
    console.log('\n✓ 数据库连接已关闭。');
    console.log('✓ 示例数据初始化完成，可重复执行！');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ 初始化失败:', err);
    db.close();
    process.exit(1);
  });
