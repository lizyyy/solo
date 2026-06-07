import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';
import { StatusBadge, TypeBadge } from './StatusBadge';
import type { CheckRecord } from '@/types';

interface RecordCardProps {
  record: CheckRecord;
}

export function RecordCard({ record }: RecordCardProps) {
  const navigate = useNavigate();

  const stepLabels = record.steps.map((s) => s.label);
  const currentStepIndex = record.steps.findIndex((s) => s.status === 'current' || s.status === 'blocked');

  return (
    <div
      onClick={() => navigate(`/record/${record.id}`)}
      className="bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex">
        <div
          className={`w-1 flex-shrink-0 ${
            record.status === 'completed'
              ? 'bg-slate-600'
              : record.status === 'conflict'
              ? 'bg-red-600'
              : record.status === 'pending_review'
              ? 'bg-amber-600'
              : 'bg-emerald-600'
          }`}
        />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 font-serif truncate">{record.title}</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">批次: {record.batchId}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors flex-shrink-0" />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <StatusBadge status={record.status} />
            <TypeBadge type={record.type} />
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>审核进度</span>
            </div>
            <div className="flex items-center gap-1">
              {stepLabels.map((label, index) => (
                <div key={label} className="flex items-center flex-1">
                  <div
                    className={`flex-1 h-1.5 ${
                      index < currentStepIndex
                        ? 'bg-emerald-500'
                        : index === currentStepIndex
                        ? 'bg-teal-500'
                        : 'bg-slate-200'
                    }`}
                  />
                  {index < stepLabels.length - 1 && <div className="w-1 h-1.5" />}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              当前步骤: {stepLabels[currentStepIndex] || '已完成'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>特征: {record.featureName}</span>
            <span>更新: {record.updateTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
