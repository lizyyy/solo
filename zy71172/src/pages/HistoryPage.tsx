
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Download, Play, Calendar, Trophy, Target, Clock } from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { levels } from '@/data/levels';

export function HistoryPage() {
  const navigate = useNavigate();
  const { records, loadRecords, deleteRecord, clearAllRecords, exportReport } = useHistoryStore();

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleExport = (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (record) {
      const report = exportReport(record);
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `投放报告_${new Date(record.completedAt).toLocaleDateString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLevelName = (levelId: number) => {
    return levels.find(l => l.id === levelId)?.name || `关卡${levelId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur hover:bg-white/30 text-white font-bold rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
            返回
          </button>
          <h1 className="text-3xl font-bold text-white">历史记录</h1>
          {records.length > 0 && (
            <button
              onClick={clearAllRecords}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/80 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
            >
              <Trash2 size={20} />
              清空
            </button>
          )}
        </div>

        {/* Records List */}
        {records.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/20 backdrop-blur rounded-3xl p-12 text-center"
          >
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl font-bold text-white mb-2">暂无游戏记录</h2>
            <p className="text-white/80 mb-6">快去玩一局游戏吧！</p>
            <button
              onClick={() => navigate('/game/1')}
              className="px-8 py-3 bg-white text-green-600 font-bold rounded-xl hover:bg-white/90 transition-colors"
            >
              开始游戏
            </button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-4">
              {records.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-800">
                            {getLevelName(record.levelId)}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar size={14} />
                            {formatDate(record.completedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-500">{record.score}</div>
                          <div className="text-xs text-gray-500">得分</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-500">{record.accuracy}%</div>
                          <div className="text-xs text-gray-500">准确率</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-500">{record.correctCount}/{record.wrongCount + record.correctCount}</div>
                          <div className="text-xs text-gray-500">正确/总数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-500">
                            {Math.floor(record.duration / 60)}:{(record.duration % 60).toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">用时</div>
                        </div>
                      </div>

                      {/* Error Preview */}
                      {record.errors.length > 0 && (
                        <div className="bg-red-50 rounded-xl p-3 mb-4">
                          <div className="text-sm font-medium text-red-600 mb-2">
                            主要错误 ({record.errors.length}个)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {record.errors.slice(0, 3).map((error, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full"
                              >
                                {error.trashItem.emoji} {error.trashItem.name}
                              </span>
                            ))}
                            {record.errors.length > 3 && (
                              <span className="text-xs text-red-500">
                                +{record.errors.length - 3}个更多
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => navigate(`/result/${record.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Target size={16} />
                        查看详情
                      </button>
                      <button
                        onClick={() => handleExport(record.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Download size={16} />
                        导出报告
                      </button>
                      <button
                        onClick={() => navigate(`/game/${record.levelId}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Play size={16} />
                        再来一局
                      </button>
                      <button
                        onClick={() => deleteRecord(record.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-medium rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
