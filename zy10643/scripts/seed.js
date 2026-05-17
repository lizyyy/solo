const { v4: uuidv4 } = require('uuid');
const db = require('../src/database/db');

function runExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function seedData() {
  console.log('开始造数...');

  const emp1Id = uuidv4();
  const emp2Id = uuidv4();
  const emp3Id = uuidv4();
  
  await runExecute(
    'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)',
    [emp1Id, '张三', '技术部']
  );
  await runExecute(
    'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)',
    [emp2Id, '李四', '财务部']
  );
  await runExecute(
    'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)',
    [emp3Id, '王五', '市场部']
  );

  const sub1Id = uuidv4();
  const sub2Id = uuidv4();
  const sub3Id = uuidv4();
  const sub4Id = uuidv4();
  
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub1Id, '差旅费', 'TRAVEL001', 100000, 0]
  );
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub2Id, '办公费', 'OFFICE001', 50000, 0]
  );
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub3Id, '招待费', 'ENTERTAIN001', 30000, 0]
  );
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub4Id, '培训费', 'TRAIN001', 80000, 45000]
  );

  const order1Id = uuidv4();
  const order2Id = uuidv4();
  const order3Id = uuidv4();
  
  await runExecute(
    'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
    [order1Id, emp1Id, 5000, sub1Id, 'pending']
  );
  await runExecute(
    'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
    [order2Id, emp2Id, 3000, sub2Id, 'pending']
  );
  await runExecute(
    'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
    [order3Id, emp3Id, 8000, sub1Id, 'pending']
  );

  console.log('造数完成!');
  console.log('员工ID:', { emp1Id, emp2Id, emp3Id });
  console.log('预算科目ID:', { sub1Id, sub2Id, sub3Id, sub4Id });
  console.log('报销单ID:', { order1Id, order2Id, order3Id });
  
  process.exit(0);
}

seedData().catch(err => {
  console.error('造数失败:', err);
  process.exit(1);
});
