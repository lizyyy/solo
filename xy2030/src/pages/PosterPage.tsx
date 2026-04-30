import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Download,
  Share2,
  RefreshCw,
  ChevronRight,
  Trophy,
  TrendingUp,
  Calendar,
  Heart,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Header from '@/components/Header';

const posterThemes = [
  {
    id: 'purple',
    name: 'i人主题',
    gradient: 'from-i-400 via-purple-500 to-pink-500',
    textColor: 'text-white',
    bgLight: 'bg-i-50',
  },
  {
    id: 'green',
    name: 'e人主题',
    gradient: 'from-e-400 via-green-500 to-teal-500',
    textColor: 'text-white',
    bgLight: 'bg-e-50',
  },
  {
    id: 'sunset',
    name: '日落主题',
    gradient: 'from-orange-400 via-red-400 to-pink-500',
    textColor: 'text-white',
    bgLight: 'bg-orange-50',
  },
  {
    id: 'night',
    name: '夜空主题',
    gradient: 'from-gray-700 via-purple-700 to-indigo-800',
    textColor: 'text-white',
    bgLight: 'bg-gray-50',
  },
];

const motivationalQuotes = [
  '每一步都在向更好的自己靠近',
  '社交从微小的勇气开始',
  '你比想象中更勇敢',
  '慢慢来，也是一种快',
  '今天的你比昨天更棒',
  '每一次尝试都是胜利',
  '勇敢的人不是不害怕，而是带着害怕前进',
  '成长比完美更重要',
];

export default function PosterPage() {
  const navigate = useNavigate();
  const { user, plant, diaryEntries } = useAppStore();
  const posterRef = useRef<HTMLDivElement>(null);
  
  const [selectedTheme, setSelectedTheme] = useState(posterThemes[0]);
  const [currentQuote, setCurrentQuote] = useState(motivationalQuotes[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  const today = new Date();
  const todayDiary = diaryEntries.find(d => d.date === today.toISOString().split('T')[0]);
  const todaySteps = todayDiary?.socialSteps || user.totalSocialSteps;

  const personalityLabel = user.personalityType === 'E' ? 'E型人格' : 'I型人格';
  const personalitySubtitle = user.personalityType === 'E' 
    ? '正在向超e人进化！' 
    : '努力从i人变成e人...';

  const plantStage = (() => {
    if (plant.growth >= 80) return { emoji: '🌳', label: '大树' };
    if (plant.growth >= 60) return { emoji: '🌸', label: '开花' };
    if (plant.growth >= 40) return { emoji: '🌿', label: '小苗' };
    if (plant.growth >= 20) return { emoji: '🌱', label: '嫩芽' };
    return { emoji: '🌰', label: '种子' };
  })();

  const refreshQuote = () => {
    const randomIndex = Math.floor(Math.random() * motivationalQuotes.length);
    setCurrentQuote(motivationalQuotes[randomIndex]);
  };

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      alert('海报已生成！在实际项目中会自动下载图片。');
    }, 1000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${user.name}的社交步数`,
        text: `我今天获得了 ${todaySteps} 社交步数！来看看我的进步吧！`,
        url: window.location.href,
      });
    } else {
      alert('您的浏览器不支持分享功能');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      <Header
        title="生成海报"
        showBack
      />
      
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-center mb-4">
            <div 
              ref={posterRef}
              className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${selectedTheme.gradient}`} />
              
              <div className="absolute top-8 left-6 right-6">
                <p className="text-white/80 text-xs">
                  {format(today, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
                </p>
              </div>

              <div className="absolute top-1/4 left-0 right-0 text-center px-6">
                <div className="text-8xl mb-4">{plantStage.emoji}</div>
                <h2 className="text-3xl font-bold text-white mb-2">今日社交步数</h2>
                <div className="text-7xl font-bold text-white mb-4">
                  {todaySteps}
                </div>
                <p className="text-white/90 text-lg">{plantStage.label}在成长中...</p>
              </div>

              <div className="absolute top-2/3 left-6 right-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
                  <div className="flex justify-around">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{user.streakDays}</p>
                      <p className="text-white/80 text-xs">连续打卡</p>
                    </div>
                    <div className="w-px bg-white/30" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{plant.growth}%</p>
                      <p className="text-white/80 text-xs">植物成长</p>
                    </div>
                    <div className="w-px bg-white/30" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{user.badges.length}</p>
                      <p className="text-white/80 text-xs">获得徽章</p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-white/90 text-lg italic">
                    "{currentQuote}"
                  </p>
                </div>
              </div>

              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <img
                      src={user.avatar}
                      alt="头像"
                      className="w-10 h-10 rounded-full border-2 border-white"
                    />
                    <div className="ml-3">
                      <p className="text-white font-medium text-sm">{user.name}</p>
                      <p className="text-white/70 text-xs">{personalityLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/80 text-xs">i人转e人训练营</p>
                    <p className="text-white/60 text-xs">社交成长记录</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-3">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center px-6 py-3 bg-i-500 text-white rounded-xl hover:bg-i-600 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Download className="w-5 h-5 mr-2" />
              )}
              {isGenerating ? '生成中...' : '保存海报'}
            </button>
            <button
              onClick={handleShare}
              className="flex items-center px-6 py-3 bg-e-500 text-white rounded-xl hover:bg-e-600 transition-colors"
            >
              <Share2 className="w-5 h-5 mr-2" />
              分享
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">选择主题</h3>
            <div className="grid grid-cols-4 gap-3">
              {posterThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  className={`relative overflow-hidden rounded-xl h-16 transition-transform ${
                    selectedTheme.id === theme.id ? 'ring-2 ring-i-500 scale-105' : ''
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
                  <div className="absolute bottom-1 left-0 right-0 text-center">
                    <span className="text-white text-xs font-medium drop-shadow">{theme.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">励志语录</h3>
              <button
                onClick={refreshQuote}
                className="flex items-center text-sm text-i-500 hover:text-i-600"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                换一个
              </button>
            </div>
            <div className={`p-4 rounded-xl ${selectedTheme.bgLight}`}>
              <p className="text-center text-gray-700 italic">
                "{currentQuote}"
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">今日数据</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-i-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-i-100 flex items-center justify-center mr-3">
                    <TrendingUp className="w-5 h-5 text-i-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">今日社交步数</p>
                    <p className="text-xs text-gray-500">今天的努力</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-i-600">{todaySteps}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                    <Calendar className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">连续打卡</p>
                    <p className="text-xs text-gray-500">坚持就是胜利</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-orange-600">{user.streakDays}天</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <Sparkles className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">植物状态</p>
                    <p className="text-xs text-gray-500">{plantStage.label}成长中</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl">{plantStage.emoji}</span>
                  <p className="text-sm font-medium text-green-600">{plant.growth}%</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">人格类型</p>
                    <p className="text-xs text-gray-500">{personalitySubtitle}</p>
                  </div>
                </div>
                <span className={`text-lg font-bold ${
                  user.personalityType === 'E' ? 'text-e-600' : 'text-i-600'
                }`}>
                  {personalityLabel}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="p-4 bg-gradient-to-r from-e-100 to-green-100 rounded-xl border border-e-200">
            <div className="flex items-start">
              <Heart className="w-6 h-6 text-e-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-e-700 mb-1">分享你的进步</h3>
                <p className="text-sm text-e-600">
                  生成精美的海报，分享到社交媒体，让朋友们看到你的成长和进步！
                  每一步都值得庆祝，每一次分享都是对自己的鼓励。
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
