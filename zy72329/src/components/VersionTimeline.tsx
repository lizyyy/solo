import { GitBranch, User, Clock, CheckCircle, AlertTriangle, PlusCircle, XCircle, ArrowLeftRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store';
import { ParamVersion } from '../../shared/types';

interface VersionTimelineProps {
  versions?: ParamVersion[];
  onCompare?: (v1: string, v2: string) => void;
}

const statusColors = {
  smooth: 'bg-green-100 text-green-700',
  gap: 'bg-orange-100 text-orange-700',
  supplement: 'bg-purple-100 text-purple-700',
  conflict: 'bg-red-100 text-red-700',
};

const statusLabels = {
  smooth: '正常',
  gap: '断档',
  supplement: '补录',
  conflict: '冲突',
};

const statusIcons = {
  smooth: CheckCircle,
  gap: AlertTriangle,
  supplement: PlusCircle,
  conflict: XCircle,
};

export default function VersionTimeline({ versions: propVersions, onCompare }: VersionTimelineProps) {
  const { versions: storeVersions, compareVersions, setCompareVersion } = useAppStore();
  const versions = propVersions || storeVersions;

  const handleSelectCompare = (index: 0 | 1, versionId: string) => {
    if (compareVersions[index] === versionId) {
      setCompareVersion(index, null);
    } else {
      setCompareVersion(index, versionId);
    }
  };

  const handleCompare = () => {
    if (compareVersions[0] && compareVersions[1] && onCompare) {
      onCompare(compareVersions[0], compareVersions[1]);
    }
  };

  return (
    <div className="relative">
      {(compareVersions[0] || compareVersions[1]) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800">
              已选择版本进行对比
            </span>
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                compareVersions[0] ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {compareVersions[0]
                  ? versions.find(v => v.id === compareVersions[0])?.version || '版本 1'
                  : '未选择'}
              </span>
              <span className="text-gray-400">VS</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                compareVersions[1] ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {compareVersions[1]
                  ? versions.find(v => v.id === compareVersions[1])?.version || '版本 2'
                  : '未选择'}
              </span>
            </div>
          </div>
          <button
            onClick={handleCompare}
            disabled={!compareVersions[0] || !compareVersions[1]}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              compareVersions[0] && compareVersions[1]
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            )}
          >
            开始对比
          </button>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-gray-200" />

        <div className="space-y-6">
          {versions.map((version, index) => {
            const isSelected0 = compareVersions[0] === version.id;
            const isSelected1 = compareVersions[1] === version.id;
            const isLatest = index === 0;

            return (
              <div key={version.id} className="relative flex gap-4 pl-4">
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      isLatest ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600',
                      (isSelected0 || isSelected1) && 'ring-4 ring-blue-200'
                    )}
                  >
                    <GitBranch className="w-5 h-5" />
                  </div>
                  {isLatest && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">新</span>
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    'flex-1 bg-white rounded-xl border p-4 transition-all',
                    isSelected0 && 'border-blue-500 ring-2 ring-blue-200',
                    isSelected1 && 'border-green-500 ring-2 ring-green-200',
                    !isSelected0 && !isSelected1 && 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">
                          v{version.version}
                        </span>
                        {isLatest && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            当前版本
                          </span>
                        )}
                        {isSelected0 && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded-full">
                            对比版本 1
                          </span>
                        )}
                        {isSelected1 && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full">
                            对比版本 2
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {version.createdAt}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {version.operator}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectCompare(0, version.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          isSelected0
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {isSelected0 ? '已选 V1' : '选为 V1'}
                      </button>
                      <button
                        onClick={() => handleSelectCompare(1, version.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          isSelected1
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {isSelected1 ? '已选 V2' : '选为 V2'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-800">变更摘要：</span>
                      {version.changeSummary}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(['smooth', 'gap', 'supplement', 'conflict'] as const).map((key) => {
                      const Icon = statusIcons[key];
                      return (
                        <div
                          key={key}
                          className={cn(
                            'flex items-center justify-between p-2 rounded-lg',
                            statusColors[key]
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">{statusLabels[key]}</span>
                          </div>
                          <span className="font-mono font-semibold">
                            {version.recordCount[key]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
