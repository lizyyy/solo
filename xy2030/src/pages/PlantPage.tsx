import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Droplets,
  Sparkles,
  Info,
  Trophy,
  TrendingUp,
  Edit3,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/Header';

const plantStages = [
  { level: 0, name: '种子', emoji: '🌰', description: '刚刚种下，期待发芽' },
  { level: 1, name: '嫩芽', emoji: '🌱', description: '破土而出，开始成长' },
  { level: 2, name: '小苗', emoji: '🌿', description: '茁壮成长中...' },
  { level: 3, name: '开花', emoji: '🌸', description: '绽放美丽的花朵' },
  { level: 4, name: '大树', emoji: '🌳', description: '你已经是e人啦！' },
];

const getPlantStage = (growth: number): typeof plantStages[0] => {
  if (growth >= 80) return plantStages[4];
  if (growth >= 60) return plantStages[3];
  if (growth >= 40) return plantStages[2];
  if (growth >= 20) return plantStages[1];
  return plantStages[0];
};

const getGrowthProgress = (growth: number): number => {
  const stage = getPlantStage(growth);
  const stageIndex = plantStages.findIndex(s => s.level === stage.level);
  const prevGrowth = stageIndex * 20;
  const nextGrowth = (stageIndex + 1) * 20;
  return ((growth - prevGrowth) / (nextGrowth - prevGrowth)) * 100;
};

export default function PlantPage() {
  const { plant, waterPlant, fertilizePlant, updatePlantName, addSocialSteps } = useAppStore();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [plantName, setPlantName] = useState(plant.name);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [showWaterAnimation, setShowWaterAnimation] = useState(false);
  const [showFertilizeAnimation, setShowFertilizeAnimation] = useState(false);

  const stage = getPlantStage(plant.growth);
  const nextStage = plantStages.find(s => s.level === stage.level + 1);

  const canWaterToday = () => {
    const lastWatered = plant.lastWateredAt ? new Date(plant.lastWateredAt) : null;
    if (!lastWatered) return true;
    const today = new Date();
    return lastWatered.toDateString() !== today.toDateString();
  };

  const canFertilizeToday = () => {
    const lastFertilized = plant.lastFertilizedAt ? new Date(plant.lastFertilizedAt) : null;
    if (!lastFertilized) return true;
    const today = new Date();
    return lastFertilized.toDateString() !== today.toDateString();
  };

  const handleWater = () => {
    if (!canWaterToday()) return;
    setShowWaterAnimation(true);
    setTimeout(() => {
      waterPlant();
      addSocialSteps(1);
      setShowSuccess('浇水成功！+1 社交步数');
      setShowWaterAnimation(false);
      setTimeout(() => setShowSuccess(null), 2000);
    }, 1000);
  };

  const handleFertilize = () => {
    if (!canFertilizeToday()) return;
    setShowFertilizeAnimation(true);
    setTimeout(() => {
      fertilizePlant();
      addSocialSteps(3);
      setShowSuccess('施肥成功！+3 社交步数');
      setShowFertilizeAnimation(false);
      setTimeout(() => setShowSuccess(null), 2000);
    }, 1000);
  };

  const handleSaveName = () => {
    if (plantName.trim()) {
      updatePlantName(plantName.trim());
    } else {
      setPlantName(plant.name);
    }
    setIsEditingName(false);
  };

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-green-50 to-emerald-100">
      <Header
        title="i人陪伴植物"
        showBack
      />
      
      <div className="p-4">
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-20 left-4 right-4 z-50 bg-green-500 text-white py-3 px-4 rounded-xl shadow-lg flex items-center justify-center"
            >
              <Check className="w-5 h-5 mr-2" />
              {showSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="card card-green relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-e-200 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-e-200 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />
            
            <div className="relative">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center mb-2">
                  {isEditingName ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={plantName}
                        onChange={(e) => setPlantName(e.target.value)}
                        className="text-lg font-semibold text-e-700 bg-transparent border-b-2 border-e-400 focus:outline-none text-center w-32"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        className="ml-2 p-1 bg-e-500 text-white rounded-full"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="flex items-center group"
                    >
                      <h2 className="text-xl font-bold text-e-700">{plant.name}</h2>
                      <Edit3 className="w-4 h-4 text-e-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-e-600">
                  {stage.name} • {stage.description}
                </p>
              </div>

              <div className="relative h-48 flex items-center justify-center mb-6">
                {showWaterAnimation && (
                  <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: [0, 1, 0], y: [-50, 0, 50] }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-6xl">💧</div>
                  </motion.div>
                )}
                
                {showFertilizeAnimation && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-6xl">✨</div>
                  </motion.div>
                )}

                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 2, -2, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-9xl"
                >
                  {stage.emoji}
                </motion.div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>成长进度</span>
                  <span className="font-medium text-e-600">{plant.growth}%</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${plant.growth}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-e-400 to-e-600 rounded-full relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  </motion.div>
                </div>
                {nextStage && (
                  <p className="text-xs text-gray-500 mt-2">
                    距离 {nextStage.name} 还需要 {Math.max(0, (nextStage.level + 1) * 20 - plant.growth)} 点成长值
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleWater}
                  disabled={!canWaterToday()}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all ${
                    canWaterToday()
                      ? 'bg-blue-100 hover:bg-blue-200 active:scale-95'
                      : 'bg-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Droplets className={`w-8 h-8 mb-2 ${canWaterToday() ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${canWaterToday() ? 'text-blue-700' : 'text-gray-500'}`}>
                    浇水
                  </span>
                  <span className="text-xs text-blue-500 mt-1">
                    {canWaterToday() ? '+5 成长值' : '今日已浇'}
                  </span>
                </button>

                <button
                  onClick={handleFertilize}
                  disabled={!canFertilizeToday()}
                  className={`flex flex-col items-center p-4 rounded-xl transition-all ${
                    canFertilizeToday()
                      ? 'bg-amber-100 hover:bg-amber-200 active:scale-95'
                      : 'bg-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className={`w-8 h-8 mb-2 ${canFertilizeToday() ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${canFertilizeToday() ? 'text-amber-700' : 'text-gray-500'}`}>
                    施肥
                  </span>
                  <span className="text-xs text-amber-500 mt-1">
                    {canFertilizeToday() ? '+10 成长值' : '今日已施'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">成长历程</h3>
          <div className="space-y-2">
            {plantStages.map((s, index) => (
              <motion.div
                key={s.level}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className={`flex items-center p-3 rounded-xl ${
                  plant.growth >= (s.level + 1) * 20
                    ? 'bg-e-100'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <span className="text-2xl mr-3">{s.emoji}</span>
                <div className="flex-1">
                  <p className={`font-medium ${
                    plant.growth >= (s.level + 1) * 20 ? 'text-e-700' : 'text-gray-600'
                  }`}>
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-500">{s.description}</p>
                </div>
                {plant.growth >= (s.level + 1) * 20 && (
                  <Trophy className="w-5 h-5 text-e-500" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <Info className="w-5 h-5 text-e-500 mr-2" />
              如何获得成长值
            </h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                  <Droplets className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">每日浇水</p>
                  <p className="text-xs text-gray-500">+5 成长值，+1 社交步数</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-3 flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">每日施肥</p>
                  <p className="text-xs text-gray-500">+10 成长值，+3 社交步数</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-e-100 flex items-center justify-center mr-3 flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-e-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">社交练习</p>
                  <p className="text-xs text-gray-500">完成聊天、发帖、日记打卡等获得成长值</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="p-4 bg-gradient-to-r from-e-100 to-green-100 rounded-xl border border-e-200">
            <div className="flex items-start">
              <TrendingUp className="w-6 h-6 text-e-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-e-700 mb-1">当前状态</h3>
                <p className="text-sm text-e-600">
                  {plant.growth >= 80 
                    ? '🎉 恭喜！你已经完全成为e人了！你的植物也长成了大树！'
                    : plant.growth >= 60
                    ? '🌸 你正在快速成长！继续保持，离e人不远了！'
                    : plant.growth >= 40
                    ? '🌿 成长中... 多练习社交，植物会更快成长哦！'
                    : plant.growth >= 20
                    ? '🌱 刚开始发芽，慢慢来，每一步都是进步！'
                    : '🌰 刚刚开始旅程，每天坚持，一定会长成大树的！'
                  }
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
