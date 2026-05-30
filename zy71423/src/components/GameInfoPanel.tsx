import { Heart, Zap, Target, TrendingUp, Clock, Award } from 'lucide-react';
import { FunctionCard, CurvePoint } from '../types';
import { getSlopeFeedback, getDifferentiabilityFeedback } from '../utils/obstacleDetector';

interface GameInfoPanelProps {
  functionCard: FunctionCard;
  currentPoint: CurvePoint | undefined;
  score: number;
  lives: number;
  combo: number;
  maxCombo: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  batchId: string;
}

export const GameInfoPanel = ({
  functionCard,
  currentPoint,
  score,
  lives,
  combo,
  maxCombo,
  speed,
  onSpeedChange,
  batchId,
}: GameInfoPanelProps) => {
  const slopeFeedback = currentPoint ? getSlopeFeedback(currentPoint.slope) : null;
  const diffFeedback = currentPoint
    ? getDifferentiabilityFeedback(currentPoint.isDifferentiable, currentPoint)
    : null;

  return (
    <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/50 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white font-orbitron">游戏状态</h2>
        <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2 py-1 rounded">
          {batchId}
        </span>
      </div>

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
        <p className="text-xs text-slate-400 mb-1">当前函数</p>
        <p className="text-cyan-400 font-mono text-sm">{functionCard.expression}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-slate-400">得分</span>
          </div>
          <p className="text-2xl font-bold text-yellow-400 font-orbitron">{score}</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">生命</span>
          </div>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-600'}`}
              />
            ))}
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400">连击</span>
          </div>
          <p className="text-2xl font-bold text-purple-400 font-orbitron">{combo}</p>
          <p className="text-xs text-slate-500">最高: {maxCombo}</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">速度</span>
          </div>
          <p className="text-2xl font-bold text-green-400 font-orbitron">
            {speed.toFixed(1)}x
          </p>
        </div>
      </div>

      {currentPoint && (
        <div className="space-y-3">
          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">实时斜率</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold font-orbitron" style={{ color: slopeFeedback?.color }}>
                {currentPoint.slope.toFixed(2)}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold"
                style={{
                  backgroundColor: `${slopeFeedback?.color}20`,
                  color: slopeFeedback?.color,
                  border: `1px solid ${slopeFeedback?.color}50`,
                }}
              >
                {slopeFeedback?.text}
              </span>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-slate-400">可导性检测</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{diffFeedback?.icon}</span>
                <span
                  className="text-lg font-bold"
                  style={{ color: diffFeedback?.color }}
                >
                  {diffFeedback?.text}
                </span>
              </div>
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: diffFeedback?.color,
                  boxShadow: `0 0 10px ${diffFeedback?.color}`,
                }}
              />
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-2">当前坐标</p>
            <div className="flex gap-4">
              <div>
                <span className="text-xs text-slate-500">x =</span>
                <span className="text-white font-mono ml-1">
                  {currentPoint.x.toFixed(3)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500">y =</span>
                <span className="text-white font-mono ml-1">
                  {currentPoint.y.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
        <p className="text-xs text-slate-400 mb-3">移动速度控制</p>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>慢</span>
          <span>快</span>
        </div>
      </div>

      <div className="text-xs text-slate-500 space-y-1">
        <p>← → 方向键：控制移动方向</p>
        <p>减速通过不可导点可获得额外分数</p>
        <p>高速碰撞陷阱将扣除生命值</p>
      </div>
    </div>
  );
};
