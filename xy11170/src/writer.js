const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

function formatDateTimeCSV(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function prepareRecordForCSV(auditedRecord) {
  const r = auditedRecord.record;
  return {
    预约ID: r.bookingId,
    排练室名称: r.studioName,
    客户姓名: r.customerName,
    舞种类型: r.danceType,
    预约开始时间: formatDateTimeCSV(r.scheduledStartTime),
    预约结束时间: formatDateTimeCSV(r.scheduledEndTime),
    实际入场时间: formatDateTimeCSV(r.actualStartTime),
    实际离场时间: formatDateTimeCSV(r.actualEndTime),
    小时单价: r.hourlyRate,
    计费金额: r.billedAmount,
    备注: r.remarks
  };
}

function prepareAbnormalRecordForCSV(auditedRecord) {
  const r = auditedRecord.record;
  const anomalyTypes = auditedRecord.anomalies.map(a => a.description).join('; ');
  const severity = auditedRecord.anomalies.some(a => a.severity === 'critical') 
    ? '严重' 
    : auditedRecord.anomalies.some(a => a.severity === 'error')
      ? '错误'
      : '警告';
  
  return {
    预约ID: r.bookingId,
    排练室名称: r.studioName,
    客户姓名: r.customerName,
    舞种类型: r.danceType,
    异常类型: anomalyTypes,
    严重程度: severity,
    预约开始时间: formatDateTimeCSV(r.scheduledStartTime),
    预约结束时间: formatDateTimeCSV(r.scheduledEndTime),
    实际入场时间: formatDateTimeCSV(r.actualStartTime),
    实际离场时间: formatDateTimeCSV(r.actualEndTime),
    小时单价: r.hourlyRate,
    计费金额: r.billedAmount,
    备注: r.remarks
  };
}

async function writeNormalRecords(normalRecords, outputDir) {
  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, '正常记录.csv'),
    header: [
      { id: '预约ID', title: '预约ID' },
      { id: '排练室名称', title: '排练室名称' },
      { id: '客户姓名', title: '客户姓名' },
      { id: '舞种类型', title: '舞种类型' },
      { id: '预约开始时间', title: '预约开始时间' },
      { id: '预约结束时间', title: '预约结束时间' },
      { id: '实际入场时间', title: '实际入场时间' },
      { id: '实际离场时间', title: '实际离场时间' },
      { id: '小时单价', title: '小时单价' },
      { id: '计费金额', title: '计费金额' },
      { id: '备注', title: '备注' }
    ]
  });
  
  const records = normalRecords.map(prepareRecordForCSV);
  await csvWriter.writeRecords(records);
  return records.length;
}

async function writeAbnormalRecords(abnormalRecords, outputDir) {
  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, '异常记录.csv'),
    header: [
      { id: '预约ID', title: '预约ID' },
      { id: '排练室名称', title: '排练室名称' },
      { id: '客户姓名', title: '客户姓名' },
      { id: '舞种类型', title: '舞种类型' },
      { id: '异常类型', title: '异常类型' },
      { id: '严重程度', title: '严重程度' },
      { id: '预约开始时间', title: '预约开始时间' },
      { id: '预约结束时间', title: '预约结束时间' },
      { id: '实际入场时间', title: '实际入场时间' },
      { id: '实际离场时间', title: '实际离场时间' },
      { id: '小时单价', title: '小时单价' },
      { id: '计费金额', title: '计费金额' },
      { id: '备注', title: '备注' }
    ]
  });
  
  const records = abnormalRecords.map(prepareAbnormalRecordForCSV);
  await csvWriter.writeRecords(records);
  return records.length;
}

async function writeDetailedAnomalies(abnormalRecords, outputDir) {
  const allAnomalies = [];
  
  for (const auditedRecord of abnormalRecords) {
    for (const anomaly of auditedRecord.anomalies) {
      const r = auditedRecord.record;
      allAnomalies.push({
        预约ID: r.bookingId,
        排练室名称: r.studioName,
        客户姓名: r.customerName,
        异常类型: anomaly.description,
        严重程度: anomaly.severity === 'critical' ? '严重' : anomaly.severity === 'error' ? '错误' : '警告',
        详细描述: JSON.stringify(anomaly),
        修复建议: anomaly.suggestion
      });
    }
  }
  
  const csvWriter = createObjectCsvWriter({
    path: path.join(outputDir, '异常详情.csv'),
    header: [
      { id: '预约ID', title: '预约ID' },
      { id: '排练室名称', title: '排练室名称' },
      { id: '客户姓名', title: '客户姓名' },
      { id: '异常类型', title: '异常类型' },
      { id: '严重程度', title: '严重程度' },
      { id: '详细描述', title: '详细描述' },
      { id: '修复建议', title: '修复建议' }
    ]
  });
  
  await csvWriter.writeRecords(allAnomalies);
  return allAnomalies.length;
}

async function writeAuditResults(auditResult, outputDir) {
  ensureOutputDir(outputDir);
  
  const normalCount = await writeNormalRecords(auditResult.normalRecords, outputDir);
  const abnormalCount = await writeAbnormalRecords(auditResult.abnormalRecords, outputDir);
  const anomalyCount = await writeDetailedAnomalies(auditResult.abnormalRecords, outputDir);
  
  return {
    normalCount,
    abnormalCount,
    anomalyCount
  };
}

module.exports = {
  writeAuditResults,
  ensureOutputDir
};
