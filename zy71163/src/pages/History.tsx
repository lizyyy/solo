import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History as HistoryIcon, Trophy, Star, Clock, AlertCircle, 
  ArrowLeft, Trash2, Play, Download, Calendar,
  Filter, Search, ChevronDown
} from 'lucide-react';
import { getAllGameRecords, deleteGameRecord, clearAllRecords } from '@/utils/storage';
import { getLevelById, getDifficultyStars } from '@/data/levels';
import { cn } from '@/lib/utils';
import type { GameRecord } from '@/types';

const History = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<GameRecord[]>(() => getAllGameRecords());
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'time'>('date');

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(r => r.levelId === selectedLevel);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        const level = getLevelById(r.levelId);
        return level?.name.toLowerCase().includes(query);
      });
    }
    
    filtered.sort((a, b) => {
      if (sortBy === 'date') return b.endTime - a.endTime;
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'time') return a.totalTime - b.totalTime;
      return 0;
    });
    
    return filtered;
  }, [records, selectedLevel, searchQuery, sortBy]);

  const stats = useMemo(() => {
    if (records.length === 0) {
      return {
        totalGames: 0,
        bestScore: 0,
        avgScore: 0,
        totalTime: 0
      };
    }
    
    const bestScore = Math.max(...records.map(r => r.score));
    const avgScore = Math.round(records.reduce((sum, r) => sum + r.score, 0) / records.length);
    const totalTime = records.reduce((sum, r) => sum + r.totalTime, 0);
    
    return {
      totalGames: records.length,
      bestScore,
      avgScore,
      totalTime
    };
  }, [records]);

  const uniqueLevels = useMemo(() => {
    const levelIds = [...new Set(records.map(r => r.levelId))];
    return levelIds.map(id => {
      const level = getLevelById(id);
      return { id, name: level?.name || '未知关卡' };
    });
  }, [records]);

  const handleDelete = (gameId: string) => {
    deleteGameRecord(gameId);
    setRecords(getAllGameRecords());
    setShowDeleteConfirm(null);
  };

  const handleClearAll = () => {
    clearAllRecords();
    setRecords([]);
    setShowClearConfirm(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const getStars = (score: number, maxScore: number): number => {
    const percentage = score / maxScore;
    if (percentage >= 0.9) return 3;
    if (percentage >= 0.7) return 2;
    if (percentage >= 0.5) return 1;
    return 0;
  };

  const getScoreColor = (score: number, maxScore: number): string => {
    const percentage = score / maxScore;
    if (percentage >= 0.9) return 'text-green-600';
    if (percentage >= 0.7) return 'text-blue-600';
    if (percentage >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-white shadow-md hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="text-gray-600" size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <HistoryIcon className="text-purple-500" size={32} />
                历史记录
              </h1>
              <p className="text-gray-500">查看你的所有游戏记录和成就</p>
            </div>
          </div>
          {records.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={18} />
              <span className="text-sm font-medium">清空记录</span>
            </button>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-100 flex items-center justify-center">
              <Trophy className="text-purple-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-gray-900 font-mono">{stats.totalGames}</p>
            <p className="text-sm text-gray-500 mt-1">总游戏次数</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-yellow-100 flex items-center justify-center">
              <Star className="text-yellow-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-yellow-600 font-mono">{stats.bestScore}</p>
            <p className="text-sm text-gray-500 mt-1">最高分</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Trophy className="text-blue-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-blue-600 font-mono">{stats.avgScore}</p>
            <p className="text-sm text-gray-500 mt-1">平均分</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-green-100 flex items-center justify-center">
              <Clock className="text-green-500" size={24} />
            </div>
            <p className="text-3xl font-bold text-green-600 font-mono">
              {formatTime(stats.totalTime)}
            </p>
            <p className="text-sm text-gray-500 mt-1">总游戏时长</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="搜索关卡..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="appearance-none pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="all">全部关卡</option>
                {uniqueLevels.map(level => (
                  <option key={level.id} value={level.id}>{level.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'time')}
                className="appearance-none pl-4 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="date">按时间排序</option>
                <option value="score">按分数排序</option>
                <option value="time">按时长排序</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {filteredRecords.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <HistoryIcon className="text-gray-300" size={40} />
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">暂无游戏记录</h3>
              <p className="text-gray-500 mb-6">开始游戏后，你的记录会显示在这里</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
              >
                开始游戏
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRecords.map((record, index) => {
                const level = getLevelById(record.levelId);
                if (!level) return null;
                
                const stars = getStars(record.score, level.maxScore);
                const isPassed = record.score >= level.maxScore * 0.6;
                
                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="p-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg text-2xl font-bold text-white flex-shrink-0',
                        isPassed 
                          ? 'bg-gradient-to-br from-green-400 to-green-500' 
                          : 'bg-gradient-to-br from-gray-300 to-gray-400'
                      )}>
                        {isPassed ? '✓' : '✗'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 truncate">{level.name}</h4>
                          <span className="text-sm">{getDifficultyStars(level.difficulty)}</span>
                          {record.errors.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                              <AlertCircle size={10} />
                              {record.errors.length}个错误
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(record.endTime).toLocaleDateString('zh-CN')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatTime(record.totalTime)}
                          </span>
                          <span>
                            {record.prescriptionResults.filter(r => r.isCorrect).length}/{record.prescriptionResults.length} 处方正确
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 mr-2">
                          {[1, 2, 3].map(star => (
                            <Star
                              key={star}
                              size={18}
                              className={cn(
                                star <= stars 
                                  ? 'text-yellow-400 fill-yellow-400' 
                                  : 'text-gray-200'
                              )}
                            />
                          ))}
                        </div>
                        <div className="text-right mr-4">
                          <p className={cn('text-xl font-bold font-mono', getScoreColor(record.score, level.maxScore))}>
                            {record.score}
                          </p>
                          <p className="text-xs text-gray-400">/{level.maxScore}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/replay/${record.id}`)}
                          className="p-2 rounded-xl bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                          title="历史回放"
                        >
                          <Play size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/result/${record.id}`)}
                          className="p-2 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                          title="查看详情"
                        >
                          <Trophy size={18} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(record.id)}
                          className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="删除记录"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-600 mb-6">确定要删除这条游戏记录吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">清空所有记录</h3>
              <p className="text-gray-600 mb-6">确定要清空所有游戏记录吗？此操作无法撤销。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
                >
                  清空
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default History;
