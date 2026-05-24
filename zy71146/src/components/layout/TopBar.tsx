import {
  Download,
  FileText,
  Settings,
  Activity,
  Map,
  HelpCircle,
} from 'lucide-react';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

interface TopBarProps {
  onExportReport: () => void;
  onExportJSON: () => void;
}

export function TopBar({ onExportReport, onExportJSON }: TopBarProps) {
  const currentScene = useSceneStore(state => state.currentScene);
  const showStats = useUIStore(state => state.showStats);
  const setShowStats = useUIStore(state => state.setShowStats);
  const setSampleModalOpen = useUIStore(state => state.setSampleModalOpen);

  return (
    <div className="absolute top-0 left-0 right-0 z-30 h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-wide">
                导视盲区分析系统
              </h1>
              <p className="text-xs text-slate-400">
                {currentScene?.name || '未加载场景'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSampleModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>导入样例</span>
          </button>

          <button
            onClick={() => setShowStats(!showStats)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
              showStats
                ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            )}
          >
            <Activity className="w-4 h-4" />
            <span>性能</span>
          </button>

          <div className="h-6 w-px bg-slate-700 mx-2" />

          <button
            onClick={onExportJSON}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>导出数据</span>
          </button>

          <button
            onClick={onExportReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
          >
            <FileText className="w-4 h-4" />
            <span>导出报告</span>
          </button>

          <div className="h-6 w-px bg-slate-700 mx-2" />

          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
            <HelpCircle className="w-4 h-4" />
          </button>

          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
