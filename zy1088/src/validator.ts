import {
  Sale,
  Payment,
  Inventory,
  Fee,
  Return,
  Config,
  ValidationError,
  ValidationResult,
  LoadedData
} from './types';
import { groupBy, getBusinessDate } from './utils';

export function validateData(data: LoadedData): ValidationResult {
  const { sales, payments, inventory, fees, returns, config } = data;
  
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  errors.push(...validateSales(sales, config));
  errors.push(...validatePayments(payments, sales, config));
  errors.push(...validateInventory(inventory, sales, returns, config));
  errors.push(...validateReturns(returns, sales, config));
  errors.push(...validateFees(fees, config));
  
  const crossDayIssues = validateCrossDayHours(sales, payments, returns, config);
  if (crossDayIssues.length > 0) {
    warnings.push(...crossDayIssues);
  }
  
  const validationErrors = errors.filter(e => e.severity === 'error');
  const validationWarnings = [
    ...errors.filter(e => e.severity === 'warning'),
    ...errors.filter(e => e.severity === 'info'),
    ...warnings
  ];
  
  return {
    valid: validationErrors.length === 0,
    totalErrors: validationErrors.length,
    totalWarnings: validationWarnings.length,
    errors: validationErrors,
    warnings: validationWarnings,
    summary: {
      missingFields: countByType(errors, 'missing_field'),
      duplicateOrders: countByType(errors, 'duplicate_order'),
      paymentMismatches: countByType(errors, 'payment_mismatch'),
      negativeStock: countByType(errors, 'negative_stock'),
      invalidReturns: countByType(errors, 'return_no_order'),
      crossDayIssues: countByType([...errors, ...warnings], 'cross_day_hours')
    }
  };
}

function countByType(errors: ValidationError[], type: string): number {
  return errors.filter(e => e.type === type).length;
}

function validateSales(sales: Sale[], config: Config): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (sales.length === 0) {
    errors.push({
      type: 'missing_field',
      severity: 'warning',
      message: '没有销售记录',
      impactOnProfit: '无法计算销售收入，利润可能不准确',
      actionRequired: '检查 sales.csv 文件是否存在且包含数据',
      details: {}
    });
    return errors;
  }
  
  const orderIds = new Map<string, number>();
  
  sales.forEach((sale, index) => {
    const lineNumber = index + 2;
    
    if (!sale.orderId || sale.orderId.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'error',
        message: `第 ${lineNumber} 行: 缺少订单号`,
        impactOnProfit: '无法追踪订单，可能导致重复计算或漏算收入',
        actionRequired: '补充或修正订单号',
        details: {
          field: 'orderId',
          recordId: sale.orderId,
          stallId: sale.stallId,
          date: sale.date
        }
      });
    } else {
      const count = orderIds.get(sale.orderId) || 0;
      if (count > 0) {
        errors.push({
          type: 'duplicate_order',
          severity: 'error',
          message: `订单 ${sale.orderId} 重复出现`,
          impactOnProfit: '会导致销售收入被重复计算，虚高利润',
          actionRequired: '删除重复订单或修正订单号',
          details: {
            orderId: sale.orderId,
            stallId: sale.stallId,
            date: sale.date,
            value: count + 1
          }
        });
      }
      orderIds.set(sale.orderId, count + 1);
    }
    
    if (!sale.productId || sale.productId.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'error',
        message: `订单 ${sale.orderId}: 缺少商品ID`,
        impactOnProfit: '无法匹配库存，成本计算可能不准确',
        actionRequired: '补充商品ID',
        details: {
          field: 'productId',
          orderId: sale.orderId,
          stallId: sale.stallId
        }
      });
    }
    
    if (sale.quantity <= 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `订单 ${sale.orderId}: 销售数量 ${sale.quantity} 无效`,
        impactOnProfit: '销售数量为0或负数会导致收入和成本计算错误',
        actionRequired: '修正销售数量',
        details: {
          field: 'quantity',
          value: sale.quantity,
          expected: '> 0',
          orderId: sale.orderId
        }
      });
    }
    
    if (sale.unitPrice < 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `订单 ${sale.orderId}: 单价 ${sale.unitPrice} 为负数`,
        impactOnProfit: '负单价会导致收入计算错误',
        actionRequired: '修正单价',
        details: {
          field: 'unitPrice',
          value: sale.unitPrice,
          expected: '>= 0',
          orderId: sale.orderId
        }
      });
    }
    
    if (sale.totalAmount < 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `订单 ${sale.orderId}: 总金额 ${sale.totalAmount} 为负数`,
        impactOnProfit: '负金额会导致收入计算错误',
        actionRequired: '修正总金额',
        details: {
          field: 'totalAmount',
          value: sale.totalAmount,
          expected: '>= 0',
          orderId: sale.orderId
        }
      });
    }
    
    const expectedTotal = sale.unitPrice * sale.quantity;
    if (sale.totalAmount > 0 && Math.abs(sale.totalAmount - expectedTotal) > 0.01) {
      errors.push({
        type: 'invalid_value',
        severity: 'warning',
        message: `订单 ${sale.orderId}: 总金额 ${sale.totalAmount} 与单价×数量 ${expectedTotal} 不符`,
        impactOnProfit: '金额不一致可能导致收入计算偏差',
        actionRequired: '检查并修正金额',
        details: {
          field: 'totalAmount',
          value: sale.totalAmount,
          expected: expectedTotal,
          orderId: sale.orderId
        }
      });
    }
    
    if (!sale.date || sale.date.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'warning',
        message: `订单 ${sale.orderId}: 缺少日期`,
        impactOnProfit: '无法按日期分组统计利润',
        actionRequired: '补充日期或从时间戳推断',
        details: {
          field: 'date',
          orderId: sale.orderId
        }
      });
    }
    
    if (!sale.timestamp || sale.timestamp.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'warning',
        message: `订单 ${sale.orderId}: 缺少时间戳`,
        impactOnProfit: '无法准确判断营业日期（跨天营业场景）',
        actionRequired: '补充时间戳',
        details: {
          field: 'timestamp',
          orderId: sale.orderId
        }
      });
    }
  });
  
  return errors;
}

function validatePayments(payments: Payment[], sales: Sale[], config: Config): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (payments.length === 0) {
    errors.push({
      type: 'missing_field',
      severity: 'warning',
      message: '没有收款记录',
      impactOnProfit: '无法核对销售与收款是否一致，可能存在漏收或多收',
      actionRequired: '检查 payments.csv 文件是否存在且包含数据',
      details: {}
    });
    return errors;
  }
  
  const salesByOrderId = groupBy(sales, s => s.orderId);
  const paymentIds = new Set<string>();
  
  payments.forEach((payment, index) => {
    const lineNumber = index + 2;
    
    if (!payment.paymentId || payment.paymentId.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'error',
        message: `第 ${lineNumber} 行: 缺少收款ID`,
        impactOnProfit: '无法追踪收款记录',
        actionRequired: '补充或修正收款ID',
        details: {
          field: 'paymentId',
          stallId: payment.stallId,
          date: payment.date
        }
      });
    } else {
      if (paymentIds.has(payment.paymentId)) {
        errors.push({
          type: 'duplicate_order',
          severity: 'error',
          message: `收款ID ${payment.paymentId} 重复出现`,
          impactOnProfit: '会导致收款被重复计算',
          actionRequired: '删除重复记录或修正收款ID',
          details: {
            paymentId: payment.paymentId,
            stallId: payment.stallId,
            date: payment.date
          }
        });
      }
      paymentIds.add(payment.paymentId);
    }
    
    if (payment.amount <= 0 && payment.status !== 'refunded') {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `收款 ${payment.paymentId}: 金额 ${payment.amount} 无效`,
        impactOnProfit: '收款金额为0或负数会导致收入计算错误',
        actionRequired: '修正收款金额',
        details: {
          field: 'amount',
          value: payment.amount,
          expected: '> 0 (非退款)',
          paymentId: payment.paymentId
        }
      });
    }
    
    if (payment.orderId && payment.orderId.trim() !== '') {
      const relatedSales = salesByOrderId[payment.orderId] || [];
      
      if (relatedSales.length === 0) {
        errors.push({
          type: 'missing_reference',
          severity: 'warning',
          message: `收款 ${payment.paymentId} 关联的订单 ${payment.orderId} 不存在`,
          impactOnProfit: '无法核对该收款对应的销售',
          actionRequired: '检查订单号是否正确，或删除无效关联',
          details: {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            field: 'orderId'
          }
        });
      } else {
        const totalSaleAmount = relatedSales.reduce((sum, s) => sum + s.totalAmount, 0);
        if (payment.status === 'success' && Math.abs(payment.amount - totalSaleAmount) > 0.01) {
          errors.push({
            type: 'payment_mismatch',
            severity: 'error',
            message: `订单 ${payment.orderId}: 销售金额 ${totalSaleAmount} 与收款金额 ${payment.amount} 不符`,
            impactOnProfit: '金额不一致会导致实际收入与账面不符，可能存在漏收或多收',
            actionRequired: '核对销售记录和收款记录，找出差异原因',
            details: {
              orderId: payment.orderId,
              paymentId: payment.paymentId,
              value: payment.amount,
              expected: totalSaleAmount
            }
          });
        }
      }
    }
  });
  
  const salesWithPaymentId = sales.filter(s => s.paymentId && s.paymentId.trim() !== '');
  const paymentIdSet = new Set(payments.map(p => p.paymentId));
  
  salesWithPaymentId.forEach(sale => {
    if (!paymentIdSet.has(sale.paymentId!)) {
      errors.push({
        type: 'payment_mismatch',
        severity: 'warning',
        message: `订单 ${sale.orderId} 关联的收款 ${sale.paymentId} 不存在`,
        impactOnProfit: '无法确认该订单是否已收款',
        actionRequired: '检查收款ID是否正确，或补充收款记录',
        details: {
          orderId: sale.orderId,
          paymentId: sale.paymentId
        }
      });
    }
  });
  
  return errors;
}

function validateInventory(inventory: Inventory, sales: Sale[], returns: Return[], config: Config): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (inventory.items.length === 0) {
    errors.push({
      type: 'missing_field',
      severity: 'warning',
      message: '没有库存商品信息',
      impactOnProfit: '无法计算商品成本，利润计算将缺少成本部分',
      actionRequired: '检查 inventory.json 文件是否包含商品信息',
      details: {}
    });
    return errors;
  }
  
  const productMap = new Map(inventory.items.map(item => [item.productId, item]));
  const salesByProduct = groupBy(sales, s => s.productId);
  const returnsByProduct = groupBy(returns, r => r.productId);
  
  inventory.items.forEach(item => {
    if (!item.productId || item.productId.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'error',
        message: '库存商品缺少商品ID',
        impactOnProfit: '无法匹配销售记录，成本计算错误',
        actionRequired: '补充商品ID',
        details: {
          field: 'productId',
          productId: item.productId
        }
      });
    }
    
    if (item.unitCost < 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `商品 ${item.productId}(${item.productName}): 单位成本 ${item.unitCost} 为负数`,
        impactOnProfit: '负成本会导致利润虚高',
        actionRequired: '修正单位成本',
        details: {
          field: 'unitCost',
          value: item.unitCost,
          expected: '>= 0',
          productId: item.productId
        }
      });
    }
    
    const productSales = salesByProduct[item.productId] || [];
    const totalSold = productSales.reduce((sum, s) => sum + s.quantity, 0);
    
    const productReturns = returnsByProduct[item.productId] || [];
    const totalReturned = productReturns.reduce((sum, r) => sum + r.quantity, 0);
    
    const netSold = totalSold - totalReturned;
    const estimatedRemaining = item.initialStock - netSold;
    
    if (estimatedRemaining < 0 && config.inventory.negativeStockWarning) {
      errors.push({
        type: 'negative_stock',
        severity: 'error',
        message: `商品 ${item.productId}(${item.productName}): 库存可能为负数`,
        impactOnProfit: '负库存意味着销售超出了进货量，可能存在：1) 库存记录不准确；2) 销售记录错误；3) 未记录的进货。这会导致成本计算错误。',
        actionRequired: '核对库存记录、销售记录和进货记录，确认是否有遗漏的进货或错误的销售',
        details: {
          productId: item.productId,
          value: estimatedRemaining,
          expected: '>= 0',
          initialStock: item.initialStock,
          totalSold,
          totalReturned
        }
      });
    }
    
    if (item.currentStock < item.minStock) {
      errors.push({
        type: 'invalid_value',
        severity: 'warning',
        message: `商品 ${item.productId}(${item.productName}): 当前库存 ${item.currentStock} 低于最低库存 ${item.minStock}`,
        impactOnProfit: '库存不足可能导致销售机会流失',
        actionRequired: '考虑补货',
        details: {
          productId: item.productId,
          value: item.currentStock,
          expected: `>= ${item.minStock}`
        }
      });
    }
    
    if (item.unitPrice < item.unitCost) {
      errors.push({
        type: 'invalid_value',
        severity: 'warning',
        message: `商品 ${item.productId}(${item.productName}): 售价 ${item.unitPrice} 低于成本 ${item.unitCost}`,
        impactOnProfit: '该商品每卖出一件都会亏损',
        actionRequired: '考虑调整售价或寻找更低成本的进货渠道',
        details: {
          productId: item.productId,
          value: item.unitPrice,
          expected: `>= ${item.unitCost}`
        }
      });
    }
  });
  
  sales.forEach(sale => {
    if (sale.productId && !productMap.has(sale.productId)) {
      errors.push({
        type: 'missing_reference',
        severity: 'warning',
        message: `订单 ${sale.orderId}: 商品 ${sale.productId}(${sale.productName}) 不在库存列表中`,
        impactOnProfit: '无法获取该商品的成本信息，成本计算可能不准确',
        actionRequired: '在 inventory.json 中添加该商品的信息，或检查商品ID是否正确',
        details: {
          orderId: sale.orderId,
          productId: sale.productId
        }
      });
    }
  });
  
  return errors;
}

function validateReturns(returns: Return[], sales: Sale[], config: Config): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (returns.length === 0) {
    return errors;
  }
  
  const salesByOrderId = groupBy(sales, s => s.orderId);
  
  returns.forEach((ret, index) => {
    const lineNumber = index + 2;
    
    if (!ret.originalOrderId || ret.originalOrderId.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'error',
        message: `退货 ${ret.returnId}: 缺少原订单号`,
        impactOnProfit: '无法确认退货对应的原销售，可能导致错误的退款',
        actionRequired: '补充原订单号',
        details: {
          field: 'originalOrderId',
          returnId: ret.returnId,
          date: ret.date
        }
      });
    } else {
      const relatedSales = salesByOrderId[ret.originalOrderId] || [];
      
      if (relatedSales.length === 0) {
        errors.push({
          type: 'return_no_order',
          severity: 'error',
          message: `退货 ${ret.returnId}: 原订单 ${ret.originalOrderId} 不存在`,
          impactOnProfit: '没有对应的销售记录却有退货，可能导致：1) 错误的退款；2) 原订单号输入错误；3) 销售记录遗漏。这会直接减少利润。',
          actionRequired: '核对原订单号是否正确，或检查是否有遗漏的销售记录',
          details: {
            returnId: ret.returnId,
            orderId: ret.originalOrderId,
            refundAmount: ret.refundAmount
          }
        });
      } else {
        const relatedSale = relatedSales.find(s => s.productId === ret.productId);
        if (relatedSale) {
          if (ret.quantity > relatedSale.quantity) {
            errors.push({
              type: 'invalid_value',
              severity: 'error',
              message: `退货 ${ret.returnId}: 退货数量 ${ret.quantity} 超过原订单数量 ${relatedSale.quantity}`,
              impactOnProfit: '退货数量超过销售数量会导致过度退款，减少利润',
              actionRequired: '修正退货数量',
              details: {
                returnId: ret.returnId,
                orderId: ret.originalOrderId,
                value: ret.quantity,
                expected: `<= ${relatedSale.quantity}`
              }
            });
          }
          
          if (ret.refundAmount > relatedSale.totalAmount) {
            errors.push({
              type: 'invalid_value',
              severity: 'error',
              message: `退货 ${ret.returnId}: 退款金额 ${ret.refundAmount} 超过原订单金额 ${relatedSale.totalAmount}`,
              impactOnProfit: '退款金额超过销售金额会导致额外损失',
              actionRequired: '修正退款金额',
              details: {
                returnId: ret.returnId,
                orderId: ret.originalOrderId,
                value: ret.refundAmount,
                expected: `<= ${relatedSale.totalAmount}`
              }
            });
          }
        } else {
          errors.push({
            type: 'missing_reference',
            severity: 'warning',
            message: `退货 ${ret.returnId}: 商品 ${ret.productId} 不在原订单 ${ret.originalOrderId} 中`,
            impactOnProfit: '无法确认退货商品是否对应原订单',
            actionRequired: '检查商品ID是否正确',
            details: {
              returnId: ret.returnId,
              orderId: ret.originalOrderId,
              productId: ret.productId
            }
          });
        }
      }
    }
    
    if (ret.quantity <= 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `退货 ${ret.returnId}: 退货数量 ${ret.quantity} 无效`,
        impactOnProfit: '退货数量为0或负数会导致退款计算错误',
        actionRequired: '修正退货数量',
        details: {
          field: 'quantity',
          value: ret.quantity,
          expected: '> 0',
          returnId: ret.returnId
        }
      });
    }
    
    if (ret.refundAmount < 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `退货 ${ret.returnId}: 退款金额 ${ret.refundAmount} 为负数`,
        impactOnProfit: '负退款金额会导致收入计算错误',
        actionRequired: '修正退款金额',
        details: {
          field: 'refundAmount',
          value: ret.refundAmount,
          expected: '>= 0',
          returnId: ret.returnId
        }
      });
    }
  });
  
  return errors;
}

function validateFees(fees: Fee[], config: Config): ValidationError[] {
  const errors: ValidationError[] = [];
  
  fees.forEach((fee, index) => {
    const lineNumber = index + 2;
    
    if (fee.amount < 0) {
      errors.push({
        type: 'invalid_value',
        severity: 'error',
        message: `费用 ${fee.feeId}: 金额 ${fee.amount} 为负数`,
        impactOnProfit: '负费用会导致利润虚高',
        actionRequired: '修正费用金额',
        details: {
          field: 'amount',
          value: fee.amount,
          expected: '>= 0',
          feeId: fee.feeId
        }
      });
    }
    
    if (!fee.date || fee.date.trim() === '') {
      errors.push({
        type: 'missing_field',
        severity: 'warning',
        message: `费用 ${fee.feeId}: 缺少日期`,
        impactOnProfit: '无法按日期分摊费用',
        actionRequired: '补充日期',
        details: {
          field: 'date',
          feeId: fee.feeId
        }
      });
    }
  });
  
  return errors;
}

function validateCrossDayHours(
  sales: Sale[],
  payments: Payment[],
  returns: Return[],
  config: Config
): ValidationError[] {
  const warnings: ValidationError[] = [];
  
  const [cutoffHour, cutoffMinute] = config.businessHours.crossDayCutoff.split(':').map(Number);
  
  const allTimestamps: { timestamp: string; type: string; id: string }[] = [
    ...sales.map(s => ({ timestamp: s.timestamp, type: 'sale', id: s.orderId })),
    ...payments.map(p => ({ timestamp: p.timestamp, type: 'payment', id: p.paymentId })),
    ...returns.map(r => ({ timestamp: r.timestamp, type: 'return', id: r.returnId }))
  ].filter(t => t.timestamp);
  
  const crossDayRecords = allTimestamps.filter(record => {
    const date = new Date(record.timestamp);
    const hour = date.getHours();
    return hour < cutoffHour || (hour === cutoffHour && date.getMinutes() < cutoffMinute);
  });
  
  if (crossDayRecords.length > 0) {
    const dates = new Set(crossDayRecords.map(r => {
      const date = new Date(r.timestamp);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }));
    
    warnings.push({
      type: 'cross_day_hours',
      severity: 'info',
      message: `发现 ${crossDayRecords.length} 条记录在凌晨 ${config.businessHours.crossDayCutoff} 之前`,
      impactOnProfit: `这些记录将被归入前一天的营业数据。当前配置：跨天截止时间为 ${config.businessHours.crossDayCutoff}，即凌晨 ${cutoffHour} 点 ${cutoffMinute} 分之前的交易算作前一天的营业额。`,
      actionRequired: '如果日期归属不正确，请调整 config.json 中的 businessHours.crossDayCutoff 设置',
      details: {
        value: crossDayRecords.length,
        dates: Array.from(dates).join(', '),
        cutoffTime: config.businessHours.crossDayCutoff
      }
    });
  }
  
  return warnings;
}

export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('数据验证结果');
  lines.push('='.repeat(60));
  
  if (result.valid) {
    lines.push('\n✅ 验证通过！没有发现严重错误。');
  } else {
    lines.push(`\n❌ 验证失败！发现 ${result.totalErrors} 个错误，${result.totalWarnings} 个警告。`);
  }
  
  lines.push('\n📊 问题统计:');
  lines.push(`   缺失字段: ${result.summary.missingFields}`);
  lines.push(`   重复订单: ${result.summary.duplicateOrders}`);
  lines.push(`   收款不符: ${result.summary.paymentMismatches}`);
  lines.push(`   负库存: ${result.summary.negativeStock}`);
  lines.push(`   无效退货: ${result.summary.invalidReturns}`);
  lines.push(`   跨天问题: ${result.summary.crossDayIssues}`);
  
  if (result.errors.length > 0) {
    lines.push('\n' + '='.repeat(60));
    lines.push('❌ 错误详情 (必须处理):');
    lines.push('='.repeat(60));
    
    result.errors.forEach((error, index) => {
      lines.push(`\n[${index + 1}] ${error.message}`);
      lines.push(`    类型: ${error.type}`);
      lines.push(`    💰 对利润的影响: ${error.impactOnProfit}`);
      lines.push(`    👉 需要操作: ${error.actionRequired}`);
      if (Object.keys(error.details).length > 0) {
        lines.push(`    📝 详细信息: ${JSON.stringify(error.details, null, 2).split('\n').map((l, i) => i === 0 ? l : '        ' + l).join('\n')}`);
      }
    });
  }
  
  if (result.warnings.length > 0) {
    lines.push('\n' + '='.repeat(60));
    lines.push('⚠️ 警告详情 (建议处理):');
    lines.push('='.repeat(60));
    
    result.warnings.forEach((warning, index) => {
      lines.push(`\n[${index + 1}] ${warning.message}`);
      lines.push(`    类型: ${warning.type}`);
      lines.push(`    💰 对利润的影响: ${warning.impactOnProfit}`);
      lines.push(`    👉 需要操作: ${warning.actionRequired}`);
    });
  }
  
  lines.push('\n' + '='.repeat(60));
  
  return lines.join('\n');
}
