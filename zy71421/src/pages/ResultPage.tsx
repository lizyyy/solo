import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Home, RotateCcw, ArrowLeft, Trophy, AlertTriangle, CheckCircle } from 'lucide-react';
import { getLevelById } from '../data/levels';
import { getCompletedLevels, saveCorrectionRecord, getCorrectionByLevelId } from '../utils/storage';
import { CorrectionRecord } from '../types';

export const ResultPage: React.FC = () => {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<{ score: number; stars: number; accuracy: number } | null>(null);
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [newScore, setNewScore] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    if (levelId) {
      const completed = getCompletedLevels().find(c => c.levelId === levelId);
      if (completed) {
        setResult({ score: completed.score, stars: completed.stars, accuracy: completed.accuracy });
        setNewScore(completed.score);
      }
      setCorrections(getCorrectionByLevelId(levelId));
    }
  }, [levelId]);

  const level = levelId ? getLevelById(levelId) : null;

  const handleSubmitCorrection = () => {
    if (!levelId || !result || !teacherName || !correctionReason) return;

    const record: CorrectionRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      levelId,
      originalScore: result.score,
      newScore,
      reason: correctionReason,
      teacherName,
      changes: [],
    };

    saveCorrectionRecord(record);
    setCorrections(getCorrectionByLevelId(levelId));
    setShowCorrectionForm(false);
    setCorrectionReason('');
  };

  const getScoreMessage = () => {
    if (!result) return '';
    if (result.score >= 90) return '太棒了！完美掌握！';
    if (result.score >= 70) return '做得不错，继续加油！';
    if (result.score >= 50) return '还需要多多练习哦！';
    return '别灰心，再试一次吧！';
  };

  if (!level || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-factory-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full"
      >
        <div className="factory-card p-8 text-center mb-6">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-factory-400 to-factory-600 rounded-full mb-4 shadow-lg">
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          <h1 className="font-display text-3xl text-factory-700 mb-2">
            {level.name}
          </h1>
          <p className="text-gear-600 mb-6">{getScoreMessage()}</p>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i <= result.stars ? [1, 1.3, 1] : 1,
                  rotate: i <= result.stars ? [0, -15, 15, 0] : 0,
                }}
                transition={{ delay: 0.4 + i * 0.1 }}
              >
                <Star
                  className={`w-12 h-12 ${
                    i <= result.stars
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-factory-50 rounded-xl p-4">
              <div className="text-4xl font-bold text-factory-600 mb-1">
                {result.score}
              </div>
              <div className="text-sm text-gear-500">总分数</div>
            </div>
            <div className="bg-gear-50 rounded-xl p-4">
              <div className="text-4xl font-bold text-gear-600 mb-1">
                {result.accuracy}%
              </div>
              <div className="text-sm text-gear-500">准确率</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/game/${levelId}`)}
              className="factory-button flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              再玩一次
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="factory-button-secondary flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              返回首页
            </motion.button>
          </div>
        </div>

        <div className="factory-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg text-factory-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              教师修正
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCorrectionForm(!showCorrectionForm)}
              className="text-sm text-factory-600 hover:text-factory-700"
            >
              {showCorrectionForm ? '取消' : '添加修正'}
            </motion.button>
          </div>

          {showCorrectionForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-4 bg-factory-50 rounded-xl"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gear-600 mb-1">教师姓名</label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full px-3 py-2 border border-gear-300 rounded-lg focus:outline-none focus:border-factory-500"
                    placeholder="请输入您的姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gear-600 mb-1">
                    修正后分数: {newScore}分
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={newScore}
                    onChange={(e) => setNewScore(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gear-600 mb-1">修正理由</label>
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gear-300 rounded-lg focus:outline-none focus:border-factory-500 resize-none"
                    rows={3}
                    placeholder="请说明修正理由，例如：学生表现优秀，给予加分..."
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmitCorrection}
                  disabled={!teacherName || !correctionReason}
                  className="factory-button w-full disabled:opacity-50"
                >
                  提交修正
                </motion.button>
              </div>
            </motion.div>
          )}

          {corrections.length > 0 ? (
            <div className="space-y-3">
              {corrections.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-gear-50 rounded-xl border border-gear-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gear-700">
                      {record.teacherName}
                    </span>
                    <span className="text-xs text-gear-400">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gear-500">原始分:</span>
                    <span className="text-gear-700 line-through">{record.originalScore}</span>
                    <span className="text-factory-500">→</span>
                    <span className="text-sm text-gear-500">修正分:</span>
                    <span className="text-factory-600 font-bold">{record.newScore}</span>
                  </div>
                  <p className="text-sm text-gear-600 bg-white p-2 rounded-lg">
                    {record.reason}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gear-400 py-4">
              暂无修正记录
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
