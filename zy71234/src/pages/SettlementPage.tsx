import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, RotateCcw, Star, Trophy } from 'lucide-react';
import { SplitChart } from '../components/Settlement/SplitChart';
import { IssueList } from '../components/Settlement/IssueList';
import { DetailTrace } from '../components/Settlement/DetailTrace';
import { useGameStore } from '../stores/useGameStore';
import { formatCurrency, getPartyIcon } from '../utils/settlementEngine';
import type { SplitDetail } from '../types';

export function SettlementPage() {
  const settlement = useGameStore(state => state.settlement);
  const game = useGameStore(state => state.game);
  const setCurrentPage = useGameStore(state => state.setCurrentPage);
  const restartGame = useGameStore(state => state.restartGame);
  const exportReport = useGameStore(state => state.exportReport);
  const negotiationRecords = useGameStore(state => state.negotiationRecords);
  
  const [selectedSplit, setSelectedSplit] = useState<SplitDetail | null>(null);

  if (!settlement || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-400 mb-4">暂无结算数据</p>
          <button
            onClick={() => setCurrentPage('levels')}
            className="px-6 py-3 bg-music-gold text-music-dark font-bold rounded-lg"
          >
            选择关卡
          </button>
        </div>
      </div>
    );
  }

  const criticalIssues = settlement.issues.filter(i => i.severity === 'critical').length;
  const majorIssues = settlement.issues.filter(i => i.severity === 'major').length;
  
  const getStars = () => {
    if (criticalIssues > 0) return 1;
    if (majorIssues > 0) return 2;
    if (settlement.reputationScore >= 80) return 3;
    return 2;
  };
  
  const stars = getStars();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('game')}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-music-gold">
                结算报告
              </h1>
              <p className="text-gray-400">回合 {game.currentRound} - 谈判完成</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-4 py-2 bg-music-card border border-music-gold/30 
                text-music-gold rounded-lg hover:bg-music-gold/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重新挑战
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 bg-music-gold text-music-dark 
                font-bold rounded-lg hover:shadow-lg hover:shadow-music-gold/30 transition-all"
            >
              <Download className="w-4 h-4" />
              导出报告
            </button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-music-gold/20 via-music-card to-music-gold/20 
            rounded-2xl p-8 mb-8 border border-music-gold/30"
        >
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {Array.from({ length: 3 }, (_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3 + i * 0.2, type: 'spring' }}
                >
                  <Star
                    className={`w-12 h-12 ${
                      i < stars ? 'text-music-gold fill-music-gold' : 'text-gray-600'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
            
            <div className="text-5xl font-serif font-bold text-white mb-2">
              {settlement.reputationScore >= 80 ? '🎊 优秀！' : 
               settlement.reputationScore >= 60 ? '👍 良好' : '⚠️ 需要改进'}
            </div>
            
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-music-gold">
                  {settlement.reputationScore.toFixed(0)}
                </div>
                <div className="text-sm text-gray-400">信誉评分</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(settlement.finalPayout)}
                </div>
                <div className="text-sm text-gray-400">最终支付</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  settlement.issues.length === 0 ? 'text-green-400' : 
                  settlement.issues.length <= 2 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {settlement.issues.length}
                </div>
                <div className="text-sm text-gray-400">发现问题</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SplitChart 
              splits={settlement.splits} 
              onSegmentClick={setSelectedSplit}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <div className="bg-music-card rounded-xl p-6 border border-white/10">
              <h3 className="text-music-gold font-serif text-lg mb-4">
                💰 收入明细
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-gray-400">总营收</span>
                  <span className="font-bold text-white">
                    {formatCurrency(settlement.totalRevenue)}
                  </span>
                </div>
                {settlement.deductions.map((deduction, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-white/10 text-orange-400">
                    <span>- {deduction.name}</span>
                    <span className="font-bold">- {formatCurrency(deduction.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2">
                  <span className="text-music-gold font-bold">可分配收入</span>
                  <span className="font-bold text-music-gold">
                    {formatCurrency(settlement.totalRevenue - settlement.deductions.reduce((s, d) => s + d.amount, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-music-card rounded-xl p-6 border border-white/10">
              <h3 className="text-music-gold font-serif text-lg mb-4">
                📋 各方分成
              </h3>
              <div className="space-y-3">
                {settlement.splits.map((split, index) => (
                  <motion.div
                    key={split.partyId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-center justify-between p-3 bg-music-darker rounded-lg 
                      cursor-pointer hover:bg-music-gold/10 transition-colors"
                    onClick={() => setSelectedSplit(split)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getPartyIcon(split.partyType)}</span>
                      <span className="font-medium">{split.partyName}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-music-gold">{split.finalSplit.toFixed(1)}%</div>
                      <div className="text-sm text-gray-400">{formatCurrency(split.amount)}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-center text-gray-500 text-xs mt-4">
                点击查看详细分成溯源
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <IssueList issues={settlement.issues} />
        </motion.div>

        {negotiationRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 bg-music-card rounded-xl p-6 border border-white/10"
          >
            <h3 className="text-music-gold font-serif text-lg mb-4">
              📝 谈判记录
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 text-gray-400 font-medium">回合</th>
                    <th className="text-left py-3 text-gray-400 font-medium">卡牌</th>
                    <th className="text-left py-3 text-gray-400 font-medium">效果</th>
                  </tr>
                </thead>
                <tbody>
                  {negotiationRecords.map((record, index) => (
                    <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3">{record.round}</td>
                      <td className="py-3 font-medium">{record.cardName}</td>
                      <td className="py-3 text-gray-400">{record.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        <DetailTrace split={selectedSplit} onClose={() => setSelectedSplit(null)} />
      </div>
    </div>
  );
}
