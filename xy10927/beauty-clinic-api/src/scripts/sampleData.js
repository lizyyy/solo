const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'clinic.db');
const db = new sqlite3.Database(dbPath);

const now = new Date().toISOString();
const today = now.split('T')[0];

const sampleStores = [
  { id: uuidv4(), name: '朝阳门店', address: '北京市朝阳区xxx路xxx号', phone: '010-12345678' },
  { id: uuidv4(), name: '海淀门店', address: '北京市海淀区xxx路xxx号', phone: '010-87654321' }
];

const sampleCustomers = [
  { id: uuidv4(), name: '张美丽', phone: '13800138001', gender: '女', birthday: '1990-05-15' },
  { id: uuidv4(), name: '李漂亮', phone: '13800138002', gender: '女', birthday: '1988-08-20' },
  { id: uuidv4(), name: '王英俊', phone: '13800138003', gender: '男', birthday: '1985-03-10' }
];

db.serialize(() => {
  const stmt = db.prepare('INSERT OR IGNORE INTO stores (id, name, address, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  sampleStores.forEach(store => {
    stmt.run(store.id, store.name, store.address, store.phone, 'active', now, now);
  });
  stmt.finalize();

  const stmt2 = db.prepare('INSERT OR IGNORE INTO customers (id, name, phone, gender, birthday, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  sampleCustomers.forEach(customer => {
    stmt2.run(customer.id, customer.name, customer.phone, customer.gender, customer.birthday, now, now);
  });
  stmt2.finalize();

  const samplePackages = [
    {
      id: uuidv4(),
      customer_id: sampleCustomers[0].id,
      name: '面部护理年卡',
      total_count: 48,
      used_count: 12,
      remaining_count: 36,
      gift_count: 2,
      used_gift_count: 0,
      purchase_date: '2024-01-01',
      expire_date: '2024-12-31',
      original_store_id: sampleStores[0].id,
      current_store_id: sampleStores[0].id
    },
    {
      id: uuidv4(),
      customer_id: sampleCustomers[1].id,
      name: '身体护理套餐',
      total_count: 24,
      used_count: 5,
      remaining_count: 19,
      gift_count: 0,
      used_gift_count: 0,
      purchase_date: '2024-03-15',
      expire_date: '2025-03-15',
      original_store_id: sampleStores[1].id,
      current_store_id: sampleStores[1].id
    }
  ];

  const stmt3 = db.prepare('INSERT OR IGNORE INTO treatment_packages (id, customer_id, name, total_count, used_count, remaining_count, gift_count, used_gift_count, purchase_date, expire_date, original_store_id, current_store_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  samplePackages.forEach(pkg => {
    stmt3.run(pkg.id, pkg.customer_id, pkg.name, pkg.total_count, pkg.used_count, pkg.remaining_count, pkg.gift_count, pkg.used_gift_count, pkg.purchase_date, pkg.expire_date, pkg.original_store_id, pkg.current_store_id, 'active', now, now);
  });
  stmt3.finalize();

  const giftId = uuidv4();
  db.run('INSERT OR IGNORE INTO gift_records (id, package_id, gift_count, reason, operator, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [giftId, samplePackages[0].id, 2, '活动赠送', 'admin', now]);

  const transferId = uuidv4();
  db.run('INSERT OR IGNORE INTO store_transfer_requests (id, package_id, from_store_id, to_store_id, status, request_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [transferId, samplePackages[1].id, sampleStores[1].id, sampleStores[0].id, 'pending', '顾客搬迁申请转店', now, now]);

  const extensionId = uuidv4();
  db.run('INSERT OR IGNORE INTO extension_requests (id, package_id, original_expire_date, new_expire_date, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [extensionId, samplePackages[0].id, '2024-12-31', '2025-06-30', '顾客怀孕申请延期', 'pending', now, now]);

  const verifyId = uuidv4();
  db.run('INSERT OR IGNORE INTO verification_records (id, package_id, store_id, customer_id, verify_count, use_gift_count, use_paid_count, verify_date, operator, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [verifyId, samplePackages[0].id, sampleStores[0].id, sampleCustomers[0].id, 1, 0, 1, today, '小美', '常规护理', now]);

  console.log('样例数据插入完成');
  console.log('门店:', sampleStores.map(s => s.name).join(', '));
  console.log('顾客:', sampleCustomers.map(c => c.name).join(', '));
  console.log('套餐:', samplePackages.map(p => p.name).join(', '));
});

db.close();
