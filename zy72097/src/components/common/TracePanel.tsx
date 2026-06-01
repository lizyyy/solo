import React from 'react';
import { X, Clock, User, FileText, GitBranch, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import type { ProcessedData, FittingPoint } from '../../types';
import StatusBadge from './StatusBadge';
import { formatDateTime, formatNumber, formatProcessType } from '../../utils/format';
import { useDataStore } from '../../store/dataStore';

interface TracePanelProps {
  data: ProcessedData;
  fittingPoint?: FittingPoint;
  onClose: () => void;
  onConfirm?: (status: 'confirmed' | 'normal') => void;
}

const TracePanel: React.FC<TracePanelProps> = ({ data, fittingPoint, onClose, onConfirm }) => {
  const { boundaryStatus } = useDataStore();
  
  const isOutOfBounds = boundaryStatus?.outOfBounds.some(b => b.includes(data.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-engineering-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white shadow-2xl animate-slide-in-right overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-engineering-800 text-white">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="font-serif-cn font-semibold text-lg">数据溯源明细</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-engineering transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-engineering-500 text-sm">记录编号</span>
                <p className="font-mono-num font-semibold text-engineering-800">{data.id}</p>
              </div>
              <StatusBadge status={data.status} />
            </div>

            <div className="card">
              <div className="card-header flex items-center gap-2">
                <FileText className="w-4 h-4" />
                原始数据
              </div>
              <div className="card-body space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-engineering-500">材料牌号</span>
                    <p className="font-medium text-engineering-800">{data.material}</p>
                  </div>
                  <div>
                    <span className="text-engineering-500">试验日期</span>
                    <p className="font-medium text-engineering-800">{data.testDate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 rounded-engineering ${data.stressUnit !== data.targetStressUnit ? 'bg-warning-50 border border-warning-200' : 'bg-engineering-50'}`}>
                    <span className="text-engineering-500 text-xs">原始应力</span>
                    <p className="font-mono-num font-semibold text-engineering-800">
                      {formatNumber(data.stress)} {data.stressUnit}
                    </p>
                    {data.stressUnit !== data.targetStressUnit && (
                      <p className="text-xs text-warning-700 flex items-center gap-1 mt-1">
                        <ArrowRight className="w-3 h-3" />
                        已换算为 {formatNumber(data.stressConverted)} {data.targetStressUnit}
                      </p>
                    )}
                  </div>
                  <div className={`p-2 rounded-engineering ${data.lifeUnit !== data.targetLifeUnit ? 'bg-warning-50 border border-warning-200' : 'bg-engineering-50'}`}>
                    <span className="text-engineering-500 text-xs">原始寿命</span>
                    <p className="font-mono-num font-semibold text-engineering-800">
                      {formatNumber(data.life)} {data.lifeUnit}
                    </p>
                    {data.lifeUnit !== data.targetLifeUnit && (
                      <p className="text-xs text-warning-700 flex items-center gap-1 mt-1">
                        <ArrowRight className="w-3 h-3" />
                        已换算为 {formatNumber(data.lifeConverted)} {data.targetLifeUnit}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-engineering-500">数据来源</span>
                  <p className="font-medium text-engineering-800">{data.source}</p>
                </div>
                {data.remark && (
                  <div className="p-2 bg-historical-50 border border-historical-200 rounded-engineering">
                    <span className="text-historical-600 text-xs">原始备注</span>
                    <p className="font-medium text-historical-800 text-sm mt-0.5">{data.remark}</p>
                  </div>
                )}
                <div className="text-xs text-engineering-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  导入时间：{formatDateTime(data.importedAt)}
                </div>
              </div>
            </div>

            {fittingPoint && (
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  拟合结果
                </div>
                <div className="card-body space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-engineering-50 rounded-engineering">
                      <span className="text-engineering-500 text-xs">实测寿命</span>
                      <p className="font-mono-num font-semibold text-engineering-800">
                        {formatNumber(fittingPoint.life)}
                      </p>
                    </div>
                    <div className="p-2 bg-engineering-50 rounded-engineering">
                      <span className="text-engineering-500 text-xs">预测寿命</span>
                      <p className="font-mono-num font-semibold text-engineering-800">
                        {formatNumber(fittingPoint.predictedLife)}
                      </p>
                    </div>
                  </div>
                  <div className={`p-2 rounded-engineering ${Math.abs(fittingPoint.residual) > fittingPoint.life * 0.2 ? 'bg-danger-50 border border-danger-200' : 'bg-success-50 border border-success-200'}`}>
                    <span className={`text-xs ${Math.abs(fittingPoint.residual) > fittingPoint.life * 0.2 ? 'text-danger-600' : 'text-success-600'}`}>
                      残差
                    </span>
                    <p className={`font-mono-num font-semibold ${Math.abs(fittingPoint.residual) > fittingPoint.life * 0.2 ? 'text-danger-800' : 'text-success-800'}`}>
                      {formatNumber(fittingPoint.residual)}
                      <span className="text-xs ml-1">
                        ({((fittingPoint.residual / fittingPoint.life) * 100).toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isOutOfBounds && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-engineering flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-danger-800 text-sm">边界阈值警告</p>
                  <p className="text-danger-700 text-xs mt-0.5">
                    {boundaryStatus?.outOfBounds.find(b => b.includes(data.id))}
                  </p>
                </div>
              </div>
            )}

            {data.processHistory.length > 0 && (
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  处理过程
                </div>
                <div className="card-body">
                  <div className="relative pl-4 space-y-4">
                    <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-engineering-200" />
                    {data.processHistory.map((record, idx) => (
                      <div key={record.id} className="relative">
                        <div className="absolute -left-4 w-3 h-3 rounded-full bg-engineering-400 border-2 border-white" />
                        <div className="bg-engineering-50 p-3 rounded-engineering">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 bg-engineering-200 text-engineering-700 rounded-full">
                              {formatProcessType(record.processType)}
                            </span>
                            <span className="text-xs text-engineering-500">
                              {record.operator === 'system' ? '系统' : '人工'}
                            </span>
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2 text-engineering-600">
                              <span className="font-mono-num">{record.originalValue}</span>
                              <ArrowRight className="w-3 h-3" />
                              <span className="font-mono-num font-medium text-engineering-800">{record.processedValue}</span>
                            </div>
                            <p className="text-xs text-engineering-500">{record.reason}</p>
                            <p className="text-xs text-engineering-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(record.operatedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {data.judgment.length > 0 && (
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  判定记录
                </div>
                <div className="card-body space-y-3">
                  {data.judgment.map((judge, idx) => (
                    <div key={judge.id} className="border-b border-engineering-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <StatusBadge status={judge.status} size="sm" />
                        <span className="text-xs text-engineering-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {judge.judge}
                        </span>
                      </div>
                      <p className="text-sm text-engineering-800 font-medium">{judge.judgment}</p>
                      <p className="text-xs text-engineering-500 mt-1">
                        <span className="font-medium">判定依据：</span>{judge.evidence}
                      </p>
                      <p className="text-xs text-engineering-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(judge.judgedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {data.status === 'pending' && onConfirm && (
          <div className="p-4 border-t border-engineering-200 bg-engineering-50">
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm('confirmed')}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                确认无误
              </button>
              <button
                onClick={() => onConfirm('normal')}
                className="btn-secondary flex-1"
              >
                标记正常
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TracePanel;
