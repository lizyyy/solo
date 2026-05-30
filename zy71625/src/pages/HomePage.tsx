import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { Disc, Play, History, User } from 'lucide-react';

export const HomePage = () => {
  const navigate = useNavigate();
  const { startGame, loadFromLocalStorage } = useGameStore();
  const [playerName, setPlayerName] = useState('');

  const handleStartGame = () => {
    startGame(playerName || '店员');
    navigate('/game');
  };

  const handleContinueGame = () => {
    loadFromLocalStorage();
    navigate('/game');
  };

  const hasSavedGame = localStorage.getItem('vinylGameState') !== null;

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-block mb-6"
          >
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-4 border-[#D4A574] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full border border-white/5"
                    style={{ width: `${30 + i * 15}%`, height: `${30 + i * 15}%` }}
                  />
                ))}
              </div>
              <Disc size={48} className="text-[#D4A574] relative z-10" />
            </div>
          </motion.div>

          <h1 className="text-5xl text-[#D4A574] font-serif mb-4 tracking-wider">
            黑胶修复工坊赛
          </h1>
          <p className="text-white/60 font-serif text-lg">
            培训唱片修复技艺，掌握噪声分析、划痕判断、清洗操作的完整流程
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#1a1a1a] rounded-2xl border border-[#D4A574]/30 p-8 space-y-6"
        >
          <div>
            <label className="block text-[#D4A574] font-serif mb-2 flex items-center gap-2">
              <User size={18} />
              店员姓名
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full px-4 py-3 rounded-lg bg-black/30 border border-[#D4A574]/30 text-white font-serif focus:outline-none focus:border-[#D4A574] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartGame}
              className="flex items-center justify-center gap-3 py-4 rounded-xl bg-[#D4A574] text-[#2C1810] font-serif text-lg hover:bg-[#E5B685] transition-colors"
            >
              <Play size={24} />
              开始新游戏
            </motion.button>

            {hasSavedGame && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinueGame}
                className="flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-[#D4A574]/30 text-[#D4A574] font-serif text-lg hover:bg-[#D4A574]/10 transition-colors"
              >
                <History size={24} />
                继续游戏
              </motion.button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 grid grid-cols-3 gap-4"
        >
          {[
            { icon: '🔍', title: '划痕检测', desc: '精准识别划痕位置与严重程度' },
            { icon: '🧴', title: '清洗操作', desc: '选择合适的清洗剂与剂量' },
            { icon: '🎧', title: '试听验证', desc: '记录试听结果完成修复报告' },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6 text-center"
            >
              <div className="text-4xl mb-3">{item.icon}</div>
              <h3 className="text-[#D4A574] font-serif mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center text-white/30 text-xs font-serif"
        >
          <p>系统会自动区分系统导出数据和人工填写备注</p>
          <p>划痕误判、清洗过度、试听漏记录三类错误独立统计</p>
        </motion.div>
      </div>
    </div>
  );
};
