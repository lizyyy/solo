import { FileText, Calendar, Clock, AlertCircle } from 'lucide-react';
import type { SourceInfo } from '@shared/types';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  inspection: '巡查记录',
  complaint: '投诉记录',
  meeting: '会议纪要',
  old_caliber: '旧口径补入',
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  inspection: 'bg-blue-100 text-blue-700',
  complaint: 'bg-red-100 text-red-700',
  meeting: 'bg-purple-100 text-purple-700',
  old_caliber: 'bg-yellow-100 text-yellow-700',
};

interface SourceTimelineProps {
  sources: SourceInfo[];
  compact?: boolean;
}

export function SourceTimeline({ sources, compact = false }: SourceTimelineProps) {
  if (sources.length === 0) {
    return (
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <AlertCircle className="w-4 h-4" />
        无来源记录
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, idx) => (
          <span
            key={idx}
            className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_TYPE_COLORS[source.type] || 'bg-gray-100 text-gray-700'}`}
            title={`${source.name} - ${source.date}`}
          >
            {SOURCE_TYPE_LABELS[source.type] || source.type}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <FileText className="w-4 h-4" />
        原始来源追溯 ({sources.length} 条)
      </h4>
      <div className="relative pl-4 border-l-2 border-primary-200 space-y-4">
        {sources.map((source, idx) => (
          <div key={idx} className="relative animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
            <div className="absolute -left-[21px] top-0 w-4 h-4 bg-accent-500 rounded-full border-2 border-white shadow-sm" />
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_TYPE_COLORS[source.type] || 'bg-gray-100 text-gray-700'}`}>
                  {SOURCE_TYPE_LABELS[source.type] || source.type}
                </span>
                <span className="text-sm font-medium text-gray-800">{source.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  材料日期：{source.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  导入时间：{new Date(source.importTime).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="text-sm text-gray-600 bg-white p-2 rounded border border-gray-200 font-mono text-xs">
                {source.rawContent}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
