import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RotateCcw, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { PerformanceChart } from '../components/report/PerformanceChart';
import { OperationLogTable } from '../components/report/OperationLogTable';
import { ReportExport } from '../components/report/ReportExport';
import { formatPercent, formatCurrency } from '../utils/calculations';

export const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    round,
    maxRounds,
    totalAssets,
    trackingError,
    trackingErrorHistory,
    netValueHistory,
    indexValueHistory,
    operationLogs,
    warnings,
    gameStatus,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    if (gameStatus === 'idle') {
      navigate('/');
    }
  }, [gameStatus, navigate]);

  const handleRestart = () => {
    resetGame();
    navigate('/');
  };

  const getGrade = (error: number) => {
    if (error < 0.02) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100', desc: '优秀！跟踪误差控制非常好' };
    if (error < 0.04) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100', desc: '良好，继续优化可以更好' };
    if (error < 0.06) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100', desc: '及格，需要加强误差控制' };
    return { grade: 'D', color: 'text-red-600', bg: 'bg-red-100', desc: '需要改进，建议重新学习' };
  };

  const gradeInfo = getGrade(trackingError);
  const portfolioReturn = totalAssets > 0 ? (totalAssets - 100000000) / 100000000 : 0;

  if (gameStatus === 'idle') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">📊 复盘报告</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/game')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              返回游戏
            </button>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
            >
              <RotateCcw size={18} />
              再来一局
            </button>
            <button
              onClick={() => { resetGame(); navigate('/'); }}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="返回首页"
            >
              <Home size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <Trophy size={64} className="mx-auto mb-4 text-yellow-500" />
            <h2 className="text-3xl font-bold text-slate-800 mb-2">挑战完成！</h2>
            <p className="text-gray-500">完成 {round} / {maxRounds} 回合</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-6xl font-bold ${gradeInfo.color} mb-2`}>
                {gradeInfo.grade}
              </div>
              <div className="text-sm text-gray-500">综合评级</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-3xl font-bold ${trackingError > 0.05 ? 'text-red-600' : 'text-green-600'} mb-2`}>
                {formatPercent(trackingError)}
              </div>
              <div className="text-sm text-gray-500">最终跟踪误差</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-slate-800 mb-2">
                {formatCurrency(totalAssets)}
              </div>
              <div className="text-sm text-gray-500">最终资产</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`text-3xl font-bold mb-2 ${portfolioReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioReturn >= 0 ? '+' : ''}{formatPercent(portfolioReturn)}
              </div>
              <div className="text-sm text-gray-500">累计收益</div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${gradeInfo.bg} text-center`}>
            <p className={`font-medium ${gradeInfo.color}`}>{gradeInfo.desc}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <PerformanceChart
              netValueHistory={netValueHistory}
              indexValueHistory={indexValueHistory}
              trackingErrorHistory={trackingErrorHistory}
            />
          </div>
          <div>
            <ReportExport
              rounds={round}
              trackingErrorHistory={trackingErrorHistory}
              netValueHistory={netValueHistory}
              indexValueHistory={indexValueHistory}
              operationLogs={operationLogs}
              warnings={warnings}
            />
          </div>
        </div>

        <OperationLogTable logs={operationLogs} />
      </main>
    </div>
  );
};
