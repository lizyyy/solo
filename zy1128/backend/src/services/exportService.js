import reconciliationModel from '../models/reconciliationModel.js';
import allocationModel from '../models/allocationModel.js';
import holderModel from '../models/holderModel.js';
import accountModel from '../models/accountModel.js';
import productModel from '../models/productModel.js';
import expectedPayoutModel from '../models/expectedPayoutModel.js';
import { formatCurrency, formatPercentage } from '../utils/calculationUtils.js';
import { formatDate } from '../utils/dateUtils.js';

export const exportToCSV = (data, columns) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      let value = row[c.key];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [header, ...rows].join('\n');
};

export const exportToHTML = (data, columns, title = '导出报告') => {
  const headerRow = columns.map(c => `<th>${c.label}</th>`).join('');
  const bodyRows = data.map(row => 
    `<tr>${columns.map(c => {
      let value = row[c.key];
      if (value === null || value === undefined) {
        value = '-';
      }
      if (c.type === 'currency' && typeof value === 'number') {
        value = formatCurrency(value);
      }
      if (c.type === 'percentage' && typeof value === 'number') {
        value = formatPercentage(value * 100);
      }
      return `<td>${value}</td>`;
    }).join('')}</tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    tr:hover { background-color: #f9f9f9; }
    h1 { color: #333; }
    .summary { margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
    .summary-item { display: inline-block; margin-right: 30px; }
    .summary-label { color: #666; font-size: 12px; }
    .summary-value { font-size: 18px; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
};

export const exportToMarkdown = (data, columns, title = '导出报告') => {
  const headerRow = `| ${columns.map(c => c.label).join(' | ')} |`;
  const separatorRow = `| ${columns.map(() => '---').join(' | ')} |`;
  const bodyRows = data.map(row => 
    `| ${columns.map(c => {
      let value = row[c.key];
      if (value === null || value === undefined) {
        return '-';
      }
      if (c.type === 'currency' && typeof value === 'number') {
        return formatCurrency(value);
      }
      if (c.type === 'percentage' && typeof value === 'number') {
        return formatPercentage(value * 100);
      }
      return String(value).replace(/\|/g, '\\|');
    }).join(' | ')} |`
  ).join('\n');

  return `# ${title}

${headerRow}
${separatorRow}
${bodyRows}
`;
};

export const generateReconciliationReport = (filters = {}) => {
  const reconciliations = reconciliationModel.findAll(filters);
  
  const columns = [
    { key: 'payout_date', label: '到账日期' },
    { key: 'product_name', label: '产品名称' },
    { key: 'product_code', label: '产品代码' },
    { key: 'holder_name', label: '持有人' },
    { key: 'account_name', label: '账户' },
    { key: 'expected_amount', label: '应到账金额', type: 'currency' },
    { key: 'actual_amount', label: '实际到账金额', type: 'currency' },
    { key: 'difference', label: '差额', type: 'currency' },
    { key: 'difference_type', label: '差异类型' },
    { key: 'transaction_description', label: '交易描述' },
    { key: 'manual_adjustment', label: '手工调整说明' }
  ];

  const data = reconciliations.map(r => ({
    payout_date: r.payout_date ? formatDate(r.payout_date) : '-',
    product_name: r.product_name || '-',
    product_code: r.product_code || '-',
    holder_name: r.holder_name || '-',
    account_name: r.account_name || '-',
    expected_amount: r.expected_amount,
    actual_amount: r.actual_amount,
    difference: r.difference,
    difference_type: getDifferenceTypeLabel(r.difference_type),
    transaction_description: r.transaction_description || '-',
    manual_adjustment: r.manual_adjustment || '-'
  }));

  const summary = {
    total: reconciliations.length,
    matched: reconciliations.filter(r => r.difference_type === 'matched').length,
    unmatched: reconciliations.filter(r => r.difference_type === 'unmatched').length,
    underpaid: reconciliations.filter(r => r.difference_type === 'underpaid').length,
    overpaid: reconciliations.filter(r => r.difference_type === 'overpaid').length,
    total_expected: reconciliations.reduce((sum, r) => sum + (r.expected_amount || 0), 0),
    total_actual: reconciliations.reduce((sum, r) => sum + (r.actual_amount || 0), 0),
    total_difference: reconciliations.reduce((sum, r) => sum + (r.difference || 0), 0)
  };

  return {
    data,
    columns,
    summary,
    title: '收益核对报告'
  };
};

export const generateHolderAllocationReport = (holderId, filters = {}) => {
  const holder = holderModel.findById(holderId);
  if (!holder) {
    return { error: '持有人不存在' };
  }

  const allocations = allocationModel.findByHolderId(holderId, filters);
  
  const columns = [
    { key: 'payout_date', label: '到账日期' },
    { key: 'product_name', label: '产品名称' },
    { key: 'product_code', label: '产品代码' },
    { key: 'share_ratio', label: '持有份额', type: 'percentage' },
    { key: 'allocated_principal', label: '分摊本金', type: 'currency' },
    { key: 'allocated_interest', label: '分摊利息', type: 'currency' },
    { key: 'allocated_management_fee', label: '分摊管理费', type: 'currency' },
    { key: 'allocated_redemption_fee', label: '分摊赎回费', type: 'currency' },
    { key: 'allocated_difference', label: '分摊差额', type: 'currency' },
    { key: 'net_amount', label: '净收益', type: 'currency' }
  ];

  const data = allocations.map(a => ({
    payout_date: a.payout_date ? formatDate(a.payout_date) : '-',
    product_name: a.product_name || '-',
    product_code: a.product_code || '-',
    share_ratio: a.share_ratio,
    allocated_principal: a.allocated_principal,
    allocated_interest: a.allocated_interest,
    allocated_management_fee: a.allocated_management_fee,
    allocated_redemption_fee: a.allocated_redemption_fee,
    allocated_difference: a.allocated_difference,
    net_amount: (a.allocated_principal || 0) + (a.allocated_interest || 0) - 
               (a.allocated_management_fee || 0) - (a.allocated_redemption_fee || 0) + 
               (a.allocated_difference || 0)
  }));

  const summary = {
    holder_name: holder.holder_name,
    total_count: allocations.length,
    total_principal: allocations.reduce((sum, a) => sum + (a.allocated_principal || 0), 0),
    total_interest: allocations.reduce((sum, a) => sum + (a.allocated_interest || 0), 0),
    total_management_fee: allocations.reduce((sum, a) => sum + (a.allocated_management_fee || 0), 0),
    total_redemption_fee: allocations.reduce((sum, a) => sum + (a.allocated_redemption_fee || 0), 0),
    total_difference: allocations.reduce((sum, a) => sum + (a.allocated_difference || 0), 0)
  };

  summary.total_net = summary.total_principal + summary.total_interest - 
                      summary.total_management_fee - summary.total_redemption_fee + 
                      summary.total_difference;

  return {
    data,
    columns,
    summary,
    title: `${holder.holder_name} 收益分摊明细`
  };
};

const getDifferenceTypeLabel = (type) => {
  const labels = {
    'matched': '已匹配',
    'unmatched': '未到账',
    'underpaid': '少到账',
    'overpaid': '多到账',
    'early_redemption': '提前赎回',
    'fee_deduction': '费用扣减',
    'manual': '手工调整'
  };
  return labels[type] || type || '-';
};

export default {
  exportToCSV,
  exportToHTML,
  exportToMarkdown,
  generateReconciliationReport,
  generateHolderAllocationReport
};
