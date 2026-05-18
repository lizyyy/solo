import logger from './logger.js';

const REQUIRED_COLUMNS = [
  '摊位编号',
  '摊主姓名',
  '摊位类型',
  '收费月份',
  '应收金额',
  '实收金额',
  '收费状态'
];

const STALL_TYPES = ['蔬菜类', '水果类', '肉类', '水产类', '干货类', '熟食类', '豆制品类'];
const PAYMENT_STATUSES = ['已缴', '未缴', '部分缴纳', '临时休市', '转租'];

export function validateHeaders(headers, fileName) {
  const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  
  if (missingColumns.length > 0) {
    logger.recordError(fileName, 1, `缺少必要列: ${missingColumns.join(', ')}`);
    return false;
  }
  return true;
}

export function validateRecord(record, lineNumber, fileName) {
  const errors = [];
  const warnings = [];

  if (!record['摊位编号'] || record['摊位编号'].trim() === '') {
    errors.push('摊位编号不能为空');
  }

  if (!record['摊主姓名'] || record['摊主姓名'].trim() === '') {
    errors.push('摊主姓名不能为空');
  }

  if (record['摊位类型'] && !STALL_TYPES.includes(record['摊位类型'])) {
    warnings.push(`摊位类型"${record['摊位类型']}"不在标准类型列表中`);
  }

  if (!record['收费月份'] || !/^\d{4}-\d{2}$/.test(record['收费月份'])) {
    errors.push('收费月份格式错误，应为 YYYY-MM');
  }

  const 应收金额 = parseFloat(record['应收金额']);
  const 实收金额 = parseFloat(record['实收金额']);

  if (isNaN(应收金额) || 应收金额 < 0) {
    errors.push('应收金额必须为非负数');
  }

  if (isNaN(实收金额) || 实收金额 < 0) {
    errors.push('实收金额必须为非负数');
  }

  if (record['收费状态'] && !PAYMENT_STATUSES.includes(record['收费状态'])) {
    warnings.push(`收费状态"${record['收费状态']}"不在标准状态列表中`);
  }

  if (record['收费状态'] === '临时休市') {
    warnings.push('临时休市，该月费用需另行核算');
  }

  if (record['收费状态'] === '转租') {
    warnings.push('转租摊位，需核实新摊主信息');
  }

  errors.forEach(err => {
    logger.recordError(fileName, lineNumber, err, record);
  });

  warnings.forEach(warn => {
    logger.recordWarning(fileName, lineNumber, warn, record);
  });

  if (errors.length === 0) {
    logger.incrementValidRecords();
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function checkDuplicates(records, fileName) {
  const seen = new Map();
  const duplicates = [];

  records.forEach((record, index) => {
    const key = `${record['摊位编号']}-${record['收费月份']}`;
    if (seen.has(key)) {
      duplicates.push({
        lineNumber: index + 2,
        key,
        record
      });
      logger.recordError(fileName, index + 2, `重复记录: 摊位 ${record['摊位编号']} 在 ${record['收费月份']} 已有记录`, record);
    } else {
      seen.set(key, index + 2);
    }
  });

  return duplicates;
}

export function calculateFees(records) {
  return records.map(record => {
    const 应收金额 = parseFloat(record['应收金额']) || 0;
    const 实收金额 = parseFloat(record['实收金额']) || 0;
    const 欠费金额 = 应收金额 - 实收金额;

    let 核对结果 = '正常';
    if (record['收费状态'] === '临时休市') {
      核对结果 = '临时休市待处理';
    } else if (record['收费状态'] === '转租') {
      核对结果 = '转租待核实';
    } else if (欠费金额 > 0) {
      核对结果 = '有欠费';
    } else if (欠费金额 < 0) {
      核对结果 = '预存/多缴';
    }

    return {
      ...record,
      欠费金额,
      核对结果
    };
  });
}
