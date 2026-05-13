const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/consignment.db');
const db = new sqlite3.Database(dbPath);

const consignors = [
  { name: '张三', phone: '13800138001', email: 'zhangsan@example.com', id_card: '110101199001010001', bank_account: '6222020200010001001', bank_name: '工商银行北京分行' },
  { name: '李四', phone: '13800138002', email: 'lisi@example.com', id_card: '110101199001010002', bank_account: '6222020200010001002', bank_name: '建设银行上海分行' },
  { name: '王五', phone: '13800138003', email: 'wangwu@example.com', id_card: '110101199001010003', bank_account: '6222020200010001003', bank_name: '招商银行深圳分行' }
];

const books = [
  { consignor_id: null, isbn: '9787020002207', title: '活着', author: '余华', publisher: '作家出版社', original_price: 39.00 },
  { consignor_id: null, isbn: '9787544270008', title: '围城', author: '钱钟书', publisher: '人民文学出版社', original_price: 45.00 },
  { consignor_id: null, isbn: '9787530216729', title: '平凡的世界', author: '路遥', publisher: '北京十月文艺出版社', original_price: 68.00 },
  { consignor_id: null, isbn: '9787020146628', title: '百年孤独', author: '加西亚·马尔克斯', publisher: '南海出版公司', original_price: 55.00 },
  { consignor_id: null, isbn: '9787532779055', title: '追风筝的人', author: '卡勒德·胡赛尼', publisher: '上海人民出版社', original_price: 49.00 }
];

const seed = async () => {
  console.log('开始生成样例数据...');

  const consignorIds = [];
  for (const consignor of consignors) {
    const id = uuidv4();
    consignorIds.push(id);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO consignors (id, name, phone, email, id_card, bank_account, bank_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, consignor.name, consignor.phone, consignor.email, consignor.id_card, consignor.bank_account, consignor.bank_name],
        (err) => err ? reject(err) : resolve()
      );
    });
    console.log(`已创建寄售人: ${consignor.name}`);
  }

  const bookIds = [];
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const id = uuidv4();
    bookIds.push(id);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO books (id, consignor_id, isbn, title, author, publisher, original_price, status, estimated_price, current_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, consignorIds[i % 3], book.isbn, book.title, book.author, book.publisher, book.original_price, 
         i < 3 ? 'sold' : i === 3 ? 'for_sale' : 'evaluated',
         book.original_price * 0.6, book.original_price * 0.6],
        (err) => err ? reject(err) : resolve()
      );
    });
    console.log(`已创建书籍: ${book.title}`);
  }

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO evaluations (id, book_id, evaluator, condition, condition_description, estimated_price, notes) VALUES 
       (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), bookIds[0], '管理员', '九成新', '封面轻微磨损，内页干净', 23.40, '品相良好',
        uuidv4(), bookIds[1], '管理员', '八成新', '有阅读痕迹，无缺页', 27.00, '正常旧书',
        uuidv4(), bookIds[2], '管理员', '九五新', '几乎全新，仅拆封', 40.80, '品相极佳'
      ],
      (err) => err ? reject(err) : resolve()
    );
  });
  console.log('已创建估价记录');

  await new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO sales (id, book_id, sold_price, sold_at, sold_by, platform, buyer_info, commission_rate, seller_share, platform_fee, status) VALUES 
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), bookIds[0], 23.40, now, '管理员', '线下门店', '顾客A', 0.3, 16.38, 7.02, 'completed',
        uuidv4(), bookIds[1], 25.00, now, '管理员', '微信小程序', '顾客B', 0.3, 17.50, 7.50, 'completed',
        uuidv4(), bookIds[2], 40.80, now, '管理员', '闲鱼', '顾客C', 0.3, 28.56, 12.24, 'completed'
      ],
      (err) => err ? reject(err) : resolve()
    );
  });
  console.log('已创建销售记录');

  const statuses = ['pending_evaluation', 'evaluated', 'for_sale', 'sold'];
  const reasons = [
    '书籍创建，等待品相估价',
    '品相估价完成，等待上架',
    '书籍已上架待售',
    '书籍已售出'
  ];

  for (let i = 0; i < bookIds.length; i++) {
    const maxStatus = Math.min(i + 1, 4);
    for (let j = 0; j < maxStatus; j++) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO status_timeline (id, book_id, status, previous_status, changed_by, change_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), 
            bookIds[i], 
            statuses[j], 
            j > 0 ? statuses[j - 1] : null,
            'system',
            reasons[j],
            new Date(Date.now() - (maxStatus - j) * 3600000).toISOString()
          ],
          (err) => err ? reject(err) : resolve()
        );
      });
    }
  }
  console.log('已创建状态时间线记录');

  console.log('样例数据生成完成!');
  db.close();
};

seed().catch(err => {
  console.error('生成样例数据失败:', err);
  db.close();
});
