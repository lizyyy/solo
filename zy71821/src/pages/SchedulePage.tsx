import React, { useState, useMemo } from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle, History, Edit2, X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { Schedule, ScheduleHistory } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const MINE_TYPES = ['铁矿场', '水晶矿场', '钛金矿场', '稀有矿场', '深空矿场'];

export default function SchedulePage() {
  const { schedules, addSchedule, updateSchedule, selectedDate, setSelectedDate, feedbacks } = useAppStore();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<{ mineType: string; operator: string; status: 'normal' | 'abnormal' | 'completed'; note: string }>({ mineType: '', operator: '', status: 'normal', note: '' });
  const [editReason, setEditReason] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const currentDate = new Date(selectedDate);
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const calendarDays = useMemo(() => {
    const days: (string | null)[] = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push(dateStr);
    }
    return days;
  }, [currentDate, startDay, daysInMonth]);

  const getScheduleForDate = (date: string) => {
    return schedules.filter(s => s.date === date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-emerald-500';
      case 'abnormal': return 'bg-amber-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常';
      case 'abnormal': return '异常';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const detectAnomalies = (schedule: Schedule) => {
    const anomalies: string[] = [];
    const dayFeedbacks = feedbacks.filter(f => f.timestamp.startsWith(schedule.date));
    
    if (dayFeedbacks.length > 5) {
      anomalies.push(`当日有 ${dayFeedbacks.length} 条玩家反馈`);
    }
    if (schedule.status === 'abnormal' && !schedule.note) {
      anomalies.push('异常状态但未添加说明');
    }
    if (schedule.history.length > 3) {
      anomalies.push(`该排班已修改 ${schedule.history.length} 次`);
    }
    
    return anomalies;
  };

  const handleAddSchedule = (date: string) => {
    setSelectedSchedule(null);
    setEditForm({ mineType: MINE_TYPES[0], operator: '', status: 'normal', note: '' });
    setEditReason('新建排班');
    setShowEditModal(true);
  };

  const handleEditSchedule = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setEditForm({
      mineType: schedule.mineType,
      operator: schedule.operator,
      status: schedule.status,
      note: schedule.note || '',
    });
    setEditReason('');
    setShowEditModal(true);
  };

  const saveSchedule = () => {
    if (!editReason.trim()) {
      alert('请填写修改原因');
      return;
    }

    if (selectedSchedule) {
      updateSchedule(
        selectedSchedule.id,
        {
          mineType: editForm.mineType,
          operator: editForm.operator,
          status: editForm.status,
          note: editForm.note,
        },
        editReason,
        '运营人员'
      );
    } else {
      const newSchedule: Schedule = {
        id: generateId(),
        date: selectedDate,
        mineType: editForm.mineType,
        operator: editForm.operator,
        status: editForm.status,
        note: editForm.note,
        history: [],
      };
      addSchedule(newSchedule);
    }

    setShowEditModal(false);
  };

  const viewHistory = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setShowHistory(true);
  };

  const prevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const nextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">排班工作台</h1>
          <p className="text-slate-400 text-sm mt-1">管理矿场排班、查看历史、标记异常</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-sm rounded ${viewMode === 'calendar' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            日历视图
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            列表视图
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded">
              <ChevronLeft size={20} className="text-slate-400" />
            </button>
            <h2 className="text-lg font-medium text-slate-200">
              {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
            </h2>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded">
              <ChevronRight size={20} className="text-slate-400" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 text-xs text-slate-400 border-b border-slate-700">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <div key={day} className="py-2 text-center">{day}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {calendarDays.map((date, i) => (
              <div
                key={i}
                className={`min-h-24 border-b border-r border-slate-700/50 p-1 ${
                  date === selectedDate ? 'bg-orange-500/10' : 'hover:bg-slate-700/30'
                } cursor-pointer`}
                onClick={() => date && setSelectedDate(date)}
              >
                {date && (
                  <>
                    <div className="text-xs text-slate-400 mb-1">{parseInt(date.split('-')[2])}</div>
                    <div className="space-y-1">
                      {getScheduleForDate(date).slice(0, 2).map(schedule => (
                        <div
                          key={schedule.id}
                          className={`text-xs p-1 rounded truncate ${getStatusColor(schedule.status)}/20 border border-transparent hover:border-orange-500/50`}
                          onClick={(e) => { e.stopPropagation(); handleEditSchedule(schedule); }}
                        >
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${getStatusColor(schedule.status)}`} />
                          {schedule.mineType}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddSchedule(date); setSelectedDate(date); }}
                      className="mt-1 text-xs text-slate-500 hover:text-orange-400 flex items-center gap-0.5"
                    >
                      <Plus size={12} /> 新增
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="divide-y divide-slate-700">
            {schedules.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p>暂无排班记录</p>
              </div>
            ) : (
              schedules.map(schedule => {
                const anomalies = detectAnomalies(schedule);
                return (
                  <div key={schedule.id} className="p-4 hover:bg-slate-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(schedule.status)}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">{schedule.mineType}</span>
                            <span className="text-xs text-slate-500">{schedule.date}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                              {getStatusText(schedule.status)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">运营: {schedule.operator || '未分配'}</p>
                          {schedule.note && (
                            <p className="text-sm text-slate-500 mt-1">备注: {schedule.note}</p>
                          )}
                          {anomalies.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {anomalies.map((a, i) => (
                                <div key={i} className="flex items-center gap-1 text-xs text-amber-400">
                                  <AlertCircle size={12} />
                                  {a}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewHistory(schedule)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                          title="查看历史"
                        >
                          <History size={16} />
                        </button>
                        <button
                          onClick={() => handleEditSchedule(schedule)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                          title="编辑"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-md">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">
                {selectedSchedule ? '编辑排班' : '新增排班'} - {selectedDate}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">矿场类型</label>
                <select
                  value={editForm.mineType}
                  onChange={(e) => setEditForm({ ...editForm, mineType: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                >
                  {MINE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">运营人员</label>
                <input
                  type="text"
                  value={editForm.operator}
                  onChange={(e) => setEditForm({ ...editForm, operator: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  placeholder="输入运营人员姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">状态</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                >
                  <option value="normal">正常</option>
                  <option value="abnormal">异常</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">备注说明</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200 resize-none"
                  rows={2}
                  placeholder="异常说明、特殊情况等"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">修改原因 *</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200"
                  placeholder="请说明修改原因（必填）"
                />
              </div>
              <button
                onClick={saveSchedule}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && selectedSchedule && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-slate-200">历史变更记录</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="mb-4 p-3 bg-slate-700/50 rounded">
                <p className="text-sm text-slate-300 font-medium">{selectedSchedule.mineType}</p>
                <p className="text-xs text-slate-500">{selectedSchedule.date}</p>
              </div>
              {selectedSchedule.history.length === 0 ? (
                <p className="text-center text-slate-500 py-8">暂无修改记录</p>
              ) : (
                <div className="space-y-4">
                  {selectedSchedule.history.slice().reverse().map((record: ScheduleHistory, i) => (
                    <div key={record.id} className="relative pl-6 pb-4 border-l-2 border-slate-600">
                      <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-slate-600" />
                      <div className="text-xs text-slate-500 mb-1 flex items-center gap-2">
                        <Clock size={12} />
                        {new Date(record.timestamp).toLocaleString()}
                      </div>
                      <p className="text-sm text-slate-200 mb-2">
                        <span className="text-orange-400">{record.operator}</span>: {record.reason}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-700/50 rounded">
                          <p className="text-slate-500 mb-1">修改前</p>
                          <p className="text-slate-300">{record.before?.mineType || '-'}</p>
                          <p className="text-slate-400">{record.before?.operator || '未分配'}</p>
                          <p className="text-slate-400">{record.before?.status ? getStatusText(record.before.status) : '-'}</p>
                        </div>
                        <div className="p-2 bg-emerald-900/30 rounded border border-emerald-700/30">
                          <p className="text-slate-500 mb-1">修改后</p>
                          <p className="text-slate-300">{record.after?.mineType || '-'}</p>
                          <p className="text-slate-400">{record.after?.operator || '未分配'}</p>
                          <p className="text-slate-400">{record.after?.status ? getStatusText(record.after.status) : '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
