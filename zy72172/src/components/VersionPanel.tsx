import React, { useState } from 'react';
import { PlanVersion } from '../types';

interface VersionPanelProps {
  versions: PlanVersion[];
}

export default function VersionPanel({ versions }: VersionPanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(
    versions.length > 0 ? versions[0].id : null
  );

  const sortedVersions = [...versions].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const selected = versions.find(v => v.id === selectedVersion);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700">方案版本历史</h3>
        <p className="text-xs text-slate-500 mt-1">点击版本查看详细内容</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 border-r border-slate-200 overflow-y-auto">
          {sortedVersions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              暂无版本记录
            </div>
          ) : (
            sortedVersions.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVersion(v.id)}
                className={`w-full p-3 text-left border-b border-slate-100 transition-colors ${
                  selectedVersion === v.id
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-slate-800">{v.version}</span>
                  {v.isLegacy && (
                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      旧
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">{v.changeLog}</div>
                <div className="text-xs text-slate-400 mt-1">{formatDate(v.createdAt)}</div>
              </button>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {selected.version}
                    {selected.isLegacy && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        历史版本
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">{selected.changeLog}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">作者</div>
                  <div className="text-sm font-medium text-slate-800 mt-1">{selected.author}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">创建时间</div>
                  <div className="text-sm font-medium text-slate-800 mt-1">{formatDate(selected.createdAt)}</div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-slate-700 mb-2">方案内容</h5>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.content}</p>
                </div>
              </div>

              {selected.isLegacy && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-sm text-amber-700">
                    ⚠️ 此版本从历史审批台账导入，仅供参考，请以当前方案为准
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              请选择一个版本查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
