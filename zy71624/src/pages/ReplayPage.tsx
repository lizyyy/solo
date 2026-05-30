import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { NeonButton } from '@/components/ui/NeonButton';
import { GlowCard } from '@/components/ui/GlowCard';
import { CircuitCanvas } from '@/components/circuit/CircuitCanvas';
import { BarStatus } from '@/components/game/BarStatus';
import { OrderQueue } from '@/components/game/OrderQueue';
import { IncidentFeedback } from '@/components/game/IncidentFeedback';
import { formatTime } from '@/utils/gameConfig';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  HomeIcon,
  BarChartIcon,
  JumpIcon,
  AlertTriangleIcon,
  ZapIcon,
  FlameIcon,
  ClockIcon,
  GitBranchIcon,
  CircuitBoardIcon,
} from '@/components/circuit/CircuitIcons';
import type { ReplayNode, Incident } from '@/types';

const replayNodeConfig: Record<ReplayNode['type'], { icon: any; color: string; label: string }> = {
  component_add: { icon: CircuitBoardIcon, color: 'text-neon-green', label: '添加元件' },
  component_remove: { icon: CircuitBoardIcon, color: 'text-neon-red', label: '移除元件' },
  component_move: { icon: CircuitBoardIcon, color: 'text-neon-cyan', label: '移动元件' },
  wire_connect: { icon: ZapIcon, color: 'text-neon-purple', label: '连接导线' },
  wire_disconnect: { icon: ZapIcon, color: 'text-neon-orange', label: '断开导线' },
  switch_toggle: { icon: ZapIcon, color: 'text-neon-yellow', label: '切换开关' },
  order_event: { icon: ClockIcon, color: 'text-neon-orange', label: '订单事件' },
  incident_event: { icon: AlertTriangleIcon, color: 'text-neon-red', label: '事故事件' },
  state_change: { icon: CircuitBoardIcon, color: 'text-neon-silver', label: '状态变化' },
};

const incidentTypeConfig: Record<Incident['type'], { icon: any; color: string; label: string }> = {
  short_circuit: { icon: FlameIcon, color: 'text-neon-red', label: '短路' },
  overvoltage: { icon: ZapIcon, color: 'text-neon-orange', label: '过压' },
  undervoltage: { icon: ZapIcon, color: 'text-neon-yellow', label: '欠压' },
  overcurrent: { icon: FlameIcon, color: 'text-neon-red', label: '过流' },
  timeout: { icon: ClockIcon, color: 'text-neon-purple', label: '超时' },
  parallel_current_error: { icon: GitBranchIcon, color: 'text-neon-cyan', label: '并联电流错误' },
};

export default function ReplayPage() {
  const navigate = useNavigate();
  const {
    replayData,
    currentReplayIndex,
    isReplaying,
    incidents,
    startReplay,
    stopReplay,
    replayStep,
    replayNext,
    replayPrev,
    jumpToIncident,
  } = useGameStore();

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const autoPlayRef = useRef<number | null>(null);

  useEffect(() => {
    startReplay();
    return () => {
      stopReplay();
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [startReplay, stopReplay]);

  useEffect(() => {
    if (isAutoPlaying && currentReplayIndex < replayData.length - 1) {
      autoPlayRef.current = window.setInterval(() => {
        replayNext();
      }, 500);
    } else {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      if (currentReplayIndex >= replayData.length - 1) {
        setIsAutoPlaying(false);
      }
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, currentReplayIndex, replayData.length, replayNext]);

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
  };

  const handleTimelineClick = (index: number) => {
    replayStep(index);
    setIsAutoPlaying(false);
  };

  const handleIncidentClick = (incidentId: string) => {
    jumpToIncident(incidentId);
    setIsAutoPlaying(false);
  };

  const currentNode = replayData[currentReplayIndex];

  const incidentNodes = replayData
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === 'incident_event');

  return (
    <div className="min-h-screen bg-neon-bg p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-card px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="w-6 h-6 text-neon-red" />
              <h1 className="font-display font-bold text-2xl text-neon-red text-neon-glow-red">
                事故回放系统
              </h1>
            </div>
            <span className="px-3 py-1 bg-neon-purple/20 text-neon-purple rounded-full text-sm">
              节点 {currentReplayIndex + 1} / {replayData.length}
            </span>
            {currentNode && (
              <span className="px-3 py-1 bg-neon-cyan/20 text-neon-cyan rounded-full text-sm">
                游戏时间 {formatTime(currentNode.gameTime)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <NeonButton color="purple" variant="outline" onClick={() => navigate('/')}>
              <HomeIcon className="w-4 h-4" />
            </NeonButton>
            <NeonButton color="cyan" variant="outline" onClick={() => navigate('/report')}>
              <BarChartIcon className="w-4 h-4" />
            </NeonButton>
          </div>
        </motion.div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9 space-y-4">
            <CircuitCanvas />

            <GlowCard color="purple" className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-neon-purple">时间轴</h3>
                <div className="flex items-center gap-2">
                  <NeonButton
                    color="cyan"
                    variant="outline"
                    size="sm"
                    onClick={replayPrev}
                    disabled={currentReplayIndex === 0}
                  >
                    <SkipBackIcon className="w-4 h-4" />
                  </NeonButton>
                  <NeonButton
                    color={isAutoPlaying ? 'yellow' : 'green'}
                    onClick={toggleAutoPlay}
                  >
                    {isAutoPlaying ? (
                      <>
                        <PauseIcon className="w-4 h-4 mr-2" />
                        暂停
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4 mr-2" />
                        播放
                      </>
                    )}
                  </NeonButton>
                  <NeonButton
                    color="cyan"
                    variant="outline"
                    size="sm"
                    onClick={replayNext}
                    disabled={currentReplayIndex >= replayData.length - 1}
                  >
                    <SkipForwardIcon className="w-4 h-4" />
                  </NeonButton>
                </div>
              </div>

              <div className="relative h-12 bg-neon-bgSecondary rounded-lg overflow-x-auto">
                <div className="flex items-center h-full px-2 gap-1 min-w-full">
                  {replayData.map((node, index) => {
                    const config = replayNodeConfig[node.type];
                    const Icon = config.icon;
                    const isActive = index === currentReplayIndex;
                    const isPast = index < currentReplayIndex;
                    const isIncident = node.type === 'incident_event';

                    return (
                      <motion.div
                        key={node.sequence}
                        whileHover={{ scale: 1.1 }}
                        onClick={() => handleTimelineClick(index)}
                        className={`relative w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-all ${
                          isActive
                            ? 'bg-neon-purple ring-2 ring-neon-purple ring-offset-2 ring-offset-neon-bg scale-110'
                            : isPast
                            ? 'bg-neon-green/30'
                            : 'bg-neon-silver/20 hover:bg-neon-silver/30'
                        } ${isIncident ? 'ring-2 ring-neon-red' : ''}`}
                        title={`${config.label} - ${formatTime(node.gameTime)}`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : config.color}`} />
                        {isIncident && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-neon-red rounded-full animate-pulse" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {currentNode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={currentNode.sequence}
                  className="mt-4 p-3 bg-neon-bgSecondary/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const config = replayNodeConfig[currentNode.type];
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className={`w-5 h-5 ${config.color}`} />
                          <span className={`font-bold ${config.color}`}>{config.label}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm text-neon-silver">
                    <div>操作类型: {currentNode.action.type}</div>
                    {currentNode.action.targetId && (
                      <div>目标ID: {currentNode.action.targetId.slice(0, 16)}...</div>
                    )}
                    <div className="text-xs text-neon-silver/60 mt-1">
                      时间戳: {new Date(currentNode.timestamp).toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                </motion.div>
              )}
            </GlowCard>

            {incidentNodes.length > 0 && (
              <GlowCard color="red" className="p-4">
                <h3 className="font-display font-bold text-neon-red mb-4 flex items-center gap-2">
                  <AlertTriangleIcon className="w-5 h-5" />
                  事故时间点 ({incidentNodes.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {incidentNodes.map(({ node, index }) => {
                    const incidentsInNode = (node.action.params?.incidents as Incident[]) || [];
                    return incidentsInNode.map((incident) => {
                      const config = incidentTypeConfig[incident.type];
                      const Icon = config.icon;
                      return (
                        <motion.button
                          key={incident.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleIncidentClick(incident.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-neon-red/10 border border-neon-red/30 rounded-lg hover:bg-neon-red/20 transition-colors"
                        >
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span className="text-sm text-neon-silver">
                            {formatTime(node.gameTime)}
                          </span>
                          <span className={`text-sm font-bold ${config.color}`}>
                            {config.label}
                          </span>
                          <JumpIcon className="w-3 h-3 text-neon-cyan" />
                        </motion.button>
                      );
                    });
                  })}
                </div>
              </GlowCard>
            )}
          </div>

          <div className="col-span-3 space-y-4">
            <BarStatus />
            <OrderQueue />
            <IncidentFeedback />
          </div>
        </div>
      </div>
    </div>
  );
}
