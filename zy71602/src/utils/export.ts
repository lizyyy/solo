import * as XLSX from 'xlsx';
import { WalletLimit, LimitHistory, Transaction, WhitelistVersion, RiskMark, ExportFormat } from '../types';
import { generateContentHash } from './format';

interface ExportData {
  walletLimit: WalletLimit;
  histories: LimitHistory[];
  transactions: Transaction[];
  whitelistVersions: WhitelistVersion[];
  riskMarks: RiskMark[];
  exportTime: string;
  operator: string;
}

const prepareExportData = (data: ExportData): Record<string, unknown[]> => {
  const { walletLimit, histories, transactions, whitelistVersions, riskMarks, exportTime, operator } = data;

  return {
    基本信息: [
      {
        钱包账户: walletLimit.walletAccount,
        钱包名称: walletLimit.walletName,
        日限额: walletLimit.dailyLimit,
        单笔限额: walletLimit.singleLimit,
        已用日限额: walletLimit.usedDailyLimit,
        当前状态: walletLimit.status,
        风险等级: walletLimit.riskLevel,
        导出时间: exportTime,
        导出人: operator,
      },
    ],
    变更历史: histories.map((h) => ({
      变更时间: h.createdAt,
      操作人: h.operator,
      变更前日限额: h.beforeDailyLimit,
      变更后日限额: h.afterDailyLimit,
      变更前单笔限额: h.beforeSingleLimit,
      变更后单笔限额: h.afterSingleLimit,
      变更前状态: h.beforeStatus,
      变更后状态: h.afterStatus,
      备注: h.remark,
    })),
    交易明细: transactions.map((t) => ({
      交易流水号: t.transactionNo,
      交易金额: t.amount,
      交易状态: t.status,
      交易时间: t.transactionTime,
      是否重复: t.isDuplicate ? '是' : '否',
      是否异常: t.isAbnormal ? '是' : '否',
      交易描述: t.description,
    })),
    白名单版本: whitelistVersions.map((w) => ({
      版本号: w.version,
      临时日限额: w.tempDailyLimit,
      临时单笔限额: w.tempSingleLimit,
      生效时间: w.effectiveTime,
      过期时间: w.expireTime,
      状态: w.status,
      创建人: w.creator,
    })),
    风险标记: riskMarks.map((r) => ({
      风险类型: r.type,
      风险等级: r.level,
      风险描述: r.description,
      是否已解决: r.isResolved ? '是' : '否',
      标记时间: r.createdAt,
    })),
  };
};

const convertToCSV = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(',');
  
  const dataLines = rows.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });
  
  return [headerLine, ...dataLines].join('\n');
};

export const exportToCSV = (data: ExportData): string => {
  const preparedData = prepareExportData(data);
  let csvContent = '';

  Object.entries(preparedData).forEach(([sheetName, rows]) => {
    if (rows.length > 0) {
      csvContent += `=== ${sheetName} ===\n`;
      csvContent += convertToCSV(rows as Record<string, unknown>[]);
      csvContent += '\n\n';
    }
  });

  return csvContent;
};

export const exportToXLSX = (data: ExportData): Blob => {
  const preparedData = prepareExportData(data);
  const wb = XLSX.utils.book_new();

  Object.entries(preparedData).forEach(([sheetName, rows]) => {
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

export const exportToFile = (
  data: ExportData,
  format: ExportFormat,
  fileName: string
): { contentHash: string } => {
  const content = JSON.stringify(data);
  const contentHash = generateContentHash(content);

  if (format === 'csv') {
    const csv = exportToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `${fileName}.csv`);
  } else if (format === 'xlsx') {
    const blob = exportToXLSX(data);
    downloadFile(blob, `${fileName}.xlsx`);
  } else if (format === 'pdf') {
    const textContent = generateTextReport(data);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    downloadFile(blob, `${fileName}.txt`);
  }

  return { contentHash };
};

const downloadFile = (blob: Blob, fileName: string) => {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const generateTextReport = (data: ExportData): string => {
  const { walletLimit, histories, transactions, whitelistVersions, riskMarks, exportTime, operator } = data;

  let report = `
================================================================================
                        数字钱包限额复核报告
================================================================================

导出时间: ${exportTime}
导出人: ${operator}

--------------------------------------------------------------------------------
                            一、基本信息
--------------------------------------------------------------------------------

钱包账户: ${walletLimit.walletAccount}
钱包名称: ${walletLimit.walletName}
日限额: ${walletLimit.dailyLimit.toLocaleString()} 元
单笔限额: ${walletLimit.singleLimit.toLocaleString()} 元
已用日限额: ${walletLimit.usedDailyLimit.toLocaleString()} 元
限额使用率: ${((walletLimit.usedDailyLimit / walletLimit.dailyLimit) * 100).toFixed(2)}%
当前状态: ${walletLimit.status}
风险等级: ${walletLimit.riskLevel}

--------------------------------------------------------------------------------
                            二、变更历史 (共 ${histories.length} 条)
--------------------------------------------------------------------------------

`;

  histories.forEach((h, index) => {
    report += `
【变更记录 #${index + 1}】
时间: ${h.createdAt}
操作人: ${h.operator}
日限额变更: ${h.beforeDailyLimit.toLocaleString()} → ${h.afterDailyLimit.toLocaleString()}
单笔限额变更: ${h.beforeSingleLimit.toLocaleString()} → ${h.afterSingleLimit.toLocaleString()}
状态变更: ${h.beforeStatus} → ${h.afterStatus}
备注: ${h.remark}
────────────────────────────────────────────────────────────────────────────────
`;
  });

  report += `
--------------------------------------------------------------------------------
                            三、交易明细 (共 ${transactions.length} 条)
--------------------------------------------------------------------------------

`;

  transactions.forEach((t, index) => {
    report += `
【交易 #${index + 1}】
流水号: ${t.transactionNo}
金额: ${t.amount.toLocaleString()} 元
状态: ${t.status}
时间: ${t.transactionTime}
重复交易: ${t.isDuplicate ? '是' : '否'}
异常交易: ${t.isAbnormal ? '是' : '否'}
描述: ${t.description}
────────────────────────────────────────────────────────────────────────────────
`;
  });

  report += `
--------------------------------------------------------------------------------
                            四、白名单版本 (共 ${whitelistVersions.length} 个)
--------------------------------------------------------------------------------

`;

  whitelistVersions.forEach((w) => {
    report += `
【版本 V${w.version}】
状态: ${w.status}
临时日限额: ${w.tempDailyLimit.toLocaleString()} 元
临时单笔限额: ${w.tempSingleLimit.toLocaleString()} 元
生效时间: ${w.effectiveTime}
过期时间: ${w.expireTime}
创建人: ${w.creator}
────────────────────────────────────────────────────────────────────────────────
`;
  });

  report += `
--------------------------------------------------------------------------------
                            五、风险标记 (共 ${riskMarks.length} 个)
--------------------------------------------------------------------------------

`;

  riskMarks.forEach((r, index) => {
    report += `
【风险 #${index + 1}】
类型: ${r.type}
等级: ${r.level}
状态: ${r.isResolved ? '已解决' : '未解决'}
描述: ${r.description}
标记时间: ${r.createdAt}
────────────────────────────────────────────────────────────────────────────────
`;
  });

  report += `
================================================================================
                              报告结束
================================================================================
`;

  return report;
};
