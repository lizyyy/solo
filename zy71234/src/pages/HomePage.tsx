import { motion } from 'framer-motion';
import { Play, BookOpen, Music, Users, FileText } from 'lucide-react';
import { useGameStore } from '../stores/useGameStore';

export function HomePage() {
  const setCurrentPage = useGameStore(state => state.setCurrentPage);

  const features = [
    {
      icon: <Music className="w-8 h-8" />,
      title: '卡牌谈判',
      description: '通过卡牌选择模拟真实版权谈判场景'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: '三方博弈',
      description: '平衡词曲、录音、发行三方利益关系'
    },
    {
      icon: <FileText className="w-8 h-8" />,
      title: '风险识别',
      description: '学习识别合同漏洞和版权陷阱'
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="inline-block mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="text-7xl"
            >
              🎵
            </motion.div>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-serif font-bold mb-4 text-gold-gradient">
            音乐版权谈判牌
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            通过卡牌游戏模拟词曲、录音、发行三方的版权谈判
            <br />
            让新人在游戏中掌握版权分成、合同条款、风险识别的核心技能
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 mb-16"
        >
          <button
            onClick={() => setCurrentPage('levels')}
            className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-music-gold to-music-gold-light 
              text-music-dark font-bold text-lg rounded-xl
              hover:shadow-lg hover:shadow-music-gold/30 hover:scale-105
              transition-all duration-300"
          >
            <Play className="w-6 h-6 group-hover:scale-110 transition-transform" />
            开始游戏
          </button>
          
          <button
            onClick={() => alert('规则说明：\n1. 选择卡牌进行谈判\n2. 调整三方分成比例\n3. 识别合同漏洞\n4. 完成结算获得评分')}
            className="flex items-center gap-3 px-8 py-4 bg-music-card border border-music-gold/30 
              text-music-gold font-bold text-lg rounded-xl
              hover:bg-music-gold/10 hover:border-music-gold
              transition-all duration-300"
          >
            <BookOpen className="w-6 h-6" />
            规则说明
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
              className="bg-music-card rounded-xl p-6 border border-white/10
                hover:border-music-gold/50 hover:shadow-lg hover:shadow-music-gold/10
                transition-all duration-300"
            >
              <div className="text-music-gold mb-4">{feature.icon}</div>
              <h3 className="font-serif text-lg font-bold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-music-card/50 rounded-full border border-music-gold/20">
            <span className="text-gray-400">关卡设计：</span>
            <span className="text-music-gold">卡牌谈判</span>
            <span className="text-gray-600">→</span>
            <span className="text-music-gold">分成结算</span>
            <span className="text-gray-600">→</span>
            <span className="text-music-gold">条款冲突</span>
            <span className="text-gray-600">→</span>
            <span className="text-music-gold">信誉评分</span>
            <span className="text-gray-600">→</span>
            <span className="text-music-gold">报告导出</span>
          </div>
        </motion.div>
      </div>

      <div className="py-6 text-center text-gray-500 text-sm">
        © 2024 音乐版权谈判培训工具
      </div>
    </div>
  );
}
