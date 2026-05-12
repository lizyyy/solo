const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { PLANT_STATUSES } = require('../utils/constants');

const initData = async () => {
  console.log('开始初始化测试数据...');

  const customerId = uuidv4();
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO customers (id, name, contact_person, phone, address) VALUES (?, ?, ?, ?, ?)`,
      [customerId, 'ABC科技有限公司', '张三', '13800138000', '北京市朝阳区科技园A座'],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
  console.log('创建客户:', customerId);

  const locationId1 = uuidv4();
  const locationId2 = uuidv4();
  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO locations (id, customer_id, name, floor, area, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [locationId1, customerId, '前台大厅', '1楼', '入口处', '公司前台区域'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }),
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO locations (id, customer_id, name, floor, area, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [locationId2, customerId, '经理办公室', '5楼', '501室', '经理办公区域'],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    })
  ]);
  console.log('创建点位:', locationId1, locationId2);

  const plantId1 = uuidv4();
  const plantId2 = uuidv4();
  const plantId3 = uuidv4();
  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plants (id, location_id, name, species, pot_number, status, rental_start_date, monthly_rent, current_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plantId1, locationId1, '大绿萝', 'Epipremnum aureum', 'POT-001', PLANT_STATUSES.HEALTHY, '2024-01-01', 150, 800],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }),
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plants (id, location_id, name, species, pot_number, status, rental_start_date, monthly_rent, current_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plantId2, locationId1, '发财树', 'Pachira aquatica', 'POT-002', PLANT_STATUSES.NEEDS_CARE, '2024-01-01', 200, 1200],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }),
    new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO plants (id, location_id, name, species, pot_number, status, rental_start_date, monthly_rent, current_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plantId3, locationId2, '蝴蝶兰', 'Phalaenopsis', 'POT-003', PLANT_STATUSES.WILTED, '2024-01-15', 180, 600],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    })
  ]);
  console.log('创建植物:', plantId1, plantId2, plantId3);

  console.log('测试数据初始化完成!');
  console.log('');
  console.log('测试数据摘要:');
  console.log(`  客户ID: ${customerId}`);
  console.log(`  点位1 ID: ${locationId1} (前台大厅)`);
  console.log(`  点位2 ID: ${locationId2} (经理办公室)`);
  console.log(`  植物1 ID: ${plantId1} (大绿萝)`);
  console.log(`  植物2 ID: ${plantId2} (发财树 - 需要养护)`);
  console.log(`  植物3 ID: ${plantId3} (蝴蝶兰 - 枯萎)`);
  console.log('');
  console.log('可使用这些ID进行API测试!');

  process.exit(0);
};

initData().catch(err => {
  console.error('初始化数据失败:', err);
  process.exit(1);
});
