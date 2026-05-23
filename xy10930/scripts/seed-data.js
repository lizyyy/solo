const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dbDir = path.join(__dirname, '..', 'db');
const dbPath = path.join(dbDir, 'water_station.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('已创建 db 目录');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到数据库');
});

function run() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        const bucketNos = ['A0001', 'A0002', 'A0003', 'A0004', 'A0005', 'A0006', 'A0007', 'A0008', 'A0009', 'A0010',
                           'B0001', 'B0002', 'B0003', 'B0004', 'B0005', 'B0006', 'B0007', 'B0008', 'B0009', 'B0010'];
        
        const bucketStmt = db.prepare(`INSERT INTO buckets (id, bucket_no, status) VALUES (?, ?, ?)`);
        
        for (const no of bucketNos) {
          bucketStmt.run(uuidv4(), no, 'in_stock');
        }
        bucketStmt.finalize();
        console.log(`已插入 ${bucketNos.length} 个桶编号`);

        const customers = [
          { name: '张三', phone: '13800138001', address: '北京市朝阳区建国路88号' },
          { name: '李四', phone: '13800138002', address: '北京市海淀区中关村大街1号' },
          { name: '王五', phone: '13800138003', address: '北京市西城区金融街7号' },
          { name: '赵六', phone: '13800138004', address: '北京市东城区王府井大街2号' },
          { name: '陈七', phone: '13800138005', address: '北京市丰台区丰台路5号' }
        ];

        const customerStmt = db.prepare(`INSERT INTO customers (id, name, phone, address, total_deposit, frozen_deposit, available_deposit, bucket_count) VALUES (?, ?, ?, ?, 0, 0, 0, 0)`);
        
        for (const customer of customers) {
          customerStmt.run(uuidv4(), customer.name, customer.phone, customer.address);
        }
        customerStmt.finalize();
        console.log(`已插入 ${customers.length} 个客户`);

        console.log('样例数据初始化完成！');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

run().then(() => {
  db.close();
  console.log('数据库连接已关闭');
}).catch((err) => {
  console.error('初始化失败:', err);
  db.close();
  process.exit(1);
});
