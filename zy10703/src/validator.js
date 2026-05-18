export function detectDuplicateTransfers(records) {
  const sessionMap = new Map();
  const errors = [];
  const processedRecords = [];

  for (const record of records) {
    const sessionId = record.data['会话ID'];
    const isTransferred = record.data['是否转人工'] === '是' || record.data['是否转人工'] === 'true';

    if (!sessionId) {
      processedRecords.push(record);
      continue;
    }

    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        count: 0,
        transfers: [],
        records: []
      });
    }

    const sessionInfo = sessionMap.get(sessionId);
    sessionInfo.records.push(record);

    if (isTransferred) {
      sessionInfo.count++;
      sessionInfo.transfers.push({
        row: record.rowNumber,
        file: record.sourceFile,
        time: record.data['转人工时间']
      });
    }

    processedRecords.push(record);
  }

  for (const [sessionId, info] of sessionMap.entries()) {
    if (info.count > 1) {
      errors.push({
        type: '同一会话多次转接',
        sessionId,
        transferCount: info.count,
        details: info.transfers,
        severity: 'warning'
      });

      for (const record of info.records) {
        record.hasDuplicateTransfers = true;
        record.transferCount = info.count;
      }
    }
  }

  return { records: processedRecords, errors };
}

export function validateTransferLogic(records) {
  const errors = [];

  for (const record of records) {
    const { data, rowNumber, sourceFile } = record;
    const isTransferred = data['是否转人工'] === '是' || data['是否转人工'] === 'true';
    const transferTime = data['转人工时间'];
    const transferReason = data['转人工原因'];
    const agentId = data['客服ID'];

    if (isTransferred) {
      if (!transferTime) {
        errors.push({
          type: '转接时间缺失',
          sessionId: data['会话ID'],
          row: rowNumber,
          file: sourceFile,
          severity: 'warning'
        });
      }
      if (!transferReason) {
        errors.push({
          type: '转接原因缺失',
          sessionId: data['会话ID'],
          row: rowNumber,
          file: sourceFile,
          severity: 'warning'
        });
      }
      if (!agentId) {
        errors.push({
          type: '客服ID缺失',
          sessionId: data['会话ID'],
          row: rowNumber,
          file: sourceFile,
          severity: 'warning'
        });
      }
    }
  }

  return { records, errors };
}

export function validateTags(records) {
  const errors = [];

  for (const record of records) {
    const { data, rowNumber, sourceFile } = record;
    const tags = data['会话标签'];
    const isTransferred = data['是否转人工'] === '是' || data['是否转人工'] === 'true';

    if (!tags || tags.trim() === '') {
      errors.push({
        type: '会话标签缺失',
        sessionId: data['会话ID'],
        row: rowNumber,
        file: sourceFile,
        severity: 'warning',
        context: isTransferred ? '已转人工会话' : '机器人处理会话'
      });
      record.missingTag = true;
    }
  }

  return { records, errors };
}

export function runAllValidations(records) {
  const allErrors = [];

  const result1 = detectDuplicateTransfers(records);
  allErrors.push(...result1.errors);

  const result2 = validateTransferLogic(result1.records);
  allErrors.push(...result2.errors);

  const result3 = validateTags(result2.records);
  allErrors.push(...result3.errors);

  return {
    records: result3.records,
    errors: allErrors
  };
}