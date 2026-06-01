import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDataStore } from "@/stores/dataStore";
import { getLevelGroupById, getLevelsByGroup } from "@/data/levels";
import {
  Trophy,
  Target,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  FileText,
  Home,
} from "lucide-react";

export default function Settlement() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { currentViewSession, currentViewSteps, viewSession } = useDataStore();
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sessionId) viewSession(sessionId);
  }, [sessionId, viewSession]);

  if (!currentViewSession) {
    return (
      <div className="min-h-screen bg-jazz-bg flex items-center justify-center">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    );
  }

  const session = currentViewSession;
  const steps = currentViewSteps;
  const group = getLevelGroupById(session.groupId);
  const levels = session.groupId ? getLevelsByGroup(session.groupId) : [];
  const correctCount = steps.filter((s) => s.correct).length;
  const totalCount = steps.length;
  const accuracyPercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const timeSpent = session.endTime && session.startTime
    ? Math.round((session.endTime - session.startTime) / 1000)
    : 0;
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  const failedSteps = steps.filter((s) => !s.correct || s.failType);

  const accuracyCircumference = 2 * Math.PI * 54;
  const accuracyOffset = accuracyCircumference - (accuracyPercent / 100) * accuracyCircumference;

  function toggleStep(id: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-jazz-bg p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <Trophy className="w-16 h-16 text-jazz-gold mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-white mb-1">对局结算</h1>
          {group && <p className="text-gray-400">{group.name}</p>}
        </div>

        <div className="text-center mb-8 animate-slide-up">
          <div className="text-6xl font-bold text-jazz-gold mb-1">{session.score}</div>
          <div className="text-gray-400 text-sm">总得分</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 animate-slide-up">
          <div className="bg-jazz-card rounded-2xl p-6 text-center">
            <div className="relative w-28 h-28 mx-auto mb-3">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#2a2a4a" strokeWidth="8" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke={accuracyPercent >= 80 ? "#2ecc71" : accuracyPercent >= 50 ? "#e6a817" : "#e74c3c"}
                  strokeWidth="8"
                  strokeDasharray={accuracyCircumference}
                  strokeDashoffset={accuracyOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{accuracyPercent}%</span>
                <span className="text-xs text-gray-400">正确率</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 text-sm text-gray-300">
              <Target className="w-4 h-4 text-jazz-correct" />
              {correctCount} / {totalCount} 正确
            </div>
          </div>

          <div className="bg-jazz-card rounded-2xl p-6 text-center flex flex-col items-center justify-center">
            <Clock className="w-10 h-10 text-jazz-gold mb-3" />
            <div className="text-2xl font-bold text-white mb-1">
              {minutes > 0 ? `${minutes}分` : ""}{seconds}秒
            </div>
            <div className="text-xs text-gray-400">用时</div>
          </div>
        </div>

        {failedSteps.length > 0 && (
          <div className="mb-8 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-jazz-error" />
              <h2 className="text-lg font-bold text-white">失败诊断</h2>
            </div>
            <div className="space-y-2">
              {failedSteps.map((step) => {
                const level = levels.find((l) => l.id === step.levelId);
                const isExpanded = expandedSteps.has(step.id);
                return (
                  <div key={step.id} className="bg-jazz-card rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleStep(step.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-jazz-card/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white font-medium">
                          第 {step.stepOrder + 1} 关{level ? ` - ${level.targetChord}` : ""}
                        </span>
                        {step.failType === "rule_misunderstood" && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-jazz-error/20 text-jazz-error">
                            规则未理解
                          </span>
                        )}
                        {step.failType === "too_slow" && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                            操作过慢
                          </span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    {isExpanded && level && (
                      <div className="px-4 pb-3 pt-1 border-t border-white/5">
                        <div className="text-sm text-gray-400 mb-1">
                          目标和弦：{level.targetChord} = {level.targetNotes.join(" - ")}
                        </div>
                        {step.selectedOption && (
                          <div className="text-sm text-gray-400 mb-1">
                            你的选择：{level.options.find((o) => o.id === step.selectedOption)?.label ?? "未选择"}
                          </div>
                        )}
                        {!step.selectedOption && (
                          <div className="text-sm text-gray-400 mb-1">未作答（超时）</div>
                        )}
                        <div className="text-sm text-gray-400">
                          用时：{step.timeSpent.toFixed(1)}秒
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center animate-fade-in">
          <button
            onClick={() => navigate(`/history?replay=${sessionId}`)}
            className="px-5 py-3 bg-jazz-card text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            回放本局
          </button>
          <button
            onClick={() => navigate(`/supplement/${sessionId}`)}
            className="px-5 py-3 bg-jazz-card text-white rounded-xl hover:scale-105 transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            补录备注
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-3 bg-jazz-gold text-jazz-bg font-bold rounded-xl hover:scale-105 transition-all flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
}
