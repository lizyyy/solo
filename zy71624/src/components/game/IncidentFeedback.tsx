import { motion, AnimatePresence } from 'framer-motion';
import type { Incident } from '@/types';
import { useGameStore } from '@/store/gameStore';
import { formatTime } from '@/utils/gameConfig';
import { AlertTriangleIcon, ZapIcon, FlameIcon, ClockIcon, GitBranchIcon, JumpIcon } from '../circuit/CircuitIcons';

const incidentConfig = {
  short_circuit: {
    icon: FlameIcon,
    color: 'text-neon-red',
    bgColor: 'bg-neon-red/20',
    borderColor: 'border-neon-red',
    label: '短路',
  },
  overvoltage: {
    icon: ZapIcon,
    color: 'text-neon-orange',
    bgColor: 'bg-neon-orange/20',
    borderColor: 'border-neon-orange',
    label: '过压',
  },
  undervoltage: {
    icon: ZapIcon,
    color: 'text-neon-yellow',
    bgColor: 'bg-neon-yellow/20',
    borderColor: 'border-neon-yellow',
    label: '欠压',
  },
  overcurrent: {
    icon: FlameIcon,
    color: 'text-neon-red',
    bgColor: 'bg-neon-red/20',
    borderColor: 'border-neon-red',
    label: '过流',
  },
  timeout: {
    icon: ClockIcon,
    color: 'text-neon-purple',
    bgColor: 'bg-neon-purple/20',
    borderColor: 'border-neon-purple',
    label: '超时',
  },
  parallel_current_error: {
    icon: GitBranchIcon,
    color: 'text-neon-cyan',
    bgColor: 'bg-neon-cyan/20',
    borderColor: 'border-neon-cyan',
    label: '并联电流',
  },
};

function IncidentCard({ incident }: { incident: Incident }) {
  const { jumpToIncident, resolveIncident, highlightedErrorId } = useGameStore();
  const config = incidentConfig[incident.type];
  const Icon = config.icon;
  const isHighlighted = highlightedErrorId === incident.id;

  const handleJump = () => {
    jumpToIncident(incident.id);
  };

  const handleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    resolveIncident(incident.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      onClick={handleJump}
      className={`p-3 rounded-lg border-2 bg-neon-card/50 transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
        isHighlighted
          ? `${config.borderColor} shadow-lg ring-2 ring-offset-2 ring-offset-neon-bg ${config.borderColor.replace('border-', 'ring-')}`
          : incident.resolved
          ? 'border-neon-silver/30 opacity-60'
          : `${config.borderColor}/50 hover:${config.borderColor}`
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <span className={`font-display font-bold text-sm ${config.color}`}>
              {config.label}
            </span>
            <div className="text-xs text-neon-silver/70">
              游戏时间 {formatTime(incident.gameTime)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!incident.resolved && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResolve}
              className="p-1.5 rounded bg-neon-green/20 text-neon-green hover:bg-neon-green/30 transition-colors"
              title="标记已解决"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 rounded bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 transition-colors"
            title="跳转到事故现场"
          >
            <JumpIcon className="w-3 h-3" />
          </motion.button>
        </div>
      </div>

      <p className="text-xs text-neon-silver/80 mb-2">{incident.description}</p>

      <div className="flex items-center justify-between text-xs">
        <div className={`px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
          扣 {incident.penalty} 分
        </div>
        {incident.resolved && incident.resolvedAt && (
          <div className="text-neon-green/70">
            已解决 {new Date(incident.resolvedAt).toLocaleTimeString('zh-CN')}
          </div>
        )}
        {!incident.resolved && (
          <div className="text-neon-red/70 animate-pulse">
            待处理
          </div>
        )}
      </div>

      {(incident.sourceComponentId || incident.sourceWireId) && (
        <div className="mt-2 pt-2 border-t border-neon-silver/20 text-xs text-neon-silver/60">
          来源: {incident.sourceComponentId ? `元件 ${incident.sourceComponentId.slice(0, 8)}` : `导线 ${incident.sourceWireId?.slice(0, 8)}`}
        </div>
      )}
    </motion.div>
  );
}

export function IncidentFeedback() {
  const incidents = useGameStore(state => state.incidents);
  const unresolvedCount = incidents.filter(i => !i.resolved).length;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="w-5 h-5 text-neon-red" />
          <h3 className="text-neon-red font-display font-bold text-sm text-neon-glow-red">
            事故反馈
          </h3>
          {unresolvedCount > 0 && (
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="px-2 py-0.5 bg-neon-red/20 text-neon-red text-xs rounded-full"
            >
              {unresolvedCount} 待处理
            </motion.span>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
        <AnimatePresence>
          {[...incidents].reverse().map(incident => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </AnimatePresence>
        {incidents.length === 0 && (
          <div className="text-center text-neon-silver/50 py-8">
            <div className="text-4xl mb-2">✨</div>
            <div>暂无事故，保持良好状态！</div>
          </div>
        )}
      </div>
    </div>
  );
}
