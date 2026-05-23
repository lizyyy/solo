const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'clinic.db');
const db = new sqlite3.Database(dbPath);

db.run('PRAGMA foreign_keys = ON');

const FIXED_IDS = {
  store1: 'store-chaoyang-001',
  store2: 'store-haidian-002',
  customer1: 'customer-zhangmeili-001',
  customer2: 'customer-lipiaoliang-002',
  customer3: 'customer-wangyingjun-003',
  package1: 'package-face-care-001',
  package2: 'package-body-care-002',
  transfer1: 'transfer-test-001',
  extension1: 'extension-test-001',
  verify1: 'verify-sample-001',
  gift1: 'gift-sample-001'
};

function getOrInsertStore(storeId, name, address, phone) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM stores WHERE id = ?', [storeId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row.id);
      
      db.run('INSERT INTO stores (id, name, address, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [storeId, name, address, phone, 'active', new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) return reject(err);
          resolve(storeId);
        }
      );
    });
  });
}

function getOrInsertCustomer(customerId, name, phone, gender) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM customers WHERE phone = ?', [phone], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row.id);
      
      db.run('INSERT INTO customers (id, name, phone, gender, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [customerId, name, phone, gender, 'active', new Date().toISOString(), new Date().toISOString()],
        function(err) {
          if (err) return reject(err);
          resolve(customerId);
        }
      );
    });
  });
}

function getOrInsertPackage(packageId, customerId, name, totalCount, remainingCount, giftCount, purchaseDate, expireDate, storeId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM treatment_packages WHERE id = ?', [packageId], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row.id);
      
      const now = new Date().toISOString();
      db.run(`INSERT INTO treatment_packages 
        (id, customer_id, name, total_count, used_count, remaining_count, gift_count, used_gift_count, 
         purchase_date, expire_date, original_store_id, current_store_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [packageId, customerId, name, totalCount, totalCount - remainingCount, remainingCount, giftCount, 0,
         purchaseDate, expireDate, storeId, storeId, 'active', now, now],
        function(err) {
          if (err) return reject(err);
          resolve(packageId);
        }
      );
    });
  });
}

async function insertSampleData() {
  try {
    const store1Id = await getOrInsertStore(FIXED_IDS.store1, '朝阳门店', '北京市朝阳区建国路88号', '010-12345678');
    const store2Id = await getOrInsertStore(FIXED_IDS.store2, '海淀门店', '北京市海淀区中关村大街1号', '010-87654321');
    console.log('门店:', store1Id, store2Id);

    const customer1Id = await getOrInsertCustomer(FIXED_IDS.customer1, '张美丽', '13800138001', 'female');
    const customer2Id = await getOrInsertCustomer(FIXED_IDS.customer2, '李漂亮', '13800138002', 'female');
    const customer3Id = await getOrInsertCustomer(FIXED_IDS.customer3, '王英俊', '13800138003', 'male');
    console.log('顾客:', customer1Id, customer2Id, customer3Id);

    const package1Id = await getOrInsertPackage(FIXED_IDS.package1, customer1Id, '面部护理年卡', 48, 36, 2, '2024-01-01', '2024-12-31', store1Id);
    const package2Id = await getOrInsertPackage(FIXED_IDS.package2, customer2Id, '身体护理套餐', 24, 19, 0, '2024-03-15', '2025-03-15', store2Id);
    console.log('套餐:', package1Id, package2Id);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    db.get('SELECT id FROM verification_records WHERE id = ?', [FIXED_IDS.verify1], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO verification_records 
          (id, package_id, store_id, customer_id, verify_count, use_gift_count, use_paid_count, verify_date, operator, remark, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [FIXED_IDS.verify1, package1Id, store1Id, customer1Id, 1, 0, 1, today, '小美', '常规护理', now]
        );
      }
    });

    db.get('SELECT id FROM store_transfer_requests WHERE id = ?', [FIXED_IDS.transfer1], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO store_transfer_requests 
          (id, package_id, from_store_id, to_store_id, status, request_note, operator, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [FIXED_IDS.transfer1, package1Id, store1Id, store2Id, 'pending', '顾客搬家请求转店', '前台小王', now, now]
        );
      }
    });

    db.get('SELECT id FROM extension_requests WHERE id = ?', [FIXED_IDS.extension1], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO extension_requests 
          (id, package_id, original_expire_date, new_expire_date, reason, status, operator, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [FIXED_IDS.extension1, package2Id, '2025-03-15', '2025-09-15', '疫情期间延期', 'approved', '店长', now, now]
        );
      }
    });

    setTimeout(() => {
      db.close();
      console.log('样例数据插入完成（可重复运行）');
    }, 500);

  } catch (error) {
    console.error('插入样例数据失败:', error.message);
    db.close();
  }
}

insertSampleData();
