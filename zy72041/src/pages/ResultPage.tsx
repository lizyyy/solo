import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Trophy,
  Download,
  RotateCcw,
  Home,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User,
  FileDown,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getLevelById, getDefaultLevel } from '@/data/levels';
import { GameEngine } from '@/utils/gameEngine';
import { ReportExporter } from '@/utils/reportExporter';
import { cn } from '@/lib/utils';

const ResultPage: React.FC = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  
  const {
    state: gameState,
    playerName,
    restartGame,
    reset,
    loadSavedGame,
  } = useGameStore();

  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'json'>('txt');
  const [reportPreview, setReportPreview] = useState<string>('');

  const level = gameState
    ? getLevelById(gameState.levelId) || getDefaultLevel()
    : getDefaultLevel();

  useEffect(() => {
    if (gameId && !gameState) {
      loadSavedGame(gameId);
    }
  }, [gameId, gameState, loadSavedGame]);

  useEffect(() => {
    if (gameState && gameState.status === 'completed') {
      const preview = ReportExporter.getReportPreview(gameState, level, playerName);
      setReportPreview(preview);
    }
  }, [gameState, level, playerName]);

  useEffect(() => {
    if (gameState && gameState.status !== 'completed') {
      navigate(`/game/${gameState.levelId}`);
    }
  }, [gameState, navigate]);

  const handleRestart = () => {
    if (gameState) {
      restartGame();
      navigate(`/game/${gameState.levelId}`);
    }
  };

  const handleGoHome = () => {
    reset();
    navigate('/');
  };

  const handleExport = () => {
    if (gameState) {
      ReportExporter.exportReport(gameState, level, exportFormat, playerName);
      setShowExportModal(false);
    }
  };

  const toggleRound = (roundId: number) => {
    setExpandedRound(expandedRound === roundId ? null : roundId);
  };

  if (!gameState || gameState.status !== 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-subway-50 via-white to-subway-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-subway-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载结算数据...</p>
        </div>
      </div>
    );
  }

  const correctCount = gameState.playerChoices.filter(c => c.isCorrect).length;
  const accuracy = (correctCount / gameState.totalRounds) * 100;
  const scorePercent = (gameState.score / gameState.maxScore) * 100;
  const deductionReasons = GameEngine.getDeductionReasons(gameState, level);
  const totalDeduction = deductionReasons.reduce((sum, d) => sum + d.deduction, 0);

  const getScoreColor = (percent: number) => {
    if (percent >= 80) return 'text-success-600';
    if (percent >= 60) return 'text-warning-600';
    return 'text-danger-600';
  };

  const getScoreBgColor = (percent: number) => {
    if (percent >= 80) return 'from-success-500 to-success-600';
    if (percent >= 60) return 'from-warning-500 to-warning-600';
    return 'from-danger-500 to-danger-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-subway-50 via-white to-subway-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-subway-500 to-subway-700 rounded-2xl mb-6 shadow-lg">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2 font-serif">
            解谜完成！
          </h1>
          <p className="text-lg text-gray-600">
            {level.title}
          </p>
          {playerName && (
            <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
              <User className="w-4 h-4" />
              {playerName}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 animate-slide-up">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-center">
              <div className={cn(
                'inline-flex items-center justify-center w-40 h-40 rounded-full bg-gradient-to-br shadow-lg mb-4',
                getScoreBgColor(scorePercent)
              )}>
                <div className="text-center text-white">
                  <p className="text-5xl font-bold">{gameState.score}</p>
                  <p className="text-lg opacity-80">/ {gameState.maxScore}</p>
                </div>
              </div>
              <p className={cn('text-2xl font-bold font-serif', getScoreColor(scorePercent))}>
                {scorePercent.toFixed(1)}%
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success-500" />
                  正确题数
                </span>
                <span className="font-bold text-success-600 text-xl">
                  {correctCount} / {gameState.totalRounds}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-subway-500" />
                  正确率
                </span>
                <span className="font-bold text-subway-600 text-xl">
                  {accuracy.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-danger-500" />
                  总扣分
                </span>
                <span className="font-bold text-danger-600 text-xl">
                  -{totalDeduction} 分
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  用时
                </span>
                <span className="font-bold text-gray-700 text-xl">
                  {((gameState.endTime! - gameState.startTime - gameState.totalPauseTime) / 1000).toFixed(0)} 秒
                </span>
              </div>
            </div>
          </div>
        </div>

        {deductionReasons.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
              扣分原因汇总
            </h2>
            <div className="space-y-3">
              {deductionReasons.map((deduction, index) => (
                <div
                  key={index}
                  className="border-2 border-danger-200 bg-danger-50 rounded-xl p-4 animate-fade-in"
                  style={{ animationDelay: `${0.15 + index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-danger-500 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="font-medium text-danger-800">
                        第{deduction.round}回合
                      </span>
                    </div>
                    <span className="text-danger-600 font-bold">
                      -{deduction.deduction} 分
                    </span>
                  </div>
                  <p className="text-sm text-danger-700 mb-2">
                    <span className="font-semibold">原因：</span>
                    {deduction.reason}
                  </p>
                  <p className="text-xs text-danger-600 bg-white/50 p-2 rounded-lg">
                    <span className="font-semibold">证据：</span>
                    {deduction.evidence}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
            <FileText className="w-5 h-5 text-subway-600" />
            关键选择回顾
          </h2>
          <div className="space-y-4">
            {gameState.playerChoices.map((choice, index) => {
              const round = level.rounds[choice.roundId - 1];
              const selectedChoice = round?.choices.find(c => c.id === choice.choiceId);
              const isExpanded = expandedRound === choice.roundId;
              
              return (
                <div
                  key={index}
                  className={cn(
                    'border-2 rounded-xl overflow-hidden transition-all duration-300',
                    choice.isCorrect
                      ? 'border-success-200 bg-success-50/50'
                      : 'border-danger-200 bg-danger-50/50'
                  )}
                  style={{ animationDelay: `${0.25 + index * 0.1}s` }}
                >
                  <button
                    onClick={() => toggleRound(choice.roundId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-black/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-white font-bold',
                        choice.isCorrect ? 'bg-success-500' : 'bg-danger-500'
                      )}>
                        {choice.roundId}
                      </span>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-800">
                          {round?.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {choice.isCorrect ? '✓ 回答正确' : '✗ 回答有误'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'font-bold text-lg',
                        choice.isCorrect ? 'text-success-600' : 'text-danger-600'
                      )}>
                        {choice.isCorrect ? '+' : ''}{choice.score} 分
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-200 pt-4 animate-fade-in">
                      <div className="bg-white rounded-lg p-4 mb-3">
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-semibold">您的选择：</span>
                        </p>
                        <p className="text-gray-800">
                          {selectedChoice?.text}
                        </p>
                      </div>

                      <div className={cn(
                        'rounded-lg p-4 mb-3',
                        choice.isCorrect ? 'bg-success-100' : 'bg-danger-100'
                      )}>
                        <p className="text-sm mb-2">
                          <span className="font-semibold">反馈：</span>
                        </p>
                        <p className={cn(
                          choice.isCorrect ? 'text-success-800' : 'text-danger-800'
                        )}>
                          {selectedChoice?.feedback}
                        </p>
                      </div>

                      <div className="bg-gray-100 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-semibold">依据来源：</span>
                        </p>
                        <p className="text-gray-700 text-sm font-mono">
                          {choice.reason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {level.teacherNote && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-xl font-bold text-gray-800 mb-4 font-serif flex items-center gap-2">
              <FileText className="w-5 h-5 text-warning-600" />
              教师评分备注
            </h2>
            <div className="bg-warning-50 border-l-4 border-warning-500 p-4 rounded-r-lg">
              <p className="text-warning-800">
                {level.teacherNote}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-subway-600 hover:bg-subway-700 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all hover:shadow-lg"
          >
            <Download className="w-5 h-5" />
            导出完整报告
          </button>
          <button
            onClick={handleRestart}
            className="flex-1 flex items-center justify-center gap-2 bg-warning-500 hover:bg-warning-600 text-white py-4 px-6 rounded-xl font-semibold text-lg transition-all hover:shadow-lg"
          >
            <RotateCcw className="w-5 h-5" />
            再玩一次
          </button>
          <button
            onClick={handleGoHome}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-4 px-6 rounded-xl font-semibold text-lg transition-all"
          >
            <Home className="w-5 h-5" />
            返回首页
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>游戏ID：{gameState.gameId}</p>
          <p>开始时间：{new Date(gameState.startTime).toLocaleString('zh-CN')}</p>
          <p>结束时间：{new Date(gameState.endTime!).toLocaleString('zh-CN')}</p>
          {gameState.historyGameIds.length > 0 && (
            <p>重开次数：{gameState.historyGameIds.length} 次</p>
          )}
          {gameState.totalPauseTime > 0 && (
            <p>总暂停时间：{(gameState.totalPauseTime / 1000).toFixed(1)} 秒</p>
          )}
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 font-serif flex items-center gap-2">
                  <FileDown className="w-5 h-5 text-subway-600" />
                  导出报告
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择导出格式
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExportFormat('txt')}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
                      exportFormat === 'txt'
                        ? 'bg-subway-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    文本格式 (.txt)
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl font-medium transition-all',
                      exportFormat === 'json'
                        ? 'bg-subway-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    JSON 格式 (.json)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  报告预览
                </label>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                    {exportFormat === 'txt'
                      ? reportPreview
                      : JSON.stringify(
                          ReportExporter.generateReport(gameState, level, playerName),
                          null,
                          2
                        )}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                className="flex-1 py-3 px-4 bg-subway-600 hover:bg-subway-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultPage;
