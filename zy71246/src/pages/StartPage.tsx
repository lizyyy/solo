import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, Orbit, Satellite, Play, 
  Target, Clock, AlertTriangle, Trophy,
  ChevronRight, Zap, BarChart3, FileText
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useEventStore } from '../store/eventStore';
import { useScheduleStore } from '../store/scheduleStore';
import { MISSIONS, getAllMissions } from '../data/missions';
import { GROUND_STATIONS } from '../data/groundStations';
import type { MissionConfig } from '../types/mission';
import { formatTime } from '../utils/time';

interface DifficultyLevel {
  id: string;
  name: string;
  description: string;
  scoreMultiplier: number;
  errorMultiplier: number;
  icon: React.ReactNode;
  color: string;
}

export const StartPage: React.FC = () => {
  const navigate = useNavigate();
  const { setMission, resetGame } = useGameStore();
  const { clearEvents } = useEventStore();
  const { clearBlocks } = useScheduleStore();

  const [selectedMission, setSelectedMission] = useState<MissionConfig>(getAllMissions()[0]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('normal');

  const difficulties: DifficultyLevel[] = [
    {
      id: 'easy',
      name: '入门训练',
      description: '1个探测器，4个窗口，无干扰因素',
      scoreMultiplier: 0.8,
      errorMultiplier: 0.5,
      icon: <Target className="w-5 h-5" />,
      color: 'text-green-400 border-green-500 bg-green-500/10',
    },
    {
      id: 'normal',
      name: '常规任务',
      description: '1-2个探测器，6个窗口，有随机干扰',
      scoreMultiplier: 1.0,
      errorMultiplier: 1.0,
      icon: <Rocket className="w-5 h-5" />,
      color: 'text-blue-400 border-blue-500 bg-blue-500/10',
    },
    {
      id: 'hard',
      name: '高级挑战',
      description: '2个探测器，8个窗口，复杂干扰因素',
      scoreMultiplier: 1.5,
      errorMultiplier: 1.5,
      icon: <Satellite className="w-5 h-5" />,
      color: 'text-orange-400 border-orange-500 bg-orange-500/10',
    },
    {
      id: 'expert',
      name: '专家模式',
      description: '多探测器，10+窗口，极端条件模拟',
      scoreMultiplier: 2.0,
      errorMultiplier: 2.0,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-red-400 border-red-500 bg-red-500/10',
    },
  ];

  const handleStartMission = () => {
    resetGame();
    clearEvents();
    clearBlocks();

    const difficulty = difficulties.find(d => d.id === selectedDifficulty);
    const adjustedMission: MissionConfig = {
      ...selectedMission,
      difficulty: selectedDifficulty as any,
      scoreMultiplier: difficulty?.scoreMultiplier || 1.0,
      errorMultiplier: difficulty?.errorMultiplier || 1.0,
    };

    setMission(selectedMission.id, selectedDifficulty);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-deep-950 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(50)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.2,
            }}
            animate={{
              opacity: [Math.random() * 0.3, Math.random() * 0.8, Math.random() * 0.3],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
        
        <motion.div
          className="absolute top-1/4 right-1/4 w-64 h-64"
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        >
          <Orbit className="w-full h-full text-gold-500/10" />
        </motion.div>
      </div>

      <div className="relative z-10 container mx-auto px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <Orbit className="w-12 h-12 text-gold-500" />
            </motion.div>
            <h1 className="text-5xl font-bold font-mono tracking-wider">
              <span className="text-gold-400">航天测控</span>
              <span className="text-white">窗口赛</span>
            </h1>
          </div>
          <p className="text-xl text-deep-400 font-mono tracking-widest">
            AEROSPACE TT&C WINDOW CHALLENGE
          </p>
          <p className="mt-4 text-deep-500 max-w-2xl mx-auto">
            调度地面站资源，在有限的可见窗口内完成探测器数据下载和指令补发任务。
            体验真实航天测控工作的挑战与乐趣。
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-lg font-semibold text-gold-400 mb-4 font-mono flex items-center gap-2">
              <FileText className="w-5 h-5" />
              选择任务
            </h2>
            <div className="space-y-3">
              {getAllMissions().map((mission, index) => (
                <motion.div
                  key={mission.id}
                  whileHover={{ scale: 1.01 }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedMission.id === mission.id
                      ? 'border-gold-500 bg-gold-500/10'
                      : 'border-deep-700 bg-deep-900/50 hover:border-deep-500'
                  }`}
                  onClick={() => setSelectedMission(mission)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gold-400 font-mono text-sm">
                        任务 {index + 1}
                      </span>
                      <h3 className="font-mono text-white">{mission.name}</h3>
                    </div>
                    {selectedMission.id === mission.id && (
                      <ChevronRight className="w-5 h-5 text-gold-400" />
                    )}
                  </div>
                  <p className="text-xs text-deep-400 mb-3">{mission.description}</p>
                  <div className="flex items-center gap-4 text-[10px] text-deep-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Satellite className="w-3 h-3" />
                      {mission.probes.length} 探测器
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(mission.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {mission.dataPackets.length + mission.commands.length} 任务
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      满分 {mission.maxScore}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-gold-400 mb-4 font-mono flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              难度选择
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {difficulties.map((diff) => (
                <motion.div
                  key={diff.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedDifficulty === diff.id
                      ? diff.color
                      : 'border-deep-700 bg-deep-900/50 hover:border-deep-500'
                  }`}
                  onClick={() => setSelectedDifficulty(diff.id)}
                >
                  <div className={`flex items-center gap-2 mb-2 ${
                    selectedDifficulty === diff.id ? diff.color.split(' ')[0] : 'text-deep-400'
                  }`}>
                    {diff.icon}
                    <span className="font-mono font-semibold">{diff.name}</span>
                  </div>
                  <p className="text-xs text-deep-400 mb-2">{diff.description}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-green-400">得分 x{diff.scoreMultiplier}</span>
                    <span className="text-red-400">惩罚 x{diff.errorMultiplier}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-deep-800/50 rounded-lg border border-deep-700">
              <h3 className="text-sm font-semibold text-deep-300 mb-3 font-mono">任务简报</h3>
              <div className="space-y-2 text-xs text-deep-400">
                <div className="flex items-start gap-2">
                  <span className="text-gold-400 mt-0.5">1.</span>
                  <span>在可见窗口内安排<span className="text-green-400">数据下载</span>和<span className="text-blue-400">指令发送</span>任务</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400 mt-0.5">2.</span>
                  <span>注意<span className="text-orange-400">天线转向时间</span>，同一站点的任务不能重叠</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400 mt-0.5">3.</span>
                  <span>按<span className="text-yellow-400">优先级</span>安排任务，高优先级任务先处理</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gold-400 mt-0.5">4.</span>
                  <span>任务完成后查看<span className="text-gold-400">测控报告</span>进行复盘</span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartMission}
              className="w-full mt-6 py-4 bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 rounded-lg font-mono font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-gold-500/20"
            >
              <Play className="w-5 h-5" />
              开始任务
            </motion.button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="grid grid-cols-4 gap-4"
        >
          {[
            { label: '地面站', value: GROUND_STATIONS.length, icon: Satellite, color: 'text-blue-400' },
            { label: '可见窗口', value: selectedMission.visibilityWindows.length, icon: Clock, color: 'text-green-400' },
            { label: '待下载数据', value: selectedMission.dataPackets.length, icon: BarChart3, color: 'text-orange-400' },
            { label: '待发指令', value: selectedMission.commands.length, icon: Zap, color: 'text-purple-400' },
          ].map((stat, index) => (
            <div key={index} className="bg-deep-900/50 rounded-lg p-4 border border-deep-700 text-center">
              <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
              <div className={`text-2xl font-mono font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-xs text-deep-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
