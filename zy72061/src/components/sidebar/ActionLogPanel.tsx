import { useState } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  Edit3,
  AlertTriangle,
  MessageSquare,
  Upload,
  Save,
  RotateCcw,
  Filter,
  Clock,
  User,
  PlayCircle,
} from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';
import { ActionLog, ActionType } from '../../types';

const ACTION_TYPE_ICONS: Record<ActionType, React.ReactNode> = {
  add_note: <MessageSquare size={14} />,
  update_coordinates: <Edit3 size={14} />,
  toggle_anomaly: <AlertTriangle size={14} />,
  import_data: <Upload size={14} />,
  create_snapshot: <Save size={14} />,
  restore_snapshot: <RotateCcw size={14} />,
  update_filter: <Filter size={14} />,
  change_frame: <PlayCircle size={14} />,
};

const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  add_note: 'bg-purple-100 text-purple-700',
  update_coordinates: 'bg-green-100 text-green-700',
  toggle_anomaly: 'bg-orange-100 text-orange-700',
  import_data: 'bg-blue-100 text-blue-700',
  create_snapshot: 'bg-indigo-100 text-indigo-700',
  restore_snapshot: 'bg-teal-100 text-teal-700',
  update_filter: 'bg-gray-100 text-gray-700',
  change_frame: 'bg-cyan-100 text-cyan-700',
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  add_note: '添加备注',
  update_coordinates: '坐标修改',
  toggle_anomaly: '异常标记',
  import_data: '数据导入',
  create_snapshot: '创建快照',
  restore_snapshot: '恢复快照',
  update_filter: '筛选变更',
  change_frame: '帧切换',
};

export default function ActionLogPanel() {
  const { getActionLogs, getStatistics, snapshots } = useGaitStore();
  const logs = getActionLogs();
  const stats = getStatistics();
  const [expanded, setExpanded] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActionLog | null>(null);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const userActions = logs.filter((l) => l.author !== '系统');
  const systemActions = logs.filter((l) => l.author === '系统');

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <History size={16} className="text-blue-600" />
          操作记录与回放
          <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
            {userActions.length}
          </span>
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{userActions.length}</div>
              <div className="text-xs text-blue-600">用户操作</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-gray-600">{systemActions.length}</div>
              <div className="text-xs text-gray-600">系统操作</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">操作时间线</p>
              <span className="text-xs text-gray-400">共 {logs.length} 条</span>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-4 text-gray-400">
                <History size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">暂无操作记录</p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {logs.slice(0, 30).map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedLog?.id === log.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`p-1 rounded ${ACTION_TYPE_COLORS[log.actionType]}`}
                      >
                        {ACTION_TYPE_ICONS[log.actionType]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {log.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatDate(log.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {log.author}
                          </span>
                          <span className="px-1 bg-gray-100 rounded text-gray-600">
                            {ACTION_TYPE_LABELS[log.actionType]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedLog?.id === log.id && log.details && (
                      <div className="mt-2 p-2 bg-white rounded border border-gray-200 text-xs">
                        {log.details.pointName && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500">点位</span>
                            <span className="font-mono text-gray-700">{log.details.pointName}</span>
                          </div>
                        )}
                        {log.details.frameNumber !== undefined && (
                          <div className="flex justify-between py-1 border-b border-gray-100">
                            <span className="text-gray-500">帧</span>
                            <span className="text-gray-700">第 {log.details.frameNumber + 1} 帧</span>
                          </div>
                        )}
                        {log.details.previousValue !== undefined && (
                          <div className="py-1 border-b border-gray-100">
                            <span className="text-gray-500">变更前：</span>
                            <span className="text-red-600 ml-1">
                              {typeof log.details.previousValue === 'object'
                                ? JSON.stringify(log.details.previousValue)
                                : String(log.details.previousValue)}
                            </span>
                          </div>
                        )}
                        {log.details.newValue !== undefined && (
                          <div className="py-1 border-b border-gray-100">
                            <span className="text-gray-500">变更后：</span>
                            <span className="text-green-600 ml-1">
                              {typeof log.details.newValue === 'object'
                                ? JSON.stringify(log.details.newValue)
                                : String(log.details.newValue)}
                            </span>
                          </div>
                        )}
                        {log.details.reason && (
                          <div className="py-1">
                            <span className="text-gray-500">原因：</span>
                            <span className="text-gray-700 ml-1">{log.details.reason}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-800 mb-2">最终总结</p>
            <div className="space-y-1 text-xs text-blue-700">
              <p>• 总帧数：{stats.totalFrames}</p>
              <p>• 点位数量：{stats.totalPoints}</p>
              <p>• 异常标记：{stats.anomalyPoints} 个</p>
              <p>• 坐标修正：{stats.totalCoordinateChanges} 次</p>
              <p>• 备注记录：{stats.totalNotes} 条</p>
              <p>• 保存快照：{snapshots.length} 个</p>
              <p>• 用户操作：{userActions.length} 次</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
