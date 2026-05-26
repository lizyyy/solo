import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { Trophy, XCircle, Home, RefreshCw, FileText, Star } from 'lucide-react';

const ratingColors: Record<string, string> = {
  S: 'text-yellow-400',
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-orange-400',
  D: 'text-red-400',
};

export default function ResultModal() {
  const navigate = useNavigate();
  const { phase, score, currentLevel, failReason, setShowResult, restart } = useGameStore();

  const isSuccess = phase === 'completed';

  const getRating = (score: number): string => {
    if (score >= 900) return 'S';
    if (score >= 700) return 'A';
    if (score >= 500) return 'B';
    if (score >= 300) return 'C';
    return 'D';
  };

  const rating = getRating(score);

  const handleRestart = () => {
    setShowResult(false);
    restart();
  };

  const handleBackToMenu = () => {
    setShowResult(false);
    navigate('/');
  };

  const handleViewReport = () => {
    console.log('查看完整报告');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="hud-panel w-full max-w-md mx-4 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isSuccess ? 'bg-museum-success/20' : 'bg-museum-danger/20'
          }`}>
            {isSuccess ? (
              <Trophy className="w-10 h-10 text-museum-success" />
            ) : (
              <XCircle className="w-10 h-10 text-museum-danger" />
            )}
          </div>
          <h2 className={`text-3xl font-bold mb-2 ${
            isSuccess ? 'text-museum-success' : 'text-museum-danger'
          }`}>
            {isSuccess ? '任务完成！' : '任务失败'}
          </h2>
          {currentLevel && (
            <p className="text-museum-bgLighter">
              {currentLevel.name}
            </p>
          )}
        </div>

        <div className="bg-museum-bg/50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-museum-accent mb-1">
                {score}
              </div>
              <div className="text-sm text-museum-bgLighter">最终得分</div>
            </div>
            <div className="w-px h-16 bg-museum-bgLighter/30" />
            <div className="text-center">
              <div className={`text-5xl font-bold ${ratingColors[rating]} mb-1`}>
                {rating}
              </div>
              <div className="text-sm text-museum-bgLighter">评级</div>
            </div>
          </div>

          {!isSuccess && failReason && (
            <div className="bg-museum-danger/10 border border-museum-danger/30 rounded-lg p-3 mb-4">
              <p className="text-museum-danger text-sm text-center">
                失败原因：{failReason}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-1 mb-4">
            {['S', 'A', 'B', 'C', 'D'].map((r) => (
              <Star
                key={r}
                className={`w-6 h-6 ${
                  r === rating
                    ? `${ratingColors[r]} fill-current`
                    : r < rating
                    ? `${ratingColors[r]} fill-current opacity-50`
                    : 'text-museum-bgLighter/30'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleRestart}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            再来一次
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleViewReport}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              查看报告
            </button>
            <button
              onClick={handleBackToMenu}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              返回主菜单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
