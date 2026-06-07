import { Summary } from '@/types';
import { getMetricLabel } from '@/utils/summaryGenerator';
import { FileText, Clock, Tag } from 'lucide-react';

interface SummaryViewProps {
  summary: Summary;
  isLatest?: boolean;
}

export const SummaryView = ({ summary, isLatest = false }: SummaryViewProps) => {
  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden ${isLatest ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
      <div className={`p-4 border-b ${isLatest ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isLatest ? 'bg-blue-500' : 'bg-gray-400'}`}>
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4
                className="font-semibold text-gray-900"
                style={{ fontFamily: "'Source Serif Pro', serif" }}
              >
                可解释摘要 v{summary.version}
              </h4>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(summary.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          {isLatest && (
            <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
              最新版本
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <p className="text-gray-700 leading-relaxed mb-5">{summary.content}</p>

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">关键指标</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(summary.metrics).map(([key, value]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{getMetricLabel(key)}</p>
                <p className="text-lg font-bold text-gray-900">{value.toFixed(4)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
