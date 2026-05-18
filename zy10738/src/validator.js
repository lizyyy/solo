export function validateRecords(records) {
  const validationErrors = [];
  const validRecords = [];
  const serialNumbers = new Map();

  records.forEach((record) => {
    const recordErrors = [];

    if (serialNumbers.has(record.流水号)) {
      recordErrors.push({
        type: '重复支付',
        message: `流水号重复，首次出现在第${serialNumbers.get(record.流水号)}行`,
        firstOccurrence: serialNumbers.get(record.流水号)
      });
    } else {
      serialNumbers.set(record.流水号, record.原始行号);
    }

    if (record.车道状态 === '离线' || record.车道状态 === 'offline') {
      recordErrors.push({
        type: '车道离线',
        message: `车道${record.车道编号}处于离线状态`
      });
    }

    if (record.照片数量 === 0) {
      recordErrors.push({
        type: '照片缺失',
        message: '车辆照片数量为0'
      });
    }

    if (record.实收金额 > 0 && !record.支付方式) {
      recordErrors.push({
        type: '支付方式缺失',
        message: '有实收金额但缺少支付方式'
      });
    }

    if (record.实收金额 > record.应收金额) {
      recordErrors.push({
        type: '金额异常',
        message: `实收金额(${record.实收金额})大于应收金额(${record.应收金额})`
      });
    }

    if (recordErrors.length > 0) {
      validationErrors.push({
        流水号: record.流水号,
        原始行号: record.原始行号,
        车牌号: record.车牌号,
        入场时间: record.入场时间,
        出场时间: record.出场时间,
        errors: recordErrors
      });
    }

    validRecords.push({
      ...record,
      hasErrors: recordErrors.length > 0,
      errorCount: recordErrors.length
    });
  });

  return {
    validRecords,
    validationErrors
  };
}

export function groupErrorsByType(validationErrors) {
  const grouped = {};
  
  validationErrors.forEach((record) => {
    record.errors.forEach((error) => {
      if (!grouped[error.type]) {
        grouped[error.type] = [];
      }
      grouped[error.type].push({
        流水号: record.流水号,
        原始行号: record.原始行号,
        车牌号: record.车牌号,
        入场时间: record.入场时间,
        出场时间: record.出场时间,
        message: error.message,
        ...error
      });
    });
  });

  return grouped;
}
