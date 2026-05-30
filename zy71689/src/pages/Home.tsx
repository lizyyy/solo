import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, BookOpen, FileText, TrendingUp, AlertTriangle, Users, Clock, Award } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { formatRelativeTime, formatCurrency, formatNumber } from '@/utils/format';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { getSavedGames, deleteSavedGame } = useGameStore();
  const [savedGames, setSavedGames] = useState<ReturnType<typeof getSavedGames>>([]);

  useEffect(() => {
    setSavedGames(getSavedGames());
  }, [getSavedGames]);

  const features = [
    {
      icon: AlertTriangle,
      title: '突发新闻响应',
      description: '模拟真实市场环境下的突发新闻，训练快速决策能力',
    },
    {
      icon: TrendingUp,
      title: '实时净值反馈',
      description: '每次评级调整立即影响组合净值，直观感受决策后果',
    },
    {
      icon: AlertTriangle,
      title: '异常诊断系统',
      description: '自动识别数据问题、规则问题和材料问题，精确定位错误根源',
    },
    {
      icon: FileText,
      title: '完整复盘报告',
      description: '生成详细的操作痕迹、错因分析和改进建议报告',
    },
  ];

  const gameModes = [
    {
      mode: 'standard',
      title: '标准模式',
      description: '5回合挑战，每回合60秒响应时间，适合有基础的学生',
      icon: Play,
      color: 'from-emerald-500 to-teal-600',
      time: '60秒/回合',
      rounds: '5回合',
    },
    {
      mode: 'tutorial',
      title: '新手教学',
      description: '引导式教程，每回合90秒，附带详细提示和解释',
      icon: BookOpen,
      color: 'from-blue-500 to-cyan-600',
      time: '90秒/回合',
      rounds: '5回合',
    },
    {
      mode: 'sample',
      title: '新人样例',
      description: '自动演示完整流程，从导入到报告导出，适合新人交接',
      icon: Users,
      color: 'from-amber-500 to-orange-600',
      time: '自动演示',
      rounds: '3回合',
    },
  ];

  const handleStartGame = (mode: string) => {
    if (mode === 'sample') {
      navigate('/game/sample');
    } else {
      navigate(`/game/${mode}`);
    }
  };

  const handleLoadGame = (gameId: string) => {
    navigate(`/review/${gameId}`);
  };

  const handleDeleteGame = (e: React.MouseEvent, gameId: string) => {
    e.stopPropagation();
    deleteSavedGame(gameId);
    setSavedGames(getSavedGames());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxZTJhM2IiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0tOCAwaC0ydi00aDJ2NHptLTggMGgtMnYtNGgydjR6bTE2LTZoLTJ2LTRoMnY0em0tOCAwaC0ydi00aDJ2NHptLTggMGgtMnYtNGgydjR6bTE2LTZoLTJWMTBoMnY0em0tOCAwaC0yVjEwaDJ2NHptLTggMGgtMlYxMGgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
              <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-red-400 text-sm font-medium">实时模拟 · 决策训练</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                债券评级急救室
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
              在时间压力下做出正确的债券评级决策，实时监控组合净值变化，
              通过智能异常诊断系统快速定位问题根源，生成完整复盘报告。
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-gray-300">限时决策</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-300">实时净值</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-gray-300">异常诊断</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-300">复盘报告</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid md:grid-cols-3 gap-6 mb-16"
          >
            {gameModes.map((mode, index) => (
              <motion.div
                key={mode.mode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden cursor-pointer"
                onClick={() => handleStartGame(mode.mode)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-10 transition-opacity`} />

                <div className="p-6">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${mode.color} mb-4`}>
                    <mode.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{mode.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{mode.description}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {mode.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {mode.rounds}
                    </span>
                  </div>

                  <button className={`w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r ${mode.color} opacity-90 hover:opacity-100 transition-opacity`}>
                    开始{mode.title}
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-bold text-white mb-8 text-center">核心功能</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6"
                >
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {savedGames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6">最近游戏记录</h2>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                <div className="divide-y divide-slate-700">
                  {savedGames.slice(0, 5).map((saved) => (
                    <div
                      key={saved.gameId}
                      className="p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => handleLoadGame(saved.gameId)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {saved.game.mode === 'standard' ? '标准模式' : saved.game.mode === 'tutorial' ? '新手教学' : '新人样例'}
                          </div>
                          <div className="text-sm text-gray-400">
                            {formatRelativeTime(saved.savedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-white font-semibold">
                            {formatCurrency(saved.game.currentNav)}
                          </div>
                          <div className={`text-sm ${saved.game.totalScore >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {saved.game.totalScore >= 0 ? '+' : ''}{formatNumber(saved.game.totalScore, 0)} 分
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteGame(e, saved.gameId)}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-center mt-16 text-sm text-gray-500"
          >
            <p>💡 提示：新人交接请使用"新人样例"模式，系统将自动演示完整流程</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Home;
