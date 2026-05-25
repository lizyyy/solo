import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, Layers, MapPin, Users } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';

const LeftPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  
  const hallData = useSceneStore((state) => state.hallData);
  const batches = useSceneStore((state) => state.batches);
  const selectedBatch = useSceneStore((state) => state.selectedBatch);
  const selectedShowcases = useSceneStore((state) => state.selectedShowcases);
  const showHeatmap = useSceneStore((state) => state.showHeatmap);
  const showTrajectories = useSceneStore((state) => state.showTrajectories);
  const highlightAnomalies = useSceneStore((state) => state.highlightAnomalies);
  
  const setSelectedBatch = useSceneStore((state) => state.setSelectedBatch);
  const toggleShowcase = useSceneStore((state) => state.toggleShowcase);
  const setShowHeatmap = useSceneStore((state) => state.setShowHeatmap);
  const setShowTrajectories = useSceneStore((state) => state.setShowTrajectories);
  const setHighlightAnomalies = useSceneStore((state) => state.setHighlightAnomalies);

  if (!hallData) return null;

  const categories = [...new Set(hallData.showcases.map(s => s.category))];

  return (
    <div
      className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-72'
      }`}
    >
      <div className="bg-slate-900/95 backdrop-blur-md rounded-r-xl border border-l-0 border-slate-700/50 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700/50">
          {!collapsed && (
            <h3 className="text-white font-medium flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" />
              筛选控制
            </h3>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-white" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="p-4 space-y-6 max-h-96 overflow-y-auto">
            <div>
              <h4 className="text-slate-400 text-xs font-medium uppercase mb-3 flex items-center gap-2">
                <Layers className="w-3 h-3" />
                显示选项
              </h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showTrajectories}
                    onChange={(e) => setShowTrajectories(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-white text-sm group-hover:text-cyan-400 transition-colors">
                    显示轨迹线
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={(e) => setShowHeatmap(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                  />
                  <span className="text-white text-sm group-hover:text-cyan-400 transition-colors">
                    显示热力图
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={highlightAnomalies}
                    onChange={(e) => setHighlightAnomalies(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
                  />
                  <span className="text-white text-sm group-hover:text-orange-400 transition-colors">
                    高亮异常
                  </span>
                </label>
              </div>
            </div>

            {batches.length > 0 && (
              <div>
                <h4 className="text-slate-400 text-xs font-medium uppercase mb-3 flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  人流批次
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedBatch(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      !selectedBatch
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    全部批次
                  </button>
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedBatch === batch.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-medium">{batch.name}</div>
                      <div className="text-xs opacity-75">{batch.visitorCount} 位观众</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-slate-400 text-xs font-medium uppercase mb-3 flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                展柜筛选
              </h4>
              {categories.map((category) => (
                <div key={category} className="mb-3">
                  <div className="text-cyan-400 text-xs font-medium mb-2">{category}</div>
                  <div className="space-y-1">
                    {hallData.showcases
                      .filter((s) => s.category === category)
                      .map((showcase) => (
                        <label
                          key={showcase.id}
                          className="flex items-center gap-2 cursor-pointer group px-2 py-1 rounded hover:bg-slate-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedShowcases.includes(showcase.id)}
                            onChange={() => toggleShowcase(showcase.id)}
                            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                          />
                          <span className="text-white text-sm group-hover:text-cyan-400 transition-colors">
                            {showcase.number}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftPanel;
