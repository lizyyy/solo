import { useNavigate } from 'react-router-dom';
import { Music, Palette, Activity, Heart, Sparkles, Users, Wind } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { emotionMap } from '../data/mockData';

interface FeatureCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
}

const featureCards: FeatureCard[] = [
  {
    title: '音乐疗愈',
    description: '情绪分类歌单、白噪音混合，让音乐治愈你的心灵',
    icon: <Music size={32} />,
    path: '/music-therapy',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
  },
  {
    title: '舞蹈律动',
    description: '零基础舒缓律动、肢体舒展舞，跟随节奏释放压力',
    icon: <Wind size={32} />,
    path: '/dance-therapy',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
  },
  {
    title: '绘画疗愈',
    description: '欣赏名画、涂色放松、随心创作，用色彩表达内心',
    icon: <Palette size={32} />,
    path: '/painting-therapy',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
  },
  {
    title: '情绪心理工具',
    description: '情绪打卡、心理测试、心情日记，了解自己的内心',
    icon: <Activity size={32} />,
    path: '/emotion-tools',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
  }
];

export default function HomePage() {
  const navigate = useNavigate();
  const { state } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const todayCheckin = state.checkins.find(c => c.date === today);

  return (
    <div className="fade-in">
      {/* 顶部欢迎区域 */}
      <div className="mb-8">
        <h1 className="page-title">你好，{state.user?.name || '疗愈者'} 🌸</h1>
        <p className="text-gray-500 text-lg">
          今天是美好的一天，让我们一起照顾好自己
        </p>
      </div>

      {/* 今日情绪打卡卡片 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">今日心情</h3>
        {todayCheckin ? (
          <div className="flex items-center gap-4">
            <div 
              className="text-4xl"
              style={{ color: emotionMap[todayCheckin.emotionType].color }}
            >
              {emotionMap[todayCheckin.emotionType].icon}
            </div>
            <div>
              <p className="text-lg font-medium">
                今日情绪：{emotionMap[todayCheckin.emotionType].name}
              </p>
              <p className="text-gray-500">
                情绪强度：{todayCheckin.intensity}/10
              </p>
              {todayCheckin.note && (
                <p className="text-gray-600 mt-1 text-sm italic">
                  "{todayCheckin.note}"
                </p>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors"
            onClick={() => navigate('/emotion-tools')}
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl pulse">💭</div>
              <div>
                <p className="text-lg font-medium">还没有记录今天的心情</p>
                <p className="text-gray-500">点击记录你的情绪状态</p>
              </div>
            </div>
            <Heart size={24} className="text-gray-400" />
          </div>
        )}
      </div>

      {/* 功能卡片区域 */}
      <h2 className="section-title">疗愈方式</h2>
      <div className="grid-2 mb-8">
        {featureCards.map((card) => (
          <div
            key={card.path}
            className="card cursor-pointer hover:shadow-lg transition-all duration-300"
            onClick={() => navigate(card.path)}
          >
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 text-white"
              style={{ background: card.gradient }}
            >
              {card.icon}
            </div>
            <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {/* 社区入口 */}
      <div
        className="card cursor-pointer hover:shadow-lg transition-all duration-300"
        onClick={() => navigate('/community')}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)' }}
          >
            <Users size={28} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">疗愈社区</h3>
            <p className="text-sm text-gray-500">
              匿名分享你的故事，收获温柔的安慰与支持
            </p>
          </div>
          <Sparkles size={24} className="text-pink-400" />
        </div>
      </div>

      {/* 统计信息 */}
      {state.checkins.length > 0 && (
        <div className="card mt-6">
          <h3 className="section-title mb-4">你的疗愈旅程</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-amber-500">{state.checkins.length}</p>
              <p className="text-sm text-gray-500">情绪打卡</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">{state.diaries.length}</p>
              <p className="text-sm text-gray-500">心情日记</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{state.userArtworks.length}</p>
              <p className="text-sm text-gray-500">艺术作品</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
