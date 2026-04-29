import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Calendar,
  BookOpen,
  Palette,
  Heart,
  Settings,
  Bell,
  Moon,
  Sun,
  Lock,
  Unlock,
  ChevronRight,
  LogOut,
  Star,
  Award,
  Activity,
  Wind
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { mockUser } from '../data/mockData';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { state, toggleDarkMode } = useApp();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPrivateContent, setShowPrivateContent] = useState(false);
  const [notifications, setNotifications] = useState({
    dailyCheckin: true,
    meditationReminder: true,
    newContent: false
  });

  const handleVerifyPassword = () => {
    if (passwordInput === '123456') {
      setShowPrivateContent(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('密码错误，请重试');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysSinceJoin = () => {
    const now = Date.now();
    const diff = now - (mockUser?.createdAt || now);
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  const getAchievements = () => {
    const achievements = [];
    
    if (state.checkins.length >= 1) {
      achievements.push({
        id: 'first-checkin',
        title: '初识自己',
        description: '完成第一次情绪打卡',
        icon: '🌟',
        unlocked: true
      });
    }
    
    if (state.diaries.length >= 1) {
      achievements.push({
        id: 'first-diary',
        title: '文字疗愈',
        description: '写下第一篇日记',
        icon: '📝',
        unlocked: true
      });
    }
    
    if (state.userArtworks.length >= 1) {
      achievements.push({
        id: 'first-artwork',
        title: '色彩表达',
        description: '创作第一幅画作',
        icon: '🎨',
        unlocked: true
      });
    }
    
    if (state.checkins.length >= 7) {
      achievements.push({
        id: 'week-streak',
        title: '坚持一周',
        description: '连续7天情绪打卡',
        icon: '🔥',
        unlocked: true
      });
    }
    
    achievements.push({
      id: 'welcome',
      title: '欢迎加入',
      description: '加入艺术疗愈社区',
      icon: '🌸',
      unlocked: true
    });

    return achievements;
  };

  const achievements = getAchievements();

  return (
    <div className="fade-in">
      <h1 className="page-title">我的 🌸</h1>

      {/* 用户信息卡片 */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <img
            src={mockUser?.avatar}
            alt="头像"
            className="w-20 h-20 rounded-full object-cover ring-4 ring-amber-100"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800">{mockUser?.name || '疗愈者'}</h2>
            <p className="text-gray-500 text-sm mt-1">{mockUser?.bio || '在艺术中寻找内心的平静'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="tag tag-primary">
                <Calendar size={12} className="inline mr-1" />
                加入 {getDaysSinceJoin()} 天
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 统计数据 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Activity size={20} className="text-amber-500" />
          我的疗愈数据
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <div 
            className="text-center p-3 bg-amber-50 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => navigate('/emotion-tools')}
          >
            <p className="text-2xl font-bold text-amber-500">{state.checkins.length}</p>
            <p className="text-xs text-gray-500 mt-1">情绪打卡</p>
          </div>
          <div 
            className="text-center p-3 bg-purple-50 rounded-xl cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={() => navigate('/diary')}
          >
            <p className="text-2xl font-bold text-purple-500">{state.diaries.length}</p>
            <p className="text-xs text-gray-500 mt-1">心情日记</p>
          </div>
          <div 
            className="text-center p-3 bg-green-50 rounded-xl cursor-pointer hover:bg-green-100 transition-colors"
            onClick={() => navigate('/artwork-gallery')}
          >
            <p className="text-2xl font-bold text-green-500">{state.userArtworks.length}</p>
            <p className="text-xs text-gray-500 mt-1">艺术作品</p>
          </div>
          <div 
            className="text-center p-3 bg-pink-50 rounded-xl cursor-pointer hover:bg-pink-100 transition-colors"
            onClick={() => navigate('/music-therapy')}
          >
            <p className="text-2xl font-bold text-pink-500">{state.favoriteMusicIds.length}</p>
            <p className="text-xs text-gray-500 mt-1">收藏音乐</p>
          </div>
        </div>
      </div>

      {/* 成就 */}
      {achievements.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            我的成就
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {achievements.slice(0, 6).map(achievement => (
              <div 
                key={achievement.id}
                className={`text-center p-3 rounded-xl transition-all ${
                  achievement.unlocked 
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50' 
                    : 'bg-gray-100 opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">{achievement.icon}</div>
                <p className="text-xs font-medium text-gray-700">{achievement.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 功能入口 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">我的空间</h3>
        <div className="space-y-1">
          <div 
            className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate('/artwork-gallery')}
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Palette size={20} className="text-green-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">我的作品集</p>
              <p className="text-xs text-gray-500">{state.userArtworks.length} 幅作品</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>

          <div 
            className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => navigate('/diary')}
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <BookOpen size={20} className="text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">我的日记</p>
              <p className="text-xs text-gray-500">{state.diaries.length} 篇日记</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>

          <div 
            className="flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => {
              if (showPrivateContent) {
                setShowPrivateContent(false);
              } else {
                setShowPasswordModal(true);
              }
            }}
          >
            <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center">
              {showPrivateContent ? (
                <Unlock size={20} className="text-pink-500" />
              ) : (
                <Lock size={20} className="text-pink-500" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">私密空间</p>
              <p className="text-xs text-gray-500">
                {showPrivateContent ? '已解锁' : '需要密码访问'}
              </p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>

          {showPrivateContent && (
            <div className="ml-14 mt-2 p-3 bg-pink-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-2">
                私密作品：{state.userArtworks.filter(a => a.isPrivate).length} 幅
              </p>
              <p className="text-sm text-gray-600">
                私密日记：{state.diaries.filter(d => d.isPrivate).length} 篇
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 设置 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Settings size={20} className="text-amber-500" />
          设置
        </h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                {state.darkMode ? <Moon size={20} className="text-gray-600" /> : <Sun size={20} className="text-amber-500" />}
              </div>
              <span className="font-medium text-gray-800">深色模式</span>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                state.darkMode ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  state.darkMode ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell size={20} className="text-amber-500" />
              </div>
              <span className="font-medium text-gray-800">每日打卡提醒</span>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, dailyCheckin: !notifications.dailyCheckin })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                notifications.dailyCheckin ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  notifications.dailyCheckin ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Wind size={20} className="text-cyan-500" />
              </div>
              <span className="font-medium text-gray-800">冥想提醒</span>
            </div>
            <button
              onClick={() => setNotifications({ ...notifications, meditationReminder: !notifications.meditationReminder })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                notifications.meditationReminder ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  notifications.meditationReminder ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 关于 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">关于</h3>
        <div className="space-y-1">
          <div className="flex items-center justify-between p-3 rounded-xl">
            <span className="text-gray-800">版本</span>
            <span className="text-gray-500 text-sm">1.0.0</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl">
            <span className="text-gray-800">隐私政策</span>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl">
            <span className="text-gray-800">用户协议</span>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="card mb-6">
        <button className="w-full flex items-center justify-center gap-2 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
      </div>

      {/* 底部空间 */}
      <div className="h-4" />

      {/* 密码验证模态框 */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div 
            className="modal-content fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock size={32} className="text-pink-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">私密空间</h3>
              <p className="text-gray-500 text-sm">请输入密码访问你的私密内容</p>
            </div>
            
            <div className="form-group">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
                placeholder="请输入密码（默认：123456）"
                className={`input ${passwordError ? 'border-red-500' : ''}`}
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2">{passwordError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordInput('');
                  setPasswordError('');
                }}
                className="flex-1 btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleVerifyPassword}
                className="flex-1 btn btn-primary"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
