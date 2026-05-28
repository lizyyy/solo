import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { calculateGameStats } from '../utils/gameLogic';
import { downloadGameReport } from '../utils/storage';
import { HistoryModal } from './HistoryModal';

export const GameOverScreen: React.FC = () => {
  const { state, actions } = useGame();
  const [showHistory, setShowHistory] = useState(false);

  const stats = calculateGameStats(state);

  const getGrade = () => {
    if (stats.profit >= 300) return { grade: 'S', color: 'text-yellow-500', desc: '传奇店长！' };
    if (stats.profit >= 200) return { grade: 'A', color: 'text-green-500', desc: '出色的经营者！' };
    if (stats.profit >= 100) return { grade: 'B', color: 'text-blue-500', desc: '合格的店长' };
    if (stats.profit >= 0) return { grade: 'C', color: 'text-orange-500', desc: '勉强维持' };
    return { grade: 'D', color: 'text-red-500', desc: '需要学习' };
  };

  const gradeInfo = getGrade();

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-amber-600 to-amber-800 text-white p-6 rounded-t-xl text-center">
            <p className="text-amber-200 text-sm mb-2">{state.gameOverReason}</p>
            <h2 className="text-3xl font-bold mb-2">
              {stats.isWin ? '🎉 经营成功！' : '😢 经营结束'}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className={`text-5xl font-bold ${gradeInfo.color}`}>
                {gradeInfo.grade}
              </span>
              <span className="text-amber-200">{gradeInfo.desc}</span>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 经营总结</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-xs text-gray-500">初始资金</p>
                <p className="text-xl font-bold text-gray-800">¥{state.initialCash}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-xs text-gray-500">最终现金</p>
                <p className="text-xl font-bold text-gray-800">¥{state.cash}</p>
              </div>
              <div className={`p-4 rounded-lg text-center ${stats.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-500">总利润</p>
                <p className={`text-xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{stats.profit}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-xs text-gray-500">回报率</p>
                <p className={`text-xl font-bold ${stats.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.returnRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-xs text-blue-600 mb-1">总营收</p>
                <p className="text-2xl font-bold text-blue-700">¥{stats.totalRevenue}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-xs text-orange-600 mb-1">总投入</p>
                <p className="text-2xl font-bold text-orange-700">¥{stats.totalCost}</p>
              </div>
            </div>

            {stats.bestSelling && stats.bestSelling.sold > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">🏆 最畅销唱片</h4>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <img
                    src={stats.bestSelling.record.imageUrl}
                    alt={stats.bestSelling.record.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium">{stats.bestSelling.record.title}</p>
                    <p className="text-sm text-gray-500">
                      售出 {stats.bestSelling.sold} 张
                    </p>
                  </div>
                </div>
              </div>
            )}

            {stats.worstSelling && (
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-2">⚠️ 滞销唱片</h4>
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <img
                    src={state.vinylCatalog.find(r => r.id === stats.worstSelling.recordId)?.imageUrl}
                    alt=""
                    className="w-12 h-12 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium">
                      {state.vinylCatalog.find(r => r.id === stats.worstSelling.recordId)?.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      在库 {stats.worstSelling.daysInStock} 天，剩余 {stats.worstSelling.quantity} 张
                    </p>
                  </div>
                </div>
              </div>
            )}

            <h3 className="text-lg font-bold text-gray-800 mb-3">📈 每日经营明细</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-6">
              {state.dailyReports.map((report, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">第 {report.day} 天</span>
                    <span className={report.endingCash >= report.startingCash ? 'text-green-600' : 'text-red-600'}>
                      {report.endingCash >= report.startingCash ? '+' : ''}¥{report.endingCash - report.startingCash}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                    <span>进货: {report.purchases.length}种</span>
                    <span>销售: {report.sales.length}笔</span>
                    <span>顾客: {report.customerVisits.length}人</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => downloadGameReport(state)}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                📥 导出完整报告 (JSON)
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              >
                📜 查看历史对局
              </button>
              <button
                onClick={() => {
                  actions.startNewGame();
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
              >
                🔄 再来一局
              </button>
            </div>
          </div>
        </div>
      </div>

      <HistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
      />
    </>
  );
};
