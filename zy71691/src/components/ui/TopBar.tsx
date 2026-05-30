import { Play, Pause, Save, Download, FileText, Clock, AlertTriangle } from 'lucide-react';
import { useYardStore } from '@/store/useYardStore';
import { useState } from 'react';

export function TopBar() {
  const {
    currentTime,
    isPlaying,
    playbackSpeed,
    setIsPlaying,
    setPlaybackSpeed,
    getStatistics,
    saveScenario,
  } = useYardStore();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDesc, setScenarioDesc] = useState('');

  const stats = getStatistics();

  const formatTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleSaveScenario = () => {
    if (scenarioName.trim()) {
      saveScenario(scenarioName, scenarioDesc);
      setScenarioName('');
      setScenarioDesc('');
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 h-14 bg-slate-900/95 border-b border-slate-700 flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">港口集装箱堆场沙盘</span>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{formatTime(currentTime)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 bg-slate-800 rounded-lg px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-slate-300">利用率</span>
            <span className="text-sm font-bold text-white">{stats.utilizationRate.toFixed(1)}%</span>
          </div>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-300">冲突</span>
            <span className="text-sm font-bold text-orange-400">{stats.conflicts.total}</span>
          </div>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">吊机</span>
            <span className="text-sm font-bold text-white">{stats.activeCranes}/3</span>
          </div>
          <div className="h-4 w-px bg-slate-600" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">卡车</span>
            <span className="text-sm font-bold text-white">{stats.activeTrucks}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
          </select>
        </div>

        <div className="h-6 w-px bg-slate-700" />

        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          保存方案
        </button>

        <button className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm">
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-96 shadow-2xl border border-slate-700">
            <h3 className="text-white font-bold text-lg mb-4">保存当前方案</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-sm block mb-1">方案名称</label>
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="输入方案名称..."
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm block mb-1">方案描述</label>
                <textarea
                  value={scenarioDesc}
                  onChange={(e) => setScenarioDesc(e.target.value)}
                  placeholder="输入方案描述..."
                  rows={3}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveScenario}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
