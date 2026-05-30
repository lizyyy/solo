import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { NewsEvent } from '@/types';

interface NewsBannerProps {
  news: NewsEvent;
  roundNumber: number;
  totalRounds: number;
}

export const NewsBanner: React.FC<NewsBannerProps> = ({ news, roundNumber, totalRounds }) => {
  const getSeverityColor = () => {
    switch (news.severity) {
      case 'high':
        return 'bg-red-900/30 border-red-500/50';
      case 'medium':
        return 'bg-orange-900/30 border-orange-500/50';
      case 'low':
        return 'bg-yellow-900/30 border-yellow-500/50';
      default:
        return 'bg-gray-800 border-gray-600';
    }
  };

  const getImpactIcon = () => {
    switch (news.direction) {
      case 'upgrade':
        return <TrendingUp className="w-5 h-5 text-emerald-400" />;
      case 'downgrade':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getImpactText = () => {
    switch (news.direction) {
      case 'upgrade':
        return '利好 - 建议上调评级';
      case 'downgrade':
        return '利空 - 建议下调评级';
      default:
        return '中性 - 影响有限';
    }
  };

  const getSeverityText = () => {
    switch (news.severity) {
      case 'high':
        return '重大';
      case 'medium':
        return '中等';
      default:
        return '一般';
    }
  };

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 20 }}
      className={`w-full p-4 border-b ${getSeverityColor()} backdrop-blur-sm`}
    >
      <div className="max-w-7xl mx-auto flex items-start gap-4">
        <div className="flex-shrink-0">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="p-3 rounded-full bg-red-500/20 border border-red-500/50"
          >
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </motion.div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-700 text-slate-300">
              第 {roundNumber}/{totalRounds} 回合
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              news.severity === 'high' ? 'bg-red-500/20 text-red-400' :
              news.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {getSeverityText()}新闻
            </span>
            <div className="flex items-center gap-1 text-sm">
              {getImpactIcon()}
              <span className={news.direction === 'upgrade' ? 'text-emerald-400' : news.direction === 'downgrade' ? 'text-red-400' : 'text-gray-400'}>
                {getImpactText()}
              </span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            🚨 {news.title}
          </h2>

          <p className="text-gray-300 text-sm leading-relaxed">
            {news.content}
          </p>

          <div className="mt-2 text-xs text-gray-500">
            影响债券: {news.affectedBondCodes.length} 只 | 预期评级: {news.expectedRating}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NewsBanner;
