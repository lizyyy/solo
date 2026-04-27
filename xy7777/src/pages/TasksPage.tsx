import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Zap, ChevronRight, X, Play, Pause, Award, Lightbulb, FileText, ListChecks } from 'lucide-react';
import { Header } from '../components/Layout';
import { getTasksByPosition, getTaskById } from '../data/tasks';
import { getSkillById } from '../data/skills';
import { getPositionById } from '../data/positions';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus } from '../types';

const dayLabels: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-secondary/10 text-secondary',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
};

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPosition, isPositionSelected, getTaskProgress, updateTaskProgress } = useApp();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [taskNotes, setTaskNotes] = useState('');

  if (!isPositionSelected || !selectedPosition) {
    navigate('/');
    return null;
  }

  const position = getPositionById(selectedPosition);
  const allTasks = getTasksByPosition(selectedPosition);

  const weekNumbers = Array.from(new Set(allTasks.map(t => t.weekNumber))).sort((a, b) => a - b);
  const weekTasks = allTasks.filter(t => t.weekNumber === activeWeek);

  const getWeekProgress = (weekNumber: number) => {
    const weekTaskList = allTasks.filter(t => t.weekNumber === weekNumber);
    const completed = weekTaskList.filter(t => {
      const progress = getTaskProgress(t.id);
      return progress?.status === 'completed';
    }).length;
    return { total: weekTaskList.length, completed };
  };

  const TaskDetailModal: React.FC = () => {
    if (!selectedTask) return null;

    const taskProgress = getTaskProgress(selectedTask.id);
    const skill = getSkillById(selectedTask.skillId);
    const status = taskProgress?.status || 'pending';

    const handleStatusChange = (newStatus: TaskStatus) => {
      updateTaskProgress(selectedTask.id, {
        status: newStatus,
        startedAt: newStatus === 'in_progress' ? new Date().toISOString() : taskProgress?.startedAt,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      });
    };

    const handleSaveNotes = () => {
      if (taskNotes !== (taskProgress?.notes || '')) {
        updateTaskProgress(selectedTask.id, { notes: taskNotes });
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
          <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-dark text-lg">{selectedTask.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`tag text-xs ${statusColors[status]} flex-shrink-0`}>
                  {statusLabels[status]}
                </span>
                {skill && (
                  <span className="tag tag-primary text-xs flex-shrink-0">
                    {skill.name}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {selectedTask.estimatedMinutes}分钟
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Zap className="w-3 h-3" />
                  {'★'.repeat(selectedTask.difficulty)}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedTask(null);
                setTaskNotes('');
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {skill && (
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-primary">相关技能：</span>
                  {skill.name}
                </p>
              </div>
            )}

            <div className="mb-6">
              <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                任务描述
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">{selectedTask.description}</p>
            </div>

            <div className="mb-6">
              <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                详细步骤
              </h4>
              <ol className="space-y-2">
                {selectedTask.detailedSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <p className="text-sm text-gray-600 pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            {selectedTask.deliverables.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-dark mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  交付成果
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.deliverables.map((deliverable, index) => (
                    <span key={index} className="tag tag-accent text-xs">
                      {deliverable}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedTask.tips.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  小贴士
                </h4>
                <ul className="space-y-1">
                  {selectedTask.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-yellow-700">
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-8">
              <h4 className="font-medium text-dark mb-2">学习笔记</h4>
              <textarea
                value={taskNotes || taskProgress?.notes || ''}
                onChange={(e) => setTaskNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="在这里记录你的学习笔记和思考..."
                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-400 mt-1">
                💡 点击输入框外部或关闭弹窗时自动保存
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex-shrink-0">
            <div className="flex gap-2">
              {status !== 'completed' && (
                <>
                  {status === 'pending' ? (
                    <button
                      onClick={() => handleStatusChange('in_progress')}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      开始任务
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatusChange('completed')}
                      className="flex-1 btn-success flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      完成任务
                    </button>
                  )}
                  {status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange('pending')}
                      className="btn-secondary py-3 px-4 flex items-center justify-center gap-2"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
              {status === 'completed' && (
                <div className="flex-1 text-center py-3 text-secondary font-medium">
                  <CheckCircle className="w-5 h-5 inline mr-2" />
                  太棒了！任务已完成
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TaskCard: React.FC<{ task: Task; index: number }> = ({ task }) => {
    const progress = getTaskProgress(task.id);
    const status = progress?.status || 'pending';
    const skill = getSkillById(task.skillId);

    const handleQuickAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (status === 'pending') {
        updateTaskProgress(task.id, { status: 'in_progress', startedAt: new Date().toISOString() });
      } else if (status === 'in_progress') {
        updateTaskProgress(task.id, { status: 'completed', completedAt: new Date().toISOString() });
      }
    };

    return (
      <div
        className={`card mb-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
          status === 'completed' ? 'border-secondary/30 bg-secondary/5' : ''
        }`}
        onClick={() => {
          setSelectedTask(task);
          setTaskNotes(progress?.notes || '');
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            {status === 'completed' ? (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            ) : status === 'in_progress' ? (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-gray-200" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-medium text-sm ${
                status === 'completed' ? 'text-gray-400 line-through' : 'text-dark'
              }`}>
                {task.title}
              </h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`tag text-xs ${statusColors[status]}`}>
                {statusLabels[status]}
              </span>
              {skill && (
                <span className="tag tag-primary text-xs">
                  {skill.name}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {task.estimatedMinutes}分钟
              </span>
            </div>
            
            {status === 'pending' && (
              <button
                onClick={handleQuickAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Play className="w-3 h-3" />
                开始学习
              </button>
            )}
            {status === 'in_progress' && (
              <button
                onClick={handleQuickAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-medium rounded-lg hover:bg-secondary/90 transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
                完成任务
              </button>
            )}
            {status === 'completed' && (
              <div className="flex items-center gap-1 text-xs text-secondary">
                <CheckCircle className="w-3 h-3" />
                <span>已完成</span>
              </div>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="学习任务"
        subtitle={`第${activeWeek}周 · ${position?.name}`}
      />

      <div className="max-w-lg mx-auto">
        <div className="bg-white border-b border-gray-100 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {weekNumbers.map(week => {
              const { total, completed } = getWeekProgress(week);
              const isActive = week === activeWeek;
              const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <button
                  key={week}
                  onClick={() => setActiveWeek(week)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div>第{week}周</div>
                  <div className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                    {completed}/{total}完成
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">本周进度</span>
              <span className="font-medium text-primary">
                {getWeekProgress(activeWeek).completed}/{getWeekProgress(activeWeek).total} 任务
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${
                    getWeekProgress(activeWeek).total > 0
                      ? (getWeekProgress(activeWeek).completed / getWeekProgress(activeWeek).total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {weekTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ListChecks className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500">本周暂无任务</p>
            </div>
          ) : (
            <div>
              {Array.from(new Set(weekTasks.map(t => t.dayOfWeek))).sort((a, b) => a - b).map(day => {
                const dayTasks = weekTasks.filter(t => t.dayOfWeek === day);
                const dayCompleted = dayTasks.filter(t => {
                  const progress = getTaskProgress(t.id);
                  return progress?.status === 'completed';
                }).length;

                return (
                  <div key={day} className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <h3 className="font-medium text-dark">
                          {dayLabels[day]}
                        </h3>
                      </div>
                      <span className="text-sm text-gray-400">
                        {dayCompleted}/{dayTasks.length}
                      </span>
                    </div>
                    {dayTasks.map((task, index) => (
                      <TaskCard key={task.id} task={task} index={index} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTask && <TaskDetailModal />}
    </div>
  );
};
