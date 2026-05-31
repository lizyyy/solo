import React from 'react';
import { GitBranch, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { VersionTimeline } from '@/components/VersionTimeline';

export const VersionHistory: React.FC = () => {
  const { versionHistory, currentVersion, auditLogs } = useAppStore();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary-600" />
            <h1 className="font-mono font-bold text-lg text-primary-800">版本历史</h1>
          </div>
          <span className="text-sm text-primary-500 font-mono">
            共 {versionHistory.length} 个版本
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {versionHistory.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-mono">暂无版本历史</p>
            </div>
          ) : (
            <VersionTimeline
              versions={versionHistory}
              currentVersionId={currentVersion?.id || null}
            />
          )}

          {auditLogs.length > 0 && (
            <div className="mt-8">
              <h3 className="font-mono font-medium text-primary-700 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-primary-400" />
                审计日志
              </h3>
              <div className="border border-primary-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-primary-50 border-b border-primary-200">
                        <th className="px-4 py-2 text-left font-mono font-medium text-primary-600">时间</th>
                        <th className="px-4 py-2 text-left font-mono font-medium text-primary-600">操作人</th>
                        <th className="px-4 py-2 text-left font-mono font-medium text-primary-600">操作</th>
                        <th className="px-4 py-2 text-left font-mono font-medium text-primary-600">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 20).map(log => (
                        <tr key={log.id} className="border-b border-primary-100 hover:bg-primary-50/50">
                          <td className="px-4 py-2 font-mono text-xs text-primary-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 font-mono text-primary-700">{log.operator}</td>
                          <td className="px-4 py-2 font-mono text-primary-700">{log.action}</td>
                          <td className="px-4 py-2 font-mono text-xs text-primary-500">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {auditLogs.length > 20 && (
                  <div className="px-4 py-2 text-center text-xs text-primary-400 font-mono bg-primary-50 border-t border-primary-200">
                    显示最近 20 条，共 {auditLogs.length} 条
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
