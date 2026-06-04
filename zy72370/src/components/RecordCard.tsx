import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Gauge,
  Ruler,
  Clock,
  User,
  Tag,
  AlertOctagon,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { RecordData, RecordType } from '../types';

const typeConfig: Record<
  RecordType,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: typeof CheckCircle;
    label: string;
  }
> = {
  smooth: {
    color: 'text-[#27ae60]',
    bgColor: 'bg-[#27ae60]/5',
    borderColor: 'border-[#27ae60]',
    icon: CheckCircle,
    label: '顺利记录',
  },
  overwritten: {
    color: 'text-[#e67e22]',
    bgColor: 'bg-[#e67e22]/5',
    borderColor: 'border-[#e67e22]',
    icon: AlertTriangle,
    label: '超阈值被平均值盖掉',
  },
  supplemented: {
    color: 'text-[#8e44ad]',
    bgColor: 'bg-[#8e44ad]/5',
    borderColor: 'border-[#8e44ad]',
    icon: FileText,
    label: '旧口径补录（来自设备铭牌）',
  },
};

const statusLabels: Record<string, { text: string; color: string }> = {
  normal: { text: '正常', color: 'text-[#27ae60]' },
  pending_review: { text: '待维修师傅复核', color: 'text-[#e67e22]' },
  reviewed: { text: '已复核通过', color: 'text-[#27ae60]' },
  rejected: { text: '复核驳回', color: 'text-[#c0392b]' },
};

interface RecordCardProps {
  record: RecordData;
  index: number;
}

export default function RecordCard({ record, index }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[record.type];
  const Icon = config.icon;
  const selectedRecordId = useAppStore((s) => s.selectedRecordId);
  const setSelectedRecordId = useAppStore((s) => s.setSelectedRecordId);
  const isSelected = selectedRecordId === record.id;

  const handleClick = () => {
    setExpanded(!expanded);
    setSelectedRecordId(isSelected ? null : record.id);
  };

  return (
    <div
      className={`
        relative ${config.bgColor} border-2 ${config.borderColor}
        rounded-sm overflow-hidden
        transition-all duration-300 ease-out
        hover:shadow-lg hover:shadow-black/20
        animate-[slideUp_0.5s_ease-out_forwards]
        opacity-0 translate-y-8
        ${isSelected ? 'ring-2 ring-[#5dade2] ring-offset-2 ring-offset-[#0a1929]' : ''}
      `}
      style={{ animationDelay: `${index * 0.15}s` }}
      onClick={handleClick}
    >
      {record.status === 'pending_review' && (
        <div className="absolute top-0 right-0 left-0 bg-[#e67e22] text-white text-xs py-1 px-3 text-center font-bold animate-pulse">
          ⚠️ 待维修师傅复核 - 不得自动归为正常
        </div>
      )}

      <div className={`p-5 ${record.status === 'pending_review' ? 'pt-10' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div
              className={`
                w-12 h-12 rounded-sm ${config.bgColor} border ${config.borderColor}
                flex items-center justify-center
              `}
            >
              <Icon className={`w-6 h-6 ${config.color}`} />
            </div>
            <div>
              <h3 className={`font-bold text-base ${config.color}`}>
                {config.label}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <Tag className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-400 font-mono">
                  {record.id}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-xs text-gray-400">
                  {record.dataSourceLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`
                inline-block px-2 py-1 rounded-sm text-xs font-bold
                ${statusLabels[record.status].color}
                bg-black/30 border border-current/30
              `}
            >
              {statusLabels[record.status].text}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
            <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
              <Gauge className="w-3 h-3" />
              <span>测量速度</span>
            </div>
            <div
              className={`
                font-mono text-xl font-bold
                ${record.isOverThreshold ? 'text-[#c0392b]' : 'text-white'}
              `}
            >
              {record.measuredSpeed.toFixed(1)}
              <span className="text-sm text-gray-500 ml-1">m/s</span>
            </div>
            {record.isOverThreshold && (
              <div className="flex items-center space-x-1 mt-1 text-[#c0392b] text-xs">
                <AlertOctagon className="w-3 h-3" />
                <span>超出阈值</span>
              </div>
            )}
          </div>

          <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
            <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
              <Gauge className="w-3 h-3" />
              <span>平均值</span>
            </div>
            <div className="font-mono text-xl font-bold text-[#5dade2]">
              {record.averageSpeed.toFixed(1)}
              <span className="text-sm text-gray-500 ml-1">m/s</span>
            </div>
            {record.isOverwrittenByAverage && (
              <div className="flex items-center space-x-1 mt-1 text-[#e67e22] text-xs">
                <AlertTriangle className="w-3 h-3" />
                <span>已覆盖原始值</span>
              </div>
            )}
          </div>

          <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
            <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
              <Ruler className="w-3 h-3" />
              <span>口径</span>
            </div>
            <div className="font-mono text-xl font-bold text-white">
              {record.caliber}
            </div>
            <div className="text-xs mt-1">
              <span
                className={`
                  ${record.caliberSource === 'nameplate' ? 'text-[#8e44ad]' : 'text-gray-500'}
                `}
              >
                {record.caliberSource === 'nameplate' ? '来源：设备铭牌' : '来源：测量'}
              </span>
            </div>
          </div>

          <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
            <div className="flex items-center space-x-2 text-gray-400 text-xs mb-1">
              <Gauge className="w-3 h-3" />
              <span>安全阈值</span>
            </div>
            <div className="font-mono text-xl font-bold text-[#f39c12]">
              ≤ {record.thresholdMax.toFixed(1)}
              <span className="text-sm text-gray-500 ml-1">m/s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <Clock className="w-3 h-3" />
            <span>{record.measurementTime}</span>
          </div>
          <button
            className="flex items-center space-x-1 text-[#5dade2] hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <span>{expanded ? '收起详情' : '查看详情'}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#2d5a87] p-5 bg-black/20">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-[#5dade2] mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              计算说明与取舍理由
            </h4>
            <div className="bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50">
              <div className="text-xs text-gray-400 mb-2">
                <span className="text-[#f39c12] font-bold">参数版本：</span>
                {record.calculationNote.parameterVersion}
              </div>
              <div className="text-xs text-gray-400 mb-2">
                <span className="text-[#f39c12] font-bold">计算公式：</span>
                {record.calculationNote.calculationFormula}
              </div>
              <div className="text-xs text-gray-300 bg-[#1e3a5f]/50 p-2 rounded-sm border-l-2 border-[#5dade2]">
                <span className="text-[#5dade2] font-bold">取舍理由：</span>
                {record.calculationNote.tradeOffReason}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#5dade2] mb-2 flex items-center">
              <User className="w-4 h-4 mr-2" />
              处理历史
            </h4>
            <div className="space-y-2">
              {record.processLogs.map((log, idx) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 bg-black/30 rounded-sm p-3 border border-[#2d5a87]/50"
                >
                  <div className="w-6 h-6 rounded-full bg-[#2d5a87] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#5dade2] font-bold">
                        {log.operator}
                      </span>
                      <span className="text-xs text-gray-500">{log.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-300">{log.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {record.reviewNote && (
            <div className="mt-4 bg-[#27ae60]/10 border border-[#27ae60]/30 rounded-sm p-3">
              <div className="flex items-center space-x-2 mb-1">
                <CheckCircle className="w-4 h-4 text-[#27ae60]" />
                <span className="text-xs font-bold text-[#27ae60]">
                  {record.reviewedBy} 复核意见
                </span>
                <span className="text-xs text-gray-500">{record.reviewedAt}</span>
              </div>
              <p className="text-sm text-gray-300">{record.reviewNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
