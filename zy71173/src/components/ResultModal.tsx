import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/useGameStore';
import { generateReport, exportToJSON } from '@/game/report';
import { downloadJSON, generateReportFilename } from '@/utils/export';
import { calculateScore } from '@/game/scoring';
import {
  Trophy,
  XCircle,
  Home,
  RefreshCw,
  FileText,
  Star,
  Download,
  Play,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
} from 'lucide-react';

const ratingColors: Record<string, string> = {
  S: 'text-yellow-400',
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-orange-400',
  D: 'text-red-400',
};

const eventTypeLabels: Record<string, string> = {
  humidity_damage: '湿度损坏',
  congestion: '区域拥堵',
  guard_spotted: '被安保发现',
  door_permission_denied: '门禁权限不足',
  timeout: '超时',
  alert: '警报触发',
  wrong_operation: '操作错误',
  resource_waste: '资源浪费',
  door_blocked: '门被阻挡',
  move: '移动',
  door_open: '开门',
  humidity: '湿度影响',
  item_used: '使用物品',
  success: '任务完成',
};

export default function ResultModal() {
  const navigate = useNavigate();
  const {
    phase,
    score,
    currentLevel,
    events,
    failReason,
    savedRecord,
    setShowResult,
    restart,
  } = useGameStore();

  const isSuccess = phase === 'completed';

  const scoreResult = currentLevel
    ? calculateScore(events, currentLevel.maxRounds, savedRecord?.totalRounds || 0)
    : null;

  const handleRestart = () => {
    setShowResult(false);
    restart();
  };

  const handleBackToMenu = () => {
    setShowResult(false);
    navigate('/');
  };

  const handleViewReport = () => {
    if (savedRecord && currentLevel) {
      const report = generateReport(savedRecord, currentLevel);
      const jsonStr = exportToJSON(report);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      URL.revokeObjectURL(url);
    }
  };

  const handleExportReport = () => {
    if (savedRecord && currentLevel) {
      const report = generateReport(savedRecord, currentLevel);
      const filename = generateReportFilename(currentLevel.name, savedRecord.timestamp);
      downloadJSON(report, filename);
    }
  };

  const handleViewReplay = () => {
    if (savedRecord) {
      setShowResult(false);
      navigate(`/replay/${savedRecord.id}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="hud-panel w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div
            className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isSuccess ? 'bg-museum-success/20' : 'bg-museum-danger/20'
            }`}
          >
            {isSuccess ? (
              <Trophy className="w-10 h-10 text-museum-success" />
            ) : (
              <XCircle className="w-10 h-10 text-museum-danger" />
            )}
          </div>
          <h2
            className={`text-3xl font-bold mb-2 ${
              isSuccess ? 'text-museum-success' : 'text-museum-danger'
            }`}
          >
            {isSuccess ? '任务完成！' : '任务失败'}
          </h2>
          {currentLevel && (
            <p className="text-museum-bgLighter">{currentLevel.name}</p>
          )}
        </div>

        <div className="bg-museum-bg/50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-museum-accent mb-1">
                {scoreResult?.totalScore ?? score}
              </div>
              <div className="text-sm text-museum-bgLighter">最终得分</div>
            </div>
            <div className="w-px h-16 bg-museum-bgLighter/30" />
            <div className="text-center">
              <div
                className={`text-5xl font-bold ${
                  ratingColors[scoreResult?.rating ?? 'D']
                } mb-1`}
              >
                {scoreResult?.rating ?? 'D'}
              </div>
              <div className="text-sm text-museum-bgLighter">评级</div>
            </div>
          </div>

          {!isSuccess && failReason && (
            <div className="bg-museum-danger/10 border border-museum-danger/30 rounded-lg p-3 mb-4">
              <p className="text-museum-danger text-sm text-center flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                失败原因：{failReason}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-1 mb-6">
            {['S', 'A', 'B', 'C', 'D'].map((r) => (
              <Star
                key={r}
                className={`w-6 h-6 ${
                  r === scoreResult?.rating
                    ? `${ratingColors[r]} fill-current`
                    : r < (scoreResult?.rating ?? 'D')
                    ? `${ratingColors[r]} fill-current opacity-50`
                    : 'text-museum-bgLighter/30'
                }`}
              />
            ))}
          </div>

          {scoreResult && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-museum-bgLighter mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                评分明细
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between bg-museum-bgLight/50 px-3 py-2 rounded">
                  <span className="text-gray-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-museum-success" />
                    基础分
                  </span>
                  <span className="text-museum-success font-semibold">
                    +{scoreResult.baseScore}
                  </span>
                </div>
                <div className="flex justify-between bg-museum-bgLight/50 px-3 py-2 rounded">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-museum-info" />
                    时间奖励
                  </span>
                  <span className="text-museum-info font-semibold">
                    +{scoreResult.timeBonus}
                  </span>
                </div>
                {scoreResult.eventScores !== 0 && (
                  <div className="flex justify-between bg-museum-bgLight/50 px-3 py-2 rounded col-span-2">
                    <span className="text-gray-400">事件得分</span>
                    <span
                      className={`font-semibold ${
                        scoreResult.eventScores >= 0
                          ? 'text-museum-success'
                          : 'text-museum-danger'
                      }`}
                    >
                      {scoreResult.eventScores >= 0 ? '+' : ''}
                      {scoreResult.eventScores}
                    </span>
                  </div>
                )}
                {scoreResult.penalties && scoreResult.penalties.length > 0 && (
                  <div className="col-span-2 space-y-1 mt-2">
                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <Minus className="w-3 h-3" />
                      扣分项
                    </div>
                    {scoreResult.penalties.map((penalty, index) => (
                      <div
                        key={index}
                        className="flex justify-between bg-museum-danger/10 px-3 py-1.5 rounded text-sm"
                      >
                        <span className="text-museum-danger/80">
                          {eventTypeLabels[penalty.type] || penalty.type}
                        </span>
                        <span className="text-museum-danger font-medium">
                          -{penalty.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between bg-museum-accent/20 px-3 py-2 rounded col-span-2 mt-2 border border-museum-accent/30">
                  <span className="text-museum-accent font-semibold">总分</span>
                  <span className="text-museum-accent font-bold text-lg">
                    {scoreResult.totalScore}
                  </span>
                </div>
              </div>
            </div>
          )}
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
              onClick={handleViewReplay}
              disabled={!savedRecord}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              查看回放
            </button>
            <button
              onClick={handleViewReport}
              disabled={!savedRecord}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              查看报告
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportReport}
              disabled={!savedRecord}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出JSON
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
