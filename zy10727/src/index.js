const fs = require('fs');
const csv = require('csv-parser');
const { Parser } = require('json2csv');

const RECORD_TYPES = {
  NORMAL_PASS: '正常通行',
  OFFLINE_RECONNECT: '离线重连',
  TEMP_VISITOR: '临时访客',
  DEVICE_CHANGE: '设备换号',
  DUPLICATE: '重复记录',
  MISSING: '缺失记录',
  UNMATCHED: '未匹配'
};

async function parseCSV(filePath) {
  const records = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

function generateRecordKey(record) {
  const timestamp = record.通行时间 || record.补开时间 || '';
  const cardNo = record.卡号 || record.员工卡号 || '';
  const device = record.设备编号 || record.门禁设备 || '';
  const direction = record.通行方向 || '';
  return `${timestamp}|${cardNo}|${device}|${direction}`;
}

function normalizeRecord(record, source) {
  return {
    来源: source,
    记录类型: record.记录类型 || (source === '正常' ? RECORD_TYPES.NORMAL_PASS : RECORD_TYPES.UNMATCHED),
    通行时间: record.通行时间 || record.补开时间 || '',
    补开时间: record.补开时间 || '',
    卡号: record.卡号 || record.员工卡号 || '',
    姓名: record.姓名 || record.员工姓名 || '',
    设备编号: record.设备编号 || record.门禁设备 || '',
    设备名称: record.设备名称 || '',
    通行方向: record.通行方向 || '',
    通行结果: record.通行结果 || record.认证结果 || '',
    离线重连: record.离线重连 === '是' || record.离线重连 === true,
    临时访客: record.临时访客 === '是' || record.临时访客 === true,
    设备换号: record.设备换号 === '是' || record.设备换号 === true,
    原始数据: JSON.stringify(record)
  };
}

function detectSpecialTypes(record) {
  const types = [];
  if (record.离线重连) types.push(RECORD_TYPES.OFFLINE_RECONNECT);
  if (record.临时访客) types.push(RECORD_TYPES.TEMP_VISITOR);
  if (record.设备换号) types.push(RECORD_TYPES.DEVICE_CHANGE);
  return types;
}

function isTimeMatch(time1, time2, toleranceMinutes = 5) {
  if (!time1 || !time2) return false;
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  if (isNaN(t1) || isNaN(t2)) return time1 === time2;
  const diff = Math.abs(t1 - t2) / (1000 * 60);
  return diff <= toleranceMinutes;
}

function findMatchingRecord(normalRecords, offlineRecord) {
  const cardNo = offlineRecord.卡号;
  const device = offlineRecord.设备编号;
  const offlineTime = offlineRecord.通行时间 || offlineRecord.补开时间;

  return normalRecords.find(normal => {
    if (normal.卡号 !== cardNo) return false;
    if (normal.设备编号 !== device) return false;
    return isTimeMatch(normal.通行时间, offlineTime);
  });
}

async function runAudit({ normalLogPath, offlineLogPath }) {
  const normalRecords = await parseCSV(normalLogPath);
  const offlineRecords = await parseCSV(offlineLogPath);

  const auditResult = {
    稽核时间: new Date().toISOString(),
    正常日志文件: normalLogPath,
    补开日志文件: offlineLogPath,
    统计信息: {
      正常日志总数: normalRecords.length,
      补开日志总数: offlineRecords.length,
      匹配成功: 0,
      重复记录: 0,
      缺失记录: 0,
      离线重连: 0,
      临时访客: 0,
      设备换号: 0
    },
    稽核详情: [],
    异常记录: [],
    摘要: []
  };

  const normalizedNormal = normalRecords.map(r => normalizeRecord(r, '正常'));
  const normalizedOffline = offlineRecords.map(r => normalizeRecord(r, '补开'));

  const matchedNormalKeys = new Set();
  const offlineKeyCount = new Map();

  for (const offlineRecord of normalizedOffline) {
    const key = generateRecordKey(offlineRecord);
    offlineKeyCount.set(key, (offlineKeyCount.get(key) || 0) + 1);

    if (offlineKeyCount.get(key) > 1) {
      auditResult.异常记录.push({
        异常类型: RECORD_TYPES.DUPLICATE,
        重复次数: offlineKeyCount.get(key),
        记录信息: offlineRecord
      });
      auditResult.统计信息.重复记录++;
      continue;
    }

    const matchingNormal = findMatchingRecord(normalizedNormal, offlineRecord);
    
    if (matchingNormal) {
      const normalKey = generateRecordKey(matchingNormal);
      matchedNormalKeys.add(normalKey);
      
      const specialTypes = detectSpecialTypes(offlineRecord);
      specialTypes.forEach(type => {
        if (type === RECORD_TYPES.OFFLINE_RECONNECT) auditResult.统计信息.离线重连++;
        if (type === RECORD_TYPES.TEMP_VISITOR) auditResult.统计信息.临时访客++;
        if (type === RECORD_TYPES.DEVICE_CHANGE) auditResult.统计信息.设备换号++;
      });

      auditResult.稽核详情.push({
        匹配状态: '匹配成功',
        特殊类型: specialTypes.length > 0 ? specialTypes.join(',') : '无',
        正常记录: {
          通行时间: matchingNormal.通行时间,
          卡号: matchingNormal.卡号,
          姓名: matchingNormal.姓名,
          设备: matchingNormal.设备编号
        },
        补开记录: {
          补开时间: offlineRecord.补开时间 || offlineRecord.通行时间,
          卡号: offlineRecord.卡号,
          姓名: offlineRecord.姓名,
          设备: offlineRecord.设备编号
        }
      });
      auditResult.统计信息.匹配成功++;
    } else {
      auditResult.稽核详情.push({
        匹配状态: '未匹配',
        特殊类型: detectSpecialTypes(offlineRecord).join(',') || '无',
        补开记录: {
          补开时间: offlineRecord.补开时间 || offlineRecord.通行时间,
          卡号: offlineRecord.卡号,
          姓名: offlineRecord.姓名,
          设备: offlineRecord.设备编号
        }
      });
    }
  }

  for (const normalRecord of normalizedNormal) {
    const key = generateRecordKey(normalRecord);
    if (!matchedNormalKeys.has(key)) {
      auditResult.异常记录.push({
        异常类型: RECORD_TYPES.MISSING,
        记录信息: normalRecord
      });
      auditResult.统计信息.缺失记录++;
    }
  }

  auditResult.摘要 = generateSummary(auditResult);

  return auditResult;
}

function generateSummary(auditResult) {
  const summary = [];
  const stats = auditResult.统计信息;

  summary.push(`【门禁离线日志补开记录稽核摘要】`);
  summary.push(`稽核时间: ${auditResult.稽核时间}`);
  summary.push(`正常日志: ${stats.正常日志总数} 条, 补开日志: ${stats.补开日志总数} 条`);
  summary.push(`匹配成功: ${stats.匹配成功} 条 (${((stats.匹配成功 / stats.补开日志总数) * 100).toFixed(1)}%)`);
  
  if (stats.重复记录 > 0) {
    summary.push(`⚠️  重复记录: ${stats.重复记录} 条`);
  }
  if (stats.缺失记录 > 0) {
    summary.push(`⚠️  缺失记录: ${stats.缺失记录} 条 (正常日志中有但补开日志中没有)`);
  }
  if (stats.离线重连 > 0) {
    summary.push(`📡 离线重连记录: ${stats.离线重连} 条`);
  }
  if (stats.临时访客 > 0) {
    summary.push(`👥 临时访客记录: ${stats.临时访客} 条`);
  }
  if (stats.设备换号 > 0) {
    summary.push(`🔄 设备换号记录: ${stats.设备换号} 条`);
  }

  const hasError = stats.重复记录 > 0 || stats.缺失记录 > 0;
  summary.push(hasError ? '❌ 稽核不通过，存在异常记录需要处理' : '✅ 稽核通过，记录匹配正常');

  return summary;
}

function formatOutput(result, format = 'pretty') {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'csv') {
    const parser = new Parser();
    return parser.parse(result.稽核详情);
  }

  const lines = [];
  lines.push('='.repeat(70));
  lines.push(result.摘要.join('\n'));
  lines.push('='.repeat(70));
  lines.push('');

  if (result.异常记录.length > 0) {
    lines.push('【异常记录详情】');
    lines.push('-'.repeat(50));
    result.异常记录.forEach((item, idx) => {
      lines.push(`${idx + 1}. 异常类型: ${item.异常类型}`);
      if (item.重复次数) lines.push(`   重复次数: ${item.重复次数}`);
      lines.push(`   卡号: ${item.记录信息.卡号}`);
      lines.push(`   姓名: ${item.记录信息.姓名}`);
      lines.push(`   时间: ${item.记录信息.通行时间 || item.记录信息.补开时间}`);
      lines.push(`   设备: ${item.记录信息.设备编号}`);
      lines.push('');
    });
  }

  lines.push('【稽核详情】');
  lines.push('-'.repeat(50));
  result.稽核详情.slice(0, 20).forEach((item, idx) => {
    lines.push(`${idx + 1}. 状态: [${item.匹配状态}] 类型: [${item.特殊类型}]`);
    if (item.正常记录) {
      lines.push(`   正常: ${item.正常记录.通行时间} | ${item.正常记录.卡号} | ${item.正常记录.姓名}`);
    }
    lines.push(`   补开: ${item.补开记录.补开时间} | ${item.补开记录.卡号} | ${item.补开记录.姓名}`);
    lines.push('');
  });

  if (result.稽核详情.length > 20) {
    lines.push(`... 还有 ${result.稽核详情.length - 20} 条记录，使用 -f json 查看完整内容`);
  }

  return lines.join('\n');
}

module.exports = {
  runAudit,
  formatOutput,
  parseCSV,
  generateRecordKey,
  normalizeRecord,
  RECORD_TYPES
};
