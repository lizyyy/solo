import { X, FolderOpen, Trash2, Calendar, User, FileText, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useSchemeStore } from '@/store/schemeStore';
import { useFormationStore } from '@/store/formationStore';
import type { Scheme } from '@/types';

export function SchemeListModal() {
  const { showSchemeList, setShowSchemeList } = useUIStore();
  const { schemes, deleteScheme, loadScheme } = useSchemeStore();
  const { setDrones, setObstacles, selectDrone } = useFormationStore();

  const handleLoadScheme = (scheme: Scheme) => {
    loadScheme(scheme.id);
    setDrones(JSON.parse(JSON.stringify(scheme.drones)));
    setObstacles(JSON.parse(JSON.stringify(scheme.obstacles)));
    selectDrone(null);
    setShowSchemeList(false);
    alert(`已加载方案：${scheme.name}`);
  };

  const handleDeleteScheme = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除方案"${name}"吗？此操作无法撤销。`)) {
      deleteScheme(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!showSchemeList) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSchemeList(false)} />
      <div className="relative w-full max-w-3xl max-h-[80vh] bg-[#0f1e36] border border-white/10 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen size={20} className="text-blue-400" />
            方案列表
          </h2>
          <button
            onClick={() => setShowSchemeList(false)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {schemes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FolderOpen size={48} className="mb-4 opacity-30" />
              <p className="text-sm">暂无保存的方案</p>
              <p className="text-xs mt-2">点击工具栏的"保存"按钮创建第一个方案</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...schemes].reverse().map((scheme) => (
                <div
                  key={scheme.id}
                  className="p-4 bg-black/20 rounded-lg border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer group"
                  onClick={() => handleLoadScheme(scheme)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        {scheme.name}
                        <span className="text-[10px] text-gray-500 font-normal">
                          {scheme.id}
                        </span>
                      </h3>

                      {scheme.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {scheme.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {scheme.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(scheme.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText size={10} />
                          {scheme.drones.length} 架无人机
                        </span>
                        <span className="text-red-400">
                          异常 {scheme.drones.filter((d) => d.status !== 'NORMAL').length} 条
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteScheme(scheme.id, scheme.name, e)}
                        className="p-2 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="删除方案"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {schemes.length > 0 && (
          <div className="px-6 py-3 border-t border-white/10 bg-black/20">
            <p className="text-[10px] text-gray-500 flex items-start gap-2">
              <AlertTriangle size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              点击方案即可加载。方案保存在本地浏览器中，清除浏览器数据可能会丢失方案。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
