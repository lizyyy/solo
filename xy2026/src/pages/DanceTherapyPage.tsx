import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronRight,
  Wind,
  Moon,
  Sparkles,
  Heart,
  RotateCcw,
  SkipForward,
  SkipBack,
  Volume2,
  X,
  Clock,
  Star,
  Zap
} from 'lucide-react';
import { mockDances } from '../data/mockData';
import { Dance, DanceStep } from '../types';

type CategoryType = 'all' | 'beginner' | 'stretch' | 'breathing' | 'sleep';

const categoryMap: Record<CategoryType, { name: string; icon: React.ReactNode; color: string }> = {
  all: { name: '全部', icon: <Sparkles size={18} />, color: 'text-amber-500' },
  beginner: { name: '零基础', icon: <Zap size={18} />, color: 'text-purple-500' },
  stretch: { name: '肢体舒展', icon: <Wind size={18} />, color: 'text-green-500' },
  breathing: { name: '呼吸律动', icon: <Heart size={18} />, color: 'text-pink-500' },
  sleep: { name: '睡前放松', icon: <Moon size={18} />, color: 'text-blue-500' }
};

export default function DanceTherapyPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [activeDance, setActiveDance] = useState<Dance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [showDancePlayer, setShowDancePlayer] = useState(false);

  const filteredDances = selectedCategory === 'all' 
    ? mockDances 
    : mockDances.filter(d => d.category === selectedCategory);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startDance = (dance: Dance) => {
    setActiveDance(dance);
    setCurrentStep(0);
    setStepProgress(0);
    setIsPlaying(true);
    setShowDancePlayer(true);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const nextStep = () => {
    if (activeDance && currentStep < activeDance.steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setStepProgress(0);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setStepProgress(0);
    }
  };

  const restartDance = () => {
    setCurrentStep(0);
    setStepProgress(0);
    setIsPlaying(true);
  };

  const closePlayer = () => {
    setIsPlaying(false);
    setShowDancePlayer(false);
    setActiveDance(null);
    setCurrentStep(0);
    setStepProgress(0);
  };

  const startBreathing = () => {
    setIsBreathing(!isBreathing);
  };

  // 呼吸动画循环
  useEffect(() => {
    if (!isBreathing) return;

    const breathingCycle = () => {
      setBreathingPhase('inhale');
      setTimeout(() => setBreathingPhase('hold'), 4000);
      setTimeout(() => setBreathingPhase('exhale'), 6000);
    };

    breathingCycle();
    const interval = setInterval(breathingCycle, 10000);

    return () => clearInterval(interval);
  }, [isBreathing]);

  // 舞蹈步骤进度模拟
  useEffect(() => {
    if (!isPlaying || !activeDance || !showDancePlayer) return;

    const currentStepData = activeDance.steps[currentStep];
    if (!currentStepData) return;

    const interval = setInterval(() => {
      setStepProgress(prev => {
        const newProgress = prev + (100 / currentStepData.duration);
        if (newProgress >= 100) {
          if (currentStep < activeDance.steps.length - 1) {
            setCurrentStep(prevStep => prevStep + 1);
            return 0;
          } else {
            setIsPlaying(false);
            return 100;
          }
        }
        return newProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, activeDance, currentStep, showDancePlayer]);

  // 舞蹈播放全屏界面
  if (showDancePlayer && activeDance) {
    const currentStepData = activeDance.steps[currentStep];
    const totalSteps = activeDance.steps.length;
    const totalProgress = ((currentStep + stepProgress / 100) / totalSteps) * 100;

    return (
      <div className="fade-in min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        {/* 顶部 */}
        <div className="p-6 flex items-center justify-between">
          <button
            onClick={closePlayer}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
          >
            <X size={20} />
          </button>
          <h2 className="text-white font-semibold">{activeDance.title}</h2>
          <div className="w-10" />
        </div>

        {/* 舞蹈动画区域 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* 动画圆圈 */}
          <div className="relative w-64 h-64 mb-8">
            {/* 外圈 */}
            <div 
              className={`absolute inset-0 rounded-full border-4 border-white/30 ${
                isPlaying ? 'animate-pulse' : ''
              }`}
              style={{ 
                animationDuration: '3s',
                transform: `scale(${isPlaying ? 1.1 : 1})`,
                transition: 'transform 0.5s ease'
              }}
            />
            {/* 中圈 */}
            <div 
              className="absolute inset-4 rounded-full border-4 border-white/40"
              style={{
                animation: isPlaying ? 'spin 20s linear infinite' : 'none'
              }}
            />
            {/* 内圈 - 舞蹈人物 */}
            <div className="absolute inset-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <Zap size={64} className="text-white mx-auto mb-2" />
                <span className="text-white text-sm font-medium">
                  步骤 {currentStep + 1}/{totalSteps}
                </span>
              </div>
            </div>
            {/* 装饰点 */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 bg-white/60 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 45}deg) translateY(-140px) translateX(-50%)`,
                  animation: isPlaying ? `pulse 2s ease-in-out ${i * 0.2}s infinite` : 'none'
                }}
              />
            ))}
          </div>

          {/* 当前步骤说明 */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-white/30 text-white px-3 py-1 rounded-full text-sm font-medium">
                步骤 {currentStep + 1}
              </span>
              <span className="text-white/80 text-sm">
                {formatDuration(currentStepData?.duration || 0)}
              </span>
            </div>
            <p className="text-white text-lg font-medium leading-relaxed">
              {currentStepData?.instruction || '准备开始...'}
            </p>
          </div>

          {/* 步骤进度条 */}
          <div className="w-full max-w-sm mt-6">
            <div className="flex justify-between text-white/70 text-sm mb-2">
              <span>整体进度</span>
              <span>{Math.round(totalProgress)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-white/60 text-xs mt-2">
              {activeDance.steps.map((_, i) => (
                <div 
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < currentStep ? 'bg-white' : 
                    i === currentStep ? 'bg-amber-400' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="p-8">
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={prevStep}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <SkipBack size={24} />
            </button>
            <button
              onClick={togglePlay}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-lg"
            >
              {isPlaying ? <Pause size={36} /> : <Play size={36} className="ml-1" />}
            </button>
            <button
              onClick={nextStep}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <SkipForward size={24} />
            </button>
          </div>
          <div className="flex justify-center gap-8 mt-6">
            <button
              onClick={restartDance}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <RotateCcw size={18} />
              重新开始
            </button>
            <button
              onClick={closePlayer}
              className="flex items-center gap-2 text-white/80 text-sm"
            >
              <X size={18} />
              退出
            </button>
          </div>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 className="page-title">舞蹈律动疗愈 💃</h1>

      {/* 呼吸引导快速入口 */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div 
                className={`w-14 h-14 rounded-full bg-pink-400/20 flex items-center justify-center ${
                  isBreathing ? 'breathe' : ''
                }`}
              >
                <Heart size={28} className="text-pink-500" />
              </div>
              {isBreathing && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">快速呼吸练习</h4>
              <p className="text-sm text-gray-600">
                {isBreathing 
                  ? `正在进行：${breathingPhase === 'inhale' ? '吸气...' : breathingPhase === 'hold' ? '屏息...' : '呼气...'}`
                  : '点击开始4-7-8呼吸法'
                }
              </p>
            </div>
          </div>
          <button
            onClick={startBreathing}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isBreathing 
                ? 'bg-pink-500 text-white' 
                : 'bg-white text-pink-500 border border-pink-200'
            }`}
          >
            {isBreathing ? '停止' : '开始'}
          </button>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(Object.entries(categoryMap) as [CategoryType, typeof categoryMap[CategoryType]][]).map(([key, value]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
              selectedCategory === key
                ? 'bg-purple-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {value.icon}
            {value.name}
          </button>
        ))}
      </div>

      {/* 舞蹈列表 */}
      <div className="space-y-4">
        {filteredDances.map(dance => (
          <div
            key={dance.id}
            className="card cursor-pointer hover:shadow-lg transition-all"
            onClick={() => startDance(dance)}
          >
            <div className="flex gap-4">
              {/* 缩略图 */}
              <div className="relative">
                <img
                  src={dance.thumbnail}
                  alt={dance.title}
                  className="w-24 h-24 rounded-xl object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <Play size={24} className="text-purple-600 ml-1" />
                  </div>
                </div>
              </div>

              {/* 信息 */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800">{dance.title}</h3>
                  <span className={`tag ${
                    dance.category === 'beginner' ? 'bg-purple-100 text-purple-600' :
                    dance.category === 'stretch' ? 'bg-green-100 text-green-600' :
                    dance.category === 'breathing' ? 'bg-pink-100 text-pink-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {categoryMap[dance.category as CategoryType]?.name || '舞蹈'}
                  </span>
                </div>

                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {dance.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    <span>{formatDuration(dance.duration)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star size={14} />
                    <span>{dance.steps.length} 个步骤</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap size={14} />
                    <span>{dance.difficulty === 'easy' ? '简单' : dance.difficulty === 'medium' ? '中等' : '困难'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 步骤预览 */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">步骤预览：</p>
              <div className="flex gap-2 overflow-x-auto">
                {dance.steps.slice(0, 4).map((step, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                  >
                    <span className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-600 max-w-20 truncate">
                      {step.instruction}
                    </span>
                  </div>
                ))}
                {dance.steps.length > 4 && (
                  <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-xs text-gray-500">+{dance.steps.length - 4} 个步骤</span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div className="card mt-6" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
        <div className="flex items-start gap-3">
          <Sparkles size={24} className="text-amber-600 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-800 mb-1">小贴士</h4>
            <p className="text-sm text-amber-700">
              舞蹈疗愈不需要专业基础，只需要跟随自己的身体感觉。让音乐和动作成为你表达情绪的方式，不需要完美，只需要真实。
            </p>
          </div>
        </div>
      </div>

      {/* 底部空间 */}
      <div className="h-4" />
    </div>
  );
}
