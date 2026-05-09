import { db, initDatabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();

const employees = [
  { id: uuidv4(), name: '张三', department: '技术部', monthly_allowance: 500, used_amount: 280 },
  { id: uuidv4(), name: '李四', department: '市场部', monthly_allowance: 600, used_amount: 450 },
  { id: uuidv4(), name: '王五', department: '财务部', monthly_allowance: 500, used_amount: 120 },
  { id: uuidv4(), name: '赵六', department: '技术部', monthly_allowance: 500, used_amount: 0 },
];

const merchants = [
  { id: uuidv4(), name: '美味餐厅', contact_person: '王经理', phone: '13800138001', address: '朝阳区建国路88号' },
  { id: uuidv4(), name: '健康快餐', contact_person: '李老板', phone: '13800138002', address: '海淀区中关村大街1号' },
  { id: uuidv4(), name: '美食广场', contact_person: '张总', phone: '13800138003', address: '东城区王府井大街100号' },
];

function seedData() {
  initDatabase();

  console.log('开始插入初始数据...');

  const insertEmployee = db.prepare(`
    INSERT OR IGNORE INTO employees (id, name, department, monthly_allowance, used_amount, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  employees.forEach(emp => {
    insertEmployee.run(emp.id, emp.name, emp.department, emp.monthly_allowance, emp.used_amount, now, now);
  });

  const insertMerchant = db.prepare(`
    INSERT OR IGNORE INTO merchants (id, name, contact_person, phone, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  merchants.forEach(merch => {
    insertMerchant.run(merch.id, merch.name, merch.contact_person, merch.phone, merch.address, now);
  });

  const insertReceipt = db.prepare(`
    INSERT OR IGNORE INTO receipts (
      id, employee_id, merchant_id, receipt_no, amount, consumption_date, 
      upload_date, status, is_duplicate, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStatusLog = db.prepare(`
    INSERT OR IGNORE INTO status_logs (id, receipt_id, old_status, new_status, operator, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const duplicateGroupId = uuidv4();
  
  const receipts = [
    {
      id: uuidv4(),
      employee_id: employees[0].id,
      merchant_id: merchants[0].id,
      receipt_no: 'INV202605010001',
      amount: 45,
      consumption_date: '2026-05-01',
      upload_date: '2026-05-01',
      status: 'approved',
      is_duplicate: 0
    },
    {
      id: uuidv4(),
      employee_id: employees[0].id,
      merchant_id: merchants[0].id,
      receipt_no: 'INV202605010001',
      amount: 45,
      consumption_date: '2026-05-01',
      upload_date: '2026-05-02',
      status: 'duplicate',
      is_duplicate: 1,
      duplicate_group_id: duplicateGroupId
    },
    {
      id: uuidv4(),
      employee_id: employees[1].id,
      merchant_id: merchants[1].id,
      receipt_no: 'INV202605030002',
      amount: 68,
      consumption_date: '2026-05-03',
      upload_date: '2026-05-03',
      status: 'pending',
      is_duplicate: 0
    },
    {
      id: uuidv4(),
      employee_id: employees[1].id,
      merchant_id: merchants[1].id,
      receipt_no: 'INV202605040003',
      amount: 52,
      consumption_date: '2026-05-04',
      upload_date: '2026-05-04',
      status: 'pending',
      is_duplicate: 0
    },
    {
      id: uuidv4(),
      employee_id: employees[2].id,
      merchant_id: merchants[2].id,
      receipt_no: 'INV202605020004',
      amount: 120,
      consumption_date: '2026-05-02',
      upload_date: '2026-05-02',
      status: 'rejected',
      is_duplicate: 0,
      notes: '金额超出单日限额80元'
    },
    {
      id: uuidv4(),
      employee_id: employees[0].id,
      merchant_id: merchants[1].id,
      receipt_no: 'INV202605050005',
      amount: 35,
      consumption_date: '2026-05-05',
      upload_date: '2026-05-05',
      status: 'approved',
      is_duplicate: 0
    },
    {
      id: uuidv4(),
      employee_id: employees[0].id,
      merchant_id: merchants[2].id,
      receipt_no: 'INV202605060006',
      amount: 78,
      consumption_date: '2026-05-06',
      upload_date: '2026-05-06',
      status: 'settled',
      is_duplicate: 0
    },
  ];

  receipts.forEach((r, index) => {
    insertReceipt.run(
      r.id, r.employee_id, r.merchant_id, r.receipt_no, r.amount,
      r.consumption_date, r.upload_date, r.status, r.is_duplicate, now, now
    );

    if (r.status !== 'pending') {
      insertStatusLog.run(
        uuidv4(), r.id, 'pending', r.status, '管理员', 
        r.notes || '自动审核通过', now
      );
    }
  });

  const insertDuplicateGroup = db.prepare(`
    INSERT OR IGNORE INTO duplicate_groups (id, receipt_no, merchant_id, count, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertDuplicateGroup.run(duplicateGroupId, 'INV202605010001', merchants[0].id, 2, now);

  const insertAppeal = db.prepare(`
    INSERT OR IGNORE INTO appeals (
      id, receipt_id, appellant, appeal_type, reason, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAppeal.run(
    uuidv4(), receipts[4].id, '王五', 'reject', '该小票是团建费用，应由公司全额承担', 'pending', now, now
  );

  console.log('种子数据插入完成！');
  console.log(`员工数量: ${employees.length}`);
  console.log(`商户数量: ${merchants.length}`);
  console.log(`小票数量: ${receipts.length}`);
}

seedData();
