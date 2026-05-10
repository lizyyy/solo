const { subDays } = require('date-fns');
const { db, runAsync, getAsync, allAsync } = require('./database');

async function seed() {
  console.log('Starting database seeding...');

  await new Promise((resolve) => {
    db.serialize(resolve);
  });
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    await runAsync('DELETE FROM book_tags');
    await runAsync('DELETE FROM flow_history');
    await runAsync('DELETE FROM compensations');
    await runAsync('DELETE FROM borrow_records');
    await runAsync('DELETE FROM books');
    await runAsync('DELETE FROM residents');
    await runAsync('DELETE FROM tags');
    await runAsync('DELETE FROM locations');
  } catch (e) {
    console.log('Tables may not exist yet, continuing...');
  }

  console.log('Cleaned existing data');

  const locations = [
    { name: '社区中心阅览室', description: '位于社区服务中心一楼' },
    { name: '阳光花园A栋漂流柜', description: 'A栋大堂右侧' },
    { name: '绿荫小区B栋前台', description: 'B栋物业管理处' },
    { name: '老年活动中心', description: '公园旁老年活动中心' }
  ];

  for (const loc of locations) {
    await runAsync('INSERT INTO locations (name, description) VALUES (?, ?)', [loc.name, loc.description]);
  }
  console.log('Created locations');

  const tags = ['文学', '科技', '儿童', '历史', '哲学', '生活', '教育'];
  for (const tag of tags) {
    await runAsync('INSERT INTO tags (name) VALUES (?)', [tag]);
  }
  console.log('Created tags');

  const residents = [
    { name: '张三', phone: '13800138001', address: '阳光花园A栋101' },
    { name: '李四', phone: '13800138002', address: '绿荫小区B栋203' },
    { name: '王五', phone: '13800138003', address: '阳光花园C栋305' },
    { name: '赵六', phone: '13800138004', address: '社区家属院1栋' }
  ];

  for (const res of residents) {
    await runAsync('INSERT INTO residents (name, phone, address) VALUES (?, ?, ?)', [res.name, res.phone, res.address]);
  }
  console.log('Created residents');

  const books = [
    { isbn: '9787020002207', title: '活着', author: '余华', description: '经典文学作品', location_id: 1, tags: [1, 5] },
    { isbn: '9787544247375', title: '百年孤独', author: '马尔克斯', description: '魔幻现实主义代表作', location_id: 2, tags: [1] },
    { isbn: '9787115428028', title: 'JavaScript高级程序设计', author: 'Zakas', description: '前端开发必备', location_id: 1, tags: [2] },
    { isbn: '9787532742889', title: '小王子', author: '圣埃克苏佩里', description: '儿童文学经典', location_id: 4, tags: [3, 1] },
    { isbn: '9787101003048', title: '史记', author: '司马迁', description: '二十四史之首', location_id: 3, tags: [4] },
    { isbn: '9787302199546', title: '数据结构', author: '严蔚敏', description: '计算机基础教材', location_id: 1, tags: [2, 7] }
  ];

  for (const book of books) {
    const result = await runAsync(
      'INSERT INTO books (isbn, title, author, description, current_location_id) VALUES (?, ?, ?, ?, ?)',
      [book.isbn, book.title, book.author, book.description, book.location_id]
    );
    
    for (const tagId of book.tags) {
      await runAsync('INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)', [result.lastID, tagId]);
    }

    await runAsync(
      "INSERT INTO flow_history (book_id, action, to_location_id, notes) VALUES (?, 'added', ?, '初始入库')",
      [result.lastID, book.location_id]
    );
  }
  console.log('Created books with tags and initial flow history');

  const today = new Date();

  console.log('--- Sample 1: Normal borrow and return ---');
  await simulateBorrow(1, 1, 1, 7, false);
  await simulateReturn(1, 1);

  console.log('--- Sample 2: Overdue book ---');
  await simulateBorrow(2, 2, 2, 45, false);

  console.log('--- Sample 3: Cross-location return ---');
  await simulateBorrow(3, 3, 1, 10, false);
  await simulateReturn(3, 2);

  console.log('--- Sample 4: Lost and compensated ---');
  await simulateBorrow(4, 4, 4, 60, true);
  await simulateCompensate(4, 4, 50.00);

  console.log('Database seeded successfully!');
  console.log('\nSample data overview:');
  console.log('- 4 Locations');
  console.log('- 7 Tags');
  console.log('- 4 Residents');
  console.log('- 6 Books with various statuses');
  console.log('- Flow history for all operations');
}

async function simulateBorrow(bookId, residentId, locationId, daysAgo, willBeLost) {
  const borrowDate = subDays(new Date(), daysAgo);
  const expectedReturn = new Date(borrowDate);
  expectedReturn.setDate(expectedReturn.getDate() + 30);

  const formatDate = (d) => d.toISOString().replace('T', ' ').substring(0, 19);

  const result = await runAsync(
    `INSERT INTO borrow_records 
     (book_id, resident_id, borrow_location_id, borrow_date, expected_return_date, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [bookId, residentId, locationId, formatDate(borrowDate), formatDate(expectedReturn)]
  );

  await runAsync(
    `UPDATE books SET status = 'borrowed', current_location_id = NULL WHERE id = ?`,
    [bookId]
  );

  await runAsync(
    `INSERT INTO flow_history 
     (book_id, action, from_location_id, resident_id, borrow_record_id, timestamp, notes)
     VALUES (?, 'borrow', ?, ?, ?, ?, '模拟借阅')`,
    [bookId, locationId, residentId, result.lastID, formatDate(borrowDate)]
  );

  console.log(`Book ${bookId} borrowed ${daysAgo} days ago by resident ${residentId}`);
}

async function simulateReturn(bookId, returnLocationId) {
  const activeBorrow = await getAsync(
    `SELECT * FROM borrow_records WHERE book_id = ? AND status = 'active'`,
    [bookId]
  );

  if (!activeBorrow) return;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const isCross = activeBorrow.borrow_location_id !== returnLocationId;

  await runAsync(
    `UPDATE borrow_records 
     SET actual_return_date = ?, return_location_id = ?, status = 'returned'
     WHERE id = ?`,
    [now, returnLocationId, activeBorrow.id]
  );

  await runAsync(
    `UPDATE books SET status = 'available', current_location_id = ? WHERE id = ?`,
    [returnLocationId, bookId]
  );

  await runAsync(
    `INSERT INTO flow_history 
     (book_id, action, to_location_id, resident_id, borrow_record_id, timestamp, notes)
     VALUES (?, 'return', ?, ?, ?, ?, ?)`,
    [bookId, returnLocationId, activeBorrow.resident_id, activeBorrow.id, now, isCross ? '换点归还' : '正常归还']
  );

  console.log(`Book ${bookId} returned${isCross ? ' (cross-location)' : ''}`);
}

async function simulateCompensate(bookId, residentId, amount) {
  const activeBorrow = await getAsync(
    `SELECT * FROM borrow_records WHERE book_id = ? AND status = 'active'`,
    [bookId]
  );

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  await runAsync(`UPDATE books SET status = 'lost' WHERE id = ?`, [bookId]);

  if (activeBorrow) {
    await runAsync(`UPDATE borrow_records SET status = 'lost' WHERE id = ?`, [activeBorrow.id]);
    
    await runAsync(
      `INSERT INTO flow_history 
       (book_id, action, resident_id, borrow_record_id, timestamp, notes)
       VALUES (?, 'lost', ?, ?, ?, '模拟丢失')`,
      [bookId, residentId, activeBorrow.id, now]
    );
  }

  await runAsync(
    `INSERT INTO compensations (book_id, resident_id, amount, paid_at, notes)
     VALUES (?, ?, ?, ?, '模拟赔偿')`,
    [bookId, residentId, amount, now]
  );

  await runAsync(`UPDATE books SET status = 'compensated' WHERE id = ?`, [bookId]);

  await runAsync(
    `INSERT INTO flow_history 
     (book_id, action, resident_id, timestamp, notes)
     VALUES (?, 'compensated', ?, ?, '赔偿完成')`,
    [bookId, residentId, now]
  );

  console.log(`Book ${bookId} compensated with ¥${amount}`);
}

seed().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('Seeding failed:', err);
  db.close();
  process.exit(1);
});
