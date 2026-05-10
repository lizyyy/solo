import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import type { EquipmentIssue, CleaningTask } from '../types';
import { formatDateTime } from '../utils/storage';

interface AddFormProps {
  availableTasks: CleaningTask[];
  selectedTask: CleaningTask | null;
  onSubmit: (issue: Omit<EquipmentIssue, 'id' | 'cleaningTaskId' | 'screeningId' | 'hallNumber' | 'reportedTime' | 'createdAt'> & { cleaningTaskId: string }) => void;
  onCancel: () => void;
}

function AddEquipmentForm({ availableTasks, selectedTask, onSubmit, onCancel }: AddFormProps) {
  const [selectedTaskId, setSelectedTaskId] = useState(selectedTask?.id || (availableTasks[0]?.id || ''));
  const [equipmentType, setEquipmentType] = useState('');
  const [description, setDescription] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  useEffect(() => {
    if (selectedTask) setSelectedTaskId(selectedTask.id);
  }, [selectedTask]);

  const handleSubmit = () => {
    if (!equipmentType.trim() || !description.trim() || !reportedBy.trim()) return;
    onSubmit({
      cleaningTaskId: selectedTaskId,
      equipmentType: equipmentType.trim(),
      description: description.trim(),
      reportedBy: reportedBy.trim(),
      priority,
      status: 'reported',
    });
  };

  const equipmentOptions = [
    '座椅', '扶手', '杯架', '地毯', '墙壁',
    '银幕', '放映机', '音响', '灯光', '空调',
    '3D眼镜', '出入口', '消防设备', '其他'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">上报设备异常</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              关联清洁任务 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              disabled={availableTasks.length === 0}
            >
              {availableTasks.length === 0 ? (
                <option value="">暂无可选清洁任务</option>
              ) : (
                availableTasks.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.hallNumber}厅 - {t.movieName} ({t.screeningEndTime}散场)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                设备类型 <span className="text-red-500">*</span>
              </label>
              <select
                value={equipmentType}
                onChange={e => setEquipmentType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">请选择</option>
                {equipmentOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                上报人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                placeholder="姓名"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              优先级
            </label>
            <div className="flex space-x-2">
              {[
                { key: 'low', label: '低', color: 'bg-slate-100 text-slate-600 border-slate-200' },
                { key: 'medium', label: '中', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                { key: 'high', label: '高', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                { key: 'critical', label: '紧急', color: 'bg-red-50 text-red-700 border-red-200' },
              ].map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key as any)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    priority === p.key
                      ? p.color + ' ring-2 ring-offset-1 ring-current'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              问题描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="详细描述异常情况..."
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
            onClick={handleSubmit}
            disabled={!equipmentType.trim() || !description.trim() || !reportedBy.trim() || availableTasks.length === 0}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            确认上报
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResolveFormProps {
  issue: EquipmentIssue;
  onSubmit: (resolvedBy: string, notes: string) => void;
  onCancel: () => void;
}

function ResolveForm({ issue, onSubmit, onCancel }: ResolveFormProps) {
  const [resolvedBy, setResolvedBy] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">处理设备异常</h3>
          <p className="text-sm text-slate-500 mt-1">
            {issue.equipmentType} · {issue.hallNumber}厅
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              处理人
            </label>
            <input
              type="text"
              value={resolvedBy}
              onChange={e => setResolvedBy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              处理说明
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
            onClick={() => onSubmit(resolvedBy.trim() || '运维', notes.trim())}
            className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
          >
            标记已解决
          </button>
        </div>
      </div>
    </div>
  );
}

export function EquipmentPage() {
  const { data, addEquipmentIssue, updateEquipmentIssue, selectedTask, setSelectedTask } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [resolvingIssue, setResolvingIssue] = useState<EquipmentIssue | null>(null);
  const [filter, setFilter] = useState<'all' | 'reported' | 'in_progress' | 'resolved' | 'escalated'>('all');

  useEffect(() => {
    if (window.location.hash === '#equipment' && selectedTask) {
      setShowAddForm(true);
      window.location.hash = '';
    }
  }, [selectedTask]);

  const availableTasks = data.cleaningTasks.filter(
    t => t.status === 'in_progress' || t.status === 'completed'
  );

  const filteredIssues = data.equipmentIssues.filter(e => {
    if (filter === 'all') return true;
    return e.status === filter;
  }).sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
  });

  const handleAdd = (issue: any) => {
    const task = data.cleaningTasks.find(t => t.id === issue.cleaningTaskId);
    if (task) {
      const { cleaningTaskId, ...rest } = issue;
      addEquipmentIssue(task, rest);
    }
    setShowAddForm(false);
    if (selectedTask) setSelectedTask(null);
  };

  const handleStartProcessing = (issue: EquipmentIssue) => {
    updateEquipmentIssue(issue.id, { status: 'in_progress' });
  };

  const handleEscalate = (issue: EquipmentIssue) => {
    if (confirm('确定将此问题升级处理？')) {
      updateEquipmentIssue(issue.id, { status: 'escalated' });
    }
  };

  const handleResolve = (issue: EquipmentIssue, resolvedBy: string, notes: string) => {
    updateEquipmentIssue(issue.id, {
      status: 'resolved',
      resolvedBy,
      resolvedTime: formatDateTime(new Date()),
      resolutionNotes: notes || undefined,
    });
    setResolvingIssue(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      reported: { label: '已上报', color: 'bg-yellow-100 text-yellow-700' },
      in_progress: { label: '处理中', color: 'bg-cyan-100 text-cyan-700' },
      resolved: { label: '已解决', color: 'bg-green-100 text-green-700' },
      escalated: { label: '已升级', color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || map.reported;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  };

  const priorityBadge = (priority: string) => {
    const map: Record<string, { label: string; color: string }> = {
      low: { label: '低', color: 'bg-slate-100 text-slate-600' },
      medium: { label: '中', color: 'bg-yellow-100 text-yellow-700' },
      high: { label: '高', color: 'bg-orange-100 text-orange-700' },
      critical: { label: '紧急', color: 'bg-red-100 text-red-700' },
    };
    const p = map[priority] || map.medium;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.color}`}>
        {p.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {showAddForm && (
        <AddEquipmentForm
          availableTasks={availableTasks}
          selectedTask={selectedTask}
          onSubmit={handleAdd}
          onCancel={() => {
            setShowAddForm(false);
            if (selectedTask) setSelectedTask(null);
          }}
        />
      )}

      {resolvingIssue && (
        <ResolveForm
          issue={resolvingIssue}
          onSubmit={(resolvedBy, notes) => handleResolve(resolvingIssue, resolvedBy, notes)}
          onCancel={() => setResolvingIssue(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          {[
            { key: 'all', label: '全部' },
            { key: 'reported', label: '已上报' },
            { key: 'in_progress', label: '处理中' },
            { key: 'escalated', label: '已升级' },
            { key: 'resolved', label: '已解决' },
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
                ({f.key === 'all' ? data.equipmentIssues.length :
                   data.equipmentIssues.filter(e => e.status === f.key).length})
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          + 上报异常
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {filteredIssues.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {filteredIssues.map(issue => {
              return (
                <div key={issue.id} className="p-5 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🔧</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-slate-800">{issue.equipmentType}</h3>
                            {statusBadge(issue.status)}
                            {priorityBadge(issue.priority)}
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                            <span>影厅: {issue.hallNumber}厅</span>
                            <span>上报人: {issue.reportedBy}</span>
                            <span>上报时间: {issue.reportedTime.split(' ')[1]?.slice(0, 5)}</span>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            问题: {issue.description}
                          </div>
                          {issue.resolutionNotes && (
                            <div className="mt-2 text-sm text-slate-600 bg-green-50 px-3 py-2 rounded-lg">
                              ✅ 处理说明: {issue.resolutionNotes}
                              {issue.resolvedBy && ` · ${issue.resolvedBy}`}
                              {issue.resolvedTime && ` · ${issue.resolvedTime.split(' ')[1]?.slice(0, 5)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {issue.status === 'reported' && (
                        <>
                          <button
                            onClick={() => handleStartProcessing(issue)}
                            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            开始处理
                          </button>
                          <button
                            onClick={() => handleEscalate(issue)}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            升级
                          </button>
                        </>
                      )}
                      {(issue.status === 'in_progress' || issue.status === 'escalated') && (
                        <button
                          onClick={() => setResolvingIssue(issue)}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          标记解决
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <div className="text-5xl mb-3">🔧</div>
            <p>暂无设备异常记录</p>
            <p className="text-sm mt-1">在清洁过程中发现的设备问题可以在此上报</p>
          </div>
        )}
      </div>
    </div>
  );
}
