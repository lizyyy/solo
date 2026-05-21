const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/medicine-inventory.db');
const db = new sqlite3.Database(dbPath);

const seedData = async () => {
  console.log('开始插入测试数据...');

  const sources = [
    { id: uuidv4(), name: 'HIS系统', type: 'HIS', system_code: 'HIS001', sync_url: 'http://his.example.com/api' },
    { id: uuidv4(), name: 'WMS仓库系统', type: 'WMS', system_code: 'WMS001', sync_url: 'http://wms.example.com/api' },
    { id: uuidv4(), name: '配送系统', type: 'DELIVERY', system_code: 'DEL001', sync_url: 'http://delivery.example.com/api' }
  ];

  const medicines = [
    { id: uuidv4(), code: 'MED001', name: '阿莫西林胶囊', specification: '0.25g*24粒', manufacturer: '华北制药', unit: '盒' },
    { id: uuidv4(), code: 'MED002', name: '布洛芬缓释胶囊', specification: '0.3g*20粒', manufacturer: '中美史克', unit: '盒' },
    { id: uuidv4(), code: 'MED003', name: '维生素C片', specification: '100mg*100片', manufacturer: '东北制药', unit: '瓶' },
    { id: uuidv4(), code: 'MED004', name: '复方氨酚烷胺片', specification: '12片', manufacturer: '感康药业', unit: '盒' },
    { id: uuidv4(), code: 'MED005', name: '盐酸二甲双胍片', specification: '0.5g*30片', manufacturer: '中美上海施贵宝', unit: '盒' }
  ];

  const today = new Date();
  const expiryDate1 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15).toISOString().split('T')[0];
  const expiryDate2 = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()).toISOString().split('T')[0];
  const expiryDate3 = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  const batches = [
    { id: uuidv4(), medicine_id: medicines[0].id, batch_no: 'B2024001', production_date: '2024-01-15', expiry_date: expiryDate1, quantity: 500, occupied_quantity: 50, source_id: sources[0].id, warehouse_location: 'A-01-01', status: 'normal' },
    { id: uuidv4(), medicine_id: medicines[1].id, batch_no: 'B2024002', production_date: '2024-02-20', expiry_date: expiryDate2, quantity: 300, occupied_quantity: 20, source_id: sources[1].id, warehouse_location: 'A-01-02', status: 'normal' },
    { id: uuidv4(), medicine_id: medicines[2].id, batch_no: 'B2024003', production_date: '2024-03-10', expiry_date: expiryDate3, quantity: 1000, occupied_quantity: 100, source_id: sources[0].id, warehouse_location: 'B-02-01', status: 'normal' },
    { id: uuidv4(), medicine_id: medicines[3].id, batch_no: 'B2024004', production_date: '2024-01-05', expiry_date: expiryDate1, quantity: 200, occupied_quantity: 0, source_id: sources[2].id, warehouse_location: 'B-02-02', status: 'normal' },
    { id: uuidv4(), medicine_id: medicines[4].id, batch_no: 'B2024005', production_date: '2024-04-01', expiry_date: expiryDate3, quantity: 400, occupied_quantity: 30, source_id: sources[1].id, warehouse_location: 'C-03-01', status: 'normal' }
  ];

  const rules = [
    { id: uuidv4(), name: '默认规则', warning_days: 90, critical_days: 30, is_default: 1 }
  ];

  const occupancies = [
    { id: uuidv4(), batch_id: batches[0].id, quantity: 20, order_no: 'ORD001', department: '门诊药房', operator: '张药师', reason: '门诊发药', status: 'active' },
    { id: uuidv4(), batch_id: batches[0].id, quantity: 30, order_no: 'ORD002', department: '住院药房', operator: '李药师', reason: '住院摆药', status: 'active' },
    { id: uuidv4(), batch_id: batches[1].id, quantity: 10, order_no: 'ORD003', department: '急诊药房', operator: '王药师', reason: '急诊发药', status: 'active' }
  ];

  db.serialize(() => {
    const insertSource = db.prepare('INSERT INTO inventory_sources (id, name, type, system_code, sync_url, is_active) VALUES (?, ?, ?, ?, ?, 1)');
    sources.forEach(s => insertSource.run(s.id, s.name, s.type, s.system_code, s.sync_url));
    insertSource.finalize();

    const insertMedicine = db.prepare('INSERT INTO medicines (id, code, name, specification, manufacturer, unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    medicines.forEach(m => insertMedicine.run(m.id, m.code, m.name, m.specification, m.manufacturer, m.unit));
    insertMedicine.finalize();

    const insertBatch = db.prepare('INSERT INTO inventory_batches (id, medicine_id, batch_no, production_date, expiry_date, quantity, occupied_quantity, source_id, warehouse_location, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
    batches.forEach(b => insertBatch.run(b.id, b.medicine_id, b.batch_no, b.production_date, b.expiry_date, b.quantity, b.occupied_quantity, b.source_id, b.warehouse_location, b.status));
    insertBatch.finalize();

    const insertRule = db.prepare('INSERT INTO expiry_rules (id, name, warning_days, critical_days, is_default, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
    rules.forEach(r => insertRule.run(r.id, r.name, r.warning_days, r.critical_days, r.is_default));
    insertRule.finalize();

    const insertOccupancy = db.prepare('INSERT INTO occupancy_records (id, batch_id, quantity, order_no, department, operator, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)');
    occupancies.forEach(o => insertOccupancy.run(o.id, o.batch_id, o.quantity, o.order_no, o.department, o.operator, o.reason, o.status));
    insertOccupancy.finalize();

    console.log('测试数据插入完成！');
    console.log(`- 来源系统: ${sources.length} 个`);
    console.log(`- 药品: ${medicines.length} 个`);
    console.log(`- 库存批次: ${batches.length} 个`);
    console.log(`- 临期规则: ${rules.length} 个`);
    console.log(`- 占用记录: ${occupancies.length} 条`);
  });

  db.close();
};

seedData().catch(console.error);
