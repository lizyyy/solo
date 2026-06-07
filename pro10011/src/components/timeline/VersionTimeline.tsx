import { Clock, User, FileText } from 'lucide-react';
import type { ValuationVersion } from '../../types';
import { formatDate, formatCurrency } from '../../utils/fileParser';

interface VersionTimelineProps {
  versions: ValuationVersion[];
}

export const VersionTimeline = ({ versions }: VersionTimelineProps) => {
  const sortedVersions = [...versions].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="relative">
      {sortedVersions.map((version, index) => {
        const isLatest = index === sortedVersions.length - 1;
        
        return (
          <div key={version.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isLatest 
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                  : 'bg-gray-100 text-gray-500'
              }`}>
                <FileText size={14} />
              </div>
              {index < sortedVersions.length - 1 && (
                <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
              )}
            </div>
            
            <div className={`flex-1 pb-2 ${
              isLatest ? 'bg-blue-50 border border-blue-200 p-3 rounded-sm -ml-2' : ''
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${
                    isLatest ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {version.version}
                  </span>
                  {isLatest && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm">
                      当前版本
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  {formatDate(version.createdAt)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <p className="text-xs text-gray-500">估值金额</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">
                    {formatCurrency(version.valuation)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">操作人</p>
                  <div className="flex items-center gap-1">
                    <User size={12} className="text-gray-400" />
                    <p className="text-sm text-gray-900">{version.operator}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-2 rounded-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">版本说明</p>
                <p className="text-sm text-gray-700">{version.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
