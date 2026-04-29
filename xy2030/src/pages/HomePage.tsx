import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Target,
  MessageSquare,
  Phone,
  Bot,
  Users,
  BookMarked,
  Leaf,
  Flame,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import Header from '@/components/Header';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const quickActions = [
  { id: 'test', icon: Sparkles, label: '人格测试', path: '/test', color: 'from-i-400 to-i-600' },
  { id: 'practice', icon: Target, label: '练习工具', path: '/practice', color: 'from-accent-400 to-accent-600' },
  { id: 'chat', icon: MessageSquare, label: '模拟聊天', path: '/chat', color: 'from-e-400 to-e-600' },
  { id: 'emergency', icon: Phone, label: '紧急支援', path: '/emergency', color: 'from-red-400 to-red-600' },
  { id: 'ai', icon: Bot, label: 'AI陪练', path: '/ai-coach', color: 'from-blue-400 to-blue-600' },
  { id: 'plant', icon: Leaf, label: '陪伴植物', path: '/plant', color: 'from-green-400 to-green-600' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, plant } = useAppStore();

  const getPersonalityLabel = () => {
    if (!user.personalityType) return '未测试';
    if (user.socialConcentration >= 70) return user.personalityType === 'I' ? '重度i人' : '重度e人';
    if (user.socialConcentration >= 40) return user.personalityType === 'I' ? '中度i人' : '中度e人';
    return '均衡型';
  };

  const getPersonalityColor = () => {
    if (!user.personalityType) return 'text-gray-500 bg-gray-100';
    if (user.socialConcentration >= 70) return user.personalityType === 'I' ? 'text-i-600 bg-i-100' : 'text-e-600 bg-e-100';
    if (user.socialConcentration >= 40) return user.personalityType === 'I' ? 'text-i-500 bg-i-50' : 'text-e-500 bg-e-50';
    return 'text-blue-600 bg-blue-100';
  };

  const getPlantStage = () => {
    const stages = [
      { type: 'seed', label: '种子期', emoji: '🌱' },
      { type: 'sprout', label: '发芽期', emoji: '🌿' },
      { type: 'young', label: '成长期', emoji: '🪴' },
      { type: 'adult', label: '成熟期', emoji: '🌳' },
      { type: 'blooming', label: '开花期', emoji: '🌸' },
    ];
    return stages.find(s => s.type === plant.type) || stages[0];
  };

  const plantStage = getPlantStage();

  return (
    <div className="min-h-screen pb-20">
      <Header title="i人转e人训练营" />
      
      <div className="p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-br from-i-500 to-e-500 text-white overflow-hidden"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <img
                src={user.avatar}
                alt="头像"
                className="w-14 h-14 rounded-full border-2 border-white/30 mr-3"
              />
              <div>
                <h2 className="text-lg font-semibold">{user.name}</h2>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getPersonalityColor()}`}>
                  {getPersonalityLabel()}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Flame className="w-4 h-4 mr-1" />
                <span className="text-2xl font-bold">{user.streakDays}</span>
              </div>
              <p className="text-xs text-white/80">连续打卡</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Trophy className="w-4 h-4 mr-1" />
                <span className="text-2xl font-bold">{user.totalSocialSteps}</span>
              </div>
              <p className="text-xs text-white/80">社交步数</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Target className="w-4 h-4 mr-1" />
                <span className="text-2xl font-bold">{user.completedPractices}</span>
              </div>
              <p className="text-xs text-white/80">完成练习</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-3">快速入口</h3>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(action.path)}
                  className="card flex flex-col items-center justify-center p-4"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-2`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {user.personalityType && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-3">社恐浓度</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-i-600 font-medium">i人</span>
              <span className="text-sm text-gray-500">{user.socialConcentration}%</span>
              <span className="text-sm text-e-600 font-medium">e人</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-i-400 via-gray-300 to-e-400 rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
              <div
                className="absolute top-0 w-4 h-4 bg-white border-2 border-i-500 rounded-full shadow-md transition-all duration-500"
                style={{
                  left: `${user.personalityType === 'I' 
                    ? 5 + user.socialConcentration * 0.4 
                    : 50 + user.socialConcentration * 0.45}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              {user.personalityType === 'I' 
                ? `当前偏向i人方向，社恐浓度 ${user.socialConcentration}%`
                : `当前偏向e人方向，社牛浓度 ${user.socialConcentration}%`
              }
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card card-green"
          onClick={() => navigate('/plant')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mr-4 shadow-sm">
                <span className="text-4xl animate-bounce-slow">{plantStage.emoji}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{plant.name}</h3>
                <p className="text-sm text-gray-600">{plantStage.label}</p>
                <div className="flex items-center mt-1">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                    <div
                      className="h-full bg-e-500 rounded-full transition-all duration-500"
                      style={{ width: `${plant.growth}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{plant.growth}%</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-800">社区精选</h3>
            <button
              onClick={() => navigate('/community')}
              className="text-sm text-i-500 font-medium flex items-center"
            >
              查看全部 <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {[
              { title: '今天主动和同事打招呼了！', author: '小社恐', likes: 128, comments: 32 },
              { title: '分享一个缓解社交焦虑的小技巧', author: '成长中的i人', likes: 256, comments: 78 },
              { title: '从重度社恐到可以正常交流', author: '已经是e人了', likes: 512, comments: 156 },
            ].map((post, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="card cursor-pointer hover:shadow-lg transition-all"
                onClick={() => navigate('/community')}
              >
                <p className="text-gray-800 font-medium mb-2 line-clamp-2">{post.title}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>@{post.author}</span>
                  <div className="flex items-center space-x-3">
                    <span>❤️ {post.likes}</span>
                    <span>💬 {post.comments}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
