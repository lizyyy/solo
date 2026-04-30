import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Trophy,
  TrendingUp,
  Calendar,
  Award,
  Star,
  Heart,
  MessageSquare,
  Edit3,
  Camera,
  X,
  Check,
  User,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const avatarOptions = [
  { id: 1, seed: 'introvert', label: '小内向' },
  { id: 2, seed: 'sunshine', label: '小太阳' },
  { id: 3, seed: 'cool', label: '酷酷' },
  { id: 4, seed: 'happy', label: '开心' },
  { id: 5, seed: 'calm', label: '平静' },
  { id: 6, seed: 'brave', label: '勇敢' },
  { id: 7, seed: 'dreamer', label: '梦想家' },
  { id: 8, seed: 'warrior', label: '战士' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, plant, communityPosts, diaryEntries, resetAllData, updateUser } = useAppStore();
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user.name);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const stats = [
    { 
      label: '社交步数', 
      value: user.totalSocialSteps.toString(), 
      icon: TrendingUp, 
      color: 'text-e-500',
      bgColor: 'bg-e-50'
    },
    { 
      label: '连续打卡', 
      value: `${user.streakDays}天`, 
      icon: Calendar, 
      color: 'text-orange-500',
      bgColor: 'bg-orange-50'
    },
    { 
      label: '植物成长', 
      value: `${plant.growth}%`, 
      icon: Award, 
      color: 'text-green-500',
      bgColor: 'bg-green-50'
    },
    { 
      label: '获得徽章', 
      value: user.badges.length.toString(), 
      icon: Trophy, 
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50'
    },
  ];

  const menuItems = [
    { 
      icon: MessageSquare, 
      label: '我的帖子', 
      subtitle: `${communityPosts.length} 篇`,
      color: 'text-i-500',
      bgColor: 'bg-i-50',
      onClick: () => showToast('功能开发中...')
    },
    { 
      icon: Heart, 
      label: '我的收藏', 
      subtitle: `${user.savedPosts.length} 篇`,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      onClick: () => showToast('功能开发中...')
    },
    { 
      icon: Star, 
      label: '成就徽章', 
      subtitle: `${user.badges.length} 个`,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      onClick: () => showToast('功能开发中...')
    },
    { 
      icon: Calendar, 
      label: '打卡记录', 
      subtitle: `${diaryEntries.length} 天`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/diary')
    },
  ];

  const settingsItems = [
    { 
      icon: Bell, 
      label: '消息通知', 
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      onClick: () => showToast('消息通知设置已更新')
    },
    { 
      icon: Shield, 
      label: '隐私设置', 
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      onClick: () => showToast('隐私设置已更新')
    },
    { 
      icon: HelpCircle, 
      label: '帮助中心', 
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      onClick: () => showToast('帮助中心功能开发中...')
    },
    { 
      icon: Settings, 
      label: '系统设置', 
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      onClick: () => showToast('系统设置已更新')
    },
  ];

  const showToast = (message: string) => {
    setShowNotification(message);
    setTimeout(() => setShowNotification(null), 2000);
  };

  const handleSaveName = () => {
    if (newName.trim() && newName.trim() !== user.name) {
      updateUser({ name: newName.trim() });
      showToast('昵称已更新');
    }
    setIsEditingName(false);
  };

  const handleSelectAvatar = (seed: string) => {
    const newAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    updateUser({ avatar: newAvatar });
    setShowAvatarPicker(false);
    showToast('头像已更新');
  };

  const handleReset = () => {
    resetAllData();
    setShowResetConfirm(false);
    navigate('/');
  };

  const personalityInfo = {
    I: { 
      label: 'I型人格', 
      description: '内向型，更关注内心世界',
      color: 'text-i-600',
      bgColor: 'bg-i-100'
    },
    E: { 
      label: 'E型人格', 
      description: '外向型，更关注外部世界',
      color: 'text-e-600',
      bgColor: 'bg-e-100'
    },
  };

  const currentPersonality = user.personalityType === 'E' ? personalityInfo.E : personalityInfo.I;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 left-4 right-4 z-50 bg-gray-800 text-white py-3 px-4 rounded-xl shadow-lg flex items-center justify-center"
          >
            <Check className="w-5 h-5 mr-2 text-green-400" />
            {showNotification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gradient-to-br from-i-500 via-purple-500 to-e-500 pt-12 pb-20 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">个人中心</h1>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors active:scale-95"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex items-center">
          <div className="relative">
            <img
              src={user.avatar}
              alt="头像"
              className="w-20 h-20 rounded-full border-4 border-white shadow-lg"
            />
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-100 transition-colors active:scale-95"
            >
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center">
              {isEditingName ? (
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setNewName(user.name);
                        setIsEditingName(false);
                      }
                    }}
                    className="bg-white/20 text-white placeholder-white/60 px-3 py-1.5 rounded-lg text-lg font-bold focus:outline-none focus:bg-white/30 border border-white/30"
                    placeholder="输入昵称"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    className="ml-2 p-1.5 bg-white/30 rounded-full hover:bg-white/40 transition-colors"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => {
                      setNewName(user.name);
                      setIsEditingName(false);
                    }}
                    className="ml-1 p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center">
                  <h2 className="text-xl font-bold text-white">{user.name}</h2>
                  <button 
                    onClick={() => {
                      setNewName(user.name);
                      setIsEditingName(true);
                    }}
                    className="ml-2 p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <Edit3 className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${currentPersonality.bgColor} ${currentPersonality.color}`}>
                {currentPersonality.label}
              </span>
              {user.personalityScore !== null && (
                <span className="ml-2 text-white/80 text-sm">
                  社恐浓度: {user.personalityScore}%
                </span>
              )}
            </div>
            <p className="text-white/70 text-sm mt-1">
              加入于 {format(new Date(user.joinDate), 'yyyy年MM月', { locale: zhCN })}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10">
        <div className="card grid grid-cols-4 gap-3 p-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="text-center"
            >
              <div className={`w-10 h-10 mx-auto mb-2 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">我的内容</h3>
        <div className="card overflow-hidden">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between p-4 ${
                index < menuItems.length - 1 ? 'border-b border-gray-100' : ''
              } hover:bg-gray-50 transition-colors active:bg-gray-100`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center mr-3`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          ))}
        </div>
      </div>

      {user.badges.length > 0 && (
        <div className="px-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">获得的徽章</h3>
          <div className="flex overflow-x-auto pb-2 -mx-1">
            {user.badges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex-shrink-0 w-24 mx-1 card text-center p-3"
              >
                <div className="text-3xl mb-2">{badge.icon}</div>
                <p className="text-xs font-medium text-gray-800 line-clamp-1">{badge.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {badge.unlockedAt ? format(new Date(badge.unlockedAt), 'MM-dd', { locale: zhCN }) : '未解锁'}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">设置</h3>
        <div className="card overflow-hidden">
          {settingsItems.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={item.onClick}
              className={`w-full flex items-center justify-between p-4 ${
                index < settingsItems.length - 1 ? 'border-b border-gray-100' : ''
              } hover:bg-gray-50 transition-colors active:bg-gray-100`}
            >
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center mr-3`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="font-medium text-gray-800">{item.label}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6 mb-8">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full flex items-center justify-center p-4 card hover:bg-red-50 transition-colors group active:bg-red-100"
        >
          <LogOut className="w-5 h-5 text-red-500 mr-2 group-hover:rotate-12 transition-transform" />
          <span className="text-red-500 font-medium">重置所有数据</span>
        </button>
      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">确认重置？</h3>
                <p className="text-sm text-gray-600">
                  此操作将清除所有数据，包括：
                </p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• 测试记录和人格类型</li>
                  <li>• 植物成长数据</li>
                  <li>• 所有帖子和日记</li>
                  <li>• 社交步数和成就</li>
                </ul>
                <p className="text-red-500 text-sm mt-3 font-medium">
                  此操作不可撤销
                </p>
              </div>
              <div className="flex border-t border-gray-200">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 text-gray-600 font-medium border-r border-gray-200 hover:bg-gray-50 active:bg-gray-100"
                >
                  取消
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 py-4 text-red-500 font-medium hover:bg-red-50 active:bg-red-100"
                >
                  确认重置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAvatarPicker && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-white w-full rounded-t-3xl p-6 max-h-[70vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">选择头像</h3>
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                {avatarOptions.map((avatar) => {
                  const isSelected = user.avatar.includes(avatar.seed);
                  return (
                    <button
                      key={avatar.id}
                      onClick={() => handleSelectAvatar(avatar.seed)}
                      className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                        isSelected 
                          ? 'bg-i-50 ring-2 ring-i-500' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`}
                        alt={avatar.label}
                        className="w-16 h-16 mb-2"
                      />
                      <span className="text-xs text-gray-600">{avatar.label}</span>
                      {isSelected && (
                        <div className="mt-1 w-5 h-5 bg-i-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-white w-full rounded-t-3xl p-6 max-h-[70vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">设置</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center">
                    <User className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">账户信息</p>
                      <p className="text-xs text-gray-500">管理你的账户</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">消息通知</p>
                      <p className="text-xs text-gray-500">推送和提醒设置</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">隐私安全</p>
                      <p className="text-xs text-gray-500">数据和隐私设置</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center">
                    <HelpCircle className="w-5 h-5 text-gray-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">帮助与反馈</p>
                      <p className="text-xs text-gray-500">常见问题和建议</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-center text-xs text-gray-400">
                  i人转e人训练营 v1.0.0
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
