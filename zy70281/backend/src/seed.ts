import db from './database';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function seed() {
  console.log('开始导入样例数据...');
  
  await db.init();
  
  await db.exec('DELETE FROM packages');
  await db.exec('DELETE FROM settlements');
  await db.exec('DELETE FROM retention_rules');
  await db.exec('DELETE FROM courier_companies');
  
  const insertCompany = `
    INSERT INTO courier_companies (name, code, delivery_fee, return_fee, storage_fee_per_day)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  await db.run(insertCompany, ['顺丰快递', 'SF', 1.5, 3.0, 0.8]);
  await db.run(insertCompany, ['圆通速递', 'YT', 1.0, 2.5, 0.5]);
  await db.run(insertCompany, ['中通快递', 'ZT', 1.0, 2.0, 0.5]);
  await db.run(insertCompany, ['韵达快递', 'YD', 0.8, 2.0, 0.4]);
  await db.run(insertCompany, ['申通快递', 'ST', 0.9, 2.2, 0.45]);
  
  const insertRule = `
    INSERT INTO retention_rules (courier_company_id, free_days, storage_fee_per_day, is_global)
    VALUES (?, ?, ?, ?)
  `;
  
  await db.run(insertRule, [null, 3, 0.5, 1]);
  await db.run(insertRule, [1, 2, 0.8, 0]);
  await db.run(insertRule, [2, 4, 0.5, 0]);
  
  const insertPackage = `
    INSERT INTO packages (tracking_number, courier_company_id, recipient_name, recipient_phone, status, scan_time, delivery_fee)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const packages = [
    ['SF1234567890', 1, '张三', '13800138000', 'pending', '2026-05-01 09:00:00', 1.5],
    ['YT2345678901', 2, '李四', '13800138001', 'delivered', '2026-05-02 10:30:00', 1.0],
    ['ZT3456789012', 3, '王五', '13800138002', 'delivered', '2026-05-03 14:20:00', 1.0],
    ['YD4567890123', 4, '赵六', '13800138003', 'pending', '2026-05-04 16:45:00', 0.8],
    ['ST5678901234', 5, '钱七', '13800138004', 'pending', '2026-05-05 11:15:00', 0.9],
  ];
  
  for (const pkg of packages) {
    await db.run(insertPackage, pkg);
  }
  
  await db.run(`
    UPDATE packages SET status = 'delivered', delivery_time = '2026-05-02 15:00:00', total_fee = 1.0 WHERE tracking_number = 'YT2345678901'
  `);
  await db.run(`
    UPDATE packages SET status = 'delivered', delivery_time = '2026-05-03 17:30:00', total_fee = 1.0 WHERE tracking_number = 'ZT3456789012'
  `);
  
  console.log('✅ 样例数据已成功导入！');
  console.log('   快递公司：5家');
  console.log('   滞留规则：3条');
  console.log('   包裹：5个');
}

seed().catch(console.error);
