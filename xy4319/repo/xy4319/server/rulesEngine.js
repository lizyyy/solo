const { differenceInMinutes, parseISO } = require('date-fns');
const { getQuery, allQuery, runQuery, uuidv4 } = require('./database');

// 分诊级别配置
const TRIAGE_LEVELS = {
  red: { 
    label: '红区（紧急）', 
    color: '#ef4444',
    waitThreshold: 5,  // 5分钟超时
    priorityWeight: 100
  },
  yellow: { 
    label: '黄区（紧急）', 
    color: '#eab308',
    waitThreshold: 30,  // 30分钟超时
    priorityWeight: 50
  },
  green: { 
    label: '绿区（非紧急）', 
    color: '#22c55e',
    waitThreshold: 120,  // 120分钟超时
    priorityWeight: 10
  }
};

// 计算患者等待时间
function calculateWaitTime(arrivalTime, currentTime = new Date()) {
  const arrival = parseISO(arrivalTime);
  return differenceInMinutes(currentTime, arrival);
}

// 检查等待超时
function checkWaitTimeout(patient, currentTime = new Date()) {
  const waitTime = calculateWaitTime(patient.arrivalTime, currentTime);
  const threshold = TRIAGE_LEVELS[patient.triageLevel]?.waitThreshold || 60;
  
  return {
    isTimeout: waitTime > threshold,
    waitTime,
    threshold,
    excessMinutes: waitTime - threshold
  };
}

// 计算转运优先级
function calculateTransferPriority(patient, currentTime = new Date()) {
  let priority = 0;
  
  // 基础优先级（基于分诊级别）
  priority += TRIAGE_LEVELS[patient.triageLevel]?.priorityWeight || 10;
  
  // 等待时间加成
  const waitTime = calculateWaitTime(patient.arrivalTime, currentTime);
  const threshold = TRIAGE_LEVELS[patient.triageLevel]?.waitThreshold || 60;
  
  if (waitTime > threshold) {
    priority += Math.min((waitTime - threshold) * 2, 100);
  }
  
  // 特殊病情加成
  if (patient.chiefComplaint) {
    const criticalKeywords = ['胸痛', '呼吸困难', '意识障碍', '大出血', '心跳骤停', '卒中', '过敏反应'];
    for (const keyword of criticalKeywords) {
      if (patient.chiefComplaint.includes(keyword)) {
        priority += 50;
        break;
      }
    }
  }
  
  return priority;
}

// 检查科室容量
async function checkDepartmentCapacity(departmentId) {
  const department = await getQuery(
    'SELECT * FROM departments WHERE id = ?',
    [departmentId]
  );
  
  if (!department) {
    return { available: false, reason: '科室不存在' };
  }
  
  const capacityRatio = department.availableBeds / department.totalBeds;
  
  return {
    available: department.availableBeds > 0,
    totalBeds: department.totalBeds,
    availableBeds: department.availableBeds,
    capacityRatio,
    isOverCapacity: capacityRatio < 0.2,
    isCritical: capacityRatio < 0.1
  };
}

// 检查床位冲突
async function checkBedConflict(bedId, patientId = null) {
  const bed = await getQuery(
    'SELECT * FROM beds WHERE id = ?',
    [bedId]
  );
  
  if (!bed) {
    return { conflict: true, reason: '床位不存在' };
  }
  
  if (bed.status === 'occupied' && bed.patientId && bed.patientId !== patientId) {
    return { 
      conflict: true, 
      reason: '床位已被占用',
      occupiedBy: bed.patientId
    };
  }
  
  return {
    conflict: false,
    bed: bed
  };
}

// 检查所有超时患者
async function checkAllTimeouts(currentTime = new Date()) {
  const patients = await allQuery(
    "SELECT * FROM patients WHERE status IN ('waiting', 'triage')"
  );
  
  const timeouts = [];
  
  for (const patient of patients) {
    const result = checkWaitTimeout(patient, currentTime);
    if (result.isTimeout) {
      timeouts.push({
        patientId: patient.id,
        patientName: patient.name,
        triageLevel: patient.triageLevel,
        ...result
      });
    }
  }
  
  return timeouts;
}

// 检查床位释放同步
async function checkBedReleaseSync() {
  const discrepancies = [];
  
  // 获取所有已分配床位但状态不对的患者
  const patientsWithBed = await allQuery(`
    SELECT p.id as patientId, p.name, p.bedId, p.status, b.status as bedStatus, b.patientId as bedPatientId
    FROM patients p
    LEFT JOIN beds b ON p.bedId = b.id
    WHERE p.bedId IS NOT NULL
  `);
  
  for (const record of patientsWithBed) {
    if (record.status === 'discharged' || record.status === 'transferred') {
      if (record.bedStatus === 'occupied' && record.bedPatientId === record.patientId) {
        discrepancies.push({
          type: 'bed_not_released',
          patientId: record.patientId,
          patientName: record.name,
          bedId: record.bedId,
          message: `患者已${record.status === 'discharged' ? '出院' : '转运'}，但床位未释放`
        });
      }
    }
  }
  
  // 获取所有被占用但没有对应患者的床位
  const occupiedBeds = await allQuery(`
    SELECT b.id as bedId, b.bedNumber, b.patientId, b.status, p.status as patientStatus
    FROM beds b
    LEFT JOIN patients p ON b.patientId = p.id
    WHERE b.status = 'occupied'
  `);
  
  for (const bed of occupiedBeds) {
    if (!bed.patientStatus || bed.patientStatus === 'discharged' || bed.patientStatus === 'transferred') {
      discrepancies.push({
        type: 'bed_occupied_no_patient',
        bedId: bed.bedId,
        bedNumber: bed.bedNumber,
        patientId: bed.patientId,
        message: '床位显示被占用，但对应患者不存在或已出院/转运'
      });
    }
  }
  
  return discrepancies;
}

// 检查转运队列漏看
async function checkTransferQueueMissed() {
  const missed = [];
  
  const pendingTransfers = await allQuery(`
    SELECT tq.*, p.name as patientName, p.triageLevel, p.arrivalTime
    FROM transfer_queue tq
    JOIN patients p ON tq.patientId = p.id
    WHERE tq.status = 'pending'
    ORDER BY tq.queuePosition ASC
  `);
  
  const currentTime = new Date();
  
  for (const transfer of pendingTransfers) {
    const waitTime = calculateWaitTime(transfer.assignedAt, currentTime);
    const threshold = TRIAGE_LEVELS[transfer.triageLevel]?.waitThreshold || 60;
    
    if (waitTime > threshold) {
      missed.push({
        transferId: transfer.id,
        patientId: transfer.patientId,
        patientName: transfer.patientName,
        triageLevel: transfer.triageLevel,
        queuePosition: transfer.queuePosition,
        waitTime,
        threshold,
        priority: transfer.priority,
        message: `转运请求已等待 ${waitTime} 分钟，超过阈值 ${threshold} 分钟`
      });
    }
  }
  
  return missed;
}

// 检查分诊级别错误
async function checkTriageErrors(patient, suggestedLevel) {
  const errors = [];
  
  // 基于主诉的分诊级别建议
  const chiefComplaint = patient.chiefComplaint || '';
  
  // 红区指征
  const redIndications = [
    '心跳骤停', '呼吸骤停', '严重呼吸困难', '意识丧失', '休克',
    '严重创伤大出血', '急性心肌梗死', '脑卒中发作', '严重过敏反应'
  ];
  
  // 黄区指征
  const yellowIndications = [
    '胸痛', '呼吸困难', '意识障碍', '严重腹痛', '高热',
    '急性创伤', '中毒', '癫痫发作'
  ];
  
  let suggestedTriage = 'green';
  
  for (const indication of redIndications) {
    if (chiefComplaint.includes(indication)) {
      suggestedTriage = 'red';
      break;
    }
  }
  
  if (suggestedTriage === 'green') {
    for (const indication of yellowIndications) {
      if (chiefComplaint.includes(indication)) {
        suggestedTriage = 'yellow';
        break;
      }
    }
  }
  
  // 检查是否分诊过低
  const levelPriority = { red: 3, yellow: 2, green: 1 };
  const actualPriority = levelPriority[patient.triageLevel] || 0;
  const suggestedPriority = levelPriority[suggestedTriage] || 0;
  
  if (actualPriority < suggestedPriority) {
    errors.push({
      type: 'triage_underestimated',
      patientId: patient.id,
      patientName: patient.name,
      actualLevel: patient.triageLevel,
      suggestedLevel: suggestedTriage,
      chiefComplaint: patient.chiefComplaint,
      message: `患者主诉"${patient.chiefComplaint}"建议分诊为${TRIAGE_LEVELS[suggestedTriage].label}，但当前为${TRIAGE_LEVELS[patient.triageLevel].label}`
    });
  }
  
  return errors;
}

// 运行所有规则检查
async function runAllRulesCheck(currentTime = new Date()) {
  const results = {
    timeouts: await checkAllTimeouts(currentTime),
    bedDiscrepancies: await checkBedReleaseSync(),
    missedTransfers: await checkTransferQueueMissed(),
    timestamp: currentTime.toISOString()
  };
  
  return results;
}

module.exports = {
  TRIAGE_LEVELS,
  calculateWaitTime,
  checkWaitTimeout,
  calculateTransferPriority,
  checkDepartmentCapacity,
  checkBedConflict,
  checkAllTimeouts,
  checkBedReleaseSync,
  checkTransferQueueMissed,
  checkTriageErrors,
  runAllRulesCheck
};
