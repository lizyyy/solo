import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { useSimulationStore, createExperimentFromState } from '../../store/useSimulationStore';
import { useHistoryStore } from '../../store/useHistoryStore';
import { Slider } from './Slider';

export function ControlPanel() {
  const { params, state, actions } = useSimulationStore();
  const saveExperiment = useHistoryStore((state) => state.actions.saveExperiment);

  const isRunning = state === 'running';
  const isPaused = state === 'paused';
  const isCompleted = state === 'completed';
  const canModify = state === 'idle' || state === 'completed';

  const handleSave = () => {
    const experiment = createExperimentFromState();
    saveExperiment(experiment);
  };

  return (
    <div className="w-80 bg-space-800/90 backdrop-blur-md border-r border-cyber-500/20 p-4 overflow-y-auto">
      <h2 className="text-xl font-orbitron text-cyber-500 mb-6 tracking-wider">
        参数控制
      </h2>

      <div className="mb-6">
        <h3 className="text-sm font-jetbrains text-gray-400 mb-3 uppercase tracking-wider">
          线圈参数
        </h3>
        <Slider
          label="线圈电流"
          value={params.coilCurrent}
          min={100}
          max={10000}
          step={100}
          unit="A"
          onChange={(value) => actions.setParams({ coilCurrent: value })}
          disabled={!canModify}
        />
        <Slider
          label="线圈匝数"
          value={params.coilTurns}
          min={10}
          max={500}
          step={10}
          unit="匝"
          onChange={(value) => actions.setParams({ coilTurns: value })}
          disabled={!canModify}
        />
        <Slider
          label="加速级数"
          value={params.stageCount}
          min={1}
          max={10}
          step={1}
          unit="级"
          onChange={(value) => actions.setParams({ stageCount: value })}
          disabled={!canModify}
        />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-jetbrains text-gray-400 mb-3 uppercase tracking-wider">
          弹丸参数
        </h3>
        <Slider
          label="弹丸质量"
          value={params.projectileMass}
          min={0.01}
          max={1}
          step={0.01}
          unit="kg"
          onChange={(value) => actions.setParams({ projectileMass: value })}
          disabled={!canModify}
        />
        <Slider
          label="弹丸半径"
          value={params.projectileRadius}
          min={0.01}
          max={0.1}
          step={0.005}
          unit="m"
          onChange={(value) => actions.setParams({ projectileRadius: value })}
          disabled={!canModify}
        />
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-jetbrains text-gray-400 mb-3 uppercase tracking-wider">
          轨道参数
        </h3>
        <Slider
          label="轨道长度"
          value={params.trackLength}
          min={0.5}
          max={5}
          step={0.1}
          unit="m"
          onChange={(value) => actions.setParams({ trackLength: value })}
          disabled={!canModify}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-jetbrains text-gray-400 mb-3 uppercase tracking-wider">
          模拟控制
        </h3>

        {!isRunning ? (
          <button
            onClick={actions.startSimulation}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyber-600 to-cyber-500 hover:from-cyber-500 hover:to-cyber-400 text-white font-jetbrains rounded-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-cyber-glow hover:shadow-lg"
          >
            <Play size={20} />
            {isPaused ? '继续模拟' : isCompleted ? '重新模拟' : '开始模拟'}
          </button>
        ) : (
          <button
            onClick={actions.pauseSimulation}
            className="w-full py-3 px-4 bg-gradient-to-r from-warning-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 text-white font-jetbrains rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Pause size={20} />
            暂停模拟
          </button>
        )}

        <button
          onClick={actions.resetSimulation}
          className="w-full py-3 px-4 bg-space-700 hover:bg-space-600 text-gray-300 font-jetbrains rounded-lg transition-all duration-300 flex items-center justify-center gap-2 border border-gray-600 hover:border-cyber-500"
        >
          <RotateCcw size={20} />
          重置参数
        </button>

        <button
          onClick={handleSave}
          disabled={!isCompleted && state !== 'idle'}
          className="w-full py-3 px-4 bg-space-700 hover:bg-space-600 text-gray-300 font-jetbrains rounded-lg transition-all duration-300 flex items-center justify-center gap-2 border border-cyber-500/50 hover:border-cyber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          保存实验
        </button>
      </div>

      <div className="mt-6 p-3 bg-space-900/50 rounded-lg border border-cyber-500/20">
        <div className="text-xs text-gray-400 font-jetbrains">
          <div className="flex justify-between mb-1">
            <span>状态:</span>
            <span className={
              state === 'running' ? 'text-green-400' :
              state === 'paused' ? 'text-yellow-400' :
              state === 'completed' ? 'text-cyber-500' : 'text-gray-500'
            }>
              {state === 'running' ? '运行中' :
               state === 'paused' ? '已暂停' :
               state === 'completed' ? '已完成' : '就绪'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
