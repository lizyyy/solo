import { useAppStore } from '@/store/useAppStore';
import { parameterTypeLabels } from '@/types';
import { StatusBadge } from '@/components/common/Badges';
import DriftAlert from '@/components/common/DriftAlert';
import CleaningPipeline from '@/components/charts/CleaningPipeline';
import { X, MapPin, Ship, Calendar, Clock, FileText } from 'lucide-react';

interface RecordDetailProps {
  onClose?: () => void;
}

export default function RecordDetail({ onClose }: RecordDetailProps) {
  const record = useAppStore((state) => 
    state.records.find((r) => r.id === state.selectedRecordId)
  );
  const handleDriftSuspend = useAppStore((state) => state.handleDriftSuspend);
  const handleDriftRelease = useAppStore((state) => state.handleDriftRelease);

  if (!record) {
    return (
      <div className="h-full flex items-center justify-center text-ocean-500">
        <p>请选择一条记录查看详情</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-ocean-700">
        <h3 className="text-lg font-semibold text-white">记录详情</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-ocean-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-ocean-400" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="paper-texture tape-corner rounded-lg p-5 relative transform rotate-[-0.5deg] shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-amber-800/70 font-mono">
              {record.recordNo}
            </span>
            <span className="text-xs text-amber-800/50">
              船上记录本
            </span>
          </div>
          
          <p className="text-amber-900 leading-relaxed handwriting text-base">
            {record.originalNote}
          </p>
          
          <div className="mt-3 pt-3 border-t border-amber-300/50">
            <div className="flex items-center gap-4 text-xs text-amber-800/70">
              <span className="flex items-center gap-1">
                <Ship className="w-3 h-3" />
                {record.shipName}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {record.location}
              </span>
            </div>
          </div>
        </div>

        {record.hasSupplementaryNote && (
          <div className="bg-nautical-warning/10 border border-nautical-warning/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-nautical-warning/20 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-nautical-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-nautical-warning mb-1">
                  后补备注（现场毛边）
                </p>
                <p className="text-sm text-ocean-200">
                  {record.supplementaryNote}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-ocean-800/50 rounded-lg p-3 border border-ocean-700">
            <p className="text-xs text-ocean-500 mb-1">参数类型</p>
            <p className="text-white font-medium">{parameterTypeLabels[record.parameterType]}</p>
          </div>
          <div className="bg-ocean-800/50 rounded-lg p-3 border border-ocean-700">
            <p className="text-xs text-ocean-500 mb-1">当前状态</p>
            <StatusBadge status={record.status} size="sm" />
          </div>
          <div className="bg-ocean-800/50 rounded-lg p-3 border border-ocean-700">
            <p className="text-xs text-ocean-500 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              测量日期
            </p>
            <p className="text-white font-mono">{record.measureDate}</p>
          </div>
          <div className="bg-ocean-800/50 rounded-lg p-3 border border-ocean-700">
            <p className="text-xs text-ocean-500 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />
              测量时间
            </p>
            <p className="text-white font-mono">{record.measureTime}</p>
          </div>
        </div>

        <div className="bg-ocean-800/50 rounded-lg p-4 border border-ocean-700">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm text-ocean-400">原始数值</span>
            <span className="text-xl font-mono text-ocean-300 line-through">
              {record.rawValue.toFixed(2)}
              <span className="text-sm ml-1 text-ocean-500">{record.unit}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ocean-400">清洗结果</span>
            <span className="text-2xl font-bold font-mono text-white">
              {record.cleanedValue.toFixed(2)}
              <span className="text-sm ml-1 text-ocean-400 font-normal">{record.unit}</span>
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-ocean-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ocean-500">数据偏差</span>
              <span className={`font-mono ${
                record.rawValue - record.cleanedValue > 0 ? 'text-nautical-success' : 'text-nautical-danger'
              }`}>
                {(record.rawValue - record.cleanedValue).toFixed(2)} ({(((record.rawValue - record.cleanedValue) / record.rawValue) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {record.hasDrift && (
          <DriftAlert
            driftAmount={record.driftAmount}
            unit={record.unit}
            parameterName={parameterTypeLabels[record.parameterType]}
            onSuspend={() => {
              const confirmed = window.confirm(
                `确认将 ${record.recordNo} 挂起待补？\n\n该操作将：\n• 记录状态变更为"待补件"\n• 自动添加缺失证据项\n• 写入处置决策到时间线`
              );
              if (confirmed) {
                handleDriftSuspend(
                  record.id,
                  `检测到${parameterTypeLabels[record.parameterType]}传感器漂移 ${record.driftAmount.toFixed(2)} ${record.unit}，需现场重测确认`
                );
              }
            }}
            onRelease={() => {
              const confirmed = window.confirm(
                `确认将 ${record.recordNo} 校正放行？\n\n该操作将：\n• 记录状态变更为"已确认"\n• 清除缺失证据标记\n• 写入处置决策到时间线`
              );
              if (confirmed) {
                handleDriftRelease(
                  record.id,
                  `${parameterTypeLabels[record.parameterType]}漂移量 ${record.driftAmount.toFixed(2)} ${record.unit} 在可接受范围内，校正后放行`
                );
              }
            }}
          />
        )}

        <CleaningPipeline steps={record.cleaningSteps} showAnimation={false} />

        {record.missingEvidence.length > 0 && (
          <div className="bg-nautical-danger/10 border border-nautical-danger/30 rounded-lg p-4">
            <p className="text-sm font-medium text-nautical-danger mb-2">
              缺失证据清单
            </p>
            <ul className="space-y-1">
              {record.missingEvidence.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-ocean-200">
                  <span className="w-1.5 h-1.5 bg-nautical-danger rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
