import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export function validateInputFiles(paths) {
  const errors = [];
  const requiredFiles = ['orders', 'leaders', 'refunds', 'commission'];

  requiredFiles.forEach(fileType => {
    const filePath = paths[fileType];
    if (!fs.existsSync(filePath)) {
      errors.push(`${fileType} 文件不存在: ${filePath}`);
    } else {
      const ext = path.extname(filePath).toLowerCase();
      if (fileType === 'commission') {
        if (ext !== '.json') {
          errors.push(`佣金配置文件必须是 JSON 格式: ${filePath}`);
        }
      } else {
        if (!['.csv', '.json'].includes(ext)) {
          errors.push(`${fileType} 文件格式不支持，必须是 CSV 或 JSON: ${filePath}`);
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateOrderRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!row.orderId && !row['订单ID'] && !row['order_id']) {
    errors.push('缺少订单ID');
  }

  if (!row.leaderId && !row['团长ID'] && !row['leader_id']) {
    errors.push('缺少团长ID');
  }

  const amountRaw = row.amount ?? row['金额'] ?? row['订单金额'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少订单金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('订单金额无效');
  }

  const quantity = parseInt(row.quantity || row['数量'] || 1);
  if (isNaN(quantity) || quantity < 0) {
    warnings.push('数量无效，默认使用 1');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
}

export function validateLeaderRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!row.leaderId && !row['团长ID'] && !row['leader_id']) {
    errors.push('缺少团长ID');
  }

  if (!row.name && !row['姓名'] && !row['团长名称']) {
    warnings.push('缺少团长名称');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
}

export function validateRefundRow(row, rowIndex) {
  const errors = [];
  const warnings = [];

  if (!row.orderId && !row['订单ID'] && !row['order_id']) {
    errors.push('缺少关联订单ID');
  }

  const amountRaw = row.amount ?? row['退款金额'] ?? row['refund_amount'];
  if (amountRaw === undefined || amountRaw === '' || amountRaw === null) {
    errors.push('缺少退款金额');
  }
  const amount = parseFloat(amountRaw);
  if (isNaN(amount) || amount < 0) {
    errors.push('退款金额无效');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rowIndex
  };
}

export function validateCommissionConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.platformFeeRate && config.platformFeeRate !== 0) {
    errors.push('缺少平台服务费比例 (platformFeeRate)');
  } else if (config.platformFeeRate < 0 || config.platformFeeRate > 1) {
    errors.push('平台服务费比例必须在 0-1 之间');
  }

  if (!config.commissionTiers && !config.tieredCommission) {
    warnings.push('未配置佣金阶梯，将使用默认佣金比例');
  } else {
    const tiers = config.commissionTiers || config.tieredCommission;
    if (!Array.isArray(tiers)) {
      errors.push('佣金阶梯配置必须是数组格式');
    } else {
      tiers.forEach((tier, index) => {
        if (!tier.minSales && tier.minSales !== 0) {
          errors.push(`佣金阶梯 ${index + 1} 缺少最低销售额 (minSales)`);
        }
        if (!tier.rate && tier.rate !== 0) {
          errors.push(`佣金阶梯 ${index + 1} 缺少佣金比例 (rate)`);
        } else if (tier.rate < 0 || tier.rate > 1) {
          errors.push(`佣金阶梯 ${index + 1} 比例必须在 0-1 之间`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function parseAndValidateCSV(content, validator, type) {
  const records = [];
  const errors = [];
  const warnings = [];

  try {
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    rows.forEach((row, index) => {
      const validation = validator(row, index + 2);
      if (validation.valid) {
        records.push({
          data: row,
          rowIndex: index + 2,
          warnings: validation.warnings
        });
        warnings.push(...validation.warnings.map(w => ({
          rowIndex: index + 2,
          message: w,
          type
        })));
      } else {
        errors.push({
          rowIndex: index + 2,
          originalRow: row,
          errors: validation.errors,
          type
        });
      }
    });

  } catch (e) {
    errors.push({
      rowIndex: 0,
      originalRow: null,
      errors: [`CSV 解析失败: ${e.message}`],
      type
    });
  }

  return { records, errors, warnings };
}
