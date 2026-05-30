import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, Clock, User, TrendingUp } from 'lucide-react';
import { getCorrectionHistory } from '../utils/storage';
import { getLevelById } from '../data/levels';
import { CorrectionRecord } from '../types';

export const TeacherHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);

  useEffect(() => {
    setCorrections(getCorrectionHistory().sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  const getLevelName = (levelId: string) => {
    return getLevelById(levelId)?.name || '未知关卡';
  };

  const getScoreChange = (record: CorrectionRecord) => {
    const diff = record.newScore - record.originalScore;
    if (diff > 0) return `+${diff}`;
    return diff.toString();
  };

  const totalAdjustments = corrections.reduce((sum, r) => sum + (r.newScore - r.originalScore), 0);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md text-gear-700 hover:bg-gear-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </motion.button>
          <h1 className="font-display text-3xl text-factory-700">
            教师修正历史
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="factory-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-factory-100 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-factory-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-factory-700">{corrections.length}</div>
                <div className="text-sm text-gear-500">总修正次数</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="factory-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">
                  {new Set(corrections.map(c => c.teacherName)).size}
                </div>
                <div className="text-sm text-gear-500">参与教师数</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="factory-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className={`text-2xl font-bold ${totalAdjustments >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {totalAdjustments >= 0 ? '+' : ''}{totalAdjustments}
                </div>
                <div className="text-sm text-gear-500">分数调整总计</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="factory-card p-6">
          <h2 className="font-display text-xl text-factory-700 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            修正记录明细
          </h2>

          {corrections.length > 0 ? (
            <div className="space-y-4">
              {corrections.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-gradient-to-r from-gear-50 to-factory-50 rounded-xl border border-gear-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-medium text-gear-700 mb-1">
                        {getLevelName(record.levelId)}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gear-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {record.teacherName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-gear-400">原始分</div>
                        <div className="text-lg text-gear-600 line-through">{record.originalScore}</div>
                      </div>
                      <div className="text-2xl text-factory-500">→</div>
                      <div className="text-right">
                        <div className="text-xs text-gear-400">修正分</div>
                        <div className="text-lg font-bold text-factory-600">{record.newScore}</div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.newScore > record.originalScore
                          ? 'bg-green-100 text-green-700'
                          : record.newScore < record.originalScore
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gear-100 text-gear-700'
                      }`}>
                        {getScoreChange(record)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded-lg border border-gear-200">
                    <div className="text-xs text-gear-400 mb-1">修正理由</div>
                    <p className="text-gear-600">{record.reason}</p>
                  </div>

                  {record.changes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gear-200">
                      <div className="text-xs text-gear-400 mb-2">具体调整</div>
                      <div className="space-y-2">
                        {record.changes.map((change, i) => (
                          <div key={i} className="text-sm text-gear-600 bg-white p-2 rounded">
                            工位 {change.slotId.split('-').pop()}: 
                            {change.oldNote?.name || '空'} → {change.newNote?.name || '空'}
                            <span className="text-gear-400 ml-2">({change.justification})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Award className="w-16 h-16 text-gear-300 mx-auto mb-4" />
              <p className="text-gear-500">暂无修正记录</p>
              <p className="text-sm text-gear-400 mt-1">
                月底复盘时可以在这里查看所有人工修正记录
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
