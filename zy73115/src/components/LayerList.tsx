import React from 'react';
import { Layers, Eye, EyeOff, FileText } from 'lucide-react';
import { useReviewStore } from '../store/useReviewStore';

export const LayerList: React.FC = () => {
  const { session, toggleLayerVisibility } = useReviewStore();

  if (!session) return null;

  const groupedBySource = session.layers.reduce((acc, layer) => {
    if (!acc[layer.source]) {
      acc[layer.source] = [];
    }
    acc[layer.source].push(layer);
    return acc;
  }, {} as Record<string, typeof session.layers>);

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Layers size={20} className="text-blue-400" />
          <span>CAD图层</span>
          <span className="ml-auto text-sm text-slate-400">
            {session.layers.length} 个图层
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {Object.entries(groupedBySource).map(([source, layers]) => (
          <div key={source} className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded text-xs text-slate-300">
              <FileText size={14} className="text-slate-500" />
              <span className="truncate font-mono">{source}</span>
            </div>
            <div className="space-y-1.5">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`p-3 rounded border transition-all ${
                    layer.visible
                      ? 'bg-slate-800/50 border-slate-600'
                      : 'bg-slate-800/20 border-slate-700/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="flex-1 text-sm font-medium truncate">
                      {layer.name}
                    </span>
                    <button
                      onClick={() => toggleLayerVisibility(layer.id)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title={layer.visible ? '隐藏图层' : '显示图层'}
                    >
                      {layer.visible ? (
                        <Eye size={14} className="text-slate-300" />
                      ) : (
                        <EyeOff size={14} className="text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400 leading-relaxed">
                    <div className="font-mono text-[11px] text-slate-500 mb-1">
                      原始CAD说明：
                    </div>
                    <div className="pl-2 border-l-2 border-slate-600">
                      {layer.originalNote}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 font-mono">
                    导入批次：{layer.importBatchId.slice(-8)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {session.supplementaryNote && (
        <div className="p-3 border-t border-slate-700 bg-amber-900/20">
          <div className="text-xs text-amber-400 font-medium mb-1">
            项目后补说明
          </div>
          <div className="text-xs text-amber-200/80 leading-relaxed">
            {session.supplementaryNote}
          </div>
        </div>
      )}
    </div>
  );
};
