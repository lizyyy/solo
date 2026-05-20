const moment = require('moment');

const OVERDUE_HOURS = 24;
const MIN_FUEL_BALANCE = 100;

function validateBorrowReturnRecords(records) {
  const normal = [];
  const pending = [];
  const failed = [];

  records.forEach((record, index) => {
    const item = {
      id: `borrow_${index}`,
      type: 'borrow_return',
      originalData: { ...record }
    };

    const errors = [];
    const warnings = [];

    if (!record.车牌号 || !record.借车人 || !record.借出时间) {
      errors.push({ field: '必填字段缺失', message: '车牌号、借车人、借出时间为必填项' });
    }

    if (record.借出时间 && !record.归还时间) {
      const borrowTime = moment(record.借出时间);
      const hoursDiff = moment().diff(borrowTime, 'hours');
      if (hoursDiff > OVERDUE_HOURS) {
        warnings.push({
          type: 'overdue',
          message: `超时未还：已借出 ${hoursDiff} 小时（超过${OVERDUE_HOURS}小时阈值）`,
          detail: `车牌号: ${record.车牌号}, 借车人: ${record.借车人}, 借出时间: ${record.借出时间}`
        });
      }
    }

    if (record.油卡余额 !== undefined) {
      const balance = parseFloat(record.油卡余额);
      if (isNaN(balance)) {
        errors.push({ field: '油卡余额', message: '油卡余额格式不正确，应为数字' });
      } else if (balance < MIN_FUEL_BALANCE) {
        warnings.push({
          type: 'fuel_balance_low',
          message: `油卡余额异常：余额 ${balance} 元，低于最低阈值 ${MIN_FUEL_BALANCE} 元`,
          detail: `车牌号: ${record.车牌号}, 当前余额: ${balance}`
        });
      }
    }

    if (errors.length > 0) {
      failed.push({
        ...item,
        errors: errors,
        suggestion: generateSuggestion(errors, record)
      });
    } else if (warnings.length > 0) {
      pending.push({
        ...item,
        warnings: warnings,
        actionRequired: true
      });
    } else {
      normal.push({
        ...item,
        status: 'valid'
      });
    }
  });

  return { normal, pending, failed };
}

function validateVehicles(vehicles) {
  const normal = [];
  const pending = [];
  const failed = [];

  const vehicleList = Array.isArray(vehicles) ? vehicles : (vehicles.vehicles || [vehicles]);

  vehicleList.forEach((vehicle, index) => {
    const item = {
      id: `vehicle_${index}`,
      type: 'vehicle',
      originalData: { ...vehicle }
    };

    const errors = [];

    if (!vehicle.plateNumber && !vehicle.车牌号) {
      errors.push({ field: '车牌号', message: '车牌号为必填项' });
    }

    if (errors.length > 0) {
      failed.push({
        ...item,
        errors: errors,
        suggestion: generateSuggestion(errors, vehicle)
      });
    } else {
      normal.push({
        ...item,
        status: 'valid'
      });
    }
  });

  return { normal, pending, failed };
}

function validateViolationReceipt(receipt) {
  const normal = [];
  const pending = [];
  const failed = [];

  const item = {
    id: `violation_${Date.now()}_${Math.random()}`,
    type: 'violation',
    originalData: receipt
  };

  const warnings = [];

  if (!receipt.plateNumber && !receipt.车牌号) {
    warnings.push({
      type: 'violation_ownership_unclear',
      message: '违章归属不明确：回执中未包含车牌号信息',
      detail: '请核对违章车辆与试驾车信息'
    });
  }

  if (receipt.violationTime || receipt.违章时间) {
    const violationTime = moment(receipt.violationTime || receipt.违章时间);
    if (violationTime.isValid()) {
      warnings.push({
        type: 'violation_time_check',
        message: '违章时间待确认：请核对该时间段内的借车记录',
        detail: `违章时间: ${violationTime.format('YYYY-MM-DD HH:mm')}`
      });
    }
  }

  if (warnings.length > 0) {
    pending.push({
      ...item,
      warnings: warnings,
      actionRequired: true
    });
  } else {
    normal.push({
      ...item,
      status: 'valid'
    });
  }

  return { normal, pending, failed };
}

function generateSuggestion(errors, record) {
  const suggestions = [];
  
  errors.forEach(error => {
    if (error.field.includes('必填')) {
      suggestions.push(`请补充${error.field}信息后重新提交`);
    } else if (error.field === '油卡余额') {
      suggestions.push('请检查油卡余额填写格式，示例："200"');
    } else {
      suggestions.push(`请修正${error.field}字段后重新提交`);
    }
  });

  return suggestions.join('；');
}

module.exports = {
  validateBorrowReturnRecords,
  validateVehicles,
  validateViolationReceipt
};
