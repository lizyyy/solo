import type { HistoryRecord } from '../types/history';
import { formatDateTime, formatCurrency, formatPercent } from './formatters';

export const exportToCSV = (record: HistoryRecord): void => {
  const headers = [
    '回合',
    '时间',
    '新闻标题',
    '新闻来源',
    '操作',
    '标的',
    '数量',
    '价格',
    '仓位',
    '决策理由',
    '处理人',
    '处理时间',
    '原始来源',
  ];

  const rows: string[][] = [];

  record.trades.forEach((trade) => {
    const news = record.newsHistory.find((n) => n.id === trade.newsEventId);
    rows.push([
      trade.roundNumber.toString(),
      formatDateTime(trade.timestamp),
      news?.title || '',
      news?.sourceName || '',
      trade.action === 'buy' ? '买入' : trade.action === 'sell' ? '卖出' : '观望',
      trade.symbol,
      trade.quantity.toString(),
      trade.price.toString(),
      `${(trade.position * 100).toFixed(0)}%`,
      trade.reason,
      news?.processor || '',
      news?.processTime || '',
      news?.originalSource || '',
    ]);
  });

  const summaryRows = [
    [],
    ['=== 结算报告 ==='],
    ['初始资金', formatCurrency(record.initialCapital)],
    ['最终资金', formatCurrency(record.finalCapital)],
    ['总收益', formatCurrency(record.totalReturn)],
    ['收益率', formatPercent(record.totalReturnPercent)],
    ['交易次数', record.settlement.tradeCount.toString()],
    ['胜率', formatPercent(record.settlement.winRate)],
    ['最大回撤', formatPercent(-record.settlement.maxDrawdown)],
    ['结算原因', getSettleReasonText(record.settlement.triggerCondition)],
    ['结算时间', formatDateTime(record.settlement.settleTime)],
  ];

  const allRows = [headers, ...rows, ...summaryRows];
  const csvContent = allRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

  downloadFile(csvContent, `对局记录_${record.configName}_${formatDateForFilename(record.startTime)}.csv`, 'text/csv;charset=utf-8;');
};

export const exportToJSON = (record: HistoryRecord): void => {
  const content = JSON.stringify(record, null, 2);
  downloadFile(content, `对局记录_${record.configName}_${formatDateForFilename(record.startTime)}.json`, 'application/json');
};

const getSettleReasonText = (trigger: string): string => {
  const map: Record<string, string> = {
    round_end: '回合结束自动结算',
    manual: '手动结算',
    stop_loss: '触发止损线',
    take_profit: '触发止盈线',
  };
  return map[trigger] || trigger;
};

const formatDateForFilename = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
};

const downloadFile = (content: string, filename: string, type: string): void => {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
