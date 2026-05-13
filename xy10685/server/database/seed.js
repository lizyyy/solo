const db = require('./db');
const { v4: uuidv4 } = require('uuid');

db.serialize(() => {
  const freezer1Id = uuidv4();
  const freezer2Id = uuidv4();

  db.run(`INSERT OR REPLACE INTO freezers (id, name, location, current_temperature, min_temperature, max_temperature, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [freezer1Id, 'A区-01号冷柜', '门诊一楼A区', -20, -25, -15, 'normal']);
  
  db.run(`INSERT OR REPLACE INTO freezers (id, name, location, current_temperature, min_temperature, max_temperature, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [freezer2Id, 'B区-02号冷柜', '门诊二楼B区', -18, -25, -15, 'normal']);

  const vaccine1Id = uuidv4();
  const vaccine2Id = uuidv4();
  const vaccine3Id = uuidv4();

  db.run(`INSERT OR REPLACE INTO vaccines (id, batch_number, name, manufacturer, production_date, expiry_date, total_count, available_count, freezer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [vaccine1Id, 'COV2024001', '新冠疫苗', '国药集团', '2024-01-15', '2025-01-15', 100, 85, freezer1Id, 'normal']);
  
  db.run(`INSERT OR REPLACE INTO vaccines (id, batch_number, name, manufacturer, production_date, expiry_date, total_count, available_count, freezer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [vaccine2Id, 'HEP2024002', '乙肝疫苗', '科兴生物', '2024-02-20', '2026-02-20', 150, 140, freezer1Id, 'normal']);
  
  db.run(`INSERT OR REPLACE INTO vaccines (id, batch_number, name, manufacturer, production_date, expiry_date, total_count, available_count, freezer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [vaccine3Id, 'FLU2024003', '流感疫苗', '华兰生物', '2024-03-10', '2025-03-10', 80, 60, freezer2Id, 'normal']);

  db.run(`INSERT OR REPLACE INTO appointments (id, vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), vaccine1Id, 'COV2024001', '张三', 'P001', '2024-12-01 09:00:00', 1, 'confirmed', '李护士']);
  
  db.run(`INSERT OR REPLACE INTO appointments (id, vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), vaccine2Id, 'HEP2024002', '李四', 'P002', '2024-12-02 14:00:00', 1, 'pending', '王护士']);
  
  db.run(`INSERT OR REPLACE INTO appointments (id, vaccine_id, batch_number, patient_name, patient_id, appointment_date, quantity, status, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), vaccine3Id, 'FLU2024003', '王五', 'P003', '2024-12-03 10:30:00', 1, 'completed', '赵护士']);

  const inv1Id = uuidv4();
  const inv2Id = uuidv4();
  const inv3Id = uuidv4();

  db.run(`INSERT OR REPLACE INTO inventory_records (id, freezer_id, batch_number, expected_count, actual_count, difference, status, operator, reviewer, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inv1Id, freezer1Id, 'COV2024001', 100, 100, 0, 'matched', '陈盘点', '张主管', '盘点正常，账实相符']);
  
  db.run(`INSERT OR REPLACE INTO inventory_records (id, freezer_id, batch_number, expected_count, actual_count, difference, status, operator, reviewer, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inv2Id, freezer1Id, 'HEP2024002', 150, 148, -2, 'discrepancy', '陈盘点', '张主管', '发现2支差异，正在调查原因']);
  
  db.run(`INSERT OR REPLACE INTO inventory_records (id, freezer_id, batch_number, expected_count, actual_count, difference, status, operator, reviewer, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [inv3Id, freezer2Id, 'FLU2024003', 80, 75, -5, 'resolved', '刘盘点', '李主管', '5支已报损，差异已处理']);

  const dmg1Id = uuidv4();
  const dmg2Id = uuidv4();

  db.run(`INSERT OR REPLACE INTO damage_reports (id, batch_number, vaccine_name, quantity, reason, reporter, status, approver, approval_remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [dmg1Id, 'FLU2024003', '流感疫苗', 5, '冷柜温度波动导致失效', '刘盘点', 'approved', '王主任', '情况属实，同意报损']);
  
  db.run(`INSERT OR REPLACE INTO damage_reports (id, batch_number, vaccine_name, quantity, reason, reporter, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [dmg2Id, 'HEP2024002', '乙肝疫苗', 2, '疑似破损', '陈盘点', 'pending']);

  console.log('样例数据生成完成！');
});

db.close();
