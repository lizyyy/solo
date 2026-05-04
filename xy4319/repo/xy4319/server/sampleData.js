const { runQuery, allQuery, uuidv4 } = require('./database');
const { logPatientCreated, logAction } = require('./logger');

const SAMPLE_DEPARTMENTS = [
  { name: '急诊科', totalBeds: 15 },
  { name: '心内科', totalBeds: 20 },
  { name: '神经内科', totalBeds: 18 },
  { name: '呼吸内科', totalBeds: 16 },
  { name: '普外科', totalBeds: 22 },
  { name: '骨科', totalBeds: 20 },
  { name: '神经外科', totalBeds: 12 },
  { name: 'ICU', totalBeds: 8 }
];

const SAMPLE_PATIENTS = [
  {
    name: '张三',
    age: 65,
    gender: '男',
    chiefComplaint: '胸痛2小时，伴大汗',
    triageLevel: 'red',
    status: 'waiting',
    targetDepartment: '心内科',
    notes: '高血压病史10年'
  },
  {
    name: '李四',
    age: 45,
    gender: '女',
    chiefComplaint: '突发右侧肢体无力1小时',
    triageLevel: 'red',
    status: 'triage',
    targetDepartment: '神经内科',
    notes: '房颤病史'
  },
  {
    name: '王五',
    age: 32,
    gender: '男',
    chiefComplaint: '呼吸困难30分钟，有哮喘史',
    triageLevel: 'yellow',
    status: 'waiting',
    targetDepartment: '呼吸内科',
    notes: '规律使用吸入剂'
  },
  {
    name: '赵六',
    age: 58,
    gender: '男',
    chiefComplaint: '腹痛4小时，伴呕吐',
    triageLevel: 'yellow',
    status: 'triage',
    targetDepartment: '普外科',
    notes: '胆结石病史'
  },
  {
    name: '孙七',
    age: 28,
    gender: '女',
    chiefComplaint: '发热3天，伴咳嗽',
    triageLevel: 'green',
    status: 'waiting',
    targetDepartment: '呼吸内科',
    notes: '体温38.5°C'
  },
  {
    name: '周八',
    age: 42,
    gender: '男',
    chiefComplaint: '右踝关节扭伤2小时',
    triageLevel: 'green',
    status: 'waiting',
    targetDepartment: '骨科',
    notes: '肿胀明显，活动受限'
  },
  {
    name: '吴九',
    age: 72,
    gender: '女',
    chiefComplaint: '意识不清半小时',
    triageLevel: 'red',
    status: 'treatment',
    targetDepartment: '神经内科',
    notes: '糖尿病病史，可能低血糖'
  },
  {
    name: '郑十',
    age: 55,
    gender: '男',
    chiefComplaint: '呕血1次，量约200ml',
    triageLevel: 'yellow',
    status: 'triage',
    targetDepartment: '普外科',
    notes: '胃溃疡病史'
  },
  {
    name: '陈明',
    age: 38,
    gender: '男',
    chiefComplaint: '外伤后头痛1小时',
    triageLevel: 'yellow',
    status: 'waiting',
    targetDepartment: '神经外科',
    notes: '车祸外伤，意识清楚'
  },
  {
    name: '林芳',
    age: 25,
    gender: '女',
    chiefComplaint: '皮疹伴瘙痒2天',
    triageLevel: 'green',
    status: 'waiting',
    targetDepartment: '急诊科',
    notes: '无呼吸困难'
  }
];

const SAMPLE_AMBULANCES = [
  { plateNumber: '急救A-123', status: 'idle', location: '救护站' },
  { plateNumber: '急救A-456', status: 'idle', location: '救护站' },
  { plateNumber: '急救B-789', status: 'idle', location: '救护站' }
];

async function createSampleDepartments() {
  const existingDepts = await allQuery('SELECT id FROM departments LIMIT 1');
  
  if (existingDepts.length > 0) {
    console.log('科室数据已存在，跳过创建');
    return false;
  }
  
  for (const dept of SAMPLE_DEPARTMENTS) {
    const deptId = uuidv4();
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO departments (id, name, totalBeds, availableBeds, capacityRatio, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 0.0, 1, ?, ?)
    `, [deptId, dept.name, dept.totalBeds, dept.totalBeds, now, now]);
    
    // 为每个科室创建床位
    for (let i = 1; i <= dept.totalBeds; i++) {
      const bedId = uuidv4();
      const bedNumber = `${dept.name.charAt(0)}-${String(i).padStart(2, '0')}`;
      
      await runQuery(`
        INSERT INTO beds (id, departmentId, bedNumber, status, patientId)
        VALUES (?, ?, ?, 'available', NULL)
      `, [bedId, deptId, bedNumber]);
    }
    
    console.log(`已创建科室: ${dept.name} (${dept.totalBeds} 张床位)`);
  }
  
  return true;
}

async function createSampleAmbulances() {
  const existingAmbulances = await allQuery('SELECT id FROM ambulances LIMIT 1');
  
  if (existingAmbulances.length > 0) {
    console.log('救护车数据已存在，跳过创建');
    return false;
  }
  
  const now = new Date().toISOString();
  
  for (const ambulance of SAMPLE_AMBULANCES) {
    const ambulanceId = uuidv4();
    
    await runQuery(`
      INSERT INTO ambulances (id, plateNumber, status, location, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [ambulanceId, ambulance.plateNumber, ambulance.status, ambulance.location, now, now]);
    
    console.log(`已创建救护车: ${ambulance.plateNumber}`);
  }
  
  return true;
}

async function createSamplePatients() {
  const now = new Date();
  const patients = [];
  
  for (let i = 0; i < SAMPLE_PATIENTS.length; i++) {
    const sample = SAMPLE_PATIENTS[i];
    const patientId = uuidv4();
    
    // 随机分布到院时间（过去30分钟内）
    const arrivalMinutes = Math.floor(Math.random() * 30);
    const arrivalTime = new Date(now.getTime() - arrivalMinutes * 60000).toISOString();
    
    // 分诊时间比到院时间晚1-5分钟
    const triageMinutes = 1 + Math.floor(Math.random() * 5);
    const triageTime = new Date(now.getTime() - (arrivalMinutes - triageMinutes) * 60000).toISOString();
    
    const patient = {
      id: patientId,
      name: sample.name,
      age: sample.age,
      gender: sample.gender,
      chiefComplaint: sample.chiefComplaint,
      triageLevel: sample.triageLevel,
      triageTime: triageTime,
      arrivalTime: arrivalTime,
      status: sample.status,
      targetDepartment: sample.targetDepartment,
      notes: sample.notes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    
    await runQuery(`
      INSERT INTO patients (
        id, name, age, gender, chiefComplaint, triageLevel, triageTime,
        arrivalTime, status, targetDepartment, bedId, ambulanceId, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    `, [
      patient.id, patient.name, patient.age, patient.gender,
      patient.chiefComplaint, patient.triageLevel, patient.triageTime,
      patient.arrivalTime, patient.status, patient.targetDepartment,
      patient.notes, patient.createdAt, patient.updatedAt
    ]);
    
    await logPatientCreated(patient, 'system');
    patients.push(patient);
    
    console.log(`已创建患者: ${patient.name} (${patient.triageLevel})`);
  }
  
  return patients;
}

async function createSampleTransfers(patients) {
  const now = new Date().toISOString();
  
  // 为部分患者创建转运请求
  const transferPatients = patients.slice(0, 3);
  
  for (let i = 0; i < transferPatients.length; i++) {
    const patient = transferPatients[i];
    const transferId = uuidv4();
    
    // 计算优先级
    const priority = patient.triageLevel === 'red' ? 3 : patient.triageLevel === 'yellow' ? 2 : 1;
    
    await runQuery(`
      INSERT INTO transfer_queue (
        id, patientId, priority, queuePosition, status,
        assignedAt, fromDepartment, toDepartment, reason
      ) VALUES (?, ?, ?, ?, 'pending', ?, '急诊科', ?, '需要专科治疗')
    `, [transferId, patient.id, priority, i + 1, now, patient.targetDepartment]);
    
    await logAction(
      'transfer_requested',
      'transfer',
      transferId,
      { patientName: patient.name, priority, toDepartment: patient.targetDepartment },
      'system'
    );
    
    console.log(`已创建转运请求: ${patient.name} -> ${patient.targetDepartment}`);
  }
  
  return true;
}

async function createSampleDrillSession() {
  const existingSessions = await allQuery('SELECT id FROM drill_sessions WHERE status = "active" LIMIT 1');
  
  if (existingSessions.length > 0) {
    console.log('活跃演练会话已存在，跳过创建');
    return false;
  }
  
  const sessionId = uuidv4();
  const now = new Date().toISOString();
  
  await runQuery(`
    INSERT INTO drill_sessions (
      id, name, startTime, status, description,
      totalPatients, criticalIncidents, createdAt, updatedAt
    ) VALUES (?, '示例演练会话', ?, 'active', '用于演示系统功能的示例演练', 0, 0, ?, ?)
  `, [sessionId, now, now, now]);
  
  await logAction(
    'drill_started',
    'session',
    sessionId,
    { name: '示例演练会话' },
    'system'
  );
  
  console.log(`已创建演练会话: 示例演练会话`);
  return true;
}

async function createAllSampleData() {
  console.log('开始创建示例数据...\n');
  
  await createSampleDrillSession();
  await createSampleDepartments();
  await createSampleAmbulances();
  const patients = await createSamplePatients();
  await createSampleTransfers(patients);
  
  console.log('\n示例数据创建完成！');
  
  return {
    patientsCreated: patients.length,
    departmentsCreated: SAMPLE_DEPARTMENTS.length,
    ambulancesCreated: SAMPLE_AMBULANCES.length
  };
}

async function clearAllData() {
  console.log('开始清除所有数据...');
  
  await runQuery('DELETE FROM transfer_queue');
  await runQuery('DELETE FROM incidents');
  await runQuery('DELETE FROM operation_logs');
  await runQuery('DELETE FROM patients');
  await runQuery('DELETE FROM beds');
  await runQuery('DELETE FROM departments');
  await runQuery('DELETE FROM ambulances');
  await runQuery('DELETE FROM drill_sessions');
  
  console.log('所有数据已清除！');
  return true;
}

module.exports = {
  createSampleDepartments,
  createSampleAmbulances,
  createSamplePatients,
  createSampleTransfers,
  createSampleDrillSession,
  createAllSampleData,
  clearAllData,
  SAMPLE_DEPARTMENTS,
  SAMPLE_PATIENTS,
  SAMPLE_AMBULANCES
};
