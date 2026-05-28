import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, BarChart3, Shield, Upload, PlayCircle, Disc3 } from 'lucide-react';
import { NeonButton } from '../components/ui';
import { NeonCard } from '../components/ui';
import { useGameStore } from '../store/useGameStore';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut' as const,
    },
  },
};

const featureCards = [
  {
    icon: Zap,
    title: '沉浸式模拟',
    description: '像真实巡演一样做决策，每一站都有票房风险、库存压力、现金流挑战',
    borderColor: 'neon-pink' as const,
  },
  {
    icon: BarChart3,
    title: '数据化复盘',
    description: '游戏结束后获得完整财务报告，每一笔收支都有迹可循，每一个决策都有量化分析',
    borderColor: 'neon-cyan' as const,
  },
  {
    icon: Shield,
    title: '风险感知训练',
    description: '识别异常值、缺失值、逻辑矛盾，在脏数据中训练你的数据敏感度和风险判断力',
    borderColor: 'neon-purple' as const,
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [loadingSample, setLoadingSample] = useState<'normal' | 'critical' | 'dirty' | null>(null);
  const { currentTour, gamePhase, currentStopIndex, stops, resetGame } = useGameStore();

  useEffect(() => {
    const saved = currentTour && gamePhase !== 'setup' && gamePhase !== 'import';
    setHasSavedGame(!!saved);
  }, [currentTour, gamePhase]);

  const handleSampleData = async (type: 'normal' | 'critical' | 'dirty') => {
    setLoadingSample(type);
    try {
      resetGame();
      await navigate('/import', { state: { sampleType: type } });
    } catch (error) {
      console.error('加载样例数据失败:', error);
    } finally {
      setLoadingSample(null);
    }
  };

  const handleUpload = () => {
    resetGame();
    navigate('/import');
  };

  const handleContinue = () => {
    navigate('/game');
  };

  return (
    <div className="min-h-screen bg-rock-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" />
      
      <motion.div
        className="absolute top-20 left-10 w-64 h-64 bg-neon-pink rounded-full filter blur-[120px] opacity-30 animate-pulse-slow"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-80 h-80 bg-neon-cyan rounded-full filter blur-[120px] opacity-30 animate-pulse-slow"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.15, 0.3],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-neon-purple rounded-full filter blur-[150px] opacity-20 animate-pulse-slow"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <Disc3 className="w-20 h-20 text-neon-pink mx-auto mb-6 animate-spin-slow" />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-rock text-6xl md:text-8xl mb-4 text-white neon-glow-pink tracking-wider"
          >
            乐队巡演预算赛
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl"
          >
            用小游戏练巡演预算，玩完拿到完整复盘
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 w-full"
          >
            {featureCards.map((card, index) => (
              <NeonCard
                key={card.title}
                borderColor={card.borderColor}
                className="text-left h-full"
              >
                <div className="flex flex-col h-full">
                  <div
                    className={`w-14 h-14 rounded-lg flex items-center justify-center mb-4 ${
                      card.borderColor === 'neon-pink'
                        ? 'bg-neon-pink/20'
                        : card.borderColor === 'neon-cyan'
                        ? 'bg-neon-cyan/20'
                        : 'bg-neon-purple/20'
                    }`}
                  >
                    <card.icon
                      className={`w-7 h-7 ${
                        card.borderColor === 'neon-pink'
                          ? 'text-neon-pink'
                          : card.borderColor === 'neon-cyan'
                          ? 'text-neon-cyan'
                          : 'text-neon-purple'
                      }`}
                    />
                  </div>
                  <h3 className="font-rock text-xl text-white mb-3 tracking-wide">
                    {card.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed flex-grow">
                    {card.description}
                  </p>
                </div>
              </NeonCard>
            ))}
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8">
            <h3 className="font-rock text-lg text-gray-400 mb-6 tracking-wider">
              — 选择样例数据开始 —
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              <NeonButton
                variant="success"
                size="lg"
                onClick={() => handleSampleData('normal')}
                loading={loadingSample === 'normal'}
              >
                ✓ 正常数据
              </NeonButton>
              <NeonButton
                variant="warning"
                size="lg"
                onClick={() => handleSampleData('critical')}
                loading={loadingSample === 'critical'}
              >
                ⚠ 临界数据
              </NeonButton>
              <NeonButton
                variant="danger"
                size="lg"
                onClick={() => handleSampleData('dirty')}
                loading={loadingSample === 'dirty'}
              >
                ✗ 脏数据
              </NeonButton>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex items-center gap-6 mb-12">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-rock-light" />
            <span className="text-gray-500 font-rock text-sm tracking-widest">或</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-rock-light" />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8">
            <NeonButton
              variant="secondary"
              size="lg"
              onClick={handleUpload}
              className="gap-3"
            >
              <Upload className="w-5 h-5" />
              上传自己的数据
            </NeonButton>
          </motion.div>

          {hasSavedGame && currentTour && (
            <motion.div
              variants={itemVariants}
              className="w-full max-w-md"
            >
              <div className="bg-rock-darker/80 border-2 border-neon-cyan/50 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse" />
                  <span className="text-neon-cyan font-rock text-sm tracking-wider">
                    已保存的巡演
                  </span>
                </div>
                <h4 className="font-rock text-xl text-white mb-2">
                  {currentTour.name}
                </h4>
                {currentTour.bandName && (
                  <p className="text-gray-400 text-sm mb-4">
                    {currentTour.bandName}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    进度: {currentStopIndex + 1} / {stops.length} 站
                  </span>
                  <span className="text-neon-cyan font-mono">
                    ¥{useGameStore.getState().cashFlow.toLocaleString()}
                  </span>
                </div>
              </div>
              <NeonButton
                variant="secondary"
                size="lg"
                onClick={handleContinue}
                className="w-full gap-3"
              >
                <PlayCircle className="w-5 h-5" />
                继续游戏
              </NeonButton>
            </motion.div>
          )}

          <motion.footer variants={itemVariants} className="mt-16 text-gray-500 text-sm">
            <p>CSV / Excel 格式支持 · 巡演信息 · 站点列表 · 周边商品</p>
          </motion.footer>
        </motion.div>
      </div>
    </div>
  );
}
