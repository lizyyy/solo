import { motion, AnimatePresence } from 'framer-motion';
import type { Bar } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { formatVoltage } from '@/utils/gameConfig';
import { VoltageIcon } from '../circuit/CircuitIcons';

function BarCard({ bar }: { bar: Bar }) {
  const statusColors = {
    off: 'border-neon-silver/30 text-neon-silver',
    normal: 'border-neon-green shadow-neon-green/30 text-neon-green',
    overvoltage: 'border-neon-red shadow-neon-red/30 text-neon-red animate-pulse',
    undervoltage: 'border-neon-orange shadow-neon-orange/30 text-neon-orange',
  };

  const statusText = {
    off: '未供电',
    normal: '正常',
    overvoltage: '过压',
    undervoltage: '欠压',
  };

  const brightness = bar.bulbBrightness;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border-2 bg-neon-card/50 transition-all duration-300 ${statusColors[bar.status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display font-bold text-sm">{bar.name}</span>
        <span className="text-xs opacity-70">{statusText[bar.status]}</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <div className="relative w-8 h-8">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(245, 158, 11, ${brightness / 100}) 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute inset-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: brightness > 0 ? '#F59E0B' : '#475569',
              opacity: Math.max(0.3, brightness / 100),
              boxShadow: brightness > 0.5
                ? `0 0 ${brightness / 5}px #F59E0B, 0 0 ${brightness / 2}px #F59E0B`
                : 'none',
            }}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-xs">
            <VoltageIcon className="w-3 h-3" />
            <span>{formatVoltage(bar.currentVoltage)}</span>
            <span className="opacity-50">/</span>
            <span className="opacity-70">{formatVoltage(bar.requiredVoltage)}</span>
          </div>
        </div>
      </div>

      <div className="h-1.5 bg-neon-bgSecondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: bar.status === 'normal' ? '#10B981' : bar.status === 'overvoltage' ? '#EF4444' : '#F59E0B',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (bar.currentVoltage / bar.requiredVoltage) * 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

export function BarStatus() {
  const bars = useGameStore(state => state.bars);

  return (
    <div className="glass-card p-4">
      <h3 className="text-neon-cyan font-display font-bold text-sm mb-4 text-neon-glow-cyan">
        吧台状态
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        <AnimatePresence>
          {bars.map(bar => (
            <BarCard key={bar.id} bar={bar} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
