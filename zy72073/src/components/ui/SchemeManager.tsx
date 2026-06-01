import React from 'react';
import { Calendar, Trash2, Upload, FolderOpen } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatTimestamp } from '../../utils/helpers';

export const SchemeManager: React.FC = () => {
  const { schemes, loadScheme, deleteScheme, points } = useStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-slate-200 text-sm font-medium">方案管理</h3>
        <p className="text-slate-500 text-xs mt-1">保存的视图和处理进度方案</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {schemes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
                <FolderOpen size={24} className="text-slate-600" />
              </div>
              <p>暂无保存的方案</p>
              <p className="text-xs mt-1">点击顶部「保存方案」按钮创建</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {schemes.map((scheme) => (
              <div
                key={scheme.id}
                className="bg-slate-800/50 border border-slate-700 hover:border-slate-500 transition-all"
              >
                {scheme.screenshot && (
                  <div className="aspect-video bg-slate-900 border-b border-slate-700">
                    <img
                      src={scheme.screenshot}
                      alt={scheme.name}
                      className="w-full h-full object-cover opacity-80"
                    />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-slate-200 text-sm font-medium">{scheme.name}</h4>
                    <button
                      onClick={() => deleteScheme(scheme.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {scheme.description && (
                    <p className="text-slate-400 text-xs mb-2">{scheme.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {formatTimestamp(scheme.createdAt)}
                    </span>
                    <span>{Object.keys(scheme.pointStates).length} 个点位</span>
                  </div>
                  <button
                    onClick={() => loadScheme(scheme.id)}
                    className="w-full px-3 py-2 text-xs border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center gap-2"
                  >
                    <Upload size={12} />
                    加载方案
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
        <div className="text-xs text-slate-400">
          <div className="flex items-center justify-between mb-1">
            <span>当前点位统计</span>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            <div className="text-center p-2 bg-slate-800/50">
              <div className="text-emerald-400 text-sm font-mono">
                {points.filter((p) => p.status === 'normal').length}
              </div>
              <div className="text-slate-500 text-xs">正常</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50">
              <div className="text-amber-400 text-sm font-mono">
                {points.filter((p) => p.status === 'warning').length}
              </div>
              <div className="text-slate-500 text-xs">警告</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50">
              <div className="text-red-400 text-sm font-mono">
                {points.filter((p) => p.status === 'error').length}
              </div>
              <div className="text-slate-500 text-xs">异常</div>
            </div>
            <div className="text-center p-2 bg-slate-800/50">
              <div className="text-violet-400 text-sm font-mono">
                {points.filter((p) => p.status === 'pending').length}
              </div>
              <div className="text-slate-500 text-xs">待确认</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
