import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Download, Eye, Clock, Filter } from 'lucide-react';
import { exportScreenshotWithWatermark, buildFilterText } from '@/utils/screenshot';

export default function SchemesPage() {
  const navigate = useNavigate();
  const { schemes, deleteScheme, loadScheme, filter } = useStore();
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const handleLoad = (id: string) => {
    const scheme = loadScheme(id);
    if (scheme) {
      setLoadedId(id);
      setTimeout(() => navigate('/'), 500);
    }
  };

  const handleExportBlank = (scheme: typeof schemes[0]) => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      const offscreen = document.createElement('canvas');
      offscreen.width = 800;
      offscreen.height = 600;
      const ctx = offscreen.getContext('2d')!;
      ctx.fillStyle = '#050d1a';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(16, 540, 400, 44);
      ctx.fillStyle = '#00E5CC';
      ctx.font = '12px monospace';
      ctx.fillText(`筛选条件: ${buildFilterText(scheme.filterSnapshot)}`, 26, 558);
      ctx.fillText(`方案: ${scheme.name} · ${new Date(scheme.createdAt).toLocaleString('zh-CN')}`, 26, 574);

      const link = document.createElement('a');
      link.download = `方案_${scheme.name}.png`;
      link.href = offscreen.toDataURL('image/png');
      link.click();
      return;
    }
    exportScreenshotWithWatermark(canvas, {
      filterText: buildFilterText(scheme.filterSnapshot),
      timestamp: new Date(scheme.createdAt).toLocaleString('zh-CN'),
      schemeName: scheme.name,
    });
  };

  return (
    <div className="min-h-screen bg-[#050d1a] text-white">
      <div className="border-b border-cyan-500/10 px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-zinc-500 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-cyan-300">方案管理</h1>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {schemes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-sm">暂无保存的方案</p>
            <p className="text-zinc-700 text-xs mt-1">在沙盘页面保存方案后，将在此处显示</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schemes.map((scheme) => (
              <div
                key={scheme.id}
                className={`bg-[#0e1a30] border rounded-lg p-4 transition-colors ${
                  loadedId === scheme.id
                    ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                    : 'border-cyan-500/20 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{scheme.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock size={10} className="text-zinc-600" />
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(scheme.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-mono">
                    {scheme.recordCount} 条
                  </span>
                </div>

                <div className="mb-3 space-y-1">
                  <div className="flex items-center gap-1">
                    <Filter size={10} className="text-zinc-600" />
                    <span className="text-[10px] text-zinc-500 truncate">
                      {buildFilterText(scheme.filterSnapshot) || '全部'}
                    </span>
                  </div>
                  {scheme.note && (
                    <p className="text-[10px] text-zinc-600 truncate">{scheme.note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoad(scheme.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-600/20 text-cyan-300 text-[10px] hover:bg-cyan-600/30 transition-colors"
                  >
                    <Eye size={10} />
                    加载
                  </button>
                  <button
                    onClick={() => handleExportBlank(scheme)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-[10px] hover:text-white transition-colors"
                  >
                    <Download size={10} />
                    导出
                  </button>
                  <button
                    onClick={() => deleteScheme(scheme.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-red-400/60 text-[10px] hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
