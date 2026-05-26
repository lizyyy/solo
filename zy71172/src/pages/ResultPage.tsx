
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Home, RotateCcw, Download, AlertCircle, CheckCircle, Clock, Target } from 'lucide-react';
import { useHistoryStore } from '@/store/useHistoryStore';
import { GameRecord } from '@/types';
import { levels } from '@/data/levels';

export function ResultPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { getRecordById, exportReport, loadRecords } = useHistoryStore();
  const [record, setRecord] = useState<GameRecord | null>(null);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (recordId) {
      const found = getRecordById(recordId);
      if (found) {
        setRecord(found);
      }
    }
  }, [recordId, getRecordById]);

  if (!record) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const level = levels.find(l => l.id === record.levelId);
  const isPassed = record.score >= (level?.targetScore || 0);
  const totalAttempts = record.correctCount + record.wrongCount;

  const handleExport = () => {
    const report = exportReport(record);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `投放报告_${new Date(record.completedAt).toLocaleDateString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ rotate: isPassed ? [0, -10, 10, -10, 0] : 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-8xl mb-4"
          >
            {isPassed ? '🎉' : '😅'}
          </motion.div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {isPassed ? '恭喜通过！' : '再接再厉！'}
          </h1>
          <p className="text-white/80">
            {level?.name || '未知关卡'} · {new Date(record.completedAt).toLocaleString('zh-CN')}
          </p>
        </motion.div>

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-8 shadow-2xl mb-8"
        >
          {/* Main Score */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mb-4">
              <div className="text-center">
                <Trophy className="w-10 h-10 text-white mx-auto mb-1" />
                <span className="text-3xl font-bold text-white">{record.score}</span>
              </div>
            </div>
            <p className="text-gray-500">
              目标分数: {level?.targetScore || 0} 分
              {isPassed && <span className="text-green-500 ml-2">✓ 达标</span>}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 rounded-2xl p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{record.correctCount}</div>
              <div className="text-sm text-green-600">正确投放</div>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 text-center">
              <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">{record.wrongCount}</div>
              <div className="text-sm text-red-600">错误投放</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4 text-center">
              <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{record.accuracy}%</div>
              <div className="text-sm text-blue-600">准确率</div>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4 text-center">
              <Clock className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">{formatDuration(record.duration)}</div>
              <div className="text-sm text-purple-600">用时</div>
            </div>
          </div>

          {/* Accuracy Ring */}
          <div className="flex justify-center mb-8">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="12"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke={record.accuracy >= 80 ? '#22C55E' : record.accuracy >= 60 ? '#F59E0B' : '#EF4444'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: '0 440' }}
                  animate={{ strokeDasharray: `${(record.accuracy / 100) * 440} 440` }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-gray-700">{record.accuracy}%</span>
              </div>
            </div>
          </div>

          {/* Error Details */}
          {record.errors.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="text-red-500" />
                错误分析
              </h3>
              <div className="space-y-3">
                {record.errors.map((error, index) => (
                  <motion.div
                    key={error.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{error.trashItem.emoji}</span>
                      <div className="flex-1">
                        <div className="font-bold text-gray-800">
                          {error.trashItem.name}
                        </div>
                        <div className="text-sm text-red-600">
                          ❌ 错误: {error.wrongAction}
                        </div>
                        <div className="text-sm text-green-600">
                          ✅ 正确: {error.correctAction}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          💡 {error.explanation}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate(`/game/${record.levelId}`)}
              className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              <RotateCcw size={20} />
              再玩一次
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              <Download size={20} />
              导出报告
            </button>
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              查看历史
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors shadow-lg"
            >
              <Home size={20} />
              返回主菜单
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default ResultPage;
