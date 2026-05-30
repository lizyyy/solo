import { FlaskConical } from 'lucide-react';
import { ParameterPanel } from './components/ParameterPanel';
import { ConcentrationChart } from './components/ConcentrationChart';
import { DetailPanel } from './components/DetailPanel';
import { SampleManager } from './components/SampleManager';
import { ExportControls } from './components/ExportControls';
import { useSimulationStore } from './store/simulationStore';

function App() {
  const { isDetailPanelOpen } = useSimulationStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">微分方程药量模拟</h1>
                <p className="text-sm text-gray-500">血药浓度动态变化可视化工具</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              一室模型 · RK4数值解法
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 py-6 transition-all duration-300 ${
        isDetailPanelOpen ? 'mr-96' : ''
      }`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <SampleManager />
            <ParameterPanel />
            <ExportControls />
          </div>

          <div className="lg:col-span-2">
            <ConcentrationChart />
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold text-gray-900 mb-3">使用说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</span>
              <p>选择内置样例或导入自定义JSON配置文件</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</span>
              <p>调整药物参数和给药方案，点击"运行模拟"</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</span>
              <p>点击曲线查看详情，可导出CSV、JSON和图片</p>
            </div>
          </div>
        </div>
      </main>

      <DetailPanel />
    </div>
  );
}

export default App;
