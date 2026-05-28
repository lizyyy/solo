import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Scroll, BookOpen, History, Play } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { levels } from '../data/levels';
import { GameSession } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const { replaySessions, loadSessions, startNewGame } = useGameStore();
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleStartGame = (levelId: string) => {
    startNewGame(levelId);
    navigate(`/game/${levelId}`);
  };

  const handleReplay = (sessionId: string) => {
    navigate(`/replay/${sessionId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-paper-100 bg-paper-texture flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ scaleY: 0.1, opacity: 0 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        className="w-full max-w-4xl bg-gradient-to-b from-paper-50 to-paper-100 rounded-lg shadow-scroll border-4 border-paper-300 relative overflow-hidden"
        style={{ transformOrigin: 'top center' }}
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-paper-400 via-paper-300 to-paper-400" />
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-paper-400 via-paper-300 to-paper-400" />

        <div className="p-12">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-4 mb-4">
              <Scroll className="w-12 h-12 text-ink-400" />
              <h1 className="text-5xl font-kai text-ink-400 text-shadow-ink tracking-wider">
                古画鉴定线索局
              </h1>
              <Scroll className="w-12 h-12 text-ink-400 transform scale-x-[-1]" />
            </div>
            <p className="text-lg text-ink-200 font-song">
              穿越时空，探寻古画的秘密
            </p>
            <div className="flex justify-center gap-2 mt-6">
              <span className="w-3 h-3 rounded-full bg-seal-300" />
              <span className="w-3 h-3 rounded-full bg-lapis-300" />
              <span className="w-3 h-3 rounded-full bg-bronze-300" />
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mb-12"
          >
            <div className="bg-paper-50 rounded-lg p-6 border border-paper-300 shadow-inner">
              <h2 className="text-xl font-kai text-ink-300 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                游戏简介
              </h2>
              <p className="text-ink-200 font-song leading-relaxed mb-4">
                欢迎来到古画鉴定线索局！在这里，您将扮演一位文物鉴定专家，
                通过分析古画的纸张、印章、题跋、修复痕迹等线索，
                运用专业知识进行推理判断，揭开画作的真伪之谜。
              </p>
              <div className="grid grid-cols-5 gap-4 mt-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-paper-200 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl">📜</span>
                  </div>
                  <span className="text-sm text-ink-200">纸张分析</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-paper-200 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl">🔴</span>
                  </div>
                  <span className="text-sm text-ink-200">印章鉴别</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-paper-200 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl">✍️</span>
                  </div>
                  <span className="text-sm text-ink-200">题跋考证</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-paper-200 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl">🔧</span>
                  </div>
                  <span className="text-sm text-ink-200">修复痕迹</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto bg-paper-200 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl">📋</span>
                  </div>
                  <span className="text-sm text-ink-200">科学检测</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.8 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-kai text-ink-300 flex items-center gap-2">
              <Play className="w-5 h-5" />
              选择关卡
            </h2>

            <div className="grid gap-4">
              {levels.map((level, index) => (
                <motion.div
                  key={level.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-r from-paper-50 to-paper-100 rounded-lg p-6 border-2 border-paper-300 hover:border-seal-200 cursor-pointer transition-all duration-300 shadow-md hover:shadow-lg group"
                  onClick={() => handleStartGame(level.id)}
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-kai text-ink-300 group-hover:text-seal-300 transition-colors">
                          {level.title}
                        </h3>
                        <div className="flex gap-1">
                          {[...Array(level.difficulty)].map((_, i) => (
                            <span key={i} className="text-seal-300">★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-ink-200 font-song text-sm">
                        {level.description}
                      </p>
                    </div>
                    <div className="ml-6">
                      <div className="w-16 h-16 rounded-full bg-seal-100 flex items-center justify-center group-hover:bg-seal-200 transition-colors">
                        <span className="text-seal-300 font-kai text-2xl">鉴</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="mt-12"
          >
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-ink-200 hover:text-ink-300 transition-colors font-kai"
            >
              <History className="w-5 h-5" />
              <span>历史记录</span>
              <span className="text-sm">({replaySessions.length})</span>
            </button>

            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-4 space-y-3 max-h-64 overflow-y-auto"
              >
                {replaySessions.length === 0 ? (
                  <p className="text-ink-200 text-center py-8 font-song">
                    暂无历史记录，开始您的第一次鉴定吧！
                  </p>
                ) : (
                  replaySessions.map((session: GameSession) => (
                    <div
                      key={session.id}
                      onClick={() => handleReplay(session.id)}
                      className="bg-paper-50 rounded-lg p-4 border border-paper-300 hover:border-lapis-200 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-kai text-ink-300">
                          {levels.find(l => l.id === session.levelId)?.title}
                        </p>
                        <p className="text-sm text-ink-200 font-song">
                          {formatDate(session.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-seal-300">
                            {session.score?.totalScore || 0}
                          </span>
                          <span className="text-ink-200">分</span>
                          <span className="text-3xl font-kai text-seal-300">
                            {session.score?.grade || 'D'}
                          </span>
                        </div>
                        <p className="text-sm text-ink-200 font-song">
                          用时：{formatTime(session.endTime ? Math.round((session.endTime - session.startTime) / 1000) : 0)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="mt-8 text-ink-200 font-song text-sm"
      >
        故宫博物院 · 古画鉴定教育体验项目
      </motion.p>
    </div>
  );
}
