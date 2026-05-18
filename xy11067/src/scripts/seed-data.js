const db = require('../database');

const children = [
  { child_id: 'C20240001', name: '张小明', gender: '男', birth_date: '2021-03-15', class_name: '向日葵班', guardian_name: '张三', guardian_phone: '13800138001', address: '北京市朝阳区某某小区1号楼101', allergies: '花生过敏', special_conditions: '无', admission_date: '2023-09-01', status: '在园' },
  { child_id: 'C20240002', name: '张小美', gender: '女', birth_date: '2022-07-20', class_name: '向日葵班', guardian_name: '张三', guardian_phone: '13800138001', address: '北京市朝阳区某某小区1号楼101', allergies: '无', special_conditions: '无', admission_date: '2023-09-01', status: '在园' },
  { child_id: 'C20240003', name: '李小华', gender: '男', birth_date: '2021-11-08', class_name: '小树苗班', guardian_name: '李四', guardian_phone: '13800138002', address: '北京市海淀区某某小区2号楼202', allergies: '牛奶过敏', special_conditions: '哮喘', admission_date: '2023-09-01', status: '在园' },
  { child_id: 'C20240004', name: '王小芳', gender: '女', birth_date: '2022-01-25', class_name: '小树苗班', guardian_name: '王五', guardian_phone: '13800138003', address: '北京市西城区某某小区3号楼303', allergies: '无', special_conditions: '无', admission_date: '2023-09-01', status: '在园' },
  { child_id: 'C20240005', name: '赵小龙', gender: '男', birth_date: '2021-05-12', class_name: '向日葵班', guardian_name: '赵六', guardian_phone: '13800138004', address: '北京市东城区某某小区4号楼404', allergies: '无', special_conditions: '无', admission_date: '2023-09-01', status: '在园' }
];

const siblingRelations = [
  { child_id1: 'C20240001', child_id2: 'C20240002', relation_type: '兄弟姐妹', is_living_together: 1 }
];

const healthCheckRecords = [
  { check_id: 'HC20240518001', child_id: 'C20240001', check_date: '2024-05-18', check_time: '07:50:00', checker_name: '王医生', body_temperature: 36.5, has_fever: 0, cough: 0, runny_nose: 0, sore_throat: 0, diarrhea: 0, vomiting: 0, rash: 0, conjunctivitis: 0, hand_foot_mouth: 0, spirit_status: '良好', appetite_status: '良好', sleep_status: '良好', is_allowed_entry: 1, check_result: '正常', remarks: '无异常', guardian_notified: 0 },
  { check_id: 'HC20240518002', child_id: 'C20240002', check_date: '2024-05-18', check_time: '07:52:00', checker_name: '王医生', body_temperature: 36.8, has_fever: 0, cough: 0, runny_nose: 0, sore_throat: 0, diarrhea: 0, vomiting: 0, rash: 0, conjunctivitis: 0, hand_foot_mouth: 0, spirit_status: '良好', appetite_status: '良好', sleep_status: '良好', is_allowed_entry: 1, check_result: '正常', remarks: '无异常', guardian_notified: 0 },
  { check_id: 'HC20240518003', child_id: 'C20240003', check_date: '2024-05-18', check_time: '07:55:00', checker_name: '王医生', body_temperature: 37.8, has_fever: 1, cough: 1, runny_nose: 1, sore_throat: 0, diarrhea: 0, vomiting: 0, rash: 0, conjunctivitis: 0, hand_foot_mouth: 0, spirit_status: '一般', appetite_status: '较差', sleep_status: '较差', is_allowed_entry: 0, check_result: '隔离', remarks: '发热伴咳嗽，建议隔离观察', guardian_notified: 1, notification_time: '2024-05-18 08:00:00' },
  { check_id: 'HC20240518004', child_id: 'C20240004', check_date: '2024-05-18', check_time: '07:58:00', checker_name: '王医生', body_temperature: 36.7, has_fever: 0, cough: 0, runny_nose: 0, sore_throat: 0, diarrhea: 0, vomiting: 0, rash: 0, conjunctivitis: 0, hand_foot_mouth: 0, spirit_status: '良好', appetite_status: '良好', sleep_status: '良好', is_allowed_entry: 1, check_result: '正常', remarks: '无异常', guardian_notified: 0 },
  { check_id: 'HC20240518005', child_id: 'C20240005', check_date: '2024-05-18', check_time: '08:02:00', checker_name: '王医生', body_temperature: 36.6, has_fever: 0, cough: 0, runny_nose: 0, sore_throat: 0, diarrhea: 0, vomiting: 0, rash: 0, conjunctivitis: 0, hand_foot_mouth: 0, spirit_status: '良好', appetite_status: '良好', sleep_status: '良好', is_allowed_entry: 1, check_result: '正常', remarks: '无异常', guardian_notified: 0 }
];

const isolationRecords = [
  { isolation_id: 'ISO20240518001', child_id: 'C20240003', check_id: 'HC20240518003', start_date: '2024-05-18', start_time: '08:10:00', isolation_reason: '发热伴咳嗽，疑似上呼吸道感染', isolation_type: '临时观察', isolation_location: '保健室隔离间', symptoms: '体温37.8℃，咳嗽，流涕', diagnosis: '上呼吸道感染', body_temperature: 37.8, has_close_contact: 0, guardian_notified: 1, notification_method: '电话', notification_time: '2024-05-18 08:15:00', checker_name: '王医生', remarks: '已通知家长接回就医', is_ended: 0 }
];

const contactHistory = [
  { child_id: 'C20240003', contact_child_id: 'C20240001', contact_date: '2024-05-17', contact_duration: 120, contact_location: '教室', is_close_contact: 1, remarks: '同组活动' },
  { child_id: 'C20240003', contact_child_id: 'C20240002', contact_date: '2024-05-17', contact_duration: 120, contact_location: '教室', is_close_contact: 1, remarks: '同组活动' }
];

db.serialize(() => {
  const stmtChild = db.prepare('INSERT INTO children VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
  children.forEach(child => {
    stmtChild.run(child.child_id, child.name, child.gender, child.birth_date, child.class_name, child.guardian_name, child.guardian_phone, child.address, child.allergies, child.special_conditions, child.admission_date, child.status);
  });
  stmtChild.finalize();

  const stmtSibling = db.prepare('INSERT INTO sibling_relations (child_id1, child_id2, relation_type, is_living_together) VALUES (?, ?, ?, ?)');
  siblingRelations.forEach(rel => {
    stmtSibling.run(rel.child_id1, rel.child_id2, rel.relation_type, rel.is_living_together);
  });
  stmtSibling.finalize();

  const stmtCheck = db.prepare('INSERT INTO health_check_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
      healthCheckRecords.forEach(record => {
        stmtCheck.run(
          record.check_id, record.child_id, record.check_date, record.check_time, record.checker_name,
          record.body_temperature, record.has_fever, record.cough, record.runny_nose, record.sore_throat,
          record.diarrhea, record.vomiting, record.rash, record.conjunctivitis, record.hand_foot_mouth,
          record.other_symptoms || null, record.spirit_status, record.appetite_status, record.sleep_status,
          record.medication_name || null, record.medication_dosage || null, record.medication_time || null,
          record.is_allowed_entry, record.check_result, record.remarks || null, record.guardian_notified, record.notification_time || null
        );
      });
  stmtCheck.finalize();

  const stmtIso = db.prepare(`
    INSERT INTO isolation_records (
      isolation_id, child_id, check_id, start_date, start_time,
      end_date, end_time, isolation_reason, isolation_type, isolation_location,
      symptoms, diagnosis, hospital_name, doctor_name, body_temperature,
      has_close_contact, close_contact_details, guardian_notified, notification_method,
      notification_time, guardian_signature, is_ended, end_reason, checker_name, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  isolationRecords.forEach(record => {
    stmtIso.run(
      record.isolation_id, record.child_id, record.check_id, record.start_date, record.start_time,
      record.end_date || null, record.end_time || null, record.isolation_reason, record.isolation_type, record.isolation_location || null,
      record.symptoms || null, record.diagnosis || null, record.hospital_name || null, record.doctor_name || null, record.body_temperature || null,
      record.has_close_contact || 0, record.close_contact_details || null, record.guardian_notified || 0, record.notification_method || null,
      record.notification_time || null, record.guardian_signature || null, record.is_ended || 0, record.end_reason || null, record.checker_name, record.remarks || null
    );
  });
  stmtIso.finalize();

  const stmtContact = db.prepare('INSERT INTO contact_history (child_id, contact_child_id, contact_date, contact_duration, contact_location, is_close_contact, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)');
  contactHistory.forEach(record => {
    stmtContact.run(record.child_id, record.contact_child_id, record.contact_date, record.contact_duration, record.contact_location, record.is_close_contact, record.remarks);
  });
  stmtContact.finalize();

  console.log('样例数据插入完成');
});

db.close();
