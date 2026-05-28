import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ACTIVITY_NAMES, ACTIVITY_COLORS, KNOWLEDGE_POINT_NAMES, DIFFICULTY_NAMES, DIFFICULTY_COLORS } from '../data/constants';
import type { ActivityType, KnowledgePoint, Problem, TrainingActivity } from '../types';

interface SchedulePanelProps {
  onScheduleComplete: () => void;
}

export const SchedulePanel: React.FC<SchedulePanelProps> = ({ onScheduleComplete }) => {
  const { state, scheduleActivity, unscheduleActivity, clearSchedule, getAvailableProblems } = useGame();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState<KnowledgePoint | null>(null);

  const availableProblems = getAvailableProblems();

  const handleSchedule = () => {
    if (!selectedMember || !selectedActivity) return;

    const activity: {
      type: ActivityType;
      memberId: string;
      problemId?: string;
      knowledgePoint?: KnowledgePoint;
      duration: number;
    } = {
      type: selectedActivity,
      memberId: selectedMember,
      duration: 1,
    };

    if (selectedActivity === 'practice' && selectedProblem) {
      activity.problemId = selectedProblem;
    } else if (selectedActivity === 'review' && selectedKnowledgePoint) {
      activity.knowledgePoint = selectedKnowledgePoint;
    } else if (selectedActivity === 'practice') {
      return;
    } else if (selectedActivity === 'review') {
      return;
    }

    scheduleActivity(activity);
    setSelectedMember(null);
    setSelectedActivity(null);
    setSelectedProblem(null);
    setSelectedKnowledgePoint(null);
  };

  const canSchedule = () => {
    if (!selectedMember || !selectedActivity) return false;
    if (selectedActivity === 'practice' && !selectedProblem) return false;
    if (selectedActivity === 'review' && !selectedKnowledgePoint) return false;
    return true;
  };

  const getMemberSchedule = (memberId: string) => {
    return state.scheduledActivities.filter(a => a.memberId === memberId);
  };

  const getProblemById = (id: string): Problem | undefined => {
    return state.problems.find(p => p.id === id);
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">📋 今日排程 - 第 {state.currentDay} 天</h2>
        <div className="flex gap-2">
          {state.scheduledActivities.length > 0 && (
            <button onClick={clearSchedule} className="btn-secondary text-sm">
              清空排程
            </button>
          )}
          <button
            onClick={onScheduleComplete}
            disabled={state.scheduledActivities.length === 0}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始执行 ▶
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">安排活动</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">选择队员</label>
              <div className="grid grid-cols-3 gap-2">
                {state.members.map(member => {
                  const scheduled = getMemberSchedule(member.id);
                  const isScheduled = scheduled.length > 0;
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(member.id)}
                      disabled={isScheduled}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedMember === member.id
                          ? 'border-purple-500 bg-purple-900/30'
                          : isScheduled
                          ? 'border-green-700 bg-green-900/20 opacity-60 cursor-not-allowed'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                      }`}
                    >
                      <div className="text-2xl">{member.avatar}</div>
                      <div className="text-sm font-medium text-white">{member.name}</div>
                      {isScheduled && (
                        <div className="text-xs text-green-400 mt-1">
                          {ACTIVITY_NAMES[scheduled[0].type]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">选择活动类型</label>
              <div className="grid grid-cols-3 gap-2">
                {(['practice', 'review', 'rest'] as ActivityType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedActivity(type)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedActivity === type
                        ? `${ACTIVITY_COLORS[type]} border-white`
                        : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {type === 'practice' ? '📝' : type === 'review' ? '🔄' : '😴'}
                    </div>
                    <div className="text-sm font-medium text-white">{ACTIVITY_NAMES[type]}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedActivity === 'practice' && (
              <div className="animate-slide-in">
                <label className="block text-sm text-slate-400 mb-2">选择题目</label>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                  {availableProblems.map((problem: Problem) => (
                    <button
                      key={problem.id}
                      onClick={() => setSelectedProblem(problem.id)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        selectedProblem === problem.id
                          ? 'border-blue-500 bg-blue-900/30'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-white">{problem.title}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            知识点: {problem.knowledgePoints.map(kp => KNOWLEDGE_POINT_NAMES[kp]).join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${DIFFICULTY_COLORS[problem.difficulty]}`}>
                            {DIFFICULTY_NAMES[problem.difficulty]}
                          </div>
                          <div className="text-xs text-slate-400">{problem.points}分</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedActivity === 'review' && (
              <div className="animate-slide-in">
                <label className="block text-sm text-slate-400 mb-2">选择复盘知识点</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(KNOWLEDGE_POINT_NAMES).map(([kp, name]) => (
                    <button
                      key={kp}
                      onClick={() => setSelectedKnowledgePoint(kp as KnowledgePoint)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedKnowledgePoint === kp
                          ? 'border-purple-500 bg-purple-900/30'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                      }`}
                    >
                      <div className="font-medium text-white">{name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSchedule}
              disabled={!canSchedule()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              添加到排程
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-3">今日已安排</h3>
          
          {state.scheduledActivities.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">📅</div>
              <p>还没有安排任何活动</p>
              <p className="text-sm">从左侧选择队员和活动开始排程</p>
            </div>
          ) : (
            <div className="space-y-3">
              {state.scheduledActivities.map((activity: TrainingActivity) => {
                const member = state.members.find(m => m.id === activity.memberId);
                const problem = activity.problemId ? getProblemById(activity.problemId) : null;
                
                return (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-lg border-2 ${ACTIVITY_COLORS[activity.type]} border-white/20 animate-slide-in`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{member?.avatar}</div>
                        <div>
                          <div className="font-bold text-white">
                            {member?.name} - {ACTIVITY_NAMES[activity.type]}
                          </div>
                          <div className="text-sm text-white/80">
                            {activity.type === 'practice' && problem && (
                              <>📝 {problem.title} ({DIFFICULTY_NAMES[problem.difficulty]})</>
                            )}
                            {activity.type === 'review' && activity.knowledgePoint && (
                              <>🔄 复盘 {KNOWLEDGE_POINT_NAMES[activity.knowledgePoint]}</>
                            )}
                            {activity.type === 'rest' && (
                              <>😴 休息恢复精力</>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => unscheduleActivity(activity.id)}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
            <div className="text-sm text-slate-400">
              已安排: {state.scheduledActivities.length}/{state.members.length} 名队员
            </div>
            <div className="w-full h-2 bg-slate-600 rounded-full mt-2">
              <div
                className="h-full bg-purple-500 rounded-full progress-bar"
                style={{ width: `${(state.scheduledActivities.length / state.members.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
