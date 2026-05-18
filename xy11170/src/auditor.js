const MINUTES_TOLERANCE = 5;
const GRACE_PERIOD_MINUTES = 15;

function formatDateTime(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateMinutesDiff(start, end) {
  return (end - start) / (1000 * 60);
}

function calculateHoursDiff(start, end) {
  return (end - start) / (1000 * 60 * 60);
}

function checkEarlyEntry(record) {
  const diffMinutes = calculateMinutesDiff(record.actualStartTime, record.scheduledStartTime);
  
  if (diffMinutes > MINUTES_TOLERANCE) {
    return {
      type: 'EARLY_ENTRY',
      severity: 'warning',
      description: '提前入场',
      earlyMinutes: Math.round(diffMinutes),
      scheduledTime: formatDateTime(record.scheduledStartTime),
      actualTime: formatDateTime(record.actualStartTime),
      suggestion: `客户提前${Math.round(diffMinutes)}分钟入场，建议核实是否需追加该时段费用或与客户确认预约时间`
    };
  }
  return null;
}

function checkLateExit(record) {
  const diffMinutes = calculateMinutesDiff(record.scheduledEndTime, record.actualEndTime);
  
  if (diffMinutes > MINUTES_TOLERANCE) {
    return {
      type: 'LATE_EXIT',
      severity: 'warning',
      description: '延迟离场',
      lateMinutes: Math.round(diffMinutes),
      scheduledTime: formatDateTime(record.scheduledEndTime),
      actualTime: formatDateTime(record.actualEndTime),
      suggestion: `客户延迟${Math.round(diffMinutes)}分钟离场，建议核实是否需追加该时段费用`
    };
  }
  return null;
}

function checkCrossDayRehearsal(record) {
  const actualStartDate = formatDate(record.actualStartTime);
  const actualEndDate = formatDate(record.actualEndTime);
  const scheduledDate = formatDate(record.scheduledStartTime);
  
  if (actualStartDate !== actualEndDate) {
    const overnightMinutes = calculateMinutesDiff(
      new Date(record.actualEndTime.getFullYear(), record.actualEndTime.getMonth(), record.actualEndTime.getDate()),
      record.actualEndTime
    );
    
    return {
      type: 'CROSS_DAY_REHEARSAL',
      severity: 'error',
      description: '跨日排练',
      overnightMinutes: Math.round(overnightMinutes),
      startDate: actualStartDate,
      endDate: actualEndDate,
      scheduledDate: scheduledDate,
      suggestion: `排练从${actualStartDate}跨至${actualEndDate}，共${Math.round(overnightMinutes)}分钟。跨日排练可能涉及夜间费率，建议按实际日期分段计费并核实夜间收费标准`
    };
  }
  return null;
}

function calculateExpectedAmount(record) {
  const actualHours = calculateHoursDiff(record.actualStartTime, record.actualEndTime);
  const graceHours = GRACE_PERIOD_MINUTES / 60;
  const billableHours = Math.max(0, actualHours - graceHours);
  
  return Math.ceil(billableHours) * record.hourlyRate;
}

function checkBillingAccuracy(record) {
  const expectedAmount = calculateExpectedAmount(record);
  const diff = record.billedAmount - expectedAmount;
  
  if (Math.abs(diff) > 0.01) {
    const actualHours = calculateHoursDiff(record.actualStartTime, record.actualEndTime);
    
    return {
      type: 'BILLING_INACCURACY',
      severity: 'error',
      description: '计费金额异常',
      actualHours: actualHours.toFixed(2),
      billableHours: Math.ceil(Math.max(0, actualHours - GRACE_PERIOD_MINUTES / 60)),
      expectedAmount: expectedAmount.toFixed(2),
      billedAmount: record.billedAmount.toFixed(2),
      difference: diff.toFixed(2),
      suggestion: diff > 0 
        ? `多收了${diff.toFixed(2)}元，建议核实计费时长或退款给客户`
        : `少收了${Math.abs(diff).toFixed(2)}元，建议联系客户补缴费用`
    };
  }
  return null;
}

function checkStudioConflict(records) {
  const anomalies = [];
  const sortedRecords = [...records].sort((a, b) => a.actualStartTime - b.actualStartTime);
  
  for (let i = 0; i < sortedRecords.length; i++) {
    for (let j = i + 1; j < sortedRecords.length; j++) {
      const a = sortedRecords[i];
      const b = sortedRecords[j];
      
      if (a.studioName === b.studioName && a.actualEndTime > b.actualStartTime) {
        anomalies.push({
          type: 'STUDIO_CONFLICT',
          severity: 'critical',
          description: '排练室时间冲突',
          studioName: a.studioName,
          bookingA: {
            id: a.bookingId,
            customer: a.customerName,
            time: `${formatDateTime(a.actualStartTime)} - ${formatDateTime(a.actualEndTime)}`
          },
          bookingB: {
            id: b.bookingId,
            customer: b.customerName,
            time: `${formatDateTime(b.actualStartTime)} - ${formatDateTime(b.actualEndTime)}`
          },
          suggestion: `${a.studioName}在同一时段被两个预约占用，请核实实际使用情况并调整计费记录`
        });
      }
    }
  }
  
  return anomalies;
}

function auditRecord(record) {
  const anomalies = [];
  
  const earlyEntry = checkEarlyEntry(record);
  if (earlyEntry) anomalies.push(earlyEntry);
  
  const lateExit = checkLateExit(record);
  if (lateExit) anomalies.push(lateExit);
  
  const crossDay = checkCrossDayRehearsal(record);
  if (crossDay) anomalies.push(crossDay);
  
  const billing = checkBillingAccuracy(record);
  if (billing) anomalies.push(billing);
  
  return {
    record,
    isNormal: anomalies.length === 0,
    anomalies
  };
}

function auditAll(records) {
  const auditedRecords = records.map(auditRecord);
  const conflicts = checkStudioConflict(records);
  
  const normalRecords = auditedRecords.filter(r => r.isNormal);
  const abnormalRecords = auditedRecords.filter(r => !r.isNormal);
  
  conflictRecords = [];
  for (const conflict of conflicts) {
    const affectedRecord = auditedRecords.find(r => r.record.bookingId === conflict.bookingA.id);
    if (affectedRecord) {
      affectedRecord.anomalies.push(conflict);
      affectedRecord.isNormal = false;
    }
  }
  
  return {
    total: records.length,
    normalCount: normalRecords.length,
    abnormalCount: abnormalRecords.length + conflicts.length,
    normalRecords,
    abnormalRecords,
    allRecords: auditedRecords
  };
}

module.exports = {
  auditRecord,
  auditAll,
  calculateExpectedAmount
};
