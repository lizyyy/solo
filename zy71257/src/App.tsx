import CarbonHeightField from './components/CarbonHeightField';
import FilterPanel from './components/FilterPanel';
import DetailPanel from './components/DetailPanel';
import StatusBar from './components/StatusBar';
import ExportPanel from './components/ExportPanel';

function App() {
  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      <header className="flex-shrink-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              ✈️ 航线碳排高度场
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              航空运营碳排放3D可视化分析系统 · 评审会专用版
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400">数据周期</p>
              <p className="text-sm text-white font-medium">2026年Q1（90天）</p>
            </div>
            <div className="h-10 w-px bg-slate-700"></div>
            <div className="text-right">
              <p className="text-xs text-slate-400">航线数 / 机型数</p>
              <p className="text-sm text-white font-medium">12 / 10</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 px-4 pt-3">
        <StatusBar />
      </div>

      <div className="flex-1 flex gap-3 p-4 overflow-hidden">
        <aside className="flex-shrink-0 w-72 overflow-hidden">
          <FilterPanel />
        </aside>

        <main className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex-1 min-h-0 relative">
            <CarbonHeightField />
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-slate-300 pointer-events-none">
              <p>🖱️ 左键拖动旋转视角 · 滚轮缩放 · 点击柱状图查看详情</p>
            </div>
          </div>
          <div className="flex-shrink-0">
            <ExportPanel />
          </div>
        </main>

        <aside className="flex-shrink-0 w-80 overflow-hidden">
          <DetailPanel />
        </aside>
      </div>

      <footer className="flex-shrink-0 bg-slate-800/50 border-t border-slate-700 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>🔵 已确认数据</span>
            <span>🟣 临时备注数据</span>
            <span>🟠 异常标注</span>
          </div>
          <div>
            <span>拖动 / 筛选 / 切时间时，所有视图自动联动同步</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
