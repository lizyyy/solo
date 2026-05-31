import type { PermissionChange } from '@/types';
import { formatDateTime, compareObjects } from '@/utils';
import { ArrowRight, ShieldAlert } from 'lucide-react';

interface PermissionDiffProps {
  changes?: PermissionChange[];
  before?: Record<string, any>;
  after?: Record<string, any>;
}

export default function PermissionDiff({ changes, before, after }: PermissionDiffProps) {
  if (changes && changes.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        暂无权限变更记录
      </div>
    );
  }

  if (before && after) {
    const diff = compareObjects(before, after);

    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 font-medium">
                  变更前
                </span>
              </div>
              <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(before, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                  变更后
                </span>
              </div>
              <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                {JSON.stringify(after, null, 2)}
              </pre>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-2 font-medium">变更差异</p>
            <div className="space-y-2">
              {Object.entries(diff).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 font-mono">{key}:</span>
                  <span className="text-red-400 font-mono">
                    {JSON.stringify((value as any).before)}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-emerald-400 font-mono">
                    {JSON.stringify((value as any).after)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {changes?.map(change => (
        <div
          key={change.id}
          className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden"
        >
          <div className="p-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-pink-400" />
                <span className="text-white font-medium">{change.operator}</span>
                <span className="text-pink-400 text-sm">变更了权限配置</span>
              </div>
              <span className="text-slate-500 text-xs">{formatDateTime(change.createdAt)}</span>
            </div>
            <p className="mt-2 text-slate-400 text-sm">
              <span className="text-slate-500">变更原因：</span>
              {change.changeReason}
            </p>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 font-medium">
                    变更前
                  </span>
                </div>
                <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                  {JSON.stringify(change.beforePermission, null, 2)}
                </pre>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                    变更后
                  </span>
                </div>
                <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto font-mono">
                  {JSON.stringify(change.afterPermission, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2 font-medium">变更差异</p>
              <div className="space-y-2">
                {Object.entries(change.diffSnapshot).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300 font-mono">{key}:</span>
                    <span className="text-red-400 font-mono">
                      {JSON.stringify((value as any).before)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400 font-mono">
                      {JSON.stringify((value as any).after)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
