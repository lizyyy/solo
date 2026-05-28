import type { OperationLog, Warning } from '../types';

interface ReportData {
  rounds: number;
  finalTrackingError: number;
  avgTrackingError: number;
  maxTrackingError: number;
  totalOperations: number;
  warnings: Warning[];
  operationLogs: OperationLog[];
  netValueHistory: number[];
  indexValueHistory: number[];
  trackingErrorHistory: number[];
}

export function generateReportData(
  rounds: number,
  trackingErrorHistory: number[],
  netValueHistory: number[],
  indexValueHistory: number[],
  operationLogs: OperationLog[],
  warnings: Warning[]
): ReportData {
  const finalTrackingError = trackingErrorHistory[trackingErrorHistory.length - 1] || 0;
  const avgTrackingError = trackingErrorHistory.length > 0
    ? trackingErrorHistory.reduce((a, b) => a + b, 0) / trackingErrorHistory.length
    : 0;
  const maxTrackingError = trackingErrorHistory.length > 0
    ? Math.max(...trackingErrorHistory)
    : 0;

  return {
    rounds,
    finalTrackingError,
    avgTrackingError,
    maxTrackingError,
    totalOperations: operationLogs.length,
    warnings,
    operationLogs,
    netValueHistory,
    indexValueHistory,
    trackingErrorHistory,
  };
}

export function generateHtmlReport(data: ReportData): string {
  const warningsByType = {
    cashExcess: data.warnings.filter(w => w.type === 'cash_excess').length,
    suspensionMismatch: data.warnings.filter(w => w.type === 'suspension_mismatch').length,
    errorAccumulation: data.warnings.filter(w => w.type === 'error_accumulation').length,
  };

  const suggestions: string[] = [];
  if (warningsByType.cashExcess > 3) {
    suggestions.push('现金管理问题突出，建议收到申购后尽快建仓，避免现金比例过高');
  }
  if (warningsByType.suspensionMismatch > 2) {
    suggestions.push('停牌股票处理不当，建议学习停牌股票替代策略');
  }
  if (data.finalTrackingError > 0.05) {
    suggestions.push('跟踪误差较大，建议定期调整持仓权重以贴近指数');
  }
  if (suggestions.length === 0) {
    suggestions.push('操作良好，继续保持！注意控制交易成本');
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>指数基金复制挑战 - 复盘报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #0F172A; border-bottom: 3px solid #0F172A; padding-bottom: 10px; }
    h2 { color: #1E293B; margin-top: 30px; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .metric { background: #F8FAFC; padding: 20px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 24px; font-weight: bold; color: #0F172A; }
    .metric-label { color: #64748B; font-size: 14px; margin-top: 8px; }
    .good { color: #10B981; }
    .bad { color: #EF4444; }
    .section { margin: 30px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #E2E8F0; }
    th { background: #F8FAFC; font-weight: 600; }
    .warning { background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .critical { background: #FEE2E2; }
    .suggestions { background: #ECFDF5; padding: 20px; border-radius: 8px; margin-top: 30px; }
    .suggestions ul { margin: 10px 0; padding-left: 20px; }
    .grade { font-size: 48px; font-weight: bold; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 指数基金复制挑战 - 复盘报告</h1>
    
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${data.rounds}</div>
        <div class="metric-label">游戏回合</div>
      </div>
      <div class="metric">
        <div class="metric-value ${data.finalTrackingError < 0.03 ? 'good' : 'bad'}">${(data.finalTrackingError * 100).toFixed(2)}%</div>
        <div class="metric-label">最终跟踪误差</div>
      </div>
      <div class="metric">
        <div class="metric-value">${(data.avgTrackingError * 100).toFixed(2)}%</div>
        <div class="metric-label">平均跟踪误差</div>
      </div>
      <div class="metric">
        <div class="metric-value">${data.totalOperations}</div>
        <div class="metric-label">操作次数</div>
      </div>
    </div>

    <div class="grade">
      ${data.finalTrackingError < 0.02 ? '🏆 A级' : 
        data.finalTrackingError < 0.04 ? '👍 B级' : 
        data.finalTrackingError < 0.06 ? '📝 C级' : '💪 D级'}
    </div>

    <h2>⚠️ 问题汇总</h2>
    <div class="section">
      <div class="metrics">
        <div class="metric">
          <div class="metric-value ${warningsByType.cashExcess > 3 ? 'bad' : ''}">${warningsByType.cashExcess}</div>
          <div class="metric-label">现金比例过高</div>
        </div>
        <div class="metric">
          <div class="metric-value">${warningsByType.suspensionMismatch}</div>
          <div class="metric-label">停牌处理问题</div>
        </div>
        <div class="metric">
          <div class="metric-value ${warningsByType.errorAccumulation > 0 ? 'bad' : ''}">${warningsByType.errorAccumulation}</div>
          <div class="metric-label">误差连续上升</div>
        </div>
      </div>
    </div>

    <h2>📋 操作日志</h2>
    <table>
      <tr>
        <th>回合</th>
        <th>类型</th>
        <th>描述</th>
        <th>误差影响</th>
      </tr>
      ${data.operationLogs.slice(-10).reverse().map(log => `
        <tr>
          <td>${log.round}</td>
          <td>${log.type === 'buy' ? '买入' : log.type === 'sell' ? '卖出' : '事件处理'}</td>
          <td>${log.description}</td>
          <td class="${log.trackingErrorImpact > 0 ? 'bad' : 'good'}">${log.trackingErrorImpact > 0 ? '+' : ''}${(log.trackingErrorImpact * 100).toFixed(3)}%</td>
        </tr>
      `).join('')}
    </table>

    <div class="suggestions">
      <h2>💡 学习建议</h2>
      <ul>
        ${suggestions.map(s => `<li>${s}</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>
  `;
}

export function downloadHtmlReport(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportOperationLogsCsv(logs: OperationLog[]) {
  const data = logs.map(log => ({
    回合: log.round,
    时间: new Date(log.timestamp).toLocaleString('zh-CN'),
    类型: log.type === 'buy' ? '买入' : log.type === 'sell' ? '卖出' : '事件处理',
    股票代码: log.stockCode || '',
    股票名称: log.stockName || '',
    数量: log.quantity || '',
    价格: log.price || '',
    描述: log.description,
    误差影响: (log.trackingErrorImpact * 100).toFixed(4) + '%',
  }));
  
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(row => Object.values(row).map(v => `"${v}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', '操作日志.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
