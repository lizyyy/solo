import { Play, Pause, RotateCcw, Save, Camera } from 'lucide-react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useSchemeStore } from '../../store/useSchemeStore';
import html2canvas from 'html2canvas';

export default function ControlPanel() {
  const {
    isPlaying,
    currentTime,
    timeScale,
    attitude,
    radiationPressure,
    conclusion,
    trajectory,
    evidenceLog,
    setIsPlaying,
    setTimeScale,
    setAttitude,
    setPressureReversed,
    resetSimulation,
  } = useSimulationStore();

  const { addScheme } = useSchemeStore();

  const handleSaveScheme = () => {
    const name = prompt('请输入方案名称:', `方案 ${new Date().toLocaleTimeString()}`);
    if (name) {
      addScheme({
        name,
        attitude: { ...attitude },
        radiationPressure: {
          ...radiationPressure,
          direction: radiationPressure.direction.clone(),
        },
        trajectory: trajectory.map((t) => ({
          ...t,
          position: t.position.clone(),
          velocity: t.velocity.clone(),
        })),
        conclusion,
        evidenceLog: [...evidenceLog],
        hasUnitError: attitude.unit === 'rad' && Math.abs(attitude.alpha) > Math.PI * 2,
        hasPressureReverse: radiationPressure.isReversed,
      });
    }
  };

  const handleScreenshot = async () => {
    const canvasContainer = document.querySelector('.game-wrapper');
    if (canvasContainer) {
      const canvas = await html2canvas(canvasContainer as HTMLElement);
      const link = document.createElement('a');
      link.download = `solar-sail-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const getConclusionText = () => {
    switch (conclusion) {
      case 'consistent':
        return { text: '结论一致', color: 'text-green-400', bg: 'bg-green-500/20' };
      case 'inconsistent':
        return { text: '结论不一致', color: 'text-red-400', bg: 'bg-red-500/20' };
      case 'needs-evidence':
        return { text: '需补充证据', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
      default:
        return { text: '待分析', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    }
  };

  const conclusionInfo = getConclusionText();

  return (
    <div className="w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-cyan-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          姿态控制台
        </h2>
        <p className="text-xs text-slate-400">调节太阳帆角度，观察光压效应</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className={`p-3 rounded-lg ${conclusionInfo.bg} border border-current/30`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">当前结论</span>
            <span className={`font-bold ${conclusionInfo.color}`}>{conclusionInfo.text}</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            模拟时间: {currentTime.toFixed(2)}s | 轨迹点: {trajectory.length}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
            姿态角控制
          </h3>
          
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAttitude({ unit: 'deg' })}
              className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-all ${
                attitude.unit === 'deg'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              度 (°)
            </button>
            <button
              onClick={() => setAttitude({ unit: 'rad' })}
              className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-all ${
                attitude.unit === 'rad'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              } ${
                attitude.unit === 'rad' && Math.abs(attitude.alpha) > Math.PI * 2
                  ? 'ring-2 ring-red-500'
                  : ''
              }`}
            >
              弧度 (rad)
            </button>
          </div>

          {attitude.unit === 'rad' && Math.abs(attitude.alpha) > Math.PI * 2 && (
            <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
              ⚠️ 警告：弧度值过大，可能存在单位混淆
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">俯仰角 α</span>
                <span className="text-cyan-400 font-mono">{attitude.alpha.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={attitude.unit === 'deg' ? -90 : -Math.PI / 2}
                max={attitude.unit === 'deg' ? 90 : Math.PI / 2}
                step={attitude.unit === 'deg' ? 1 : 0.01}
                value={attitude.alpha}
                onChange={(e) => setAttitude({ alpha: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">偏航角 β</span>
                <span className="text-cyan-400 font-mono">{attitude.beta.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={attitude.unit === 'deg' ? -180 : -Math.PI}
                max={attitude.unit === 'deg' ? 180 : Math.PI}
                step={attitude.unit === 'deg' ? 1 : 0.01}
                value={attitude.beta}
                onChange={(e) => setAttitude({ beta: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">滚转角 γ</span>
                <span className="text-cyan-400 font-mono">{attitude.gamma.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={attitude.unit === 'deg' ? -180 : -Math.PI}
                max={attitude.unit === 'deg' ? 180 : Math.PI}
                step={attitude.unit === 'deg' ? 1 : 0.01}
                value={attitude.gamma}
                onChange={(e) => setAttitude({ gamma: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
            光压设置
          </h3>
          
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
            <span className="text-sm text-slate-300">反向光压方向</span>
            <button
              onClick={() => setPressureReversed(!radiationPressure.isReversed)}
              className={`w-12 h-6 rounded-full transition-all ${
                radiationPressure.isReversed ? 'bg-red-500' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  radiationPressure.isReversed ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          
          {radiationPressure.isReversed && (
            <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
              ⚠️ 光压方向已反向，推力与预期相反
            </div>
          )}
          
          <div className="text-xs text-slate-400">
            光压大小: <span className="text-orange-400 font-mono">{(radiationPressure.magnitude * 1e6).toFixed(4)} μN</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            模拟控制
          </h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-all ${
                isPlaying
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? '暂停' : '开始'}
            </button>
            <button
              onClick={resetSimulation}
              className="flex items-center justify-center p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
              title="重置模拟"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">时间速度</span>
              <span className="text-green-400 font-mono">{timeScale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={timeScale}
              onChange={(e) => setTimeScale(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-700/50 space-y-2">
        <button
          onClick={handleSaveScheme}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-all"
        >
          <Save size={18} />
          保存当前方案
        </button>
        <button
          onClick={handleScreenshot}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-all"
        >
          <Camera size={18} />
          导出截图
        </button>
      </div>
    </div>
  );
}
