import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { type ValuationRecord } from '../../types';
import { useValuationStore } from '../../store/useValuationStore';
import { StatusTag } from '../common/StatusTag';
import { AnomalyBadge } from '../common/AnomalyBadge';
import { formatCurrency, formatDate, formatDateTime, getFundName, getFundCode } from '../../utils/formatters';
import { SUBMIT_TYPE_LABELS } from '../../types';
import { getAvailableOperations } from '../../utils/statusFlow';
import { useShallow } from 'zustand/react/shallow';

interface TableRowProps {
  record: ValuationRecord;
  index: number;
}

export function TableRow({ record, index }: TableRowProps) {
  const {
    funds,
    expandedRows,
    toggleRowExpanded,
    getLogsForValuation,
    getSharesForValuation,
    getAssetsForValuation,
    transitionStatus,
  } = useValuationStore(useShallow((state) => ({
    funds: state.funds,
    expandedRows: state.expandedRows,
    toggleRowExpanded: state.toggleRowExpanded,
    getLogsForValuation: state.getLogsForValuation,
    getSharesForValuation: state.getSharesForValuation,
    getAssetsForValuation: state.getAssetsForValuation,
    transitionStatus: state.transitionStatus,
  })));

  const isExpanded = expandedRows.has(record.valuationId);
  const hasAnomaly = record.anomalies.length > 0;
  const operations = getAvailableOperations(record.status);

  const fundName = getFundName(record.fundId, funds);
  const fundCode = getFundCode(record.fundId, funds);
  const shares = getSharesForValuation(record.valuationId);
  const assets = getAssetsForValuation(record.valuationId);
  const logs = getLogsForValuation(record.valuationId);

  const rowBg = hasAnomaly ? 'bg-rose-50/50' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
  const delay = 50 + (index % 10) * 20;

  const handleStatusChange = (targetStatus: any) => {
    const remark = prompt('请输入备注（可选）:') || '';
    transitionStatus(record.valuationId, targetStatus, remark);
  };

  return (
    <>
      <tr
        className={`${rowBg} hover:bg-sky-50/70 transition-colors cursor-pointer opacity-0 animate-fade-in [animation-fill-mode:forwards]`}
        style={{ animationDelay: `${delay}ms` }}
        onClick={() => toggleRowExpanded(record.valuationId)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-slate-800">{fundCode}</div>
          <div className="text-xs text-slate-500 truncate max-w-[180px]" title={fundName}>{fundName}</div>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(record.valuationDate)}</td>
        <td className="px-4 py-3 text-right font-mono text-sm text-slate-800">
          {formatCurrency(record.normalValue)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-amber-600">
          {formatCurrency(record.sidePocketValue)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-slate-800">
          {formatCurrency(record.totalValue)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
          {record.unitNetValue > 0 ? formatCurrency(record.unitNetValue, 4) : '-'}
        </td>
        <td className="px-4 py-3">
          <StatusTag status={record.status} size="sm" />
        </td>
        <td className="px-4 py-3">
          <AnomalyBadge anomalies={record.anomalies} size="sm" />
        </td>
        <td className="px-4 py-3">
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {record.valuationVersion}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={`text-xs ${
              record.submitType === 'normal'
                ? 'text-slate-600'
                : record.submitType === 'supplement'
                ? 'text-sky-600'
                : record.submitType === 'withdraw'
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {SUBMIT_TYPE_LABELS[record.submitType]}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {formatDateTime(record.updatedAt)}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-slate-50">
          <td colSpan={12} className="px-4 py-4">
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">份额信息</h4>
                  <div className="space-y-2">
                    {shares.length > 0 ? (
                      shares.map((share, idx) => (
                        <div key={share.shareId} className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">版本:</span>
                            <span className="font-mono text-slate-700">{share.version}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">正常份额:</span>
                            <span className="font-mono text-slate-700">{formatCurrency(share.normalShares)}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">侧袋份额:</span>
                            <span className="font-mono text-amber-600">{formatCurrency(share.sidePocketShares)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">合计:</span>
                            <span className="font-mono font-semibold text-slate-800">{formatCurrency(share.totalShares)}</span>
                          </div>
                          <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-100">
                            <span className="text-slate-500">拆分状态:</span>
                            <span
                              className={`font-medium ${
                                share.splitStatus === 'normal'
                                  ? 'text-emerald-600'
                                  : share.splitStatus === 'error'
                                  ? 'text-rose-600'
                                  : 'text-sky-600'
                              }`}
                            >
                              {share.splitStatus === 'normal'
                                ? '正常'
                                : share.splitStatus === 'error'
                                ? '错误'
                                : '已更正'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">暂无份额数据</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">侧袋资产</h4>
                  <div className="space-y-2">
                    {assets.length > 0 ? (
                      assets.map((asset) => (
                        <div key={asset.assetId} className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="text-xs text-slate-800 font-medium mb-1">{asset.assetName}</div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">金额:</span>
                            <span className="font-mono text-slate-700">¥{formatCurrency(asset.assetAmount)}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">限制期:</span>
                            <span className="font-mono text-slate-700">
                              {formatDate(asset.lockStartDate)} ~ {formatDate(asset.lockEndDate)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">限制状态:</span>
                            <span className={`font-medium ${asset.isLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {asset.isLocked ? '已锁定' : '未锁定'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">暂无侧袋资产数据</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">操作历史</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {logs.length > 0 ? (
                      logs.map((log) => (
                        <div key={log.logId} className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-medium text-slate-700">{log.operation}</span>
                            <span className="text-xs text-slate-400">{log.operator}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs mb-1">
                            {log.fromStatus && (
                              <>
                                <StatusTag status={log.fromStatus} size="sm" showDot={false} />
                                <span className="text-slate-300">→</span>
                              </>
                            )}
                            <StatusTag status={log.toStatus} size="sm" showDot={false} />
                          </div>
                          {log.remark && (
                            <div className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-100">
                              {log.remark}
                            </div>
                          )}
                          <div className="text-xs text-slate-400 mt-1">{log.operateTime}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400">暂无操作记录</div>
                    )}
                  </div>

                  {record.remark && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">备注</h4>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                        {record.remark}
                      </div>
                    </div>
                  )}

                  {operations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">可用操作</h4>
                      <div className="flex gap-2">
                        {operations.map((op) => (
                          <button
                            key={op.action}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(op.target);
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors btn-click ${
                              op.target === 'processed'
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : op.target === 'returned'
                                ? 'bg-rose-500 text-white hover:bg-rose-600'
                                : 'bg-sky-500 text-white hover:bg-sky-600'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <Edit3 className="w-3 h-3" />
                              {op.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
