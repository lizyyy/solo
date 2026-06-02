import { GitBranch, User, Clock, FileText, ChevronRight } from 'lucide-react';
import type { Version } from '@/types';
import { formatDateTime } from '@/utils/storage';

interface VersionTimelineProps {
  versions: Version[];
  selectedVersionId?: string;
  onSelectVersion: (versionId: string) => void;
}

export const VersionTimeline = ({
  versions,
  selectedVersionId,
  onSelectVersion,
}: VersionTimelineProps) => {
  const sortedVersions = [...versions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  );

  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <GitBranch className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>还没有版本记录</p>
        <p className="text-sm">导入数据后会自动生成版本</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
      
      <div className="space-y-4">
        {sortedVersions.map((version, index) => (
          <div
            key={version.id}
            className={`relative pl-10 cursor-pointer group ${
              selectedVersionId === version.id ? '' : ''
            }`}
            onClick={() => onSelectVersion(version.id)}
          >
            <div className={`absolute left-2 w-5 h-5 rounded-full border-4 ${
              index === 0
                ? 'bg-primary-500 border-primary-100'
                : 'bg-white border-gray-300 group-hover:border-primary-300'
            } transition-colors`} />
            
            <div className={`p-4 rounded-xl border transition-all ${
              selectedVersionId === version.id
                ? 'border-primary-300 bg-primary-50'
                : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${
                      index === 0 ? 'text-primary-700' : 'text-gray-700'
                    }`}>
                      {version.versionName}
                    </span>
                    {index === 0 && (
                      <span className="badge bg-primary-100 text-primary-700 text-xs">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {version.recordCount} 条记录
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {version.operator}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(version.createdAt)}
                  </div>
                  {version.changeNote && (
                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {version.changeNote}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
