import React, { useState } from 'react';
import { GitCommit, GitBranch, RotateCcw, ArrowRight, Eye } from 'lucide-react';
import type { VersionSnapshot, OperationType } from '@/types';
import { useAppStore } from '@/store/appStore';
import { compareVersions, diffToText } from '@/utils/diff';
import { ConfirmDialog } from './ConfirmDialog';

interface VersionTimelineProps {
  versions: VersionSnapshot[];
  currentVersionId: string | null;
  onRollback?: (versionId: string) => void;
}

const operationLabels: Record<OperationType, { label: string; color: string; icon: React.ReactNode }> = {
  import: { label: '导入', color: 'bg-success-500', icon: <ArrowRight className="w-3 h-3" /> },
  edit: { label: '编辑', color: 'bg-info-500', icon: <ArrowRight className="w-3 h-3" /> },
  rollback: { label: '回滚', color: 'bg-warning-500', icon: <RotateCcw className="w-3 h-3" /> },
  batch: { label: '批量', color: 'bg-primary-500', icon: <ArrowRight className="w-3 h-3" /> },
  delete: { label: '删除', color: 'bg-danger-500', icon: <ArrowRight className="w-3 h-3" /> }
};

export const VersionTimeline: React.FC<VersionTimelineProps> = ({ versions, currentVersionId }) => {
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<string | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);
  const { rollbackToVersion } = useAppStore();

  const handleCompare = () => {
    if (!compareFrom || !compareTo) return;
    
    const fromVersion = versions.find(v => v.id === compareFrom);
    const toVersion = versions.find(v => v.id === compareTo);
    
    if (fromVersion && toVersion) {
      const diff = compareVersions(fromVersion.snapshotData, toVersion.snapshotData);
      setDiffResult(diffToText(diff));
    }
  };

  const handleRollback = (versionId: string) => {
    rollbackToVersion(versionId, '用户主动回滚');
    setRollbackConfirm(null);
  };

  const clearCompare = () => {
    setCompareFrom(null);
    setCompareTo(null);
    setDiffResult(null);
  };

  return (
    <div className="space-y-4">
      {(compareFrom || compareTo) && (
        <div className="p-4 bg-primary-50 border border-primary-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-mono font-medium text-primary-700 text-sm">版本对比</h4>
            <button
              onClick={clearCompare}
              className="text-xs text-primary-500 hover:text-primary-700 font-mono"
            >
              清除选择
            </button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-primary-500 mb-1 font-mono">从版本</label>
              <select
                value={compareFrom || ''}
                onChange={(e) => setCompareFrom(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 font-mono"
              >
                <option value="">请选择</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.version} - {operationLabels[v.operationType].label} - {v.remark.substring(0, 20)}
                  </option>
                ))}
              </select>
            </div>
            <ArrowRight className="w-5 h-5 text-primary-400 mt-5" />
            <div className="flex-1">
              <label className="block text-xs text-primary-500 mb-1 font-mono">到版本</label>
              <select
                value={compareTo || ''}
                onChange={(e) => setCompareTo(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-primary-300 bg-white focus:outline-none focus:border-info-500 font-mono"
              >
                <option value="">请选择</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.version} - {operationLabels[v.operationType].label} - {v.remark.substring(0, 20)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCompare}
              disabled={!compareFrom || !compareTo}
              className="mt-5 px-4 py-2 text-sm font-medium bg-info-600 text-white hover:bg-info-700 disabled:bg-primary-300 disabled:cursor-not-allowed transition-colors"
            >
              对比
            </button>
          </div>
          {diffResult && (
            <pre className="p-3 bg-white border border-primary-200 text-xs font-mono text-primary-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {diffResult}
            </pre>
          )}
        </div>
      )}

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-200" />
        
        {[...versions].reverse().map((version) => {
          const isCurrent = version.id === currentVersionId;
          const opConfig = operationLabels[version.operationType];
          
          return (
            <div key={version.id} className="relative pl-10 pb-6 last:pb-0">
              <div className={`absolute left-2 w-5 h-5 rounded-full ${opConfig.color} flex items-center justify-center text-white ${
                isCurrent ? 'ring-4 ring-info-200' : ''
              }`}>
                {opConfig.icon}
              </div>
              
              <div className={`p-4 border ${isCurrent ? 'border-info-300 bg-info-50' : 'border-primary-200 bg-white'} hover:shadow-sm transition-shadow`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-primary-800">v{version.version}</span>
                      <span className={`px-2 py-0.5 text-xs font-mono text-white ${opConfig.color}`}>
                        {opConfig.label}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 text-xs font-mono bg-info-500 text-white">
                          当前版本
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-primary-600">{version.remark}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!compareFrom) setCompareFrom(version.id);
                        else if (!compareTo) setCompareTo(version.id);
                      }}
                      className="p-1.5 hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition-colors"
                      title="选择对比"
                    >
                      <GitBranch className="w-4 h-4" />
                    </button>
                    {!isCurrent && (
                      <button
                        onClick={() => setRollbackConfirm(version.id)}
                        className="p-1.5 hover:bg-warning-100 text-warning-500 hover:text-warning-700 transition-colors"
                        title="回滚到此版本"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      className="p-1.5 hover:bg-primary-100 text-primary-400 hover:text-primary-600 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-primary-400 font-mono">操作人: </span>
                    <span className="text-primary-700 font-mono">{version.operator}</span>
                  </div>
                  <div>
                    <span className="text-primary-400 font-mono">记录数: </span>
                    <span className="text-primary-700 font-mono">{version.snapshotData.length}</span>
                  </div>
                  <div>
                    <span className="text-primary-400 font-mono">数据指纹: </span>
                    <span className="text-primary-700 font-mono">{version.dataFingerprint.substring(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="text-primary-400 font-mono">创建时间: </span>
                    <span className="text-primary-700 font-mono">{new Date(version.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                
                {version.parentVersionId && (
                  <div className="mt-2 pt-2 border-t border-primary-100 flex items-center gap-2 text-xs text-primary-400">
                    <GitCommit className="w-3 h-3" />
                    <span className="font-mono">
                      父版本: {versions.find(v => v.id === version.parentVersionId)?.version || '未知'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!rollbackConfirm}
        title="确认回滚版本"
        message={`此操作将创建一个新版本，其数据与选中版本完全一致。原有的版本历史不会被删除。\n\n确定要回滚到此版本吗？`}
        variant="warning"
        confirmText="确认回滚"
        onConfirm={() => rollbackConfirm && handleRollback(rollbackConfirm)}
        onCancel={() => setRollbackConfirm(null)}
      />
    </div>
  );
};
