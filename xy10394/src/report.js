import { writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { table, getBorderCharacters } from 'table';
import { getRiskSummary, filterRisksByLevel } from './riskCheck.js';
import { getSuppliers, getQualifications, getPurchaseOrders } from './storage.js';
import { getCurrentDate, calculateExpiryStatus } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__filename));

export function generateTextReport(risks, outputPath = null) {
  const summary = getRiskSummary(risks);
  
  let report = `
╔══════════════════════════════════════════════════════════════════════════╗
║                    供应商资质到期风险提醒报告                             ║
╚══════════════════════════════════════════════════════════════════════════╝

报告生成时间: ${getCurrentDate()}

══════════════════════════════════════════════════════════════════════════════
                              风险汇总
══════════════════════════════════════════════════════════════════════════════

总风险数: ${summary.total}

按风险等级:
  ⚠️  严重 (CRITICAL): ${summary.byLevel.CRITICAL}
  ❗️  高 (HIGH): ${summary.byLevel.HIGH}
  ⚡️  中 (MEDIUM): ${summary.byLevel.MEDIUM}
  ℹ️  低 (LOW): ${summary.byLevel.LOW}

按风险类型:
${Object.entries(summary.byType).map(([type, count]) => `  • ${type}: ${count}`).join('\n')}

按供应商:
${Object.entries(summary.bySupplier).map(([name, count]) => `  • ${name}: ${count} 项`).join('\n')}

══════════════════════════════════════════════════════════════════════════════
                              详细风险列表
══════════════════════════════════════════════════════════════════════════════

${risks.map((risk, index) => formatRiskDetail(index + 1, risk)).join('\n\n')}

══════════════════════════════════════════════════════════════════════════════
                              统计概览
══════════════════════════════════════════════════════════════════════════════

供应商总数: ${getSuppliers().length}
资质总数: ${getQualifications().length}
采购单总数: ${getPurchaseOrders().length}
风险项总数: ${risks.length}

`;
  
  if (outputPath) {
    writeFileSync(outputPath, report, 'utf-8');
    return { path: outputPath, success: true };
  }
  
  return report;
}

function formatRiskDetail(index, risk) {
  const levelColors = {
    CRITICAL: '严重',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低'
  };
  
  let detail = `
【${index}】风险等级: ${levelColors[risk.level] || risk.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
供应商: ${risk.supplierName} (${risk.supplierCode})
风险类型: ${risk.type}
资质类型: ${risk.qualificationType || '-'}

问题描述:
  ${risk.message}

建议动作:
  ${risk.suggestion}
`;
  
  if (risk.expiryDate) {
    detail += `到期日期: ${risk.expiryDate}\n`;
  }
  
  if (risk.daysLeft !== undefined && risk.daysLeft !== null) {
    const daysText = risk.daysLeft >= 0 ? `剩余 ${risk.daysLeft} 天` : `已过期 ${Math.abs(risk.daysLeft)} 天`;
    detail += `状态: ${daysText}\n`;
  }
  
  if (risk.purchaseOrderNumber) {
    detail += `影响采购单: ${risk.purchaseOrderNumber} (${risk.orderDate})\n`;
  }
  
  return detail;
}

export function generateJSONReport(risks, outputPath) {
  const reportData = {
    generatedAt: getCurrentDate(),
    summary: getRiskSummary(risks),
    risks: risks,
    statistics: {
      totalSuppliers: getSuppliers().length,
      totalQualifications: getQualifications().length,
      totalPurchaseOrders: getPurchaseOrders().length,
      totalRisks: risks.length
    }
  };
  
  if (outputPath) {
    writeFileSync(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
    return { path: outputPath, success: true };
  }
  
  return reportData;
}

export function displayRisksByLevel(risks) {
  const levels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const output = [];
  
  for (const level of levels) {
    const levelRisks = filterRisksByLevel(risks, level);
    if (levelRisks.length > 0) {
      output.push(`\n【${level === 'CRITICAL' ? '严重' : level === 'HIGH' ? '高' : level === 'MEDIUM' ? '中' : '低'}风险】共 ${levelRisks.length} 项`);
      output.push('─'.repeat(60));
      
      for (const risk of levelRisks) {
        output.push(`  • ${risk.supplierName} - ${risk.qualificationType || risk.type}: ${risk.message}`);
      }
    }
  }
  
  return output.join('\n');
}
