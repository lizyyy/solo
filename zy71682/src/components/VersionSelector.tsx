import { Clock, GitCompare, X } from 'lucide-react';
import type { VersionRecord } from '@/types';
import { formatDateTimeForDisplay } from '@/utils/helpers';

interface VersionSelectorProps {
  versions: VersionRecord[];
  selectedVersion: number | null;
  onSelectVersion: (version: number | null) => void;
  onCompare?: (v1: number, v2: number) => void;
}

export function VersionSelector({
  versions,
  selectedVersion,
  onSelectVersion,
  onCompare
}: VersionSelectorProps) {
  if (versions.length === 0) {
    return (
      <div className="text-sm text-base-500 font-mono">
        暂无版本记录
      </div>
    );
  }

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-display font-bold uppercase tracking-wider">
          <Clock className="w-4 h-4" />
          版本历史
        </div>
        {selectedVersion !== null && (
          <button
            onClick={() => onSelectVersion(null)}
            className="text-xs font-mono text-base-500 hover:text-white flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            退出历史查看
          </button>
        )}
      </div>
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-base-700" />
        <div className="space-y-3">
          {sortedVersions.map((version, index) => {
            const isLatest = index === 0;
            const isSelected = selectedVersion === version.versionNumber;
            
            return (
              <div key={version.id} className="relative pl-8">
                <div
                  className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center
                    ${isSelected 
                      ? 'bg-neon-purple border-neon-purple' 
                      : isLatest 
                        ? 'bg-neon-green border-neon-green' 
                        : 'bg-base-800 border-base-600'
                    }`}
                >
                  <span className={`text-[10px] font-bold ${isSelected || isLatest ? 'text-black' : 'text-base-500'}`}>
                    {version.versionNumber}
                  </span>
                </div>
                <button
                  onClick={() => onSelectVersion(isSelected ? null : version.versionNumber)}
                  className={`w-full text-left p-2 border transition-colors
                    ${isSelected 
                      ? 'border-neon-purple bg-neon-purple bg-opacity-10' 
                      : 'border-transparent hover:border-base-600 hover:bg-base-800'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm font-bold">
                        v{version.versionNumber}
                      </span>
                      {isLatest && (
                        <span className="ml-2 text-xs font-mono text-neon-green">
                          当前版本
                        </span>
                      )}
                    </div>
                    {onCompare && !isLatest && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompare(version.versionNumber, sortedVersions[0].versionNumber);
                        }}
                        className="p-1 hover:bg-base-700 text-base-500 hover:text-white"
                        title="与当前版本对比"
                      >
                        <GitCompare className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-mono text-base-500 mt-1">
                    {version.changeSummary}
                  </p>
                  <p className="text-[10px] font-mono text-base-600 mt-1">
                    {formatDateTimeForDisplay(version.createdAt)}
                    {version.createdBy && ` · ${version.createdBy}`}
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
