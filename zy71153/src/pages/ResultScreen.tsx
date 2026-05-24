import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { getLevelById } from '../game/levels';
import { getScoreRating, getMaxPossibleScore } from '../game/scoring';
import { downloadText, downloadJSON } from '../utils/export';
import { SUPPLY_CONFIGS } from '../types';
import { Home, RotateCcw, Download, FileText } from 'lucide-react';

export const ResultScreen = () => {
  const navigate = useNavigate();
  const state = useGameStore();
  const level = getLevelById(state.levelId);
  const maxScore = getMaxPossibleScore(state);
  const rating = getScoreRating(state.score, maxScore);

  const handleExportText = () => {
    if (level) {
      downloadText(state, level.name);
    }
  };

  const handleExportJSON = () => {
    downloadJSON(state, '配送报告.json');
  };

  const handleReplay = () => {
    navigate(`/replay?id=latest`);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            {state.failReason ? '😔 任务结束' : '🎉 任务完成！'}
          </h1>
          <p className="text-slate-400">
            {level?.name} - {state.failReason || '恭喜你完成了所有安置点的物资配送'}
          </p>
        </div>

        {state.failReason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-400 font-medium">失败原因</p>
            <p className="text-white mt-1">{state.failReason}</p>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 mb-6">
          <div className="text-center mb-8">
            <div className={`text-8xl font-bold ${rating.color} mb-2`}>
              {rating.grade}
            </div>
            <div className="text-3xl font-bold text-white">
              {state.score} <span className="text-xl text-slate-400">/ {maxScore}</span>
            </div>
            <div className="w-64 h-3 bg-slate-700 rounded-full mx-auto mt-4">
              <div
                className={`h-3 rounded-full transition-all ${
                  rating.color.replace('text-', 'bg-')
                }`}
                style={{ width: `${(state.score / maxScore) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {state.scoreDetails.map((detail, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
              >
                <div>
                  <span className="text-white font-medium">{detail.category}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{detail.description}</p>
                </div>
                <span
                  className={`font-bold ${
                    detail.score >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {detail.score >= 0 ? '+' : ''}{detail.score}
                  <span className="text-slate-500 text-sm ml-1">
                    / {detail.maxScore}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">安置点配送情况</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.nodes
              .filter((n) => n.type === 'shelter')
              .map((shelter) => {
                if (!shelter.demand || !shelter.received) return null;
                const allMet =
                  shelter.received!.water >= shelter.demand!.water &&
                  shelter.received!.medicine >= shelter.demand!.medicine &&
                  shelter.received!.tent >= shelter.demand!.tent;

                return (
                  <div
                    key={shelter.id}
                    className={`p-4 rounded-lg ${
                      allMet
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{shelter.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          allMet ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}
                      >
                        {allMet ? '已完成' : '未完成'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {SUPPLY_CONFIGS.map((supply) => (
                        <div key={supply.type} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">
                            {supply.emoji} {supply.name}
                          </span>
                          <span
                            className={
                              shelter.received![supply.type] >= shelter.demand![supply.type]
                                ? 'text-green-400'
                                : 'text-red-400'
                            }
                          >
                            {shelter.received![supply.type]} / {shelter.demand![supply.type]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Home size={18} /> 返回首页
          </button>
          <button
            onClick={() => {
              state.resetGame();
              navigate(`/game?level=${state.levelId}`);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            <RotateCcw size={18} /> 重新挑战
          </button>
          <button
            onClick={handleReplay}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            <FileText size={18} /> 查看回放
          </button>
          <button
            onClick={handleExportText}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
          >
            <Download size={18} /> 导出报告
          </button>
        </div>
      </div>
    </div>
  );
};
