const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { db } = require('./database');

const initData = () => {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  // 药箱位置
  const boxes = [
    { id: uuidv4(), location_name: '社区服务中心', address: 'XX街道1号', manager: '张三', phone: '13800138001', status: 'active' },
    { id: uuidv4(), location_name: '小区北门岗亭', address: 'XX小区北门', manager: '李四', phone: '13800138002', status: 'active' },
    { id: uuidv4(), location_name: '老年活动中心', address: 'XX路56号', manager: '王五', phone: '13800138003', status: 'active' }
  ];

  const stmtBox = db.prepare(`INSERT INTO medicine_boxes (id, location_name, address, manager, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  boxes.forEach(box => stmtBox.run(box.id, box.location_name, box.address, box.manager, box.phone, box.status, now, now));

  // 药品批次 - 包含不同效期的药品
  const batches = [
    { id: uuidv4(), box_id: boxes[0].id, medicine_name: '感冒灵颗粒', batch_number: 'B2024001', quantity: 50, unit: '盒', production_date: '2024-01-15', expiry_date: '2026-01-14', supplier: '医药公司A', status: 'normal' },
    { id: uuidv4(), box_id: boxes[0].id, medicine_name: '碘伏消毒液', batch_number: 'B2024002', quantity: 30, unit: '瓶', production_date: '2024-03-20', expiry_date: '2026-06-15', supplier: '医药公司B', status: 'normal' },
    { id: uuidv4(), box_id: boxes[1].id, medicine_name: '创可贴', batch_number: 'B2024003', quantity: 100, unit: '片', production_date: '2024-05-10', expiry_date: moment().add(20, 'days').format('YYYY-MM-DD'), supplier: '医药公司C', status: 'normal' },
    { id: uuidv4(), box_id: boxes[1].id, medicine_name: '布洛芬缓释胶囊', batch_number: 'B2024004', quantity: 40, unit: '盒', production_date: '2023-06-01', expiry_date: moment().add(5, 'days').format('YYYY-MM-DD'), supplier: '医药公司D', status: 'normal' },
    { id: uuidv4(), box_id: boxes[2].id, medicine_name: '体温计', batch_number: 'B2024005', quantity: 20, unit: '支', production_date: '2024-02-28', expiry_date: '2029-02-27', supplier: '医疗器械公司', status: 'normal' },
    { id: uuidv4(), box_id: boxes[2].id, medicine_name: '过期药品样例', batch_number: 'B2023001', quantity: 5, unit: '盒', production_date: '2023-01-01', expiry_date: moment().subtract(10, 'days').format('YYYY-MM-DD'), supplier: '医药公司E', status: 'normal' }
  ];

  const stmtBatch = db.prepare(`INSERT INTO medicine_batches (id, box_id, medicine_name, batch_number, quantity, unit, production_date, expiry_date, supplier, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  batches.forEach(batch => stmtBatch.run(batch.id, batch.box_id, batch.medicine_name, batch.batch_number, batch.quantity, batch.unit, batch.production_date, batch.expiry_date, batch.supplier, batch.status, now, now));

  // 居民信息
  const residents = [
    { id: uuidv4(), name: '赵小明', id_card: '310101199001011234', phone: '13900139001', address: 'XX小区1号楼101室' },
    { id: uuidv4(), name: '钱阿姨', id_card: '310101196505055678', phone: '13900139002', address: 'XX小区2号楼302室' },
    { id: uuidv4(), name: '孙大爷', id_card: '310101195808089012', phone: '13900139003', address: 'XX小区3号楼501室' }
  ];

  const stmtResident = db.prepare(`INSERT INTO residents (id, name, id_card, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
  residents.forEach(r => stmtResident.run(r.id, r.name, r.id_card, r.phone, r.address, now));

  // 借用记录 - 包含正常和待复核的
  const borrows = [
    { id: uuidv4(), resident_id: residents[0].id, batch_id: batches[0].id, box_id: boxes[0].id, quantity: 2, borrow_reason: '感冒发烧', borrow_date: moment().subtract(3, 'days').format('YYYY-MM-DD'), expected_return_date: moment().add(4, 'days').format('YYYY-MM-DD'), status: 'borrowed', operator: '张三' },
    { id: uuidv4(), resident_id: residents[1].id, batch_id: batches[2].id, box_id: boxes[1].id, quantity: 10, borrow_reason: '手擦伤', borrow_date: moment().subtract(1, 'days').format('YYYY-MM-DD'), expected_return_date: moment().add(6, 'days').format('YYYY-MM-DD'), status: 'pending_review', operator: '李四' },
    { id: uuidv4(), resident_id: residents[2].id, batch_id: batches[1].id, box_id: boxes[0].id, quantity: 1, borrow_reason: '伤口消毒', borrow_date: moment().subtract(7, 'days').format('YYYY-MM-DD'), expected_return_date: moment().subtract(1, 'days').format('YYYY-MM-DD'), status: 'returned', operator: '张三', actual_return_date: moment().subtract(2, 'days').format('YYYY-MM-DD') }
  ];

  const stmtBorrow = db.prepare(`INSERT INTO borrow_records (id, resident_id, batch_id, box_id, quantity, borrow_reason, borrow_date, expected_return_date, actual_return_date, status, operator, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  borrows.forEach(b => stmtBorrow.run(b.id, b.resident_id, b.batch_id, b.box_id, b.quantity, b.borrow_reason, b.borrow_date, b.expected_return_date, b.actual_return_date || null, b.status, b.operator, now, now));

  // 归还验收记录
  const returns = [
    { id: uuidv4(), borrow_id: borrows[2].id, inspection_date: moment().subtract(2, 'days').format('YYYY-MM-DD'), inspector: '张三', quantity_actual: 1, condition: '完好', remarks: '包装完好，未开封', status: 'completed' }
  ];

  const stmtReturn = db.prepare(`INSERT INTO return_inspections (id, borrow_id, inspection_date, inspector, quantity_actual, condition, remarks, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  returns.forEach(r => stmtReturn.run(r.id, r.borrow_id, r.inspection_date, r.inspector, r.quantity_actual, r.condition, r.remarks, r.status, now));

  // 补给计划
  const supplies = [
    { id: uuidv4(), box_id: boxes[0].id, medicine_name: '感冒灵颗粒', planned_quantity: 100, unit: '盒', planned_date: moment().add(7, 'days').format('YYYY-MM-DD'), supplier: '医药公司A', responsible_person: '张三', status: 'pending' },
    { id: uuidv4(), box_id: boxes[1].id, medicine_name: '创可贴', planned_quantity: 200, unit: '片', planned_date: moment().add(3, 'days').format('YYYY-MM-DD'), actual_date: moment().add(3, 'days').format('YYYY-MM-DD'), supplier: '医药公司C', responsible_person: '李四', status: 'completed' }
  ];

  const stmtSupply = db.prepare(`INSERT INTO supply_plans (id, box_id, medicine_name, planned_quantity, unit, planned_date, actual_date, supplier, status, responsible_person, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  supplies.forEach(s => stmtSupply.run(s.id, s.box_id, s.medicine_name, s.planned_quantity, s.unit, s.planned_date, s.actual_date || null, s.supplier, s.status, s.responsible_person, null, now, now));

  console.log('样例数据初始化完成！');
};

initData();
