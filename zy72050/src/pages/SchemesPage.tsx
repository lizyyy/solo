import { useNavigate } from 'react-router-dom';
import { Save, Trash2, Play, Layers, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { formatDateTime } from '@/utils/data';

export default function SchemesPage() {
  const navigate = useNavigate();
  const schemes = useAppStore(s => s.schemes);
  const data = useAppStore(s => s.data);
  const loadScheme = useAppStore(s => s.loadScheme);
  const deleteScheme = useAppStore(s => s.deleteScheme);

  const handleLoad = (id: string) => {
    loadScheme(id);
    if (data.length > 0) {
      navigate('/cloud');
    } else {
      navigate('/import');
    }
  };

  const getFilterSummary = (filters: any) => {
    return `Δ∈[${filters.deltaRange[0].toFixed(1)},${filters.deltaRange[1].toFixed(1)}] · Γ∈[${filters.gammaRange[0].toFixed(1)},${filters.gammaRange[1].toFixed(1)}]${filters.anomalyOnly ? ' · 仅异常' : ''}`;
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Layers className="text-amber-400" size={20} />
            方案管理
          </h2>
          <p className="text-xs text-slate-400 mt-1">保存的 3D 云台查看方案，包含视角、筛选条件和标注快照</p>
        </div>
        {data.length > 0 && (
          <button
            onClick={() => navigate('/cloud')}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            进入 3D 云台
          </button>
        )}
      </div>

      {schemes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <Save className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">还没有保存过方案</p>
            <p className="text-xs text-slate-500 mt-1">在 3D 云台页点击"保存方案"可以保存当前视角和筛选条件</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schemes.map(scheme => (
            <div
              key={scheme.id}
              className="bg-[#1a1f36] border border-slate-700/50 rounded-xl p-4 hover:border-cyan-500/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-white">{scheme.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDateTime(scheme.createdAt)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                    <Layers size={16} className="text-cyan-400" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 mb-3">
                <div className="text-[10px] text-slate-500 mb-1">筛选条件</div>
                <div className="text-[10px] text-slate-300 font-mono leading-relaxed">
                  {getFilterSummary(scheme.filters)}
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 mb-4">
                <div className="text-[10px] text-slate-500 mb-1">相机视角</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  pos: [{scheme.camera.position.map(v => v.toFixed(1)).join(', ')}]
                </div>
              </div>

              <div className="flex items-center justify-between">
                {Object.keys(scheme.annotationSnapshot).length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle size={10} />
                    {Object.keys(scheme.annotationSnapshot).length} 条标注快照
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => {
                      if (confirm('确认删除这个方案吗？')) {
                        deleteScheme(scheme.id);
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                    title="删除"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    onClick={() => handleLoad(scheme.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 rounded-md transition-all"
                  >
                    <Play size={11} />
                    加载
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
