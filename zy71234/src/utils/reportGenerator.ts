import type { Settlement, ReportData, NegotiationRecord, Card } from '../types';
import { formatCurrency, getCardTypeName, getPartyIcon } from './settlementEngine';
import { getIssueTypeLabel, getSeverityLabel } from './issueDetector';

export function generateReportData(
  levelName: string,
  settlement: Settlement,
  negotiationRecords: NegotiationRecord[]
): ReportData {
  const rawVsProcessed = [
    {
      item: '总营收',
      raw: formatCurrency(settlement.rawTotalRevenue),
      processed: formatCurrency(settlement.totalRevenue),
      difference: '无变化'
    },
    {
      item: '信誉评分',
      raw: `${settlement.rawReputationScore.toFixed(0)}分`,
      processed: `${settlement.reputationScore.toFixed(0)}分`,
      difference: settlement.reputationScore < settlement.rawReputationScore 
        ? `扣除 ${(settlement.rawReputationScore - settlement.reputationScore).toFixed(0)}分（问题处罚）`
        : '无变化'
    },
    {
      item: '平台扣费',
      raw: '无',
      processed: formatCurrency(settlement.deductions.reduce((sum, d) => sum + d.amount, 0)),
      difference: `${settlement.deductions.length} 项扣费`
    },
    ...settlement.splits.map(split => ({
      item: `${getPartyIcon(split.partyType)} ${split.partyName} 分成`,
      raw: `${split.rawSplit.toFixed(1)}%`,
      processed: `${split.finalSplit.toFixed(1)}%`,
      difference: split.modifiers.length > 0 
        ? split.modifiers.map(m => `${m.cardName}: ${m.value > 0 ? '+' : ''}${m.value}%`).join(', ')
        : '无调整'
    }))
  ];

  return {
    levelName,
    totalRevenue: settlement.totalRevenue,
    finalPayout: settlement.finalPayout,
    splits: settlement.splits,
    issues: settlement.issues,
    reputationScore: settlement.reputationScore,
    negotiationRecords,
    rawVsProcessed
  };
}

export function generateReportHTML(reportData: ReportData): string {
  const issueSummary = {
    critical: reportData.issues.filter(i => i.severity === 'critical').length,
    major: reportData.issues.filter(i => i.severity === 'major').length,
    minor: reportData.issues.filter(i => i.severity === 'minor').length
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>版权谈判报告 - ${reportData.levelName}</title>
  <style>
    body { font-family: 'Noto Sans SC', sans-serif; padding: 40px; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px; }
    h2 { color: #f4d03f; margin-top: 30px; }
    .section { background: #1e1e3a; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stat { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #333; }
    .critical { color: #ef4444; }
    .major { color: #eab308; }
    .minor { color: #60a5fa; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { color: #d4af37; }
    .raw { color: #9ca3af; }
    .processed { color: #22c55e; }
  </style>
</head>
<body>
  <h1>🎵 音乐版权谈判报告</h1>
  <h2>关卡：${reportData.levelName}</h2>
  
  <div class="section">
    <h3>📊 结算摘要</h3>
    <div class="stat"><span>总营收：</span><span>${formatCurrency(reportData.totalRevenue)}</span></div>
    <div class="stat"><span>最终支付：</span><span>${formatCurrency(reportData.finalPayout)}</span></div>
    <div class="stat"><span>信誉评分：</span><span>${reportData.reputationScore.toFixed(0)}分</span></div>
  </div>
  
  <div class="section">
    <h3>⚠️ 问题识别</h3>
    <div class="stat critical"><span>严重问题：</span><span>${issueSummary.critical} 项</span></div>
    <div class="stat major"><span>重要问题：</span><span>${issueSummary.major} 项</span></div>
    <div class="stat minor"><span>轻微问题：</span><span>${issueSummary.minor} 项</span></div>
  </div>
  
  <div class="section">
    <h3>💰 分成明细</h3>
    <table>
      <tr><th>参与方</th><th>原始比例</th><th>最终比例</th><th>金额</th></tr>
      ${reportData.splits.map(s => `
      <tr>
        <td>${getPartyIcon(s.partyType)} ${s.partyName}</td>
        <td class="raw">${s.rawSplit.toFixed(1)}%</td>
        <td class="processed">${s.finalSplit.toFixed(1)}%</td>
        <td>${formatCurrency(s.amount)}</td>
      </tr>`).join('')}
    </table>
  </div>
  
  <div class="section">
    <h3>🔍 原始信息 vs 处理结果</h3>
    <table>
      <tr><th>项目</th><th>原始信息</th><th>处理结果</th><th>差异说明</th></tr>
      ${reportData.rawVsProcessed.map(item => `
      <tr>
        <td>${item.item}</td>
        <td class="raw">${item.raw}</td>
        <td class="processed">${item.processed}</td>
        <td>${item.difference}</td>
      </tr>`).join('')}
    </table>
  </div>
  
  <div class="section">
    <h3>📝 谈判记录</h3>
    <table>
      <tr><th>回合</th><th>卡牌</th><th>类型</th><th>效果</th></tr>
      ${reportData.negotiationRecords.map(r => `
      <tr>
        <td>${r.round}</td>
        <td>${r.cardName}</td>
        <td>${getCardTypeName(r.cardType)}</td>
        <td>${r.effect}</td>
      </tr>`).join('')}
    </table>
  </div>
  
  <p style="margin-top: 40px; color: #6b7280; text-align: center;">
    报告生成时间：${new Date().toLocaleString('zh-CN')}
  </p>
</body>
</html>`;
}

export function generateNegotiationRecord(
  round: number,
  card: Card
): NegotiationRecord {
  let effectText = '';
  
  switch (card.effect.type) {
    case 'split_modifier':
      effectText = `${card.effect.target === 'all' ? '全部' : card.effect.target} 分成 ${card.effect.value > 0 ? '+' : ''}${card.effect.value}%`;
      break;
    case 'right_add':
      effectText = `添加权利: ${card.effect.right || '未知权利'}`;
      break;
    case 'risk_add':
      effectText = `添加风险项`;
      break;
    case 'reputation_mod':
      effectText = `信誉 ${card.effect.value > 0 ? '+' : ''}${card.effect.value}`;
      break;
    case 'deduction_add':
      effectText = `扣费 ${card.effect.value}%`;
      break;
    default:
      effectText = card.description;
  }
  
  return {
    round,
    cardName: card.name,
    cardType: card.type,
    effect: effectText,
    timestamp: new Date()
  };
}

export function downloadReport(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(elementId: string, filename: string): Promise<void> {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Element not found');
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a2e',
      scale: 2
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);
    pdf.save(filename);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}
