import { ParameterPanel } from '../components/ParameterPanel/ParameterPanel';
import { TrajectoryChart } from '../components/TrajectoryChart/TrajectoryChart';
import { RiskAlertPanel } from '../components/RiskAlertPanel/RiskAlertPanel';
import { ReportExport } from '../components/ReportExport/ReportExport';
import { useSimulationStore } from '../store/simulationStore';
import { Rocket, Github } from 'lucide-react';

export default function Home() {
  const { result } = useSimulationStore();

  return (
    <div className="h-screen w-screen bg-gray-950 flex flex-col overflow-hidden">
      <header className="h-14 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wider">火星降落伞试算</h1>
            <p className="text-xs text-gray-500">Mars Parachute Simulation</p>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-4">
          <div className="text-xs text-gray-500">
            基于 RK4 数值积分 · 火星大气阻力模型
          </div>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <Github className="w-4 h-4 text-gray-400" />
          </a>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-80 shrink-0 overflow-hidden">
          <ParameterPanel />
        </aside>

        <section className="flex-1 overflow-hidden">
          <TrajectoryChart />
          {result && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700 shadow-xl">
                <ReportExport />
              </div>
            </div>
          )}
        </section>

        <aside className="w-80 shrink-0 overflow-hidden">
          <RiskAlertPanel />
        </aside>
      </main>

      <footer className="h-8 bg-gray-900/50 border-t border-gray-800 flex items-center px-6 shrink-0">
        <div className="text-xs text-gray-600">
          航天科普营 · 探测器EDL减速分析系统
        </div>
        <div className="ml-auto text-xs text-gray-600">
          提示: 调整参数后点击"开始模拟"运行计算
        </div>
      </footer>
    </div>
  );
}
