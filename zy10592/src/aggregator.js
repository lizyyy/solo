function deduplicateRequests(records) {
  const seen = new Map();
  const duplicates = [];
  
  records.forEach((record, index) => {
    let key;
    
    if (record.requestId && record.requestId.trim()) {
      key = `req_${record.requestId}`;
    } else if (record.path && record.tenant && record.timestamp) {
      const timeWindow = Math.floor(record.timestamp / 1000);
      key = `approx_${record.path}_${record.tenant}_${timeWindow}_${record.latency}`;
    } else {
      key = `raw_${index}_${record.path}_${record.latency}`;
    }
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.duplicateSources.push({
        file: record.sourceFile,
        line: record.lineNumber
      });
      duplicates.push({
        original: {
          file: existing.sourceFile,
          line: existing.lineNumber
        },
        duplicate: {
          file: record.sourceFile,
          line: record.lineNumber
        },
        key
      });
    } else {
      record.duplicateSources = [];
      seen.set(key, record);
    }
  });
  
  const dedupedRecords = Array.from(seen.values());
  
  const deduplicationStats = {
    originalCount: records.length,
    dedupedCount: dedupedRecords.length,
    duplicateCount: records.length - dedupedRecords.length,
    policy: [
      '去重口径说明：',
      '1. 优先使用 request_id 作为唯一标识',
      '2. 无 request_id 时，使用【路径 + 租户 + 秒级时间戳 + 耗时】作为近似标识',
      '3. 仍无法匹配时，按原始行号保留，不进行去重',
      '4. 重复请求保留首次出现的记录，其他记录计入 duplicateSources'
    ].join('\n'),
    duplicates
  };
  
  return {
    dedupedRecords,
    deduplicationStats
  };
}

function aggregateData(records) {
  const groups = new Map();
  
  records.forEach(record => {
    const key = `${record.path}|${record.tenant}|${record.statusCode}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        path: record.path,
        tenant: record.tenant,
        statusCode: record.statusCode,
        records: [],
        latencies: []
      });
    }
    
    const group = groups.get(key);
    group.records.push(record);
    group.latencies.push(record.latency);
  });
  
  return Array.from(groups.values()).map(group => {
    group.latencies.sort((a, b) => a - b);
    return group;
  });
}

module.exports = {
  deduplicateRequests,
  aggregateData
};
