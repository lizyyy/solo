const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const testData = [
  {
    app_key: 'app001',
    callback_url: 'https://api.example.com/callback/v1',
    old_signature_version: 'v1',
    new_signature_version: 'v2',
    current_signature_version: 'v1',
    status: 'switched',
    fail_count: 0,
    gray_start_time: '2024-01-01 10:00:00',
    switch_time: '2024-01-02 10:00:00',
    old_key_expire_time: '2024-02-01 23:59:59'
  },
  {
    app_key: 'app002',
    callback_url: 'https://api.example.com/callback/v1',
    old_signature_version: 'v1',
    new_signature_version: 'v2',
    current_signature_version: 'v1',
    status: 'in_gray',
    fail_count: 2,
    gray_start_time: '2024-01-05 10:00:00',
    old_key_expire_time: '2024-03-01 23:59:59'
  },
  {
    app_key: 'app003',
    callback_url: 'https://api.example.com/callback/v1',
    old_signature_version: 'v1',
    new_signature_version: 'v2',
    current_signature_version: 'v1',
    status: 'not_enabled',
    fail_count: 0,
    old_key_expire_time: '2024-04-01 23:59:59'
  },
  {
    app_key: 'app004',
    callback_url: 'https://api.example.com/callback/v1',
    old_signature_version: 'v2',
    new_signature_version: 'v3',
    current_signature_version: 'v2',
    status: 'rolled_back',
    fail_count: 5,
    gray_start_time: '2024-01-10 10:00:00',
    switch_time: '2024-01-11 10:00:00',
    rollback_time: '2024-01-11 14:00:00',
    old_key_expire_time: '2024-05-01 23:59:59'
  },
  {
    app_key: 'app001',
    callback_url: 'https://api.example.com/callback/v2',
    old_signature_version: 'v2',
    new_signature_version: 'v3',
    current_signature_version: 'v2',
    status: 'not_enabled',
    fail_count: 0,
    old_key_expire_time: '2024-06-01 23:59:59'
  }
];

const insertStmt = db.prepare(`
  INSERT INTO signature_rotations 
  (app_key, callback_url, old_signature_version, new_signature_version, current_signature_version, status, fail_count, gray_start_time, switch_time, rollback_time, old_key_expire_time, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);

db.serialize(() => {
  testData.forEach(data => {
    insertStmt.run(
      data.app_key,
      data.callback_url,
      data.old_signature_version,
      data.new_signature_version,
      data.current_signature_version,
      data.status,
      data.fail_count,
      data.gray_start_time,
      data.switch_time,
      data.rollback_time,
      data.old_key_expire_time
    );
  });

  insertStmt.finalize();
  console.log('测试数据插入完成');
});

db.close();
