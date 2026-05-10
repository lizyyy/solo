import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { CleaningTask } from '../types';

interface StartFormProps {
  task: CleaningTask;
  onSubmit: (staff: string) => void;
  onCancel: () => void;
}

function StartTaskForm({ task, onSubmit, onCancel }: StartFormProps) {
  const [staff, setStaff] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">开始清洁</h3>
          <p className="text-sm text-slate-500 mt-1">
            {task.hallNumber}厅 - {task.movieName}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              清洁人员
            </label>
            <input
              type="text"
              value={staff}
              onChange={e => setStaff(e.target.value)}
              placeholder="请输入姓名"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={() => staff.trim() && onSubmit(staff.trim())}
            disabled={!staff.trim()}
            className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            开始清洁
          </button>
        </div>
      </div>
    </div>
  );
}

interface CompleteFormProps {
  task: CleaningTask;
  onSubmit: (score: number, notes: string) => void;
  onCancel: () => void;
}

function CompleteTaskForm({ task, onSubmit, onCancel }: CompleteFormProps) {
  const [score, setScore] = useState(8);
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">完成清洁</h3>
          <p className="text-sm text-slate-500 mt-1">
            {task.hallNumber}厅 - {task.movieName}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              清洁质量评分: <span className="text-cyan-600 font-bold">{score}</span> / 10
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={score}
              onChange={e => setScore(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>需改进</span>
              <span>一般</span>
              <span>良好</span>
              <span>优秀</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              备注（可选）
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="清洁情况、发现的问题等..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={() => onSubmit(score, notes)}
            className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}

export function CleaningTasksPage() {
  const { data, startTask, completeTask, setSelectedTask } = useApp();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [startingTask, setStartingTask] = useState<CleaningTask | null>(null);
  const [completingTask, setCompletingTask] = useState<CleaningTask | null>(null);

  const filteredTasks = data.cleaningTasks.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  }).sort((a, b) => {
    const priority = { pending: 0, in_progress: 1, overdue: 2, completed: 3 };
    return (priority[a.status] || 0) - (priority[b.status] || 0);
  });

  const getGapMinutes = (task: CleaningTask) => {
    if (!task.nextScreeningStartTime) return null;
    const [endH, endM] = task.screeningEndTime.split(':').map(Number);
    const [nextH, nextM] = task.nextScreeningStartTime.split(':').map(Number);
    return (nextH * 60 + nextM) - (endH * 60 + endM);
  };

  return (
    <div className="space-y-6">
      {startingTask && (
        <StartTaskForm
          task={startingTask}
          onSubmit={staff => {
            startTask(startingTask.id, staff);
            setStartingTask(null);
          }}
          onCancel={() => setStartingTask(null)}
        />
      )}

      {completingTask && (
        <CompleteTaskForm
          task={completingTask}
          onSubmit={(score, notes) => {
            completeTask(completingTask.id, score, notes);
            setCompletingTask(null);
          }}
          onCancel={() => setCompletingTask(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'pending', label: '待开始' },
            { key: 'in_progress', label: '进行中' },
            { key: 'completed', label: '已完成' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                filter === f.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
              <span className="ml-1 text-xs opacity-70">
                ({f.key === 'all' ? data.cleaningTasks.length :
                   data.cleaningTasks.filter(t => t.status === f.key).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {filteredTasks.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {filteredTasks.map(task => {
              const gap = getGapMinutes(task);
              const taskLostItems = data.lostItems.filter(l => l.cleaningTaskId === task.id);
              const taskEquipment = data.equipmentIssues.filter(e => e.cleaningTaskId === task.id);

              return (
                <div key={task.id} className="p-5 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎬</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-slate-800">
                              {task.hallNumber}号厅
                            </h3>
                            <span className="text-slate-600">—</span>
                            <span className="text-slate-700">{task.movieName}</span>
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                            <span>散场: {task.screeningEndTime}</span>
                            {task.nextScreeningStartTime && (
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                gap && gap < 45 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'
                              }`}>
                                距下场 {task.nextScreeningStartTime} 仅 {gap} 分钟
                              </span>
                            )}
                            <span>截止: {task.deadline.split(' ')[1]?.slice(0, 5)}</span>
                          </div>
                          <div className="mt-2 flex items-center space-x-3 text-sm">
                            {task.assignedTo && (
                              <span className="text-slate-500">
                                责任人: <span className="text-slate-700 font-medium">{task.assignedTo}</span>
                              </span>
                            )}
                            {task.startTime && (
                              <span className="text-slate-500">
                                开始: <span className="text-slate-700">{task.startTime.split(' ')[1]?.slice(0, 5)}</span>
                              </span>
                            )}
                            {task.endTime && (
                              <span className="text-slate-500">
                                结束: <span className="text-slate-700">{task.endTime.split(' ')[1]?.slice(0, 5)}</span>
                              </span>
                            )}
                            {task.qualityScore !== undefined && (
                              <span className="text-slate-500">
                                评分: <span className="text-slate-700 font-medium">{task.qualityScore}/10</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {task.notes && (
                        <div className="mt-3 ml-11 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                          📝 {task.notes}
                        </div>
                      )}

                      {(taskLostItems.length > 0 || taskEquipment.length > 0) && (
                        <div className="mt-3 ml-11 flex flex-wrap gap-2">
                          {taskLostItems.length > 0 && (
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                              📦 {taskLostItems.length} 件遗失物
                            </span>
                          )}
                          {taskEquipment.length > 0 && (
                            <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                              🔧 {taskEquipment.length} 项设备异常
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        task.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        task.status === 'in_progress' ? 'bg-cyan-100 text-cyan-700' :
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {{
                          pending: '待开始',
                          in_progress: '进行中',
                          completed: '已完成',
                          overdue: '超时',
                        }[task.status]}
                      </span>

                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => setStartingTask(task)}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            开始清洁
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                window.location.hash = '#lostItems';
                              }}
                              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              登记遗失物
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                window.location.hash = '#equipment';
                              }}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              报设备异常
                            </button>
                            <button
                              onClick={() => setCompletingTask(task)}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              完成
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">🧹</div>
            <p>暂无清洁任务</p>
            <p className="text-sm mt-1">请先在"排片管理"导入排片并生成清洁任务</p>
          </div>
        )}
      </div>
    </div>
  );
}
