const parseDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const dt = new Date(`${dateStr} ${timeStr}`);
  return isNaN(dt.getTime()) ? null : dt;
};

const formatTime = (date) => {
  if (!date) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

export const detectIssues = (cases, vitals, medications, rules) => {
  const issues = [];
  
  if (!cases || cases.length === 0) return issues;
  
  cases.forEach((caseItem) => {
    const caseId = caseItem.id || caseItem.caseId;
    const caseVitals = vitals.filter(v => v.caseId === caseId);
    const caseMeds = medications.filter(m => m.caseId === caseId);
    
    detectVitalGaps(caseVitals, caseId, rules, issues);
    detectDosageOverrides(caseMeds, caseId, rules, issues);
    detectDuplicateScans(caseMeds, caseId, issues);
    detectMidnightAssignmentIssues(caseItem, caseVitals, caseId, issues);
  });
  
  return issues;
};

const detectVitalGaps = (vitals, caseId, rules, issues) => {
  if (vitals.length < 2) return;
  
  const gapThreshold = (rules?.vitals?.gapThresholdMinutes) || 5;
  
  const sorted = vitals
    .filter(v => v.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].timestamp);
    const curr = new Date(sorted[i].timestamp);
    const diffMinutes = (curr - prev) / (1000 * 60);
    
    if (diffMinutes > gapThreshold) {
      issues.push({
        id: `gap-${caseId}-${i}`,
        caseId,
        type: 'vital_gap',
        severity: 'warning',
        title: '体征数据断采',
        description: `从 ${formatTime(prev)} 到 ${formatTime(curr)} 之间有 ${Math.round(diffMinutes)} 分钟的数据断采`,
        startTime: prev.toISOString(),
        endTime: curr.toISOString(),
        details: {
          gapMinutes: Math.round(diffMinutes),
          threshold: gapThreshold
        }
      });
    }
  }
};

const detectDosageOverrides = (medications, caseId, rules, issues) => {
  if (!rules?.medications?.dosageLimits) return;
  
  medications.forEach((med, index) => {
    const drugName = med.drugName || med.name;
    const dosage = parseFloat(med.dosage);
    const weight = parseFloat(med.weight) || 1;
    
    if (!drugName || isNaN(dosage)) return;
    
    const limits = rules.medications.dosageLimits[drugName];
    if (!limits) return;
    
    const dosagePerKg = dosage / weight;
    
    if (limits.maxDosePerKg && dosagePerKg > limits.maxDosePerKg) {
      issues.push({
        id: `dosage-${caseId}-${index}`,
        caseId,
        type: 'dosage_override',
        severity: 'error',
        title: '用药剂量超限',
        description: `${drugName} 剂量 ${dosage}mg (${dosagePerKg.toFixed(2)}mg/kg) 超过上限 ${limits.maxDosePerKg}mg/kg`,
        time: med.timestamp || med.adminTime,
        details: {
          drugName,
          dosage,
          dosagePerKg: dosagePerKg.toFixed(2),
          maxLimit: limits.maxDosePerKg
        }
      });
    }
    
    if (limits.minDosePerKg && dosagePerKg < limits.minDosePerKg) {
      issues.push({
        id: `dosage-low-${caseId}-${index}`,
        caseId,
        type: 'dosage_under',
        severity: 'warning',
        title: '用药剂量不足',
        description: `${drugName} 剂量 ${dosage}mg (${dosagePerKg.toFixed(2)}mg/kg) 低于下限 ${limits.minDosePerKg}mg/kg`,
        time: med.timestamp || med.adminTime,
        details: {
          drugName,
          dosage,
          dosagePerKg: dosagePerKg.toFixed(2),
          minLimit: limits.minDosePerKg
        }
      });
    }
  });
};

const detectDuplicateScans = (medications, caseId, issues) => {
  const timeThreshold = 60;
  
  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const med1 = medications[i];
      const med2 = medications[j];
      
      if (med1.drugName !== med2.drugName) continue;
      
      const time1 = med1.timestamp || med1.adminTime;
      const time2 = med2.timestamp || med2.adminTime;
      
      if (!time1 || !time2) continue;
      
      const diffSeconds = Math.abs(new Date(time1) - new Date(time2)) / 1000;
      
      if (diffSeconds < timeThreshold) {
        issues.push({
          id: `duplicate-${caseId}-${i}-${j}`,
          caseId,
          type: 'duplicate_scan',
          severity: 'warning',
          title: '重复用药扫描',
          description: `${med1.drugName} 在 ${formatTime(new Date(time1))} 和 ${formatTime(new Date(time2))} 有两次重复扫描 (间隔 ${Math.round(diffSeconds)} 秒)`,
          time: time1,
          details: {
            drugName: med1.drugName,
            time1,
            time2,
            gapSeconds: Math.round(diffSeconds)
          }
        });
      }
    }
  }
};

const detectMidnightAssignmentIssues = (caseItem, vitals, caseId, issues) => {
  const surgeryDate = caseItem.surgeryDate || caseItem.date;
  if (!surgeryDate) return;
  
  const caseStart = parseDateTime(surgeryDate, caseItem.startTime || '00:00');
  const caseEnd = parseDateTime(surgeryDate, caseItem.endTime || '23:59');
  
  vitals.forEach((vital, index) => {
    const vitalTime = new Date(vital.timestamp);
    if (isNaN(vitalTime.getTime())) return;
    
    const isNextDay = vitalTime.getDate() !== new Date(surgeryDate).getDate();
    
    if (isNextDay) {
      const diffHours = (vitalTime - caseEnd) / (1000 * 60 * 60);
      
      if (diffHours > 0 && diffHours < 24) {
        issues.push({
          id: `midnight-${caseId}-${index}`,
          caseId,
          type: 'midnight_assignment',
          severity: 'info',
          title: '跨午夜数据归属检查',
          description: `体征数据时间 ${vitalTime.toLocaleString('zh-CN')} 跨越午夜，请确认数据归属是否正确`,
          time: vital.timestamp,
          details: {
            surgeryDate,
            vitalTime: vital.timestamp,
            hoursAfterCaseEnd: Math.round(diffHours * 10) / 10
          }
        });
      }
    }
  });
};

export const analyzeCase = (caseItem, vitals, medications, rules, issues) => {
  const result = {
    totalVitals: vitals.length,
    totalMedications: medications.length,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    anesthesiaDuration: null,
    recoveryStatus: 'unknown',
    timeline: []
  };
  
  issues.forEach(issue => {
    if (issue.severity === 'error') result.errorCount++;
    else if (issue.severity === 'warning') result.warningCount++;
    else if (issue.severity === 'info') result.infoCount++;
  });
  
  const startTime = caseItem.startTime || caseItem.anesthesiaStart;
  const endTime = caseItem.endTime || caseItem.anesthesiaEnd;
  const surgeryDate = caseItem.surgeryDate || caseItem.date;
  
  if (startTime && endTime && surgeryDate) {
    const start = parseDateTime(surgeryDate, startTime);
    const end = parseDateTime(surgeryDate, endTime);
    if (start && end) {
      result.anesthesiaDuration = Math.round((end - start) / (1000 * 60));
    }
  }
  
  const extubationTime = caseItem.extubationTime || caseItem.recoveryTime;
  if (extubationTime) {
    result.recoveryStatus = extubationTime ? 'extubated' : 'unknown';
  }
  
  result.timeline = buildTimeline(vitals, medications, issues, caseItem);
  
  return result;
};

const buildTimeline = (vitals, medications, issues, caseItem) => {
  const timeline = [];
  
  vitals.forEach(vital => {
    if (vital.timestamp) {
      timeline.push({
        type: 'vitals',
        time: new Date(vital.timestamp),
        data: vital
      });
    }
  });
  
  medications.forEach(med => {
    const time = med.timestamp || med.adminTime;
    if (time) {
      timeline.push({
        type: 'medication',
        time: new Date(time),
        data: med
      });
    }
  });
  
  issues.forEach(issue => {
    const time = issue.time || issue.startTime;
    if (time) {
      timeline.push({
        type: 'issue',
        time: new Date(time),
        data: issue
      });
    }
  });
  
  const surgeryDate = caseItem.surgeryDate || caseItem.date;
  const anesthesiaStart = parseDateTime(surgeryDate, caseItem.startTime || caseItem.anesthesiaStart);
  const anesthesiaEnd = parseDateTime(surgeryDate, caseItem.endTime || caseItem.anesthesiaEnd);
  
  if (anesthesiaStart) {
    timeline.push({
      type: 'event',
      time: anesthesiaStart,
      data: { title: '麻醉开始', description: caseItem.procedure || caseItem.surgeryType }
    });
  }
  
  if (anesthesiaEnd) {
    timeline.push({
      type: 'event',
      time: anesthesiaEnd,
      data: { title: '麻醉结束', description: '手术完成' }
    });
  }
  
  return timeline.sort((a, b) => a.time - b.time);
};
