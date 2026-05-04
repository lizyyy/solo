import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Music, 
  BookOpen, 
  TrendingUp, 
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Target,
  ChevronRight
} from 'lucide-react';
import { progressApi, wrongNotesApi } from '../services/api';

// 知识点分类展示
const KNOWLEDGE_CATEGORIES = [
  {
    id: 'scale',
    name: '音阶与音级',
    icon: Music,
    description: '识别大/小调音阶中的各级音',
    count: 4,
    color: 'bg-blue-500'
  },
  {
    id: 'chord',
    name: '和弦构成',
    icon: Target,
    description: '掌握三和弦、七和弦的结构',
    count: 5,
    color: 'bg-green-500'
  },
  {
    id: 'inversion',
    name: '和弦转位',
    icon: Clock,
    description: '识别六和弦、四六和弦等转位形式',
    count: 3,
    color: 'bg-purple-500'
  },
  {
    id: 'roman_numeral',
    name: '罗马数字功能',
    icon: BookOpen,
    description: '理解和弦的功能标记（I, IV, V 等）',
    count: 4,
    color: 'bg-orange-500'
  },
  {
    id: 'cadence',
    name: '终止式判断',
    icon: Award,
    description: '识别正格、变格、半终止、欺骗终止',
    count: 4,
    color: 'bg-red-500'
  }
];

// 快速统计卡片组件
const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick }) => (
  <div 
    className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </div>
    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    <p className="text-sm text-gray-500 mt-1">{title}</p>
    {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
  </div>
);

// 知识点卡片组件
const CategoryCard = ({ category, onClick }) => {
  const Icon = category.icon;
  
  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all hover:border-blue-200 cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
            {category.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
          <p className="text-xs text-blue-500 mt-2">{category.count} 道题目</p>
        </div>
      </div>
    </div>
  );
};

// 首页组件
function HomePage() {
  const [stats, setStats] = useState({
    totalAnswers: 0,
    correctAnswers: 0,
    accuracy: 0,
    activeWrongNotes: 0,
    totalSessions: 0
  });
  const [weakPoints, setWeakPoints] = useState([]);
  const [errorTags, setErrorTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 获取进度概览
      const progressResponse = await progressApi.getOverview();
      const progressData = progressResponse.data.data;
      
      setStats({
        totalAnswers: progressData.totalAnswers || 0,
        correctAnswers: progressData.correctAnswers || 0,
        accuracy: progressData.accuracy || 0,
        activeWrongNotes: progressData.activeWrongNotes || 0,
        totalSessions: progressData.totalSessions || 0
      });
      
      // 获取薄弱知识点
      try {
        const weakPointsResponse = await progressApi.getWeakPoints();
        setWeakPoints(weakPointsResponse.data.data.weakKnowledgePoints || []);
      } catch (e) {
        console.log('No weak points data');
      }
      
      // 获取错因统计
      try {
        const errorTagsResponse = await wrongNotesApi.getErrorTagStats();
        setErrorTags(errorTagsResponse.data.data || []);
      } catch (e) {
        console.log('No error tags data');
      }
      
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPractice = (questionType) => {
    // 导航到练习页面并带上筛选条件
    if (questionType) {
      window.location.href = `/practice?type=${questionType}`;
    } else {
      window.location.href = '/practice';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">欢迎回来！</h1>
            <p className="text-blue-100 text-lg">继续你的乐理学习之旅</p>
            <div className="mt-6">
              <button
                onClick={() => handleStartPractice()}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Music className="w-5 h-5" />
                开始练习
              </button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-32 h-32 bg-white/20 rounded-2xl flex items-center justify-center">
              <Music className="w-16 h-16 text-white/80" />
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={CheckCircle}
          title="总答题数"
          value={stats.totalAnswers}
          subtitle="累计完成的题目"
          color="bg-blue-500"
          onClick={() => window.location.href = '/progress'}
        />
        <StatCard
          icon={Award}
          title="正确率"
          value={`${stats.accuracy}%`}
          subtitle={`答对 ${stats.correctAnswers} 题`}
          color="bg-green-500"
          onClick={() => window.location.href = '/progress'}
        />
        <StatCard
          icon={XCircle}
          title="待复习错题"
          value={stats.activeWrongNotes}
          subtitle="需要重点关注"
          color="bg-orange-500"
          onClick={() => window.location.href = '/wrong-notes'}
        />
        <StatCard
          icon={BookOpen}
          title="练习次数"
          value={stats.totalSessions}
          subtitle="完成的练习会话"
          color="bg-purple-500"
          onClick={() => window.location.href = '/progress'}
        />
      </div>

      {/* 知识点选择区域 */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">选择知识点开始练习</h2>
          <Link 
            to="/practice" 
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            查看全部 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {KNOWLEDGE_CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onClick={() => handleStartPractice(category.id)}
            />
          ))}
        </div>
      </div>

      {/* 薄弱知识点和错因分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 薄弱知识点 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" />
            需要优先复习的知识点
          </h3>
          
          {weakPoints.length > 0 ? (
            <div className="space-y-3">
              {weakPoints.map((point, index) => (
                <div 
                  key={point.id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/practice?knowledgePointId=${point.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center text-xs font-semibold text-orange-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{point.name}</p>
                      <p className="text-xs text-gray-500">{point.category} · 答题 {point.total_answers} 次</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    point.accuracy >= 60 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {point.accuracy}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" />
              <p>表现良好！暂无需要特别关注的薄弱知识点</p>
            </div>
          )}
        </div>

        {/* 错因分布 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            常见错误类型
          </h3>
          
          {errorTags.length > 0 ? (
            <div className="space-y-3">
              {errorTags.slice(0, 5).map((tag, index) => (
                <div key={tag.tag} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {tag.label || tag.tag}
                    </span>
                    <span className="text-sm text-gray-500">{tag.count} 次</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-red-400 h-2 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min((tag.count / (errorTags[0]?.count || 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" />
              <p>暂无错题记录</p>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-gray-100">
            <Link 
              to="/wrong-notes"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
            >
              查看所有错题 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/practice"
            className="flex items-center gap-3 p-4 bg-white rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-gray-200 transition-all"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">开始新练习</p>
              <p className="text-xs text-gray-500">选择知识点随机出题</p>
            </div>
          </Link>
          
          <Link 
            to="/wrong-notes"
            className="flex items-center gap-3 p-4 bg-white rounded-lg hover:bg-orange-50 hover:border-orange-200 border border-gray-200 transition-all"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">复习错题</p>
              <p className="text-xs text-gray-500">针对薄弱点专项训练</p>
            </div>
          </Link>
          
          <Link 
            to="/reports"
            className="flex items-center gap-3 p-4 bg-white rounded-lg hover:bg-purple-50 hover:border-purple-200 border border-gray-200 transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">查看报告</p>
              <p className="text-xs text-gray-500">导出学习进度分析</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
