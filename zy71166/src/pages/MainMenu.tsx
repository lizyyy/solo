import { useState, useEffect } from 'react';
import { Play, BookOpen, History, ThermometerSun, Zap, Wind, ChevronRight, Trophy, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../engine/config';
import { loadReplays, clearAllReplays } from '../engine/replay';
import type { ReplayRecord } from '../engine/types';
import { formatHour } from '../utils/temperature';

type TabType = 'levels' | 'tutorial' | 'history';

export default function MainMenu() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('levels');
  const [replays, setReplays] = useState<ReplayRecord[]>([]);

  useEffect(() => {
    if (activeTab === 'history') {
      setReplays(loadReplays());
    }
  }, [activeTab]);

  const handleStartLevel = (levelId: string) => {
    navigate(`/game/${levelId}`);
  };

  const handleViewReplay = (gameId: string) => {
    navigate(`/replay/${gameId}`);
  };

  const handleClearHistory = () => {
    if (confirm('确定要清除所有历史记录吗？')) {
      clearAllReplays();
      setReplays([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-2xl">
              <ThermometerSun size={40} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                机房降温策略
              </h1>
              <p className="text-slate-400 text-lg mt-1">数据中心热管理模拟器</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-8">
          {[
            { id: 'levels' as const, label: '关卡选择', icon: <Play size={16} /> },
            { id: 'tutorial' as const, label: '玩法说明', icon: <BookOpen size={16} /> },
            { id: 'history' as const, label: '历史记录', icon: <History size={16} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-5xl">
          {activeTab === 'levels' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {LEVELS.map((level, index) => (
                <div
                  key={level.id}
                  className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer"
                  onClick={() => handleStartLevel(level.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      level.difficulty === 'easy' ? 'bg-green-500/20 text-green-400'
                        : level.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {level.difficulty === 'easy' ? '简单' : level.difficulty === 'medium' ? '中等' : '困难'}
                    </span>
                    <span className="text-slate-500 text-sm">第 {index + 1} 关</span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-cyan-400 transition-colors">
                    {level.name}
                  </h3>

                  <p className="text-slate-400 text-sm mb-4 line-clamp-3">
                    {level.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Zap size={14} className="text-cyan-400" />
                      {level.rackCount} 个机柜
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Wind size={14} className="text-blue-400" />
                      {level.acCount} 台空调
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Clock size={14} className="text-yellow-400" />
                      {level.totalTurns} 回合
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <DollarSign size={14} className="text-green-400" />
                      预算 ¥{level.budget}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      目标得分: <span className="text-cyan-400 font-medium">{level.targetScore}</span>
                    </span>
                    <div className="flex items-center gap-1 text-cyan-400 group-hover:gap-2 transition-all">
                      <span className="text-sm">开始挑战</span>
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tutorial' && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-2">
                <BookOpen className="text-cyan-400" />
                游戏玩法说明
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-bold text-cyan-400 mb-4">游戏目标</h3>
                  <p className="text-slate-300 mb-4">
                    作为数据中心运维工程师，你需要管理机房的温度和负载，在控制电费的同时，确保所有机柜温度在安全范围内，完成所有回合挑战。
                  </p>

                  <h3 className="text-lg font-bold text-cyan-400 mb-4 mt-6">操作指南</h3>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><strong className="text-slate-100">空调控制</strong>：开关空调机组，调节设定温度</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><strong className="text-slate-100">负载迁移</strong>：将高负载机柜的任务迁移到低负载机柜</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><strong className="text-slate-100">回合推进</strong>：点击"下一回合"执行物理模拟</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span><strong className="text-slate-100">视角切换</strong>：3D视图与俯视图切换</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} />
                    失败条件
                  </h3>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>机柜温度超过 42°C 持续一回合</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>总制冷需求超过空调额定容量 120%</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-1">•</span>
                      <span>累计电费超过预算 300%</span>
                    </li>
                  </ul>

                  <h3 className="text-lg font-bold text-yellow-400 mb-4 mt-6">计分规则</h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li>• 每存活一回合 +100 分</li>
                    <li>• 平均温度低于 30°C 每度 +50 分</li>
                    <li>• 电费按 10:1 扣分</li>
                    <li>• 温度告警每台 -200 分</li>
                    <li>• 负载均衡奖励最高 +300 分</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <History className="text-cyan-400" />
                  历史记录
                </h2>
                {replays.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    清除全部
                  </button>
                )}
              </div>

              {replays.length === 0 ? (
                <div className="text-center py-16">
                  <History size={48} className="mx-auto text-slate-600 mb-4" />
                  <p className="text-slate-400">暂无游戏记录</p>
                  <p className="text-slate-500 text-sm mt-2">完成一局游戏后，记录会自动保存</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {replays.map((replay) => (
                    <div
                      key={replay.gameId}
                      className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30 hover:border-cyan-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            replay.gamePhase === 'won' ? 'bg-green-500/20 text-green-400'
                              : replay.gamePhase === 'lost' ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {replay.gamePhase === 'won' ? '挑战成功' : replay.gamePhase === 'lost' ? '挑战失败' : '进行中'}
                          </span>
                          <span className="text-slate-300 font-medium">{replay.levelName}</span>
                        </div>
                        <button
                          onClick={() => handleViewReplay(replay.gameId)}
                          className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          查看回放 <ChevronRight size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">得分</span>
                          <div className="text-cyan-400 font-bold flex items-center gap-1">
                            <Trophy size={14} />
                            {replay.finalScore}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">回合</span>
                          <div className="text-slate-200">
                            {replay.completedTurns}/{replay.totalTurns}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">电费</span>
                          <div className="text-green-400">¥{replay.totalCost.toFixed(0)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">时间</span>
                          <div className="text-slate-400 text-xs">
                            {new Date(replay.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      </div>

                      {replay.failReason && (
                        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-300">
                          失败原因: {replay.failReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-center py-6 text-slate-600 text-sm">
        机房降温策略游戏 · 数据中心运维培训模拟器
      </div>
    </div>
  );
}
