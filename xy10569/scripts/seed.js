const database = require('../src/database');
const { studentService, classService, teacherService, bookService } = require('../src/services/baseServices');

async function runSeed() {
  console.log('========================================');
  console.log('   初始化样例数据');
  console.log('========================================\n');

  await database.initDatabase();

  const operatorId = 'system-seed';

  console.log('1. 创建班级...');
  const class1 = await classService.create({
    id: 'class-301',
    name: '三年级1班',
    grade: 3,
    headTeacherId: null
  }, operatorId);

  const class2 = await classService.create({
    id: 'class-302',
    name: '三年级2班',
    grade: 3,
    headTeacherId: null
  }, operatorId);

  console.log('   ✅ 班级创建完成');

  console.log('\n2. 创建教师...');
  const teacher = await teacherService.create({
    id: 'teacher-wang',
    teacher_no: 'T001',
    name: '王老师',
    phone: '13800138001'
  }, operatorId);

  console.log('   ✅ 教师创建完成');

  console.log('\n3. 创建学生...');
  const studentsData = [
    { id: 'stu-301-01', student_no: 'S301001', name: '张三', class_id: 'class-301' },
    { id: 'stu-301-02', student_no: 'S301002', name: '李四', class_id: 'class-301' },
    { id: 'stu-301-03', student_no: 'S301003', name: '王五', class_id: 'class-301' },
    { id: 'stu-302-01', student_no: 'S302001', name: '赵六', class_id: 'class-302' },
    { id: 'stu-302-02', student_no: 'S302002', name: '钱七', class_id: 'class-302' },
  ];

  for (const s of studentsData) {
    await studentService.create(s, operatorId);
  }
  console.log('   ✅ 学生创建完成');

  console.log('\n4. 创建图书...');
  const booksData = [
    { id: 'book-001', isbn: '978-7-100-12345-1', title: '西游记', author: '吴承恩', price: 35.00, category: '文学' },
    { id: 'book-002', isbn: '978-7-100-12345-2', title: '红楼梦', author: '曹雪芹', price: 40.00, category: '文学' },
    { id: 'book-003', isbn: '978-7-100-12345-3', title: '三国演义', author: '罗贯中', price: 38.00, category: '文学' },
    { id: 'book-004', isbn: '978-7-100-12345-4', title: '水浒传', author: '施耐庵', price: 36.00, category: '文学' },
    { id: 'book-005', isbn: '978-7-100-12345-5', title: 'Python入门', author: '张三', price: 55.00, category: '科技' },
    { id: 'book-006', isbn: '978-7-100-12345-6', title: '数学思维', author: '李四', price: 45.00, category: '教育' },
    { id: 'book-007', isbn: '978-7-100-12345-7', title: '英语故事', author: 'Wang', price: 32.00, category: '外语' },
    { id: 'book-008', isbn: '978-7-100-12345-8', title: '科学探索', author: '赵六', price: 48.00, category: '科技' },
  ];

  for (const b of booksData) {
    await bookService.create(b, operatorId);
  }
  console.log('   ✅ 图书创建完成');

  console.log('\n========================================');
  console.log('   样例数据初始化完成！');
  console.log('========================================\n');
  console.log('创建的基础数据:');
  console.log('  - 班级: 2个 (三年级1班、三年级2班)');
  console.log('  - 教师: 1个 (王老师)');
  console.log('  - 学生: 5个');
  console.log('  - 图书: 8本');
  console.log('\n下一步可以运行: node scripts/demo.js 执行完整演示');
}

runSeed().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
