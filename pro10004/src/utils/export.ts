import { ScreeningVersion, RemittanceStatus, Remittance } from '../types';
import { formatCurrency, getStatusLabel, formatDate } from './format';

export const exportVersionReport = (version: ScreeningVersion): string => {
  const abnormalRemittances = version.remittances.filter(r => r.status === RemittanceStatus.ABNORMAL);
  const pendingRemittances = version.remittances.filter(r => r.status === RemittanceStatus.PENDING);

  let report = '';
  report += '='.repeat(60) + '\n';
  report += '  跨境汇款筛查回放 - 历史版本报告\n';
  report += '='.repeat(60) + '\n\n';
  report += `版本名称: ${version.name}\n`;
  report += `生成时间: ${version.timestamp}\n`;
  report += `总笔数: ${version.totalCount}\n`;
  report += `  正常: ${version.normalCount} 笔\n`;
  report += `  异常: ${version.abnormalCount} 笔\n`;
  report += `  待确认: ${version.pendingCount} 笔\n\n`;

  report += '-'.repeat(60) + '\n';
  report += '  【异常汇款明细】\n';
  report += '-'.repeat(60) + '\n\n';

  abnormalRemittances.forEach((r, idx) => {
    report += `【异常 ${idx + 1}】交易号: ${r.transactionId}\n`;
    report += `  付款方: ${r.payer}\n`;
    report += `  收款方: ${r.payee}\n`;
    report += `  金额: ${formatCurrency(r.amount, r.currency)}\n`;
    report += `  交易日期: ${formatDate(r.transactionDate)}\n`;
    report += `  命中规则:\n`;
    r.ruleHits.forEach(hit => {
      report += `    - ${hit.ruleName}: ${hit.ruleDescription}\n`;
      report += `      命中材料: ${hit.matchedMaterials.join(', ')}\n`;
    });
    report += `  人工说明:\n`;
    r.manualNotes.forEach(note => {
      report += `    [${note.timestamp}] ${note.author} (来源: ${note.source})\n`;
      report += `      ${note.content}\n`;
    });
    report += '\n';
  });

  report += '-'.repeat(60) + '\n';
  report += '  【待确认汇款明细】\n';
  report += '-'.repeat(60) + '\n\n';

  pendingRemittances.forEach((r, idx) => {
    report += `【待确认 ${idx + 1}】交易号: ${r.transactionId}\n`;
    report += `  付款方: ${r.payer}\n`;
    report += `  收款方: ${r.payee}\n`;
    report += `  金额: ${formatCurrency(r.amount, r.currency)}\n`;
    report += `  交易日期: ${formatDate(r.transactionDate)}\n`;
    if (r.crossSettlementAnalysis) {
      report += `  跨清算日分析:\n`;
      report += `    原始交易日: ${r.crossSettlementAnalysis.originalDate}\n`;
      report += `    退款日: ${r.crossSettlementAnalysis.refundDate}\n`;
      report += `    跨越天数: ${r.crossSettlementAnalysis.daysAcross} 天\n`;
      report += `    证据链:\n`;
      r.crossSettlementAnalysis.evidenceChain.forEach(item => {
        report += `      - [${item.type}] ${item.description} (${item.reference})\n`;
      });
    }
    report += `  人工说明:\n`;
    r.manualNotes.forEach(note => {
      report += `    [${note.timestamp}] ${note.author} (来源: ${note.source})\n`;
      report += `      ${note.content}\n`;
    });
    report += '\n';
  });

  report += '='.repeat(60) + '\n';
  report += '  报告结束\n';
  report += '='.repeat(60) + '\n';

  return report;
};

export const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const getAbnormalNotesForSharing = (remittance: Remittance): string => {
  let text = `【跨境汇款异常说明】\n`;
  text += `交易号: ${remittance.transactionId}\n`;
  text += `付款方: ${remittance.payer}\n`;
  text += `收款方: ${remittance.payee}\n`;
  text += `金额: ${formatCurrency(remittance.amount, remittance.currency)}\n`;
  text += `状态: ${getStatusLabel(remittance.status)}\n\n`;
  text += `命中规则:\n`;
  remittance.ruleHits.forEach(hit => {
    text += `• ${hit.ruleName}\n`;
    text += `  ${hit.ruleDescription}\n`;
    text += `  命中材料: ${hit.matchedMaterials.join('、')}\n\n`;
  });
  text += `人工说明:\n`;
  remittance.manualNotes.forEach(note => {
    text += `[${note.timestamp}] ${note.author}\n`;
    text += `${note.content}\n\n`;
  });
  return text;
};
