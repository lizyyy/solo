import { FileText, Trash2, Eye, Plus } from 'lucide-react';
import type { Scheme } from '../../types';

interface SchemeListProps {
  schemes: Scheme[];
  currentSchemeId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveNew: () => void;
}

export function SchemeList({
  schemes,
  currentSchemeId,
  onLoad,
  onDelete,
  onSaveNew,
}: SchemeListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          方案管理
        </h3>
        <button
          onClick={onSaveNew}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          新方案
        </button>
      </div>
      
      {schemes.length === 0 ? (
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
          <p className="text-sm text-slate-500">暂无保存的方案</p>
          <p className="text-xs text-slate-600 mt-1">点击"新方案"保存当前状态</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {schemes.slice().reverse().map((scheme) => (
            <div
              key={scheme.id}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                scheme.id === currentSchemeId
                  ? 'bg-blue-500/10 border-blue-500/50'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      scheme.id === currentSchemeId ? 'bg-blue-400' : 'bg-slate-500'
                    }`} />
                    <h4 className="text-sm font-medium text-slate-200 truncate">
                      {scheme.name}
                    </h4>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                    <p>创建人: {scheme.operator}</p>
                    <p>更新: {scheme.updatedAt}</p>
                    <p className="text-slate-600">异常数: {Object.keys(scheme.anomalyStates).length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onLoad(scheme.id)}
                    className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                    title="加载方案"
                  >
                    <Eye className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                  </button>
                  <button
                    onClick={() => onDelete(scheme.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                    title="删除方案"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
