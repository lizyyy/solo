import { useEffect } from 'react';
import { Scene3D } from './components/Scene3D';
import { VoltageChart } from './components/VoltageChart';
import { ParameterPanel } from './components/ParameterPanel';
import { FaradayPanel } from './components/FaradayPanel';
import { WarningPanel } from './components/WarningPanel';
import { ExportToolbar } from './components/ExportToolbar';
import { useSimulationStore } from './store/simulationStore';

function App() {
  const calculate = useSimulationStore((state) => state.calculate);

  useEffect(() => {
    calculate();
  }, [calculate]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-100">
      <header className="bg-primary-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <h1 className="font-serif-sc text-xl font-semibold">
            电磁感应发电演示
          </h1>
          <span className="text-xs bg-primary-700 px-2 py-0.5 rounded text-primary-200">
            评审版
          </span>
        </div>
        <div className="text-sm text-primary-300 font-mono text-xs">
          基于法拉第电磁感应定律 ε = -N·dΦ/dt
        </div>
      </header>

      <main id="main-content" className="flex-1 overflow-hidden p-4 gap-4 flex flex-col">
        <ExportToolbar />
        
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          <div className="col-span-3 flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <ParameterPanel />
            </div>
          </div>

          <div className="col-span-6 flex flex-col gap-4">
            <div className="flex-1 min-h-0" style={{ minHeight: '40%' }}>
              <Scene3D />
            </div>
            <div className="bg-white rounded-lg card-shadow p-4 flex-1 min-h-0" style={{ minHeight: '35%' }}>
              <h3 className="font-serif-sc text-sm font-semibold text-slate-700 mb-2">
                感应电压曲线
              </h3>
              <div className="h-[calc(100%-2rem)]">
                <VoltageChart />
              </div>
            </div>
            <div className="bg-white rounded-lg card-shadow p-4">
              <WarningPanel />
            </div>
          </div>

          <div className="col-span-3 flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <FaradayPanel />
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-500 flex justify-between items-center">
        <span>点击3D场景可拖拽旋转视角 | 点击线圈/磁铁查看对应数据</span>
        <span className="font-mono">
          会话ID: {useSimulationStore.getState().session.id.slice(0, 12)}...
        </span>
      </footer>
    </div>
  );
}

export default App;
