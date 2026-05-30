import { useState } from 'react';
import type { ValuationRecord } from '../../types';
import { useValuationStore } from '../../store/useValuationStore';
import { StatusTag } from '../common/StatusTag';
import { AnomalyBadge } from '../common/AnomalyBadge';
import { formatCurrency, formatDate, getFundName, getFundCode } from '../../utils/formatters';
import { getAvailableOperations, getStatusColors } from '../../utils/statusFlow';
import { SUBMIT_TYPE_LABELS } from '../../types';
import { Edit3, Clock, AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

interface RecordCardProps {
  record: ValuationRecord;
  index: number;
}

export function RecordCard({ record, index }: RecordCardProps) {
  const {
    funds,
    transitionStatus,
    getLogsForValuation,
    getSharesForValuation,
    getAssetsForValuation,
  } = useValuationStore(useShallow((state) => ({
    funds: state.funds,
    transitionStatus: state.transitionStatus,
    getLogsForValuation: state.getLogsForValuation,
    getSharesForValuation: state.getSharesForValuation,
    getAssetsForValuation: state.getAssetsForValuation,
  })));
  
  const [expanded, setExpanded] = useState(false);
  const operations = getAvailableOperations(record.status);
  const colors = getStatusColors(record.status);
  
  const fundName = getFundName(record.fundId, funds);
  const fundCode = getFundCode(record.fundId, funds);
  const logs = getLogsForValuation(record.valuationId);
  const shares = getSharesForValuation(record.valuationId);
  const assets = getAssetsForValuation(record.valuationId);
  
  const delay = 50 + (index % 10) * 30;
  
  const handleOperation = (targetStatus: any) => {
    const remark = prompt('请输入备注（可选）:') || '';
    transitionStatus(record.valuationId, targetStatus, remark);
  };
  
  return (
    <div
      className={`bg-white rounded-xl border-2 ${colors.border} overflow-hidden card-hover opacity-0 animate-fade-in-up [animation-fill-mode:forwards]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-800">{fundCode}</span>
              <StatusTag status={record.status} size="sm" />
              {record.anomalies.length > 0 && (
                <AnomalyBadge anomalies={record.anomalies} size="sm" />
              )}
            </div>
            <p className="text-xs text-slate-500 truncate" title={fundName}>{fundName}</p>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div>
            <span className="text-slate-500">估值日期:</span>
            <span className="ml-1 font-mono text-slate-700">{formatDate(record.valuationDate)}</span>
          </div>
          <div>
            <span className="text-slate-500">版本:</span>
            <span className="ml-1 font-mono text-slate-700">{record.valuationVersion}</span>
          </div>
          <div>
            <span className="text-slate-500">类型:</span>
            <span className={`ml-1 ${
              record.submitType === 'normal' ? 'text-slate-600' :
              record.submitType === 'supplement' ? 'text-sky-600' :
              record.submitType === 'withdraw' ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {SUBMIT_TYPE_LABELS[record.submitType]}
            </span>
          </div>
          <div>
            <span className="text-slate-500">单位净值:</span>
            <span className="ml-1 font-mono text-slate-700">
              {record.unitNetValue > 0 ? record.unitNetValue.toFixed(4) : '-'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-slate-500">正常:</span>
              <span className="ml-1 font-mono text-sky-600 font-medium">
                ¥{formatCurrency(record.normalValue / 10000, 0)}万
              </span>
            </div>
            <div>
              <span className="text-slate-500">侧袋:</span>
              <span className="ml-1 font-mono text-amber-600 font-medium">
                ¥{formatCurrency(record.sidePocketValue / 10000, 0)}万
              </span>
            </div>
          </div>
          <div className="font-mono text-sm font-bold text-slate-800">
            ¥{formatCurrency(record.totalValue / 10000, 0)}万
          </div>
        </div>
        
        {record.remark && (
          <div className="mt-3 p-2 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{record.remark}</span>
            </div>
          </div>
        )}
      </div>
      
      {expanded && (
        <div className="border-t border-slate-100 p-4 animate-fade-in">
          <div className="space-y-3">
            {shares.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  份额信息
                </h5>
                <div className="space-y-1.5">
                  {shares.map(share => (
                    <div key={share.shareId} className="flex justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                      <span className="text-slate-500">{share.version}</span>
                      <span className="font-mono text-slate-700">
                        正常 {formatCurrency(share.normalShares / 10000, 0)}万 + 
                        侧袋 {formatCurrency(share.sidePocketShares / 10000, 0)}万
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {assets.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  侧袋资产
                </h5>
                <div className="space-y-1.5">
                  {assets.slice(0, 2).map(asset => (
                    <div key={asset.assetId} className="flex justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                      <span className="text-slate-500 truncate max-w-[120px]">{asset.assetName}</span>
                      <span className="font-mono text-slate-700">
                        ¥{formatCurrency(asset.assetAmount / 10000, 0)}万
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {logs.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  最近操作
                </h5>
                <div className="space-y-1.5">
                  {logs.slice(0, 2).map(log => (
                    <div key={log.logId} className="flex justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                      <span className="text-slate-600">{log.operation}</span>
                      <span className="text-slate-400">{log.operateTime.slice(5, 16)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {operations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                {operations.map((op) => (
                  <button
                    key={op.action}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOperation(op.target);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors btn-click ${
                      op.target === 'processed'
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : op.target === 'returned'
                        ? 'bg-rose-500 text-white hover:bg-rose-600'
                        : 'bg-sky-500 text-white hover:bg-sky-600'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
