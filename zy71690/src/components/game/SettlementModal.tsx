import React from 'react';
import { X, Trophy, XCircle, RotateCcw, FileText, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorBadge } from '@/components/reports/ErrorBadge';
import type { EnergyState, ErrorMark } from '@/types';
import { RESULT_LABELS } from '@/types';

interface SettlementModalProps {
  isOpen: boolean;
  result: 'escape' | 'collide' | 'orbit' | 'chaos' | 'timeout';
  duration: number;
  finalEnergy: EnergyState;
  errorMarks: ErrorMark[];
  summary: string;
  collisionBodyId?: string;
  orbitPeriod?: number;
  escapeDistance?: number;
  onClose: () => void;
  onRestart: () => void;
  onViewReport: () => void;
  onReplay: () => void;
}

const RESULT_STYLES: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  escape: {
    icon: <Trophy size={48} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  collide: {
    icon: <XCircle size={48} />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
  orbit: {
    icon: <Trophy size={48} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  chaos: {
    icon: <Trophy size={48} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  timeout: {
    icon: <Trophy size={48} />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
};

export const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  result,
  duration,
  finalEnergy,
  errorMarks,
  summary,
  collisionBodyId,
  orbitPeriod,
  escapeDistance,
  onClose,
  onRestart,
  onViewReport,
  onReplay,
}) => {
  if (!isOpen) return null;

  const style = RESULT_STYLES[result];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={cn(
          'relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden',
          'animate-[slideIn_0.3s_ease-out]'
        )}
      >
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1',
            result === 'escape' && 'bg-gradient-to-r from-green-600 to-green-400',
            result === 'collide' && 'bg-gradient-to-r from-red-600 to-red-400',
            result === 'orbit' && 'bg-gradient-to-r from-blue-600 to-blue-400',
            result === 'chaos' && 'bg-gradient-to-r from-purple-600 to-purple-400',
            result === 'timeout' && 'bg-gradient-to-r from-yellow-600 to-yellow-400'
          )}
        />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6 pt-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center mb-4',
                style.bgColor,
                style.color
              )}
            >
              {style.icon}
            </div>
            <h2
              className={cn(
                'text-2xl font-bold font-mono tracking-wider mb-2',
                style.color
              )}
            >
              {RESULT_LABELS[result]}
            </h2>
            <p className="text-sm text-gray-400 font-mono">
              模拟时长: {duration.toFixed(3)} 秒
            </p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <h4 className="text-xs text-gray-500 font-mono mb-2">能量分析</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-orange-400 font-mono">动能</div>
                  <div className="text-sm text-orange-300 font-mono font-bold">
                    {finalEnergy.kinetic.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-400 font-mono">势能</div>
                  <div className="text-sm text-blue-300 font-mono font-bold">
                    {finalEnergy.potential.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-purple-400 font-mono">总能量</div>
                  <div
                    className={cn(
                      'text-sm font-mono font-bold',
                      finalEnergy.total > 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {finalEnergy.total.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {collisionBodyId && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-xs text-red-400 font-mono">
                  碰撞星体: <span className="text-red-300 font-bold">{collisionBodyId}</span>
                </div>
              </div>
            )}

            {orbitPeriod && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="text-xs text-blue-400 font-mono">
                  轨道周期: <span className="text-blue-300 font-bold">{orbitPeriod.toFixed(3)}s</span>
                </div>
              </div>
            )}

            {escapeDistance && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-xs text-green-400 font-mono">
                  逃逸距离: <span className="text-green-300 font-bold">{escapeDistance.toFixed(1)}px</span>
                </div>
              </div>
            )}

            {errorMarks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-mono">检测到 {errorMarks.length} 个异常</div>
                <div className="flex flex-wrap gap-1">
                  {errorMarks.map((error) => (
                    <ErrorBadge key={error.id} type={error.type} size="sm" />
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="text-xs text-gray-500 font-mono mb-1">分析结论</div>
              <p className="text-sm text-gray-300 leading-relaxed">{summary}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onReplay}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-sm transition-all active:scale-95"
            >
              <Play size={16} />
              轨迹回放
            </button>
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-mono font-bold text-sm transition-all active:scale-95"
            >
              <RotateCcw size={16} />
              再来一局
            </button>
            <button
              onClick={onViewReport}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-mono font-bold text-sm transition-all active:scale-95"
            >
              <FileText size={16} />
              实验报告
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
