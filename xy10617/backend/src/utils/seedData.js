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
    let status = '';
    let estimatedPrice = book.original_price * 0.6;
    let currentPrice = estimatedPrice;
    
    if (i === 0) {
      status = 'sold';
    } else if (i === 1) {
      status = 'returned';
      currentPrice = estimatedPrice * 0.9;
    } else if (i === 2) {
      status = 'sold';
    } else if (i === 3) {
      status = 'for_sale';
      currentPrice = estimatedPrice * 0.85;
    } else {
      status = 'evaluated';
    }
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO books (id, consignor_id, isbn, title, author, publisher, original_price, status, estimated_price, current_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, consignorIds[i % 3], book.isbn, book.title, book.author, book.publisher, book.original_price, status, estimatedPrice, currentPrice],
        (err) => err ? reject(err) : resolve()
      );
    });
    console.log(`已创建书籍: ${book.title} - 状态: ${status}`);
  }

  const evaluations = [
    { book_id: bookIds[0], evaluator: '李管理员', condition: '九成新', condition_description: '封面轻微磨损，内页干净无笔记', estimated_price: 23.40, notes: '品相良好' },
    { book_id: bookIds[1], evaluator: '王审核员', condition: '八成新', condition_description: '有阅读痕迹，无缺页无水印', estimated_price: 27.00, notes: '正常旧书' },
    { book_id: bookIds[2], evaluator: '张管理员', condition: '九五新', condition_description: '几乎全新，仅拆封未阅读', estimated_price: 40.80, notes: '品相极佳' },
    { book_id: bookIds[3], evaluator: '李管理员', condition: '八五新', condition_description: '书角轻微折痕，内页干净', estimated_price: 33.00, notes: '整体较好' },
    { book_id: bookIds[4], evaluator: '王审核员', condition: '九成新', condition_description: '保存完好，无明显磨损', estimated_price: 29.40, notes: '建议上架' }
  ];

  for (const evalItem of evaluations) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO evaluations (id, book_id, evaluator, condition, condition_description, estimated_price, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuidv4(), evalItem.book_id, evalItem.evaluator, evalItem.condition, evalItem.condition_description, evalItem.estimated_price, evalItem.notes],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  console.log('已创建品相估价记录');

  const priceReductions = [
    { book_id: bookIds[1], original_price: 27.00, proposed_price: 24.30, reason: '上架两周无人问津，申请降价10%', proposer: '张管理员', approver: '王审核员', status: 'approved', approved_at: new Date().toISOString() },
    { book_id: bookIds[3], original_price: 33.00, proposed_price: 28.05, reason: '版本较旧，建议降价促销', proposer: '李管理员', approver: null, status: 'pending', approved_at: null }
  ];

  for (const pr of priceReductions) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO price_reductions (id, book_id, original_price, proposed_price, reason, proposer, approver, status, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuidv4(), pr.book_id, pr.original_price, pr.proposed_price, pr.reason, pr.proposer, pr.approver, pr.status, pr.approved_at],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  console.log('已创建降价确认记录');

  const now = new Date();
  const sales = [
    { book_id: bookIds[0], sold_price: 23.40, sold_at: new Date(now - 2 * 24 * 3600000).toISOString(), sold_by: '销售员A', platform: '线下门店', buyer_info: '顾客A-到店自提', commission_rate: 0.3, seller_share: 16.38, platform_fee: 7.02, status: 'completed' },
    { book_id: bookIds[2], sold_price: 40.80, sold_at: new Date(now - 1 * 24 * 3600000).toISOString(), sold_by: '销售员B', platform: '闲鱼', buyer_info: '用户booklover-快递发货', commission_rate: 0.3, seller_share: 28.56, platform_fee: 12.24, status: 'completed' }
  ];

  for (const sale of sales) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO sales (id, book_id, sold_price, sold_at, sold_by, platform, buyer_info, commission_rate, seller_share, platform_fee, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuidv4(), sale.book_id, sale.sold_price, sale.sold_at, sale.sold_by, sale.platform, sale.buyer_info, sale.commission_rate, sale.seller_share, sale.platform_fee, sale.status],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  console.log('已创建售出分成记录');

  const returnId = uuidv4();
  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO returns (id, book_id, return_reason, returned_at, received_by, inspection_result, inspection_notes, inspected_by, inspected_at, status, manual_process_required, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [returnId, bookIds[1], '顾客反映内页有笔记划线，与描述不符', new Date(now - 5 * 24 * 3600000).toISOString(), '收货员B', 'fail', '确实存在多处笔记，超出描述范围，做退货处理，需人工联系寄售人说明情况', '质检张', new Date(now - 4 * 24 * 3600000).toISOString(), 'inspection_failed', 1],
      (err) => err ? reject(err) : resolve()
    );
  });
  console.log('已创建退回验收记录');

  const settlementId1 = uuidv4();
  const settlementId2 = uuidv4();
  const periodStart = new Date(now - 30 * 24 * 3600000).toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settlements (id, consignor_id, period_start, period_end, total_sales, total_commission, total_settlement, status, generated_by, generated_at, paid_at, paid_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [settlementId1, consignorIds[0], periodStart, periodEnd, 23.40, 7.02, 16.38, 'paid', '财务李', new Date(now - 3 * 24 * 3600000).toISOString(), new Date(now - 1 * 24 * 3600000).toISOString(), '财务王'],
      (err) => err ? reject(err) : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settlements (id, consignor_id, period_start, period_end, total_sales, total_commission, total_settlement, status, generated_by, generated_at, paid_at, paid_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [settlementId2, consignorIds[2], periodStart, periodEnd, 40.80, 12.24, 28.56, 'pending', '财务李', new Date(now - 2 * 24 * 3600000).toISOString(), null, null],
      (err) => err ? reject(err) : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settlement_items (id, settlement_id, book_id, sale_id, sold_price, commission, seller_share, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), settlementId1, bookIds[0], null, 23.40, 7.02, 16.38],
      (err) => err ? reject(err) : resolve()
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settlement_items (id, settlement_id, book_id, sale_id, sold_price, commission, seller_share, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), settlementId2, bookIds[2], null, 40.80, 12.24, 28.56],
      (err) => err ? reject(err) : resolve()
    );
  });
  console.log('已创建分成账单记录');

  const statusFlows = [
    { bookIndex: 0, statuses: ['pending_evaluation', 'evaluated', 'for_sale', 'sold'], reasons: ['书籍创建，等待品相估价', '完成品相估价', '确认上架待售', '书籍已售出，等待结算'] },
    { bookIndex: 1, statuses: ['pending_evaluation', 'evaluated', 'for_sale', 'sold', 'returned', 'inspection_failed'], reasons: ['书籍创建，等待品相估价', '完成品相估价', '降价审批通过，上架待售', '书籍已售出', '顾客申请退货', '退货验收不通过，需人工处理'] },
    { bookIndex: 2, statuses: ['pending_evaluation', 'evaluated', 'for_sale', 'sold'], reasons: ['书籍创建，等待品相估价', '完成品相估价', '确认上架待售', '书籍已售出，等待结算'] },
    { bookIndex: 3, statuses: ['pending_evaluation', 'evaluated', 'for_sale'], reasons: ['书籍创建，等待品相估价', '完成品相估价', '降价审批通过，上架待售'] },
    { bookIndex: 4, statuses: ['pending_evaluation', 'evaluated'], reasons: ['书籍创建，等待品相估价', '完成品相估价，等待上架'] }
  ];

  for (const flow of statusFlows) {
    const bookId = bookIds[flow.bookIndex];
    for (let i = 0; i < flow.statuses.length; i++) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO status_timeline (id, book_id, status, previous_status, changed_by, change_reason, old_values, new_values, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            bookId,
            flow.statuses[i],
            i > 0 ? flow.statuses[i - 1] : null,
            i === 0 ? 'system' : '管理员',
            flow.reasons[i],
            null,
            null,
            new Date(Date.now() - (flow.statuses.length - i) * 3600000).toISOString()
          ],
          (err) => err ? reject(err) : resolve()
        );
      });
    }
  }
  console.log('已创建状态时间线记录');

  console.log('\n样例数据生成完成!');
  console.log('- 寄售人: 3人');
  console.log('- 书籍: 5本');
  console.log('- 品相估价: 5条');
  console.log('- 降价确认: 2条（1条已批准，1条待审批）');
  console.log('- 售出分成: 2条');
  console.log('- 退回验收: 1条（验收不通过，需人工处理）');
  console.log('- 分成账单: 2条（1条已打款，1条待打款）');
  db.close();
};

seed().catch(err => {
  console.error('生成样例数据失败:', err);
  db.close();
});
