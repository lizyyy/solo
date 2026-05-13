const db = require('../database');

console.log('开始初始化数据...');

const employees = [
  { employee_id: 'EMP001', name: '张三', department: '技术部', size: 'M' },
  { employee_id: 'EMP002', name: '李四', department: '销售部', size: 'L' },
  { employee_id: 'EMP003', name: '王五', department: '行政部', size: 'S' },
  { employee_id: 'EMP004', name: '赵六', department: '技术部', size: 'XL' },
  { employee_id: 'EMP005', name: '钱七', department: '销售部', size: 'M' },
];

const inventory = [
  { size: 'S', quantity: 15 },
  { size: 'M', quantity: 25 },
  { size: 'L', quantity: 20 },
  { size: 'XL', quantity: 10 },
  { size: 'XXL', quantity: 5 },
];

const batches = [
  { batch_number: 'BATCH2024001', uniform_type: '夏季工装', total_quantity: 50 },
  { batch_number: 'BATCH2024002', uniform_type: '冬季工装', total_quantity: 30 },
];

db.serialize(() => {
  console.log('插入员工数据...');
  const empStmt = db.prepare('INSERT OR IGNORE INTO employees (employee_id, name, department, size, status) VALUES (?, ?, ?, ?, ?)');
  employees.forEach(emp => {
    empStmt.run(emp.employee_id, emp.name, emp.department, emp.size, 'active');
  });
  empStmt.finalize();

  console.log('插入库存数据...');
  const invStmt = db.prepare('INSERT OR IGNORE INTO inventory (size, quantity) VALUES (?, ?)');
  inventory.forEach(inv => {
    invStmt.run(inv.size, inv.quantity);
  });
  invStmt.finalize();

  console.log('插入批次数据...');
  const batStmt = db.prepare('INSERT OR IGNORE INTO batches (batch_number, uniform_type, size_distribution, total_quantity) VALUES (?, ?, ?, ?)');
  batches.forEach(bat => {
    batStmt.run(bat.batch_number, bat.uniform_type, JSON.stringify(inventory), bat.total_quantity);
  });
  batStmt.finalize();

  console.log('✅ 数据初始化完成！');
  console.log('已创建:');
  console.log('  - 5 名员工');
  console.log('  - 5 个尺码库存');
  console.log('  - 2 个批次');
  console.log('\n现在可以运行 npm run dev 启动应用');
});