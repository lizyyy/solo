import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  MessageSquare,
  Plus,
  Smile,
  Frown,
  Meh,
  Heart,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { DiaryEntry } from '@/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Header from '@/components/Header';

type DiaryTab = 'diary' | 'treehole';

const moodEmojis: Record<string, { emoji: string; label: string; color: string }> = {
  great: { emoji: '😊', label: '很棒', color: 'text-green-600 bg-green-50' },
  good: { emoji: '🙂', label: '不错', color: 'text-blue-600 bg-blue-50' },
  neutral: { emoji: '😐', label: '一般', color: 'text-gray-600 bg-gray-50' },
  bad: { emoji: '😔', label: '不好', color: 'text-red-600 bg-red-50' },
};

export default function DiaryPage() {
  const navigate = useNavigate();
  const { diaryEntries, treeHolePosts, user } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<DiaryTab>('diary');

  const getTodayEntry = () => {
    const today = new Date().toISOString().split('T')[0];
    return diaryEntries.find(entry => entry.date === today);
  };

  const todayEntry = getTodayEntry();

  return (
    <div className="min-h-screen pb-20">
      <Header
        title="记录树洞"
        rightContent={
          <button
            onClick={() => navigate(activeTab === 'diary' ? '/diary/create' : '/hole/create')}
            className="flex items-center p-2 rounded-full bg-i-500 text-white hover:bg-i-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />
      
      <div className="p-4">
        <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('diary')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'diary'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            <div className="flex items-center justify-center">
              <BookOpen className="w-4 h-4 mr-1.5" />
              成长日记
            </div>
          </button>
          <button
            onClick={() => setActiveTab('treehole')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'treehole'
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            <div className="flex items-center justify-center">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              匿名树洞
            </div>
          </button>
        </div>

        {activeTab === 'diary' && (
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {!todayEntry ? (
                <button
                  onClick={() => navigate('/diary/create')}
                  className="w-full card card-green border-2 border-dashed border-e-300 hover:border-e-400 transition-colors"
                >
                  <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-e-100 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-e-500" />
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1">今日还未打卡</h3>
                    <p className="text-sm text-gray-500">记录今天的成长和心情</p>
                  </div>
                </button>
              ) : (
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        moodEmojis[todayEntry.mood]?.color
                      }`}>
                        {moodEmojis[todayEntry.mood]?.emoji} {moodEmojis[todayEntry.mood]?.label}
                      </span>
                      <span className="ml-3 text-sm text-gray-400">
                        {format(new Date(todayEntry.date), 'MM月dd日', { locale: zhCN })}
                      </span>
                    </div>
                    <div className="text-sm text-e-600 bg-e-50 px-2 py-1 rounded-full">
                      +{todayEntry.socialSteps} 社交步数
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-line">{todayEntry.content}</p>
                  
                  {todayEntry.achievements.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">今日成就</h4>
                      <div className="flex flex-wrap gap-2">
                        {todayEntry.achievements.map((achievement, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-e-50 text-e-600 text-xs rounded-full flex items-center"
                          >
                            <Heart className="w-3 h-3 mr-1" />
                            {achievement}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">历史记录</h3>
              <div className="space-y-3">
                {diaryEntries.filter(e => e.id !== todayEntry?.id).map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{moodEmojis[entry.mood]?.emoji}</span>
                        <div>
                          <p className="text-sm text-gray-700 line-clamp-1">{entry.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {format(new Date(entry.date), 'yyyy年MM月dd日', { locale: zhCN })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </motion.div>
                ))}
                
                {diaryEntries.filter(e => e.id !== todayEntry?.id).length === 0 && (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400">暂无历史记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'treehole' && (
          <div className="space-y-4">
            {treeHolePosts.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">树洞是空的</h3>
                <p className="text-sm text-gray-500 mb-4">
                  在这里可以匿名倾诉你的烦恼、吐槽、秘密...
                </p>
                <button
                  onClick={() => navigate('/hole/create')}
                  className="btn-primary btn-purple"
                >
                  写下你的故事
                </button>
              </div>
            ) : (
              treeHolePosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white mr-3">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800">匿名用户</h4>
                        <p className="text-xs text-gray-400">
                          {format(new Date(post.createdAt), 'MM月dd日 HH:mm', { locale: zhCN })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 whitespace-pre-line mb-3">{post.content}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-6">
                      <button
                        onClick={() => {}}
                        className="flex items-center space-x-1"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            post.isLiked
                              ? 'fill-red-500 text-red-500'
                              : 'text-gray-400'
                          }`}
                        />
                        <span className="text-sm text-gray-500">{post.likes}</span>
                      </button>
                      <button className="flex items-center space-x-1">
                        <MessageSquare className="w-5 h-5 text-gray-400" />
                        <span className="text-sm text-gray-500">{post.comments}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
