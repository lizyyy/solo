const db = require('../src/database');

const FIXED_READERS = [
  { id: 'reader-001-teacher-zhangsan', name: '张老师', identity_type: 'teacher', department: '计算机系' },
  { id: 'reader-002-teacher-lisi', name: '李老师', identity_type: 'teacher', department: '数学系' },
  { id: 'reader-003-staff-wangzhu', name: '王主任', identity_type: 'staff', department: '图书馆' },
  { id: 'reader-004-student-xiaoming', name: '小明', identity_type: 'student', department: '计算机系' },
  { id: 'reader-005-student-xiaohong', name: '小红', identity_type: 'student', department: '中文系' },
  { id: 'reader-006-student-xiaohua', name: '小华', identity_type: 'student', department: '物理系' }
];

const FIXED_BOOKS = [
  { id: 'book-001-csapp-1', isbn: '978-7-111-54493-7', title: '深入理解计算机系统', author: 'Randal E. Bryant', location: 'A区-3楼', status: 'available' },
  { id: 'book-002-csapp-2', isbn: '978-7-111-54493-7', title: '深入理解计算机系统', author: 'Randal E. Bryant', location: 'A区-3楼', status: 'available' },
  { id: 'book-003-clrs-1', isbn: '978-7-115-42746-2', title: '算法导论', author: 'Thomas H. Cormen', location: 'A区-3楼', status: 'available' },
  { id: 'book-004-clrs-2', isbn: '978-7-115-42746-2', title: '算法导论', author: 'Thomas H. Cormen', location: 'A区-3楼', status: 'available' },
  { id: 'book-005-marquez-1', isbn: '978-7-5447-5426-3', title: '百年孤独', author: '加西亚·马尔克斯', location: 'B区-2楼', status: 'available' },
  { id: 'book-006-cao-1', isbn: '978-7-02-008721-1', title: '红楼梦', author: '曹雪芹', location: 'B区-2楼', status: 'available' }
];

const now = Date.now();

console.log('开始初始化样例数据（可重复调用模式）...');

db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  try {
    db.run('DELETE FROM booking_queue');
    db.run('DELETE FROM overdue_records');
    db.run('DELETE FROM circulation_reports');
    db.run('DELETE FROM error_logs');
    db.run('DELETE FROM readers');
    db.run('DELETE FROM book_copies');

    console.log('已清理所有旧数据');

    const readerStmt = db.prepare(`INSERT INTO readers 
      (id, name, identity_type, department, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`);
    
    FIXED_READERS.forEach(reader => {
      readerStmt.run(reader.id, reader.name, reader.identity_type, reader.department, now, now);
    });
    readerStmt.finalize();
    console.log(`已插入 ${FIXED_READERS.length} 位读者（固定ID）`);

    const bookStmt = db.prepare(`INSERT INTO book_copies 
      (id, isbn, title, author, location, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
    FIXED_BOOKS.forEach(book => {
      bookStmt.run(book.id, book.isbn, book.title, book.author, book.location, book.status, now, now);
    });
    bookStmt.finalize();
    console.log(`已插入 ${FIXED_BOOKS.length} 本图书（固定ID）`);

    db.run('COMMIT');
    console.log('事务提交成功');

  } catch (err) {
    db.run('ROLLBACK');
    console.error('初始化失败，事务已回滚:', err.message);
    process.exit(1);
  }

  setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log('样例数据初始化完成！');
    console.log('='.repeat(50));
    console.log('\n读者固定ID参考:');
    FIXED_READERS.forEach(r => console.log(`  ${r.name}: ${r.id}`));
    console.log('\n图书固定ID参考:');
    FIXED_BOOKS.forEach(b => console.log(`  ${b.title}: ${b.id}`));
    console.log('\n提示: 重复运行本脚本将重置所有数据为初始状态');
    process.exit(0);
  }, 300);
});
