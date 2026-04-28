import { useNavigate } from 'react-router-dom';
import { 
  Music, 
  Palette, 
  Activity, 
  Wind, 
  Users,
  ChevronRight,
  Sparkles,
  Heart,
  BookOpen,
  Zap
} from 'lucide-react';

interface HealingCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
  tags: string[];
}

const healingCards: HealingCard[] = [
  {
    title: '音乐疗愈',
    description: '通过旋律与节奏，抚慰心灵的每一个角落',
    icon: <Music size={32} />,
    path: '/music-therapy',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    tags: ['情绪歌单', '白噪音', '收藏']
  },
  {
    title: '舞蹈律动',
    description: '跟随身体的节奏，释放压力与焦虑',
    icon: <Zap size={32} />,
    path: '/dance-therapy',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    tags: ['零基础', '肢体舒展', '呼吸律动']
  },
  {
    title: '绘画疗愈',
    description: '用色彩表达内心，用画笔释放情绪',
    icon: <Palette size={32} />,
    path: '/painting-therapy',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    tags: ['名画欣赏', '涂色本', '随心画板']
  },
  {
    title: '情绪心理工具',
    description: '了解自己，关爱自己的内心世界',
    icon: <Activity size={32} />,
    path: '/emotion-tools',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    tags: ['情绪打卡', '心理测试', '心情日记']
  },
  {
    title: '冥想练习',
    description: '在呼吸中找到平静，在当下找到力量',
    icon: <Wind size={32} />,
    path: '/meditation',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
    tags: ['呼吸冥想', '身体扫描', '睡前冥想']
  },
  {
    title: '疗愈社区',
    description: '在这里，你不是孤单的，我们彼此温暖',
    icon: <Users size={32} />,
    path: '/community',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    tags: ['匿名分享', '温柔安慰', '正能量']
  }
];

const dailyQuotes = [
  {
    text: '你已经做得很好了，允许自己休息一下吧。',
    author: '心灵疗愈'
  },
  {
    text: '每一个情绪都值得被看见，每一个你都值得被爱。',
    author: '心灵疗愈'
  },
  {
    text: '慢慢来，治愈是一场温柔的旅程。',
    author: '心灵疗愈'
  },
  {
    text: '今天的你，比昨天更勇敢一点点。',
    author: '心灵疗愈'
  }
];

export default function HealingSquarePage() {
  const navigate = useNavigate();
  
  const todayQuote = dailyQuotes[Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % dailyQuotes.length];

  return (
    <div className="fade-in">
      {/* 页面标题 */}
      <h1 className="page-title">疗愈广场 🌿</h1>
      
      {/* 每日心语 */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)' }}>
        <div className="flex items-start gap-3">
          <Sparkles size={24} className="text-amber-600 mt-1" />
          <div>
            <h4 className="font-semibold text-amber-800 mb-2">今日心语</h4>
            <p className="text-amber-900 italic">"{todayQuote.text}"</p>
            <p className="text-sm text-amber-700 mt-2">— {todayQuote.author}</p>
          </div>
        </div>
      </div>

      {/* 快速入口 */}
      <div className="card mb-6">
        <h3 className="section-title mb-4">快速进入</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: <Music size={24} />, label: '音乐', path: '/music-therapy', color: 'text-amber-500' },
            { icon: <Zap size={24} />, label: '舞蹈', path: '/dance-therapy', color: 'text-purple-500' },
            { icon: <Palette size={24} />, label: '绘画', path: '/painting-therapy', color: 'text-green-500' },
            { icon: <Wind size={24} />, label: '冥想', path: '/meditation', color: 'text-cyan-500' }
          ].map(item => (
            <div
              key={item.path}
              className="flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-all"
              onClick={() => navigate(item.path)}
            >
              <div className={`${item.color}`}>{item.icon}</div>
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 疗愈方式卡片 */}
      <h2 className="section-title">探索疗愈方式</h2>
      <div className="space-y-4 mb-6">
        {healingCards.map((card) => (
          <div
            key={card.path}
            className="card cursor-pointer hover:shadow-lg transition-all duration-300"
            onClick={() => navigate(card.path)}
          >
            <div className="flex gap-4">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: card.gradient }}
              >
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">{card.title}</h3>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{card.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {card.tags.map(tag => (
                    <span key={tag} className="tag tag-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 今日推荐 */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Heart size={20} className="text-pink-500" />
          今日推荐
        </h3>
        <div className="space-y-4">
          <div 
            className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
            onClick={() => navigate('/emotion-tools')}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
            >
              <BookOpen size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-800">记录今日心情</h4>
              <p className="text-sm text-gray-500">每天花一点时间了解自己的情绪</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
          
          <div 
            className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
            onClick={() => navigate('/meditation')}
          >
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)' }}
            >
              <Wind size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-800">5分钟呼吸冥想</h4>
              <p className="text-sm text-gray-500">给自己一个放松的机会</p>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* 底部空间 */}
      <div className="h-4" />
    </div>
  );
}
