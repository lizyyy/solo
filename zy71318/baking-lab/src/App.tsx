import { useCallback, useState } from 'react';
import { useSimulationStore } from './store/useSimulationStore';
import { Workspace3D } from './components/Workspace3D';
import { TemperatureChart } from './components/TemperatureChart';
import { SimulationForm } from './components/SimulationForm';
import { SimulationHistory } from './components/SimulationHistory';
import type { SimulationParams } from './types';

function App() {
  const {
    simulations,
    selectedSimulations,
    status,
    errors,
    progress,
    addSimulation,
    removeSimulation,
    clearSimulations,
    toggleSimulationSelection,
    selectAllSimulations,
    deselectAllSimulations,
    validateParams,
    exportReport,
    exportChartData,
    setStatus
  } = useSimulationStore();

  const [activeTab, setActiveTab] = useState<'workspace' | 'chart' | 'history'>('workspace');

  const handleSubmit = useCallback(async (params: SimulationParams) => {
    await addSimulation(params);
    setTimeout(() => {
      setStatus('idle');
    }, 1000);
  }, [addSimulation, setStatus]);

  const handleValidate = useCallback((params: Partial<SimulationParams>) => {
    validateParams(params);
  }, [validateParams]);

  return (
    <div className="min-h-screen text-white">
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-3xl">🍰</div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                  烘焙实验室 - 热传导仿真工作台
                </h1>
                <p className="text-xs text-gray-400">
                  不同模具材料下蛋糕中心温度曲线模拟分析系统
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">
                模拟次数: <span className="text-white font-medium">{simulations.length}</span>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                status === 'running' 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : status === 'completed'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {status === 'running' ? `计算中 ${progress.toFixed(0)}%` : 
                 status === 'completed' ? '已完成' : '空闲'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-80px)]">
        <aside className="w-96 bg-gray-900/50 border-r border-gray-700 p-6 overflow-y-auto flex-shrink-0">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>⚙️</span> 模拟参数设置
          </h2>
          
          {status === 'running' && (
            <div className="mb-4">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">
                正在进行热传导数值计算...
              </p>
            </div>
          )}

          <SimulationForm
            onSubmit={handleSubmit}
            errors={errors}
            isRunning={status === 'running'}
            onValidate={handleValidate}
          />

          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <span>⚠️</span> 注意事项
            </h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 时间步长过大可能影响计算精度</li>
              <li>• 模具材料参数来源于材料数据库</li>
              <li>• 相同参数的模拟不会重复计算</li>
              <li>• 计算结果自动保存在本地</li>
            </ul>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-700 bg-gray-900/30">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'workspace'
                  ? 'text-white border-b-2 border-blue-500 bg-blue-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              🎯 3D工作台
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chart'
                  ? 'text-white border-b-2 border-blue-500 bg-blue-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📈 曲线对比
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-white border-b-2 border-blue-500 bg-blue-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              📋 历史记录
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'workspace' && (
              <Workspace3D
                simulations={simulations}
                selectedIds={selectedSimulations}
                onSelectSimulation={toggleSimulationSelection}
              />
            )}
            {activeTab === 'chart' && (
              <div className="h-full p-4">
                <TemperatureChart
                  simulations={simulations}
                  selectedIds={selectedSimulations}
                />
              </div>
            )}
            {activeTab === 'history' && (
              <div className="h-full p-4">
                <SimulationHistory
                  simulations={simulations}
                  selectedIds={selectedSimulations}
                  onToggleSelect={toggleSimulationSelection}
                  onSelectAll={selectAllSimulations}
                  onDeselectAll={deselectAllSimulations}
                  onRemove={removeSimulation}
                  onClearAll={clearSimulations}
                  onExportReport={exportReport}
                  onExportChart={exportChartData}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
