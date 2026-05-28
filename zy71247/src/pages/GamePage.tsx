import { useGameStore } from '../store/gameStore';
import { FlightPathCanvas } from '../components/game/FlightPathCanvas';
import { EchoWaveform } from '../components/game/EchoWaveform';
import { ParamSliders } from '../components/game/ParamSliders';
import { ImagePreview } from '../components/game/ImagePreview';
import { SceneSelector } from '../components/game/SceneSelector';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function GamePage() {
  const { phase, submitForReview, resetGame } = useGameStore();
  const navigate = useNavigate();

  const handleSubmit = () => {
    submitForReview();
    setTimeout(() => {
      navigate('/review');
    }, 1600);
  };

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-tech-400 text-glow">
              SAR 成像拼图
            </h1>
            <p className="text-space-300 text-sm mt-1">
              调整航迹与采样参数，合成清晰的地物图像
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-space-700/50 border border-space-600 text-space-200 hover:border-space-500 hover:text-space-100 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              重置参数
            </button>
            <button
              onClick={handleSubmit}
              disabled={phase === 'processing'}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-tech-500/20 border border-tech-400 text-tech-400 hover:bg-tech-500/30 hover:shadow-lg hover:shadow-tech-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === 'processing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {phase === 'processing' ? '处理中...' : '提交成像'}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 space-y-4">
          <ParamSliders />
        </div>

        <div className="col-span-6 space-y-4">
          <SceneSelector />
          <FlightPathCanvas />
          <EchoWaveform />
        </div>

        <div className="col-span-3 space-y-4">
          <ImagePreview />
          
          <div className="card-bg rounded-lg p-4 border border-tech-500/30">
            <h3 className="font-orbitron text-tech-400 text-sm font-semibold mb-3">操作提示</h3>
            <ul className="text-xs text-space-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-tech-400">▸</span>
                拖拽航迹画布中的飞机调整飞行位置
              </li>
              <li className="flex items-start gap-2">
                <span className="text-tech-400">▸</span>
                采样间隔越小，成像分辨率越高
              </li>
              <li className="flex items-start gap-2">
                <span className="text-tech-400">▸</span>
                噪声水平过高会降低图像对比度
              </li>
              <li className="flex items-start gap-2">
                <span className="text-tech-400">▸</span>
                航迹偏离中心会导致方位向模糊
              </li>
              <li className="flex items-start gap-2">
                <span className="text-alert-yellow">▸</span>
                黄色/红色提示表示参数超出阈值
              </li>
            </ul>
          </div>
        </div>
      </div>

      {phase === 'processing' && (
        <div className="fixed inset-0 bg-space-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-tech-500/30 border-t-tech-400 rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-orbitron text-xl text-tech-400 mb-2">正在处理...</h3>
            <p className="text-space-300 text-sm">SAR成像算法运行中</p>
            <div className="mt-4 w-64 h-2 bg-space-700 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-tech-400 animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
