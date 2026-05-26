import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../store/useGameStore';
import { ScoreCalculator } from '../../game/engine/ScoreCalculator';
import { getLevelById } from '../../game/data/levels';

export function ResultScreen() {
  const navigate = useNavigate();
  const { gameState, exportReportJSON, restartGame, currentGameId } = useGameStore();
  const level = getLevelById(gameState.currentLevelId);

  const isVictory = gameState.status === 'victory';
  const totalVictims = gameState.victims.length;
  const rescuedVictims = gameState.victims.filter((v) => v.isRescued).length;
  const rating = ScoreCalculator.getFinalRating(gameState.score, totalVictims);

  const ratingColors: Record<string, string> = {
    S: 'text-yellow-400',
    A: 'text-green-400',
    B: 'text-blue-400',
    C: 'text-orange-400',
    D: 'text-red-400',
  };

  const handleExportJSON = () => {
    const json = exportReportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rescue-report-${currentGameId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewReport = () => {
    navigate(`/report/${currentGameId}`);
  };

  const handleReplay = () => {
    navigate(`/replay/${currentGameId}`);
  };

  const handleRestart = () => {
    restartGame();
    navigate(`/game/${gameState.currentLevelId}`);
  };

  const handleMainMenu = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="text-8xl mb-4">
            {isVictory ? '🏆' : '💔'}
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">
            {isVictory ? '任务成功！' : '任务失败'}
          </h1>
          {!isVictory && gameState.defeatReason && (
            <p className="text-red-400 text-lg">{gameState.defeatReason}</p>
          )}
          <p className="text-slate-300 mt-2">{level?.name}</p>
        </div>

        <div className="bg-slate-800/80 rounded-2xl p-8 mb-6">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <p className="text-slate-400 text-sm">最终得分</p>
              <p className="text-4xl font-bold text-yellow-400">{gameState.score}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">评级</p>
              <p className={`text-5xl font-bold ${ratingColors[rating]}`}>{rating}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">救援成功</p>
              <p className="text-4xl font-bold text-white">
                {rescuedVictims}/{totalVictims}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-white font-semibold mb-4">得分明细</h3>
            <div className="space-y-2">
              {gameState.dispatchHistory.map((record, index) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-300">
                    救援 #{index + 1} -{' '}
                    {gameState.victims.find((v) => v.id === record.victimId)?.name}
                  </span>
                  <span className={record.success ? 'text-green-400' : 'text-red-400'}>
                    {record.success ? `+${Math.floor(gameState.score / (index + 1))}` : '失败'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={handleReplay}
            className="py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all"
          >
            📼 查看回放
          </button>
          <button
            onClick={handleViewReport}
            className="py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all"
          >
            📊 详细报告
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={handleExportJSON}
            className="py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-all text-sm"
          >
            💾 导出JSON
          </button>
          <button
            onClick={handleRestart}
            className="py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-all text-sm"
          >
            🔄 再来一局
          </button>
          <button
            onClick={handleMainMenu}
            className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all text-sm"
          >
            🏠 主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
