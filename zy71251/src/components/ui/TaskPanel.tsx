import { useState } from 'react';
import {
  X, Play, CheckCircle, RotateCcw, AlertTriangle, Clock,
  ChevronDown, ChevronUp, FilePlus, PenLine, History
} from 'lucide-react';
import useStore from '../../store/useStore';
import type { Task } from '../../types';

const taskTypeText: Record<string, string> = {
  inbound: '入库', outbound: '出库', transfer: '移库'
};
const statusText: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', completed: '已完成', cancelled: '已撤回'
};
const statusColor: Record<string, string> = {
  pending: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  in_progress: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  completed: 'bg-green-900/50 text-green-300 border-green-700/50',
  cancelled: 'bg-slate-700/50 text-slate-400 border-slate-600/50'
};

interface TaskPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskPanel({ isOpen, onClose }: TaskPanelProps) {
  const {
    tasks, operationLogs, locations,
    updateTaskStatus, cancelTask, supplementTask,
    addOperationLog, detectDuplicateLocations,
    detectTemperatureAlerts, detectHumidityAlerts,
    checkForbiddenCrossing, planRoute
  } = useStore();

  const [remarkInput, setRemarkInput] = useState('');
  const [operatorInput, setOperatorInput] = useState('张管理员');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs'>('tasks');

  if (!isOpen) return null;

  const handleStartTask = (task: Task) => {
    updateTaskStatus(task.id, 'in_progress', operatorInput, remarkInput || '开始执行任务');
    setRemarkInput('');
  };

  const handleCompleteTask = (task: Task) => {
    updateTaskStatus(task.id, 'completed', operatorInput, remarkInput || '任务完成');
    setRemarkInput('');
  };

  const handleCancelTask = (task: Task) => {
    cancelTask(task.id, operatorInput, remarkInput || '撤回任务');
    setRemarkInput('');
  };

  const handleSupplement = (task: Task) => {
    if (!remarkInput.trim()) return;
    supplementTask(task.id, operatorInput, remarkInput);
    setRemarkInput('');
  };

  const duplicates = detectDuplicateLocations();
  const tempAlerts = detectTemperatureAlerts();
  const humidAlerts = detectHumidityAlerts();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50 shrink-0">
          <h2 className="text-lg font-semibold text-white">任务与操作管理</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-slate-700/50 shrink-0">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'tasks' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            任务管理 ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'logs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            操作日志 ({operationLogs.length})
          </button>
        </div>

        <div className="p-4 border-b border-slate-700/50 shrink-0 bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">操作人</span>
              <select
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                className="bg-slate-800 border border-slate-600/50 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option>张管理员</option>
                <option>李典藏</option>
                <option>王组长</option>
                <option>陈助理</option>
              </select>
            </div>
            <div className="flex items-center gap-2 flex-[2]">
              <span className="text-xs text-slate-500 whitespace-nowrap">备注</span>
              <input
                type="text"
                value={remarkInput}
                onChange={e => setRemarkInput(e.target.value)}
                placeholder="操作备注（补录必填）"
                className="flex-1 bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'tasks' && (
            <>
              {duplicates.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-2">
                  <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                    <AlertTriangle size={14} />
                    箱位重复告警
                  </div>
                  {duplicates.map((d, i) => (
                    <div key={i} className="text-xs text-red-300/80 ml-5">{d}</div>
                  ))}
                </div>
              )}
              {(tempAlerts.length > 0 || humidAlerts.length > 0) && (
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 mb-2">
                  <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                    <AlertTriangle size={14} />
                    环境超限告警
                  </div>
                  <div className="text-xs text-amber-300/80 ml-5">
                    温度超限 {tempAlerts.length} 库位，湿度超限 {humidAlerts.length} 库位
                  </div>
                </div>
              )}

              {tasks.map(task => {
                const isExpanded = expandedTask === task.id;
                const fromLoc = locations.find(l => l.id === task.fromLocation);
                const toLoc = locations.find(l => l.id === task.toLocation);
                const routeCrossing = task.route.length > 0 ? checkForbiddenCrossing(task.route) : task.hasForbiddenCrossing;

                return (
                  <div key={task.id} className="bg-slate-800/50 rounded-lg border border-slate-700/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                      className="w-full p-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusColor[task.status]}`}>
                          {statusText[task.status]}
                        </span>
                        <span className="text-white text-sm font-medium">{taskTypeText[task.type]}</span>
                        <span className="text-slate-400 text-xs font-mono">{task.boxId}</span>
                        {routeCrossing && task.status !== 'completed' && task.status !== 'cancelled' && (
                          <AlertTriangle size={14} className="text-red-400" />
                        )}
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-700/50 p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">来源:</span> <span className="text-slate-300">{fromLoc?.code || task.fromLocation}</span></div>
                          <div><span className="text-slate-500">目标:</span> <span className="text-slate-300">{toLoc?.code || task.toLocation}</span></div>
                          <div><span className="text-slate-500">优先级:</span> <span className="text-slate-300">{task.priority === 'urgent' ? '紧急' : task.priority === 'emergency' ? '特急' : '普通'}</span></div>
                          <div><span className="text-slate-500">创建:</span> <span className="text-slate-300">{new Date(task.createTime).toLocaleString('zh-CN')}</span></div>
                        </div>

                        {routeCrossing && task.status !== 'completed' && task.status !== 'cancelled' && (
                          <div className="bg-red-900/20 border border-red-700/30 rounded p-2 text-xs text-red-300">
                            <AlertTriangle size={12} className="inline mr-1" />
                            此任务路线穿越禁区，建议重新规划
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {task.status === 'pending' && (
                            <button
                              onClick={() => handleStartTask(task)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                            >
                              <Play size={12} /> 开始执行
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => handleCompleteTask(task)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                            >
                              <CheckCircle size={12} /> 完成任务
                            </button>
                          )}
                          {(task.status === 'pending' || task.status === 'in_progress') && (
                            <button
                              onClick={() => handleCancelTask(task)}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-colors"
                            >
                              <RotateCcw size={12} /> 撤回
                            </button>
                          )}
                          {(task.status === 'pending' || task.status === 'in_progress') && (
                            <button
                              onClick={() => handleSupplement(task)}
                              disabled={!remarkInput.trim()}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900 disabled:text-amber-700 text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                            >
                              <PenLine size={12} /> 补录完成
                            </button>
                          )}
                        </div>

                        {task.operationLog.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-slate-700/30">
                            <div className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                              <History size={10} /> 操作记录
                            </div>
                            {task.operationLog.map((log, i) => (
                              <div key={i} className="text-xs text-slate-400 ml-2">
                                <span className="text-slate-500">{new Date(log.time).toLocaleString('zh-CN')}</span>
                                {' '}<span className="text-slate-300">{log.operator}</span>: {log.action}
                                {log.remark && <span className="text-slate-500"> — {log.remark}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-1">
              {operationLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded hover:bg-slate-800/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.action.includes('撤回') ? 'bg-red-400' :
                    log.action.includes('补录') ? 'bg-amber-400' :
                    log.action.includes('告警') ? 'bg-red-500' :
                    'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">
                      <span className="text-slate-400">{log.operator}</span>: {log.action}
                    </div>
                    {log.remark && <div className="text-xs text-slate-500 truncate">{log.remark}</div>}
                  </div>
                  <div className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(log.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
