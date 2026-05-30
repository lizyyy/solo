import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Music, Train, Users, Play, Info, Star, Zap, Clock } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { Difficulty } from '@/types/game';

const Home = () => {
  const navigate = useNavigate();
  const { startGame, difficulty: currentDifficulty } = useGameStore();

  const difficulties: { level: Difficulty; label: string; desc: string; color: string }[] = [
    { level: 'easy', label: '简单', desc: 'BPM 80，客流较慢', color: 'from-green-500 to-emerald-500' },
    { level: 'normal', label: '普通', desc: 'BPM 100，标准挑战', color: 'from-blue-500 to-cyan-500' },
    { level: 'hard', label: '困难', desc: 'BPM 120，极限挑战', color: 'from-red-500 to-orange-500' },
  ];

  const handleStartGame = (difficulty: Difficulty) => {
    startGame(difficulty);
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-8 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-purple-500/5 rounded-full" />
      </div>

      <motion.div
        className="relative z-10 text-center mb-12"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex items-center justify-center gap-4 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <Train className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <Music className="w-12 h-12 text-purple-400" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-4">
          节奏地铁调度战
        </h1>
        <p className="text-xl text-gray-400 max-w-xl mx-auto">
          跟随节拍，精准发车。在音乐节奏中体验地铁调度的魅力
        </p>
      </motion.div>

      <motion.div
        className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl w-full"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {difficulties.map((diff, index) => (
          <motion.button
            key={diff.level}
            onClick={() => handleStartGame(diff.level)}
            className={`relative p-6 rounded-2xl border-2 bg-gradient-to-br ${diff.color} bg-opacity-10 backdrop-blur-sm
              hover:scale-105 transition-all duration-300 group
              ${currentDifficulty === diff.level ? 'border-white shadow-lg' : 'border-gray-600 hover:border-gray-400'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            whileHover={{ y: -5 }}
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${diff.color} opacity-0 group-hover:opacity-20 transition-opacity`} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-400" />
                <span className="text-2xl font-bold text-white">{diff.label}</span>
              </div>
              <p className="text-gray-300 text-sm">{diff.desc}</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-white/80">
                <Play className="w-5 h-5" />
                <span>开始游戏</span>
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-3xl w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl backdrop-blur-sm">
          <Zap className="w-8 h-8 text-cyan-400 mb-2" />
          <span className="text-sm text-gray-300">精准判定</span>
          <span className="text-xs text-gray-500">毫秒级响应</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl backdrop-blur-sm">
          <Clock className="w-8 h-8 text-purple-400 mb-2" />
          <span className="text-sm text-gray-300">随时暂停</span>
          <span className="text-xs text-gray-500">断点续玩</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl backdrop-blur-sm">
          <Users className="w-8 h-8 text-green-400 mb-2" />
          <span className="text-sm text-gray-300">客流管理</span>
          <span className="text-xs text-gray-500">防止溢出</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-800/50 rounded-xl backdrop-blur-sm">
          <Info className="w-8 h-8 text-yellow-400 mb-2" />
          <span className="text-sm text-gray-300">教学报告</span>
          <span className="text-xs text-gray-500">数据复盘</span>
        </div>
      </motion.div>

      <motion.div
        className="relative z-10 max-w-2xl w-full p-6 bg-gray-800/50 rounded-2xl border border-gray-700 backdrop-blur-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
      >
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-cyan-400" />
          游戏规则
        </h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">●</span>
            跟随节拍点击屏幕或按空格键发车
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">●</span>
            精准点击可获得 Perfect/Good 评价，减少站台客流
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">●</span>
            过早或过晚点击会导致拍点偏移，影响分数
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400">●</span>
            错过节拍或发车间隔过短会导致站台拥堵
          </li>
        </ul>
      </motion.div>
    </div>
  );
};

export default Home;
