import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Users, Award, Clock } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber } from '@/utils/format';
import type { Game } from '@/types';

interface PortfolioStatsProps {
  game: Game;
}

export const PortfolioStats: React.FC<PortfolioStatsProps> = ({ game }) => {
  const navChange = game.currentNav - game.initialNav;
  const navChangePercent = ((game.currentNav - game.initialNav) / game.initialNav) * 100;

  const stats = [
    {
      label: '组合净值',
      value: formatCurrency(game.currentNav),
      change: navChange,
      changePercent: navChangePercent,
      icon: Wallet,
      color: 'text-white',
    },
    {
      label: '现金余额',
      value: formatCurrency(game.cash),
      change: null,
      changePercent: null,
      icon: Award,
      color: 'text-blue-400',
    },
    {
      label: '客户信任度',
      value: `${formatNumber(game.trustScore, 0)}%`,
      change: null,
      changePercent: null,
      icon: Users,
      color: game.trustScore >= 80 ? 'text-emerald-400' : game.trustScore >= 60 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: '当前得分',
      value: `${game.totalScore >= 0 ? '+' : ''}${game.totalScore}`,
      change: null,
      changePercent: null,
      icon: Clock,
      color: game.totalScore >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">{stat.label}</span>
            <stat.icon className="w-4 h-4 text-gray-500" />
          </div>
          <motion.div
            key={stat.value}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.3 }}
            className={`text-2xl font-bold ${stat.color}`}
          >
            {stat.value}
          </motion.div>
          {stat.change !== null && stat.changePercent !== null && (
            <div className="flex items-center gap-1 mt-1">
              {stat.change >= 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              <span className={`text-xs ${stat.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatPercent(stat.changePercent)}
              </span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default PortfolioStats;
