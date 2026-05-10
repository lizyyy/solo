const { db } = require('./database');
const DAOs = require('./daos');

const patients = [
  { id: 'pat-001', name: '张三', phone: '13800138001', id_card: '110101199001011234', age: 34, gender: '男' },
  { id: 'pat-002', name: '李四', phone: '13800138002', id_card: '110101199202022345', age: 32, gender: '女' },
  { id: 'pat-003', name: '王五', phone: '13800138003', id_card: '110101198503033456', age: 39, gender: '男' }
];

const escorts = [
  { id: 'esc-001', name: '李陪诊', phone: '13900139001', skills: '内科,外科,儿科' },
  { id: 'esc-002', name: '王陪护', phone: '13900139002', skills: '骨科,神经科,肿瘤科' },
  { id: 'esc-003', name: '张助理', phone: '13900139003', skills: '妇产科,儿科,眼科' }
];

const examinations = [
  { id: 'exam-001', name: '血常规检查', department: '内科', price: 80, duration: 30 },
  { id: 'exam-002', name: '肝功能检查', department: '内科', price: 150, duration: 30 },
  { id: 'exam-003', name: 'CT扫描', department: '放射科', price: 500, duration: 60 },
  { id: 'exam-004', name: '核磁共振(MRI)', department: '放射科', price: 800, duration: 90 },
  { id: 'exam-005', name: '心电图检查', department: '心内科', price: 60, duration: 20 },
  { id: 'exam-006', name: 'B超检查', department: '超声科', price: 120, duration: 30 },
  { id: 'exam-007', name: '胃镜检查', department: '消化科', price: 400, duration: 60 },
  { id: 'exam-008', name: '尿常规检查', department: '内科', price: 40, duration: 15 }
];

function seed() {
  console.log('开始清理旧数据...');
  
  db._data.orders = [];
  db._data.order_timeline = [];
  db._data.schedules = [];
  db._data.order_examinations = [];
  db._data.order_fees = [];
  db._data.patients = [];
  db._data.escorts = [];
  db._data.examinations = [];
  db._data.idempotent_records = [];
  db.save();

  console.log('插入患者数据...');
  patients.forEach(p => {
    db._data.patients.push({
      ...p,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  });

  console.log('插入陪诊员数据...');
  escorts.forEach(e => {
    db._data.escorts.push({
      ...e,
      status: 'active',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
  });

  console.log('插入检查项目数据...');
  examinations.forEach(exam => {
    db._data.examinations.push(exam);
  });

  db.save();

  console.log('✅ 基础数据插入完成！');
  console.log('\n已创建数据:');
  console.log('  患者: 3 人');
  console.log('  陪诊员: 3 人');
  console.log('  检查项目: 8 项');
  console.log('\n接下来可以运行: npm run test 查看完整测试流程');
}

seed();
