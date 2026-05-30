import { useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { SpeakerForm } from '../components/SpeakerForm';
import { Heatmap } from '../components/Heatmap';
import { ResultTable } from '../components/ResultTable';
import { ValidationPanel } from '../components/ValidationPanel';
import { ExportPanel } from '../components/ExportPanel';
import { useStore } from '../store';

export default function Home() {
  const { loadDemoData } = useStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDemoData();
    }, 500);
    return () => clearTimeout(timer);
  }, [loadDemoData]);

  return (
    <div className="h-screen flex flex-col bg-acoustic-900 overflow-hidden">
      <header className="flex-shrink-0 h-14 bg-acoustic-800 border-b border-acoustic-700 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Volume2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">舞台声压叠加估算</h1>
            <p className="text-xs text-gray-500 -mt-0.5">专业声场分析工具</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-gray-500">
            <span className="text-gray-400 font-mono text-xs">v1.0.0</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4">
        <div className="h-full grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
            <SpeakerForm />
          </div>

          <div className="col-span-12 lg:col-span-6 h-full flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <Heatmap />
            </div>
            <div className="flex-shrink-0">
              <ValidationPanel />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3 h-full flex flex-col gap-4 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <ResultTable />
            </div>
            <div className="flex-shrink-0">
              <ExportPanel />
            </div>
          </div>
        </div>
      </main>

      <footer className="flex-shrink-0 h-8 bg-acoustic-800 border-t border-acoustic-700 px-6 flex items-center justify-between text-xs text-gray-600">
        <span>
          声压叠加 | 相位估算 | 热力图 | 数据一致性保证
        </span>
        <span className="font-mono">
          关键中间量已保留，便于复核
        </span>
      </footer>
    </div>
  );
}