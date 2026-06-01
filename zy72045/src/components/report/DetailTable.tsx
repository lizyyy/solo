import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import type { HistoryRecord } from '../../types/history';
import { StatusBadge } from '../common/StatusBadge';
import { SourceCard } from '../common/SourceCard';
import { formatCurrency, formatDateTime, formatPercent, getReturnColor } from '../../utils/formatters';
import { exportToCSV, exportToJSON } from '../../utils/export';
import { useState } from 'react';

interface DetailTableProps {
  record: HistoryRecord;
}

export function DetailTable({ record }: DetailTableProps) {
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

  const getNewsForTrade = (newsEventId: string) => {
    return record.newsHistory.find((n) => n.id === newsEventId);
  };

  const handleExportCSV = () => {
    exportToCSV(record);
  };

  const handleExportJSON = () => {
    exportToJSON(record);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg font-semibold">交易明细</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <FileSpreadsheet size={14} />
            导出CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <FileJson size={14} />
            导出JSON
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="text-left py-3 px-2 font-medium text-neutral-500">回合</th>
              <th className="text-left py-3 px-2 font-medium text-neutral-500">时间</th>
              <th className="text-left py-3 px-2 font-medium text-neutral-500">新闻标题</th>
              <th className="text-left py-3 px-2 font-medium text-neutral-500">操作</th>
              <th className="text-left py-3 px-2 font-medium text-neutral-500">标的</th>
              <th className="text-right py-3 px-2 font-medium text-neutral-500">数量</th>
              <th className="text-right py-3 px-2 font-medium text-neutral-500">价格</th>
              <th className="text-right py-3 px-2 font-medium text-neutral-500">仓位</th>
              <th className="text-center py-3 px-2 font-medium text-neutral-500">操作</th>
            </tr>
          </thead>
          <tbody>
            {record.trades.length > 0 ? (
              record.trades.map((trade) => {
                const news = getNewsForTrade(trade.newsEventId);
                const isExpanded = expandedTradeId === trade.id;

                return (
                  <>
                    <tr
                      key={trade.id}
                      className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                      onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                    >
                      <td className="py-3 px-2 font-medium">{trade.roundNumber}</td>
                      <td className="py-3 px-2 text-neutral-500 font-mono text-xs">
                        {formatDateTime(trade.timestamp)}
                      </td>
                      <td className="py-3 px-2 max-w-xs truncate" title={news?.title}>
                        {news?.title || '-'}
                      </td>
                      <td className="py-3 px-2">
                        <StatusBadge status={trade.action} type="trade" />
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-mono">{trade.symbol}</span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {trade.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {formatCurrency(trade.price)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {formatPercent(trade.position, 0)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button className="text-primary-500 hover:text-primary-600 text-xs">
                          {isExpanded ? '收起' : '展开'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-neutral-50">
                        <td colSpan={9} className="py-4 px-6">
                          <div className="space-y-3">
                            {trade.reason && (
                              <div className="p-3 bg-white rounded border border-neutral-200">
                                <p className="text-xs text-neutral-500 mb-1">决策理由</p>
                                <p className="text-sm">{trade.reason}</p>
                              </div>
                            )}
                            {news && <SourceCard sourceInfo={news} />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-12 text-neutral-400">
                  暂无交易记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-200">
        <h4 className="font-serif font-semibold mb-3">最终持仓</h4>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left py-2 px-2 font-medium text-neutral-500">标的</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-500">持仓</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-500">成本</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-500">现价</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-500">市值</th>
                <th className="text-right py-2 px-2 font-medium text-neutral-500">盈亏</th>
              </tr>
            </thead>
            <tbody>
              {record.finalPositions.length > 0 ? (
                record.finalPositions.map((pos) => (
                  <tr key={pos.symbol} className="border-b border-neutral-100">
                    <td className="py-2 px-2">
                      <span className="font-medium">{pos.name}</span>
                      <span className="text-xs text-neutral-400 ml-2 font-mono">{pos.symbol}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{pos.quantity.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-mono text-neutral-500">{formatCurrency(pos.avgCost)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(pos.currentPrice)}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatCurrency(pos.marketValue)}</td>
                    <td className={`py-2 px-2 text-right font-mono font-medium ${getReturnColor(pos.profitLossPercent)}`}>
                      {formatCurrency(pos.profitLoss)} ({formatPercent(pos.profitLossPercent)})
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-neutral-400">
                    无持仓
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
