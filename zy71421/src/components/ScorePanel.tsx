import React from 'react';
import { motion } from 'framer-motion';
import { Star, Target, Clock } from 'lucide-react';

interface ScorePanelProps {
  score: number;
  accuracy: number;
  completedMeasures: number;
  totalMeasures: number;
}

export const ScorePanel: React.FC<ScorePanelProps> = ({
  score,
  accuracy,
  completedMeasures,
  totalMeasures,
}) => {
  const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="factory-card p-4"
    >
      <h3 className="font-display text-lg text-factory-700 mb-3">实时评分</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i <= stars ? [1, 1.2, 1] : 1,
                  rotate: i <= stars ? [0, -10, 10, 0] : 0,
                }}
                transition={{ delay: i * 0.1 }}
              >
                <Star
                  className={`w-6 h-6 ${
                    i <= stars
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </motion.div>
            ))}
          </div>
          <span className="text-xs text-gear-500">评价</span>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-factory-600">{score}</div>
          <div className="flex items-center justify-center gap-1 text-xs text-gear-500">
            <Target className="w-3 h-3" />
            分数
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-gear-600">{accuracy}%</div>
          <div className="flex items-center justify-center gap-1 text-xs text-gear-500">
            <Clock className="w-3 h-3" />
            准确率
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-gear-500 mb-1">
          <span>完成进度</span>
          <span>{completedMeasures} / {totalMeasures} 小节</span>
        </div>
        <div className="h-2 bg-gear-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-factory-400 to-factory-600 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedMeasures / totalMeasures) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </div>
    </motion.div>
  );
};
