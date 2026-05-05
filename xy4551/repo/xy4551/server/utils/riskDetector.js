const crypto = require('crypto');

function generateRiskId(type, ...keyParts) {
  const key = `${type}-${keyParts.join('-')}`;
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 12);
}

function parseDateTime(dateStr, timeStr = '00:00') {
  if (!dateStr) return null;
  const fullStr = `${dateStr} ${timeStr}`;
  const parsed = Date.parse(fullStr);
  return isNaN(parsed) ? null : new Date(parsed);
}

function formatTime(date) {
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function detectCageConflicts(postOpCages = []) {
  const risks = [];
  const cageMap = new Map();

  postOpCages.forEach((cage, index) => {
    const cageNumber = cage.cageNumber || cage.cage_number || cage.笼位号;
    const patientName = cage.patientName || cage.patient_name || cage.宠物名 || cage.动物名;
    const startTime = cage.startTime || cage.start_time || cage.开始时间;
    const endTime = cage.endTime || cage.end_time || cage.预计离开时间 || cage.结束时间;

    if (!cageNumber) return;

    const cageKey = String(cageNumber);
    const currentInterval = {
      start: startTime ? new Date(startTime) : null,
      end: endTime ? new Date(endTime) : null,
      patient: patientName || `未知宠物 #${index + 1}`,
      record: cage
    };

    if (cageMap.has(cageKey)) {
      const existingIntervals = cageMap.get(cageKey);
      existingIntervals.forEach(existing => {
        if (hasTimeOverlap(currentInterval, existing)) {
          const riskId = generateRiskId('cage_conflict', cageKey, patientName, existing.patient);
          risks.push({
            id: riskId,
            type: 'cage_conflict',
            severity: 'critical',
            title: `笼位冲突: 笼位 ${cageKey}`,
            description: `宠物 "${currentInterval.patient}" 与 "${existing.patient}" 的笼位时间有重叠`,
            details: {
              cageNumber: cageKey,
              patient1: currentInterval.patient,
              patient2: existing.patient,
              time1: `${formatTime(currentInterval.start) || '未知'} - ${formatTime(currentInterval.end) || '未知'}`,
              time2: `${formatTime(existing.start) || '未知'} - ${formatTime(existing.end) || '未知'}`
            },
            affectedRecords: [currentInterval.record, existing.record]
          });
        }
      });
      existingIntervals.push(currentInterval);
    } else {
      cageMap.set(cageKey, [currentInterval]);
    }
  });

  return risks;
}

function hasTimeOverlap(interval1, interval2) {
  if (!interval1.start || !interval2.start) return false;

  const s1 = interval1.start;
  const e1 = interval1.end || new Date(8640000000000000);
  const s2 = interval2.start;
  const e2 = interval2.end || new Date(8640000000000000);

  return s1 < e2 && s2 < e1;
}

function detectOxygenInterruptions(oxygenLogs = []) {
  const risks = [];

  if (oxygenLogs.length === 0) return risks;

  const patientGroups = new Map();
  
  oxygenLogs.forEach((log, index) => {
    const patientId = log.patientId || log.patient_id || log.宠物ID || log.patient;
    const patientName = log.patientName || log.patient_name || log.宠物名 || `宠物 #${index + 1}`;
    const timestamp = log.timestamp || log.time || log.时间;
    const flowRate = log.flowRate || log.flow_rate || log.流量;
    const status = log.status || log.状态;

    const key = patientId || patientName;
    if (!patientGroups.has(key)) {
      patientGroups.set(key, []);
    }
    
    patientGroups.get(key).push({
      ...log,
      patientName,
      timestamp: timestamp ? new Date(timestamp) : null,
      flowRate: parseFloat(flowRate) || 0,
      status,
      index
    });
  });

  patientGroups.forEach((logs, patientKey) => {
    logs.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return a.timestamp - b.timestamp;
    });

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      
      if (log.flowRate === 0 && log.status !== 'completed' && log.status !== '停止') {
        const riskId = generateRiskId('oxygen_zero', patientKey, log.index);
        risks.push({
          id: riskId,
          type: 'oxygen_interruption',
          severity: 'critical',
          title: `吸氧中断: ${log.patientName}`,
          description: `氧气流量为 0，可能已中断供氧`,
          details: {
            patientName: log.patientName,
            time: log.timestamp ? log.timestamp.toLocaleString() : '未知时间',
            flowRate: log.flowRate
          },
          affectedRecords: [log]
        });
      }

      if (i > 0) {
        const prevLog = logs[i - 1];
        if (prevLog.timestamp && log.timestamp) {
          const gapMinutes = (log.timestamp - prevLog.timestamp) / (1000 * 60);
          
          if (gapMinutes > 30 && prevLog.flowRate > 0) {
            const riskId = generateRiskId('oxygen_gap', patientKey, i);
            risks.push({
              id: riskId,
              type: 'oxygen_interruption',
              severity: 'warning',
              title: `吸氧记录间隔过长: ${log.patientName}`,
              description: `前后两次记录间隔 ${Math.round(gapMinutes)} 分钟，超过 30 分钟阈值`,
              details: {
                patientName: log.patientName,
                gapMinutes: Math.round(gapMinutes),
                previousTime: prevLog.timestamp.toLocaleString(),
                currentTime: log.timestamp.toLocaleString()
              },
              affectedRecords: [prevLog, log]
            });
          }
        }
      }
    }
  });

  return risks;
}

function detectRecoveryTimeouts(anesthesiaRecovery = [], surgerySchedule = []) {
  const risks = [];
  const NORMAL_RECOVERY_MINUTES = 120;

  anesthesiaRecovery.forEach((recovery, index) => {
    const patientName = recovery.patientName || recovery.patient_name || recovery.宠物名 || `宠物 #${index + 1}`;
    const surgeryEndTime = recovery.surgeryEndTime || recovery.surgery_end_time || recovery.手术结束时间;
    const extubationTime = recovery.extubationTime || recovery.extubation_time || recovery.拔管时间;
    const fullRecoveryTime = recovery.fullRecoveryTime || recovery.full_recovery_time || recovery.完全苏醒时间;
    const recoveryStatus = recovery.status || recovery.状态 || 'in_progress';

    if (!surgeryEndTime) return;

    const endTime = new Date(surgeryEndTime);
    const now = new Date();
    const referenceTime = fullRecoveryTime ? new Date(fullRecoveryTime) : now;

    const elapsedMinutes = (referenceTime - endTime) / (1000 * 60);

    if (elapsedMinutes > NORMAL_RECOVERY_MINUTES && !fullRecoveryTime && recoveryStatus !== 'completed' && recoveryStatus !== '完成') {
      const riskId = generateRiskId('recovery_timeout', patientName, index);
      risks.push({
        id: riskId,
        type: 'recovery_timeout',
        severity: 'critical',
        title: `苏醒超时: ${patientName}`,
        description: `手术结束后已超过 ${NORMAL_RECOVERY_MINUTES} 分钟仍未完全苏醒`,
        details: {
          patientName,
          surgeryEndTime: endTime.toLocaleString(),
          elapsedMinutes: Math.round(elapsedMinutes),
          thresholdMinutes: NORMAL_RECOVERY_MINUTES,
          hasExtubation: !!extubationTime,
          hasFullRecovery: !!fullRecoveryTime
        },
        affectedRecords: [recovery]
      });
    }

    if (extubationTime && !fullRecoveryTime) {
      const extubTime = new Date(extubationTime);
      const postExtubMinutes = (now - extubTime) / (1000 * 60);
      
      if (postExtubMinutes > 60) {
        const riskId = generateRiskId('post_extub_delay', patientName, index);
        risks.push({
          id: riskId,
          type: 'recovery_timeout',
          severity: 'warning',
          title: `拔管后苏醒延迟: ${patientName}`,
          description: `拔管后已超过 60 分钟仍未完全苏醒`,
          details: {
            patientName,
            extubationTime: extubTime.toLocaleString(),
            postExtubMinutes: Math.round(postExtubMinutes)
          },
          affectedRecords: [recovery]
        });
      }
    }
  });

  return risks;
}

function detectFastingMissedNotes(ownerNotes = [], surgerySchedule = []) {
  const risks = [];

  const fastingKeywords = ['禁食', '禁水', '空腹', '不能吃', '不能喝', '术前禁食'];
  const handoverKeywords = ['交接', '告知', '提醒', '注意', '交代'];

  surgerySchedule.forEach((surgery, index) => {
    const patientName = surgery.patientName || surgery.patient_name || surgery.宠物名 || `宠物 #${index + 1}`;
    const surgeryType = surgery.surgeryType || surgery.surgery_type || surgery.手术类型 || '';
    const notes = surgery.notes || surgery.备注 || '';
    const hasSurgery = !!surgeryType;

    if (!hasSurgery) return;

    const hasFastingInstruction = fastingKeywords.some(keyword => 
      notes.includes(keyword) || surgeryType.includes(keyword)
    );

    if (hasSurgery || hasFastingInstruction) {
      const matchingOwnerNotes = ownerNotes.filter(note => {
        const notePatient = note.patientName || note.patient_name || note.宠物名 || '';
        return notePatient === patientName || patientName.includes(notePatient) || notePatient.includes(patientName);
      });

      const hasHandoverNote = matchingOwnerNotes.some(note => {
        const noteContent = note.notes || note.备注 || note.content || note.内容 || '';
        return handoverKeywords.some(keyword => noteContent.includes(keyword)) ||
               fastingKeywords.some(keyword => noteContent.includes(keyword));
      });

      if (!hasHandoverNote && matchingOwnerNotes.length === 0) {
        const riskId = generateRiskId('fasting_missed', patientName, index);
        risks.push({
          id: riskId,
          type: 'fasting_missed',
          severity: 'warning',
          title: `禁食备注漏交接: ${patientName}`,
          description: `该宠物有手术安排，但未找到主人接送备注中的禁食交接记录`,
          details: {
            patientName,
            surgeryType,
            hasSurgeryNotes: !!notes,
            surgeryNotes: notes.substring(0, 100),
            ownerNotesCount: matchingOwnerNotes.length
          },
          affectedRecords: [surgery, ...matchingOwnerNotes]
        });
      }
    }
  });

  return risks;
}

function detectAllRisks(data) {
  const {
    surgerySchedule = [],
    postOpCages = [],
    oxygenLogs = [],
    anesthesiaRecovery = [],
    ownerNotes = [],
    overrides = {}
  } = data;

  const allRisks = [
    ...detectCageConflicts(postOpCages),
    ...detectOxygenInterruptions(oxygenLogs),
    ...detectRecoveryTimeouts(anesthesiaRecovery, surgerySchedule),
    ...detectFastingMissedNotes(ownerNotes, surgerySchedule)
  ];

  const risksWithOverrideStatus = allRisks.map(risk => {
    const override = overrides[risk.id];
    return {
      ...risk,
      override: override || null,
      effectiveSeverity: override ? (override.status === 'dismissed' ? 'dismissed' : override.status) : risk.severity
    };
  });

  return risksWithOverrideStatus;
}

module.exports = {
  detectAllRisks,
  detectCageConflicts,
  detectOxygenInterruptions,
  detectRecoveryTimeouts,
  detectFastingMissedNotes
};
