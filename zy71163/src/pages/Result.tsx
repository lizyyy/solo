import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, Star, Clock, AlertCircle, CheckCircle, 
  XCircle, Download, Home, RotateCcw, Play,
  TrendingUp, Target, Zap
} from 'lucide-react';
import { getGameRecordById, downloadReport } from '@/utils/storage';
import { getLevelById, getDifficultyStars } from '@/data/levels';
import { getMedicineById } from '@/data/medicines';
import { cn } from '@/lib/utils';
import type { GameRecord, GameError, ScoreDetail } from '@/types';

const Result = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const gameRecord = useMemo(() => {
    if (!gameId) return null;
    return getGameRecordById(gameId);
  }, [gameId]);

  const level = useMemo(() => {
    if (!gameRecord) return null;
    return getLevelById(gameRecord.levelId);
  }, [gameRecord]);

  const getStars = (score: number, maxScore: number): number => {
    const percentage = score / maxScore;
    if (percentage >= 0.9) return 3;
    if (percentage >= 0.7) return 2;
    if (percentage >= 0.5) return 1;
    return 0;
  };

  const getGrade = (score: number, maxScore: number): { grade: string; color: string; description: string } => {
    const percentage = score / maxScore;
    if (percentage >= 0.95) return { grade: 'S', color: 'text-yellow-500', description: '完美！' };
    if (percentage >= 0.9) return { grade: 'A', color: 'text-green-500', description: '优秀！' };
    if (percentage >= 0.8) return { grade: 'B', color: 'text-blue-500', description: '良好' };
    if (percentage >= 0.7) return { grade: 'C', color: 'text-purple-500', description: '及格' };
    if (percentage >= 0.6) return { grade: 'D', color: 'text-orange-500', description: '需要改进' };
    return { grade: 'F', color: 'text-red-500', description: '失败' };
  };

  const getErrorIcon = (error: GameError) => {
    switch (error.type) {
      case 'dosage':
        return <AlertCircle className="text-blue-500" size={16} />;
      case 'contraindication':
        return <AlertCircle className="text-red-500" size={16} />;
      case 'batch':
        return <AlertCircle className="text-yellow-500" size={16} />;
      case 'wrong_medicine':
        return <XCircle className="text-gray-500" size={16} />;
      default:
        return <AlertCircle className="text-gray-500" size={16} />;
    }
  };

  const groupedErrors = useMemo(() => {
    if (!gameRecord) return {};
    return gameRecord.errors.reduce((acc, error) => {
      const key = error.prescriptionId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(error);
      return acc;
    }, {} as Record<string, GameError[]>);
  }, [gameRecord]);

  const scoreDetails = useMemo(() => {
    if (!gameRecord) return [];
    const details: ScoreDetail[] = [];
    
    const bonusDetails = gameRecord.scoreDetails.filter(d => d.type === 'bonus');
    const penaltyDetails = gameRecord.scoreDetails.filter(d => d.type === 'penalty');
    
    details.push(...bonusDetails, ...penaltyDetails);
    return details;
  }, [gameRecord]);

  if (!gameRecord || !level) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <p className="text-xl text-gray-600">游戏记录不存在</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
          >
            返回菜单
          </button>
        </div>
      </div>
    );
  }

  const stars = getStars(gameRecord.score, level.maxScore);
  const gradeInfo = getGrade(gameRecord.score, level.maxScore);
  const isPassed = gameRecord.score >= level.maxScore * 0.6;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}分${secs}秒`;
  };

  const correctCount = gameRecord.prescriptionResults.filter(r => r.isCorrect).length;
  const accuracy = Math.round((correctCount / gameRecord.prescriptionResults.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {isPassed ? '🎉 关卡完成！' : '😔 再接再厉！'}
          </h1>
          <p className="text-gray-600">{level.name} - 结算报告</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-3xl shadow-2xl border border-gray-100 p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{level.name}</h2>
                <p className="text-gray-500 flex items-center gap-2 mt-1">
                  <span>{getDifficultyStars(level.difficulty)}</span>
                  <span className="text-sm">{level.description}</span>
                </p>
              </div>
              <div className="text-right">
                <div className={cn('text-6xl font-black', gradeInfo.color)}>
                  {gradeInfo.grade}
                </div>
                <p className={cn('text-sm font-medium', gradeInfo.color)}>
                  {gradeInfo.description}
                </p>
              </div>
            </div>

            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((star) => (
                  <motion.div
                    key={star}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3 + star * 0.1, type: 'spring' }}
                  >
                    <Star
                      size={48}
                      className={cn(
                        'transition-all duration-500',
                        star <= stars
                          ? 'text-yellow-400 fill-yellow-400 drop-shadow-lg'
                          : 'text-gray-200'
                      )}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Trophy className="text-green-500" size={28} />
                </div>
                <p className="text-3xl font-bold text-green-700 font-mono">
                  {gameRecord.score}
                </p>
                <p className="text-xs text-green-600 mt-1">总得分</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Target className="text-blue-500" size={28} />
                </div>
                <p className="text-3xl font-bold text-blue-700 font-mono">
                  {accuracy}%
                </p>
                <p className="text-xs text-blue-600 mt-1">正确率</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Clock className="text-purple-500" size={28} />
                </div>
                <p className="text-3xl font-bold text-purple-700 font-mono">
                  {formatTime(gameRecord.totalTime)}
                </p>
                <p className="text-xs text-purple-600 mt-1">用时</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-4 text-center">
                <div className="flex justify-center mb-2">
                  <AlertCircle className="text-red-500" size={28} />
                </div>
                <p className="text-3xl font-bold text-red-700 font-mono">
                  {gameRecord.errors.length}
                </p>
                <p className="text-xs text-red-600 mt-1">错误数</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="text-green-500" size={20} />
                得分明细
              </h3>
              <div className="bg-gray-50 rounded-2xl p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {scoreDetails.map((detail, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-white"
                    >
                      <div className="flex items-center gap-2">
                        {detail.type === 'bonus' ? (
                          <CheckCircle className="text-green-500" size={16} />
                        ) : (
                          <XCircle className="text-red-500" size={16} />
                        )}
                        <span className="text-sm text-gray-700">{detail.description}</span>
                      </div>
                      <span className={cn(
                        'font-bold font-mono',
                        detail.type === 'bonus' ? 'text-green-600' : 'text-red-600'
                      )}>
                        {detail.type === 'bonus' ? '+' : ''}{detail.points}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {gameRecord.errors.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={20} />
                  错误记录
                </h3>
                <div className="bg-red-50 rounded-2xl p-4 max-h-60 overflow-y-auto">
                  <div className="space-y-3">
                    {gameRecord.errors.map((error, index) => {
                      const medicine = getMedicineById(error.medicineId);
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 + index * 0.05 }}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white border border-red-100"
                        >
                          {getErrorIcon(error)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {medicine?.name || '未知药品'}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                                {error.type === 'dosage' && '剂量错误'}
                                {error.type === 'contraindication' && '禁忌冲突'}
                                {error.type === 'batch' && '批号过期'}
                                {error.type === 'wrong_medicine' && '药品错误'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">{error.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              处方 #{gameRecord.prescriptionResults.findIndex(r => r.prescriptionId === error.prescriptionId) + 1}
                            </p>
                          </div>
                          <span className="text-red-500 font-mono font-bold text-sm">
                            -{error.penalty}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6"
            >
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="text-yellow-500" size={20} />
                处方完成情况
              </h3>
              <div className="space-y-2">
                {gameRecord.prescriptionResults.map((result, index) => (
                  <div
                    key={result.prescriptionId}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl transition-all',
                      result.isCorrect 
                        ? 'bg-green-50 border border-green-100' 
                        : 'bg-red-50 border border-red-100'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">处方 #{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.isCorrect ? (
                        <CheckCircle className="text-green-500" size={18} />
                      ) : (
                        <XCircle className="text-red-500" size={18} />
                      )}
                      <span className={cn(
                        'text-sm font-mono font-bold',
                        result.isCorrect ? 'text-green-600' : 'text-red-600'
                      )}>
                        {result.score > 0 ? '+' : ''}{result.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-3"
            >
              <button
                onClick={() => navigate(`/replay/${gameId}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
              >
                <Play size={18} />
                <span>历史回放</span>
              </button>
              <button
                onClick={() => downloadReport(gameRecord)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
              >
                <Download size={18} />
                <span>导出报告</span>
              </button>
              <button
                onClick={() => navigate(`/game/${level.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
              >
                <RotateCcw size={18} />
                <span>重新挑战</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
              >
                <Home size={18} />
                <span>返回菜单</span>
              </button>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-gray-500"
        >
          <p>游戏结束时间: {new Date(gameRecord.endTime).toLocaleString('zh-CN')}</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Result;
