import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/stores/gameStore";
import { levelGroups, getLevelsByGroup } from "@/data/levels";
import {
  Play,
  Pause,
  RotateCcw,
  Music,
  Clock,
  Trophy,
  Flame,
  Star,
  ChevronRight,
  HelpCircle,
  Import,
} from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const {
    gameStatus,
    currentGroupId,
    currentLevelIndex,
    currentSession,
    timer,
    feedback,
    score,
    combo,
    maxCombo,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    endGame,
    selectOption,
    clearFeedback,
    reset,
    sessionSteps,
  } = useGameStore();

  const levels = currentGroupId ? getLevelsByGroup(currentGroupId) : [];
  const currentLevel = levels[currentLevelIndex];
  const totalLevels = levels.length;
  const progressPercent = totalLevels > 0 ? ((currentLevelIndex) / totalLevels) * 100 : 0;
  const timerSeconds = timer / 10;
  const timerPercent = currentLevel ? (timer / (currentLevel.timeLimit * 10)) * 100 : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (timerPercent / 100) * circumference;

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => clearFeedback(), 2000);
      return () => clearTimeout(t);
    }
  }, [feedback, clearFeedback]);

  const difficultyLabel: Record<string, string> = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "高级",
  };

  const difficultyColor: Record<string, string> = {
    beginner: "text-jazz-correct",
    intermediate: "text-jazz-gold",
    advanced: "text-jazz-error",
  };

  function renderControlBar() {
    return (
      <div className="flex flex-col gap-3 w-16 items-center py-4">
        {gameStatus === "playing" && (
          <button
            onClick={pauseGame}
            className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
          >
            <Pause className="w-5 h-5 text-jazz-gold" />
          </button>
        )}
        {gameStatus === "paused" && (
          <button
            onClick={resumeGame}
            className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
          >
            <Play className="w-5 h-5 text-jazz-correct" />
          </button>
        )}
        {(gameStatus === "playing" || gameStatus === "paused") && (
          <>
            <button
              onClick={restartGame}
              className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
            >
              <RotateCcw className="w-5 h-5 text-gray-400" />
            </button>
            <button
              onClick={() => {
                endGame();
              }}
              className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
            >
              <span className="text-xs text-jazz-error font-bold">结束</span>
            </button>
          </>
        )}
        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => navigate("/import")}
            className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
          >
            <Import className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => navigate("/help")}
            className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
          >
            <HelpCircle className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => navigate("/history")}
            className="w-12 h-12 rounded-xl bg-jazz-card hover:bg-jazz-card/80 flex items-center justify-center transition-all hover:scale-105"
          >
            <Clock className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  function renderScorePanel() {
    return (
      <div className="flex flex-col gap-4 w-52">
        <div className="bg-jazz-card rounded-2xl p-4 text-center">
          <Trophy className="w-6 h-6 text-jazz-gold mx-auto mb-2" />
          <div className="text-3xl font-bold text-jazz-gold">{score}</div>
          <div className="text-xs text-gray-400 mt-1">当前得分</div>
        </div>
        <div className="bg-jazz-card rounded-2xl p-4 text-center">
          <div className="relative w-24 h-24 mx-auto">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a4a" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={timerPercent > 30 ? "#e6a817" : "#e74c3c"}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-100"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{timerSeconds.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">剩余时间</div>
        </div>
        <div className="bg-jazz-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-gray-300">连击</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{combo}x</div>
          <div className="text-xs text-gray-500 mt-1">最高 {maxCombo}x</div>
        </div>
        <div className="bg-jazz-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-jazz-gold" />
            <span className="text-sm text-gray-300">进度</span>
          </div>
          <div className="text-sm text-gray-300">
            第 {currentLevelIndex + 1} / {totalLevels} 关
          </div>
        </div>
      </div>
    );
  }

  function renderLevelProgress() {
    return (
      <div className="w-full h-2 bg-jazz-card/50 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-jazz-gold to-yellow-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    );
  }

  function renderFeedbackOverlay() {
    if (!feedback) return null;
    const isCorrect = feedback.correct;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className={`animate-bounce-in px-8 py-6 rounded-2xl shadow-2xl max-w-md text-center pointer-events-auto ${
            isCorrect ? "bg-jazz-correct/90" : "bg-jazz-error/90"
          }`}
        >
          <div className="text-2xl font-bold text-white mb-2">{feedback.message}</div>
          <div className="text-sm text-white/80">{feedback.detail}</div>
        </div>
      </div>
    );
  }

  function renderIdleScreen() {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-8 animate-fade-in">
        <div className="text-center mb-4">
          <Music className="w-16 h-16 text-jazz-gold mx-auto mb-4 animate-pulse-gold rounded-full p-3" />
          <h1 className="text-4xl font-bold text-white mb-2">爵士和弦寻宝</h1>
          <p className="text-gray-400 text-lg">选择关卡组，开始你的和弦探索之旅</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full px-4">
          {levelGroups.map((group) => {
            const groupLevels = getLevelsByGroup(group.id);
            return (
              <button
                key={group.id}
                onClick={() => startGame(group.id)}
                className="bg-jazz-card rounded-2xl p-6 text-left hover:scale-105 transition-all duration-300 group border border-transparent hover:border-jazz-gold/30"
              >
                <div className={`text-sm font-semibold mb-2 ${difficultyColor[group.difficulty]}`}>
                  {difficultyLabel[group.difficulty]}
                </div>
                <div className="text-xl font-bold text-white group-hover:text-jazz-gold transition-colors mb-2">
                  {group.name}
                </div>
                <div className="text-sm text-gray-400 mb-4">{groupLevels.length} 个关卡</div>
                <div className="flex items-center text-jazz-gold text-sm font-medium">
                  开始挑战
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderGameplay() {
    if (!currentLevel) return null;
    const cols = currentLevel.options.length <= 6 ? 3 : 4;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in px-4">
        {renderLevelProgress()}
        <div className="text-center mb-2">
          <div className="text-5xl font-bold text-jazz-gold mb-3 animate-slide-up">{currentLevel.targetChord}</div>
          <div className="flex items-center justify-center gap-2 mb-3">
            {currentLevel.targetNotes.map((note, i) => (
              <span key={i} className="text-lg text-white/70">
                {i > 0 && <span className="text-jazz-gold/50 mx-1">·</span>}
                {note}
              </span>
            ))}
          </div>
          <div className="text-sm text-gray-500 italic">{currentLevel.hint}</div>
        </div>
        <div className={`grid grid-cols-${cols} gap-3 max-w-lg w-full`}>
          {currentLevel.options.map((option) => (
            <button
              key={option.id}
              onClick={() => selectOption(option.id)}
              className="bg-jazz-card hover:bg-jazz-card/80 rounded-xl px-4 py-3 text-center transition-all duration-200 hover:scale-105 hover:border-jazz-gold/50 border border-transparent active:scale-95"
            >
              <div className="text-sm font-medium text-white/90">{option.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderCompletedScreen() {
    if (!currentSession) return null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fade-in">
        <div className="text-center">
          <Trophy className="w-20 h-20 text-jazz-gold mx-auto mb-4 animate-bounce-in" />
          <h2 className="text-3xl font-bold text-white mb-2">游戏结束！</h2>
          <p className="text-5xl font-bold text-jazz-gold mb-4">{score} 分</p>
          <p className="text-gray-400">
            最高连击 {maxCombo}x · 完成 {sessionSteps.filter((s) => s.correct).length}/{sessionSteps.length} 关
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate(`/settlement/${currentSession.id}`)}
            className="px-6 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all"
          >
            查看结算
          </button>
          <button
            onClick={reset}
            className="px-6 py-3 bg-jazz-card text-white font-bold rounded-xl hover:scale-105 transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jazz-bg flex">
      {(gameStatus === "playing" || gameStatus === "paused") && (
        <div className="flex-shrink-0 p-2 border-r border-white/5">{renderControlBar()}</div>
      )}
      <div className="flex-1 flex flex-col p-4">
        {gameStatus === "idle" && (
          <div className="flex items-center justify-between mb-4">
            <div />
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/import")}
                className="px-4 py-2 bg-jazz-card rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-2"
              >
                <Import className="w-4 h-4" />
                导入数据
              </button>
              <button
                onClick={() => navigate("/history")}
                className="px-4 py-2 bg-jazz-card rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                历史记录
              </button>
              <button
                onClick={() => navigate("/help")}
                className="px-4 py-2 bg-jazz-card rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                帮助
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            {gameStatus === "idle" && renderIdleScreen()}
            {(gameStatus === "playing" || gameStatus === "paused") && renderGameplay()}
            {gameStatus === "completed" && renderCompletedScreen()}
          </div>
          {(gameStatus === "playing" || gameStatus === "paused") && (
            <div className="flex-shrink-0 pl-4">{renderScorePanel()}</div>
          )}
        </div>
      </div>
      {renderFeedbackOverlay()}
    </div>
  );
}
