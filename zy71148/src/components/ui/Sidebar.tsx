import { useAppStore } from '../../store';
import { generateSampleData } from '../../data/sampleData';

export const Sidebar = () => {
  const loadData = useAppStore((state) => state.loadData);
  const resetState = useAppStore((state) => state.resetState);
  const viewMode = useAppStore((state) => state.viewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const showHeatmap = useAppStore((state) => state.showHeatmap);
  const toggleHeatmap = useAppStore((state) => state.toggleHeatmap);
  const showGrid = useAppStore((state) => state.showGrid);
  const toggleGrid = useAppStore((state) => state.toggleGrid);
  const showProbes = useAppStore((state) => state.showProbes);
  const toggleProbes = useAppStore((state) => state.toggleProbes);
  const showRepairAreas = useAppStore((state) => state.showRepairAreas);
  const toggleRepairAreas = useAppStore((state) => state.toggleRepairAreas);
  const showThreshold = useAppStore((state) => state.showThreshold);
  const toggleThreshold = useAppStore((state) => state.toggleThreshold);
  const data = useAppStore((state) => state.data);

  const handleLoadSample = () => {
    const sampleData = generateSampleData();
    loadData(sampleData);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          loadData(jsonData);
        } catch (err) {
          console.error('Failed to parse JSON:', err);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="w-72 bg-slate-900/95 border-r border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          冰场制冰厚度剖面
        </h1>
        <p className="text-xs text-slate-400 mt-1">冰面可视化监控系统</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">数据导入</h3>
          <div className="space-y-2">
            <button
              onClick={handleLoadSample}
              className="w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导入样例数据
            </button>
            <label className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导入 JSON 文件
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>
          </div>
        </div>

        {data && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">视图模式</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setViewMode('thickness')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    viewMode === 'thickness'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  厚度视图
                </button>
                <button
                  onClick={() => setViewMode('temperature')}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    viewMode === 'temperature'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  温度视图
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">显示选项</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showHeatmap}
                    onChange={toggleHeatmap}
                    className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                  />
                  热力图层
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={toggleGrid}
                    className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                  />
                  采样点网格
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showProbes}
                    onChange={toggleProbes}
                    className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                  />
                  温度探头
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showRepairAreas}
                    onChange={toggleRepairAreas}
                    className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                  />
                  修补区域
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={showThreshold}
                    onChange={toggleThreshold}
                    className="w-4 h-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                  />
                  阈值参考面
                </label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">图例说明</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-slate-400">正常 (≥ 阈值)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-slate-400">警告 (85%~100%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-slate-400">较低 (70%~85%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-slate-400">危险 (&lt; 70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span className="text-slate-400">数据缺失</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={resetState}
          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重置状态
        </button>
      </div>
    </div>
  );
};
