import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Train,
  Pause,
  Play,
  RotateCcw,
  Home,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { getLevelById, getDefaultLevel } from '@/data/levels';
import { GameEngine } from '@/utils/gameEngine';
import ProgressBar from '@/components/ProgressBar';
import AlertMessage from '@/components/AlertMessage';
import { cn } from '@/lib/utils';
import type { Round, Choice, Level } from '@/types';

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { levelId } = useParams<{ levelId: string }>();
  
  const {
    state: gameState,
    warnings,
    errors,
    makeChoice,
    pauseGame,
    resumeGame,
    restartGame,
    clearError,
    playerName,
  } = useGameStore();

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackChoice, setFeedbackChoice] = useState<Choice | null>(null);

  const level = levelId ? getLevelById(levelId) || getDefaultLevel() : getDefaultLevel();
  const currentRound = gameState ? GameEngine.getCurrentRound(gameState, level) : undefined;

  useEffect(() => {
    if (!gameState) {
      navigate('/');
      return;
    }

    if (gameState.status === 'completed') {
      navigate(`/result/${gameState.gameId}`);
      return;
    }

    if (gameState.status === 'error') {
      console.error('游戏出错:', gameState.errorMessage);
    }
  }, [gameState, navigate]);

  useEffect(() => {
    setSelectedChoiceId(null);
    setShowFeedback(false);
    setFeedbackChoice(null);
  }, [gameState?.currentRound]);

  const handleChoiceSelect = (choice: Choice) => {
    if (gameState?.status !== 'playing' || showFeedback) return;
    setSelectedChoiceId(choice.id);
  };

  const handleChoiceConfirm = () => {
    if (!selectedChoiceId || !gameState || !currentRound) return;

    const choice = currentRound.choices.find(c => c.id === selectedChoiceId);
    if (!choice) return;

    setFeedbackChoice(choice);
    setShowFeedback(true);
  };

  const handleNextRound = () => {
    if (!selectedChoiceId || !gameState) return;
    
    makeChoice(selectedChoiceId);
    setSelectedChoiceId(null);
    setShowFeedback(false);
    setFeedbackChoice(null);
  };

  const handlePause = () => {
    if (gameState?.status === 'playing') {
      pauseGame();
    }
  };

  const handleResume = () => {
    if (gameState?.status === 'paused') {
      resumeGame();
    }
  };

  const handleRestart = () => {
    if (gameState) {
      restartGame();
      setSelectedChoiceId(null);
      setShowFeedback(false);
      setFeedbackChoice(null);
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (!gameState || !currentRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-subway-50 via-white to-subway-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-subway-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const isPaused = gameState.status === 'paused';

  return (
    <div className="min-h-screen bg-gradient-to-br from-subway-50 via-white to-subway-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-subway-600 rounded-xl flex items-center justify-center">
                <Train className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-800 font-serif">{level.title}</h1>
                {playerName && (
                  <p className="text-sm text-gray-500">玩家：{playerName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-subway-600">{gameState.score}</p>
                <p className="text-xs text-gray-500">/ {gameState.maxScore} 分</p>
              </div>
              <button
                onClick={handleGoHome}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="返回首页"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <ProgressBar
            current={gameState.currentRound}
            total={gameState.totalRounds}
            showLabel={false}
            className="mb-2"
          />
          
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>回合 {gameState.currentRound} / {gameState.totalRounds}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>正确率 {gameState.playerChoices.length > 0 
                ? `${Math.round((gameState.playerChoices.filter(c => c.isCorrect).length / gameState.playerChoices.length) * 100)}%`
                : '暂无'}</span>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 space-y-2">
            {errors.map((error, index) => (
              <AlertMessage
                key={index}
                type="error"
                title="发生错误"
                message={error}
                onClose={clearError}
              />
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mb-6 space-y-2">
            {warnings.map((warning, index) => (
              <AlertMessage
                key={index}
                type="warning"
                message={warning}
                onClose={() => {}}
              />
            ))}
          </div>
        )}

        {isPaused && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-warning-100 rounded-full mb-4">
                  <Pause className="w-8 h-8 text-warning-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2 font-serif">
                  游戏已暂停
                </h2>
                <p className="text-gray-600">
                  您可以随时继续游戏，进度已自动保存
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">当前进度</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>回合：{gameState.currentRound} / {gameState.totalRounds}</p>
                  <p>得分：{gameState.score} / {gameState.maxScore}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleResume}
                  className="w-full flex items-center justify-center gap-2 bg-subway-600 hover:bg-subway-700 text-white py-3 px-4 rounded-xl font-semibold transition-all hover:shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  继续游戏
                </button>
                <button
                  onClick={handleRestart}
                  className="w-full flex items-center justify-center gap-2 bg-warning-500 hover:bg-warning-600 text-white py-3 px-4 rounded-xl font-semibold transition-all hover:shadow-lg"
                >
                  <RotateCcw className="w-5 h-5" />
                  重新开始
                </button>
                <button
                  onClick={handleGoHome}
                  className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-4 rounded-xl font-semibold transition-all"
                >
                  <Home className="w-5 h-5" />
                  返回首页
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 rounded-full bg-subway-100 text-subway-600 font-bold flex items-center justify-center text-sm">
                  {gameState.currentRound}
                </span>
                <h2 className="text-xl font-bold text-gray-800 font-serif">
                  {currentRound.title}
                </h2>
              </div>

              <p className="text-gray-600 mb-4">{currentRound.description}</p>

              <div className="bg-subway-50 border-l-4 border-subway-500 p-4 rounded-r-lg mb-6">
                <p className="text-subway-800 text-sm">
                  <span className="font-semibold">场景：</span>
                  {currentRound.scene}
                </p>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-subway-600" />
                  请选择您的决策：
                </h3>
                <div className="space-y-3">
                  {currentRound.choices.map((choice, index) => (
                    <ChoiceCard
                      key={choice.id}
                      choice={choice}
                      index={index}
                      isSelected={selectedChoiceId === choice.id}
                      isCorrect={showFeedback ? choice.isCorrect : undefined}
                      showResult={showFeedback}
                      onClick={() => handleChoiceSelect(choice)}
                      disabled={showFeedback || isPaused}
                    />
                  ))}
                </div>
              </div>

              {showFeedback && feedbackChoice && (
                <div className={cn(
                  'rounded-xl p-5 mb-6 animate-fade-in',
                  feedbackChoice.isCorrect
                    ? 'bg-success-50 border-2 border-success-300'
                    : 'bg-danger-50 border-2 border-danger-300'
                )}>
                  <div className="flex items-start gap-3">
                    {feedbackChoice.isCorrect ? (
                      <CheckCircle className="w-6 h-6 text-success-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-6 h-6 text-danger-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className={cn(
                        'font-semibold mb-2',
                        feedbackChoice.isCorrect ? 'text-success-800' : 'text-danger-800'
                      )}>
                        {feedbackChoice.isCorrect ? '回答正确！' : '回答有误'}
                        <span className="ml-2 text-sm font-normal">
                          ({feedbackChoice.isCorrect ? '+' : ''}{feedbackChoice.score} 分)
                        </span>
                      </h4>
                      <p className={cn(
                        'text-sm',
                        feedbackChoice.isCorrect ? 'text-success-700' : 'text-danger-700'
                      )}>
                        {feedbackChoice.feedback}
                      </p>
                      <p className={cn(
                        'text-xs mt-2',
                        feedbackChoice.isCorrect ? 'text-success-600' : 'text-danger-600'
                      )}>
                        依据：{feedbackChoice.reasonReference}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                {!showFeedback ? (
                  <>
                    <button
                      onClick={handleChoiceConfirm}
                      disabled={!selectedChoiceId || isPaused}
                      className={cn(
                        'flex-1 py-3 px-6 rounded-xl font-semibold transition-all',
                        selectedChoiceId && !isPaused
                          ? 'bg-subway-600 hover:bg-subway-700 text-white hover:shadow-lg'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      )}
                    >
                      确认选择
                    </button>
                    <button
                      onClick={handlePause}
                      disabled={isPaused}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                      title="暂停"
                    >
                      <Pause className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleNextRound}
                    className="flex-1 py-3 px-6 bg-subway-600 hover:bg-subway-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
                  >
                    {gameState.currentRound === gameState.totalRounds ? '查看结算' : '下一回合'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-warning-500 hover:bg-warning-600 text-white rounded-xl font-semibold transition-all hover:shadow-md"
              >
                <RotateCcw className="w-5 h-5" />
                重新开始
              </button>
              <button
                onClick={handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all"
              >
                <Home className="w-5 h-5" />
                返回首页
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <EvidencePanel round={currentRound} />
            
            {gameState.playerChoices.length > 0 && (
              <ChoiceHistory choices={gameState.playerChoices} />
            )}

            {gameState.importData?.teacherNote && (
              <div className="bg-white rounded-2xl shadow-lg p-5 animate-slide-up">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning-500" />
                  教师备注
                </h3>
                <p className="text-sm text-gray-600 bg-warning-50 p-3 rounded-lg">
                  {gameState.importData.teacherNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ChoiceCardProps {
  choice: Choice;
  index: number;
  isSelected: boolean;
  isCorrect?: boolean;
  showResult: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({
  choice,
  index,
  isSelected,
  isCorrect,
  showResult,
  onClick,
  disabled = false,
}) => {
  let borderColor = 'border-gray-200';
  let bgColor = 'bg-white';
  
  if (showResult) {
    if (isCorrect === true) {
      borderColor = 'border-success-500';
      bgColor = 'bg-success-50';
    } else if (isCorrect === false) {
      borderColor = 'border-danger-500';
      bgColor = 'bg-danger-50';
    }
  } else if (isSelected) {
    borderColor = 'border-subway-500';
    bgColor = 'bg-subway-50';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left p-4 border-2 rounded-xl transition-all duration-200',
        borderColor,
        bgColor,
        !disabled && !showResult && 'hover:border-subway-300 hover:bg-gray-50',
        disabled && 'cursor-not-allowed opacity-75'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all',
          showResult
            ? isCorrect
              ? 'border-success-500 bg-success-500 text-white'
              : 'border-danger-500 bg-danger-500 text-white'
            : isSelected
              ? 'border-subway-500 bg-subway-500 text-white'
              : 'border-gray-300 text-gray-500'
        )}>
          {showResult
            ? isCorrect
              ? <CheckCircle className="w-4 h-4" />
              : <XCircle className="w-4 h-4" />
            : String.fromCharCode(65 + index)}
        </span>
        <span className={cn(
          'text-sm leading-relaxed',
          showResult
            ? isCorrect
              ? 'text-success-800'
              : 'text-danger-800'
            : isSelected
              ? 'text-subway-800 font-medium'
              : 'text-gray-700'
        )}>
          {choice.text}
        </span>
      </div>
    </button>
  );
};

interface EvidencePanelProps {
  round: Round;
}

const EvidencePanel: React.FC<EvidencePanelProps> = ({ round }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 animate-slide-up">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-subway-600" />
        课堂计分表数据
      </h3>
      <div className="space-y-3">
        {round.evidence.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'p-3 rounded-lg transition-all',
              item.highlight
                ? 'bg-subway-50 border border-subway-200'
                : 'bg-gray-50'
            )}
            style={{ animationDelay: `${0.1 + index * 0.05}s` }}
          >
            <div className="text-xs text-gray-500 mb-1">{item.source}</div>
            <div className="text-sm text-gray-700 mb-1">{item.content}</div>
            <div className={cn(
              'text-lg font-bold',
              item.highlight ? 'text-subway-600' : 'text-gray-800',
              item.value === null && 'text-gray-400 italic'
            )}>
              {item.value !== null && item.value !== undefined
                ? String(item.value)
                : '（空值）'}
            </div>
            {item.value === null && (
              <div className="text-xs text-warning-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                数据缺失，请根据已有信息判断
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

interface ChoiceHistoryProps {
  choices: Array<{
    roundId: number;
    choiceId: string;
    isCorrect: boolean;
    score: number;
  }>;
  level?: Level;
}

const ChoiceHistory: React.FC<ChoiceHistoryProps> = ({ choices }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 animate-slide-up">
      <h3 className="font-semibold text-gray-800 mb-4">答题记录</h3>
      <div className="space-y-2">
        {choices.map((choice, index) => {
          return (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                {choice.isCorrect ? (
                  <CheckCircle className="w-4 h-4 text-success-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-danger-500" />
                )}
                <span className="text-sm text-gray-700">
                  第{choice.roundId}回合
                </span>
              </div>
              <span className={cn(
                'text-sm font-medium',
                choice.isCorrect ? 'text-success-600' : 'text-danger-600'
              )}>
                {choice.isCorrect ? '+' : ''}{choice.score}分
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GamePage;
