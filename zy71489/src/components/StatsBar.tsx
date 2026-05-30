import { Music, Clock, Users, Zap, AlertTriangle } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

interface StatsBarProps {
  selectedCount: number;
  totalDuration: number;
  totalVotes: number;
  avgStamina: number;
  hasCopyrightRisk: boolean;
  copyrightRiskCount?: number;
}

function AnimatedNumber({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const displayValue = useCountUp(value);
  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : displayValue.toLocaleString();
  return (
    <span className="font-mono font-bold text-xl animate-count-up" key={value}>
      {formatted}{suffix}
    </span>
  );
}

export default function StatsBar({
  selectedCount,
  totalDuration,
  totalVotes,
  avgStamina,
  hasCopyrightRisk,
  copyrightRiskCount = 0
}: StatsBarProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationMins = Math.floor(totalDuration / 60);

  return (
    <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-stage p-4 sticky top-0 z-30">
      <div className="grid grid-cols-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stage bg-gold/15 flex items-center justify-center border border-gold/30">
            <Music className="text-gold" size={20} />
          </div>
          <div>
            <p className="text-xs text-neutral-500">选中曲目</p>
            <div className="text-gold">
              <AnimatedNumber value={selectedCount} suffix=" 首" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stage bg-blue-500/15 flex items-center justify-center border border-blue-500/30">
            <Clock className="text-blue-400" size={20} />
          </div>
          <div>
            <p className="text-xs text-neutral-500">总时长</p>
            <div className="text-white font-mono font-bold text-xl">
              {formatDuration(totalDuration)}
              <span className="text-sm text-neutral-500 ml-1">({durationMins} 分钟)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stage bg-gold/15 flex items-center justify-center border border-gold/30">
            <Users className="text-gold" size={20} />
          </div>
          <div>
            <p className="text-xs text-neutral-500">总票数</p>
            <div className="text-gold">
              <AnimatedNumber value={totalVotes} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-stage bg-orange/15 flex items-center justify-center border border-orange/30">
            <Zap className="text-orange" size={20} />
          </div>
          <div>
            <p className="text-xs text-neutral-500">平均体力</p>
            <div className="text-orange">
              <AnimatedNumber value={avgStamina * 10} decimals={1} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-stage flex items-center justify-center border',
              hasCopyrightRisk
                ? 'bg-red/15 border-red/50 animate-pulse-red'
                : 'bg-green-500/15 border-green-500/30'
            )}
          >
            <AlertTriangle
              className={cn(
                'size-5',
                hasCopyrightRisk ? 'text-red' : 'text-green-400'
              )}
            />
          </div>
          <div>
            <p className="text-xs text-neutral-500">版权风险</p>
            <div
              className={cn(
                'font-mono font-bold text-xl',
                hasCopyrightRisk ? 'text-red animate-pulse-red' : 'text-green-400'
              )}
            >
              {hasCopyrightRisk ? `${copyrightRiskCount} 项风险` : '无风险'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
