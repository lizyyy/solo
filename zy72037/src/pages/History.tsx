import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDataStore } from "@/stores/dataStore";
import { useReplayStore } from "@/stores/replayStore";
import { getReplayLevelInfo } from "@/stores/replayStore";
import { getLevelGroupById } from "@/data/levels";
import {
  ArrowLeft,
  Clock,
  Trophy,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Gauge,
  Music,
  Trash2,
  ExternalLink,
} from "lucide-react";

export default function History() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const replayParam = searchParams.get("replay");

  const { sessions, loadAllSessions, viewSession, currentViewSession, currentViewSteps, deleteSession } =
    useDataStore();
  const {
    sessionId: replaySessionId,
    groupId: replayGroupId,
    steps: replaySteps,
    currentIndex,
    isPlaying,
    playSpeed,
    startReplay,
    play,
    pause,
    nextStep,
    prevStep,
    setSpeed,
    stopReplay,
  } = useReplayStore();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(replayParam ?? null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    loadAllSessions();
  }, [loadAllSessions]);

  useEffect(() => {
    if (replayParam) {
      setSelectedSessionId(replayParam);
    }
  }, [replayParam]);

  useEffect(() => {
    if (selectedSessionId) {
      viewSession(selectedSessionId);
      if (replayParam) {
        const s = sessions.find((s) => s.id === selectedSessionId);
        if (s) {
          startReplay(selectedSessionId, s.groupId);
          play();
        }
      }
    }
    return () => stopReplay();
  }, [selectedSessionId, viewSession, replayParam, sessions, startReplay, play, stopReplay]);

  const sortedSessions = [...sessions].sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));

  function handleSelectSession(id: string) {
    setSelectedSessionId(id);
    stopReplay();
  }

  function handleStartReplay() {
    if (!currentViewSession) return;
    startReplay(currentViewSession.id, currentViewSession.groupId);
    play();
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      deleteSession(id);
      setConfirmDelete(null);
      if (selectedSessionId === id) setSelectedSessionId(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }

  const currentReplayLevel = replayGroupId && currentIndex >= 0 && replaySteps[currentIndex]
    ? getReplayLevelInfo(replayGroupId, replaySteps[currentIndex].levelId)
    : null;

  return (
    <div className="min-h-screen bg-jazz-bg flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-jazz-card flex items-center justify-center hover:scale-105 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-white">历史记录</h1>
      </div>

      <div className="flex-1 flex">
        <div className="w-72 border-r border-white/5 p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-65px)]">
          {sortedSessions.length === 0 && (
            <div className="text-center text-gray-500 py-8">暂无对局记录</div>
          )}
          {sortedSessions.map((session) => {
            const group = getLevelGroupById(session.groupId);
            const isSelected = selectedSessionId === session.id;
            const duration = session.endTime && session.startTime
              ? Math.round((session.endTime - session.startTime) / 1000)
              : 0;
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            return (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`w-full text-left rounded-xl p-3 transition-all ${
                  isSelected
                    ? "bg-jazz-gold/10 border border-jazz-gold/30"
                    : "bg-jazz-card hover:bg-jazz-card/80 border border-transparent"
                }`}
              >
                <div className="text-sm font-medium text-white mb-1 truncate">
                  {group?.name ?? "未知关卡组"}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {session.score}分
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {mins > 0 ? `${mins}分` : ""}{secs}秒
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(session.startTime).toLocaleDateString("zh-CN")}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          {!currentViewSession && (
            <div className="flex items-center justify-center h-full text-gray-500">
              选择左侧对局查看详情
            </div>
          )}

          {currentViewSession && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {getLevelGroupById(currentViewSession.groupId)?.name ?? "对局详情"}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-jazz-gold" />
                      {currentViewSession.score} 分
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {(() => {
                        const d = currentViewSession.endTime && currentViewSession.startTime
                          ? Math.round((currentViewSession.endTime - currentViewSession.startTime) / 1000)
                          : 0;
                        return `${Math.floor(d / 60)}分${d % 60}秒`;
                      })()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/settlement/${currentViewSession.id}`)}
                    className="px-4 py-2 bg-jazz-card rounded-xl text-sm text-gray-300 hover:text-jazz-gold transition-colors flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    结算
                  </button>
                  <button
                    onClick={() => handleDelete(currentViewSession.id)}
                    className={`px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-1 ${
                      confirmDelete === currentViewSession.id
                        ? "bg-jazz-error text-white"
                        : "bg-jazz-card text-gray-400 hover:text-jazz-error"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {confirmDelete === currentViewSession.id ? "确认删除" : "删除"}
                  </button>
                </div>
              </div>

              <div className="bg-jazz-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Music className="w-5 h-5 text-jazz-gold" />
                    回放
                  </h3>
                  {!replaySessionId && (
                    <button
                      onClick={handleStartReplay}
                      className="px-4 py-2 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center gap-2 text-sm"
                    >
                      <Play className="w-4 h-4" />
                      开始回放
                    </button>
                  )}
                </div>

                {replaySessionId && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="text-center text-sm text-gray-400">
                      {currentIndex >= 0
                        ? `第 ${currentIndex + 1} / ${replaySteps.length} 步`
                        : "准备开始"}
                    </div>

                    {currentReplayLevel && currentIndex >= 0 && (
                      <div className="text-center animate-fade-in">
                        <div className="text-3xl font-bold text-jazz-gold mb-2">
                          {currentReplayLevel.targetChord}
                        </div>
                        <div className="flex items-center justify-center gap-1 mb-3">
                          {currentReplayLevel.targetNotes.map((note, i) => (
                            <span key={i} className="text-sm text-white/70">
                              {i > 0 && <span className="text-jazz-gold/50 mx-1">·</span>}
                              {note}
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
                          {currentReplayLevel.options.map((option) => {
                            const step = replaySteps[currentIndex];
                            const isSelected = step?.selectedOption === option.id;
                            const isCorrectOption = option.isCorrect;
                            return (
                              <div
                                key={option.id}
                                className={`rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
                                  isSelected && isCorrectOption
                                    ? "bg-jazz-correct/30 text-jazz-correct border border-jazz-correct/50"
                                    : isSelected && !isCorrectOption
                                    ? "bg-jazz-error/30 text-jazz-error border border-jazz-error/50"
                                    : isCorrectOption && isSelected === false && step?.selectedOption !== null
                                    ? "bg-jazz-correct/10 text-jazz-correct/60 border border-jazz-correct/20"
                                    : "bg-jazz-bg text-gray-400 border border-white/5"
                                }`}
                              >
                                {option.label}
                              </div>
                            );
                          })}
                        </div>
                        {replaySteps[currentIndex] && (
                          <div className="mt-3 text-xs text-gray-500">
                            {replaySteps[currentIndex].correct ? (
                              <span className="text-jazz-correct">正确</span>
                            ) : (
                              <span className="text-jazz-error">
                                {replaySteps[currentIndex].failType === "too_slow" ? "超时" : "选错"}
                              </span>
                            )}
                            {" · "}
                            耗时 {replaySteps[currentIndex].timeSpent.toFixed(1)}秒
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={prevStep}
                        disabled={currentIndex <= 0}
                        className="w-10 h-10 rounded-xl bg-jazz-bg flex items-center justify-center text-gray-300 hover:text-jazz-gold transition-colors disabled:opacity-30"
                      >
                        <SkipBack className="w-5 h-5" />
                      </button>
                      {isPlaying ? (
                        <button
                          onClick={pause}
                          className="w-12 h-12 rounded-full bg-jazz-gold flex items-center justify-center text-jazz-bg hover:scale-110 transition-all"
                        >
                          <Pause className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={play}
                          className="w-12 h-12 rounded-full bg-jazz-gold flex items-center justify-center text-jazz-bg hover:scale-110 transition-all"
                        >
                          <Play className="w-5 h-5 ml-0.5" />
                        </button>
                      )}
                      <button
                        onClick={nextStep}
                        disabled={currentIndex >= replaySteps.length - 1}
                        className="w-10 h-10 rounded-xl bg-jazz-bg flex items-center justify-center text-gray-300 hover:text-jazz-gold transition-colors disabled:opacity-30"
                      >
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <Gauge className="w-4 h-4 text-gray-500" />
                      {[1, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setSpeed(speed)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            playSpeed === speed
                              ? "bg-jazz-gold/20 text-jazz-gold"
                              : "bg-jazz-bg text-gray-400 hover:text-white"
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={stopReplay}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        停止回放
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-white font-semibold">步骤详情</h3>
                {currentViewSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="bg-jazz-card rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-8">#{index + 1}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          step.correct ? "bg-jazz-correct" : "bg-jazz-error"
                        }`}
                      />
                      <span className="text-sm text-gray-300">
                        {step.correct ? "正确" : step.failType === "too_slow" ? "超时" : "选错"}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">{step.timeSpent.toFixed(1)}秒</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
