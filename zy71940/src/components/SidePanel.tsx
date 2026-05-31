import { X, Clock, Database, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { formatDateTime, formatDuration } from '@/utils/timeUtils';
import { TIME_SOURCE_LABELS, TIME_SYSTEM_LABELS, WINDOW_STATUS_LABELS, CONFLICT_TYPE_LABELS } from '@/types';

export function SidePanel() {
  const { selectedWindowId, selectedConflictId, windows, conflicts, isSidePanelOpen } = useAppStore();
  const toggleSidePanel = useAppStore(state => state.toggleSidePanel);
  const selectWindow = useAppStore(state => state.selectWindow);
  const deleteWindow = useAppStore(state => state.deleteWindow);
  const resolveConflict = useAppStore(state => state.resolveConflict);

  const selectedWindow = windows.find(w => w.id === selectedWindowId);
  const selectedConflict = conflicts.find(c => c.id === selectedConflictId);
  const windowConflicts = selectedWindow 
    ? conflicts.filter(c => c.windowId1 === selectedWindow.id || c.windowId2 === selectedWindow.id)
    : [];

  if (!isSidePanelOpen) return null;

  const handleDeleteWindow = () => {
    if (selectedWindow && confirm(`确定要删除窗口 "${selectedWindow.satelliteName}" 吗？`)) {
      deleteWindow(selectedWindow.id);
    }
  };

  const handleResolveConflict = () => {
    if (selectedConflict) {
      resolveConflict(selectedConflict.id, '人工确认解决');
    }
  };

  return (
    <div className="w-80 h-full bg-space-900 border-l border-tech-cyan/20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-tech-cyan/20">
        <h2 className="font-orbitron text-sm text-tech-cyan uppercase tracking-wider">
          详情面板
        </h2>
        <button
          onClick={toggleSidePanel}
          className="p-1 hover:bg-space-800 rounded transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedWindow ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">
                  {selectedWindow.satelliteName}
                </h3>
                <span
                  className={`status-indicator ${
                    selectedWindow.status === 'NORMAL' ? 'status-normal' :
                    selectedWindow.status === 'CONFLICT' ? 'status-conflict' : 'status-warning'
                  }`}
                />
              </div>
              <p className="text-sm text-gray-400">
                {WINDOW_STATUS_LABELS[selectedWindow.status]}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-tech-cyan flex items-center gap-2">
                <Clock size={14} />
                时间信息
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">开始时间</span>
                  <span className="text-white font-mono">
                    {formatDateTime(selectedWindow.startTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">结束时间</span>
                  <span className="text-white font-mono">
                    {formatDateTime(selectedWindow.endTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">持续时长</span>
                  <span className="text-white font-mono">
                    {formatDuration(
                      new Date(selectedWindow.endTime).getTime() - 
                      new Date(selectedWindow.startTime).getTime()
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-tech-cyan flex items-center gap-2">
                <Database size={14} />
                数据来源
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">来源类型</span>
                  <span className="text-white">
                    {TIME_SOURCE_LABELS[selectedWindow.timeSource]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">时间制式</span>
                  <span className="text-white">
                    {TIME_SYSTEM_LABELS[selectedWindow.timeSystem]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">优先级</span>
                  <span className="text-white">{selectedWindow.priority}</span>
                </div>
              </div>
            </div>

            {selectedWindow.description && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-tech-cyan">描述</h4>
                <p className="text-sm text-gray-300">{selectedWindow.description}</p>
              </div>
            )}

            {windowConflicts.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-tech-red flex items-center gap-2">
                  <AlertTriangle size={14} />
                  相关冲突 ({windowConflicts.length})
                </h4>
                <div className="space-y-2">
                  {windowConflicts.map(conflict => (
                    <div
                      key={conflict.id}
                      className={`p-3 rounded border ${
                        conflict.status === 'DETECTED' 
                          ? 'bg-tech-red/10 border-tech-red/30'
                          : 'bg-tech-green/10 border-tech-green/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-tech-red">
                          {CONFLICT_TYPE_LABELS[conflict.type]}
                        </span>
                        <span className={`text-xs ${
                          conflict.status === 'DETECTED' ? 'text-tech-red' : 'text-tech-green'
                        }`}>
                          {conflict.status === 'DETECTED' ? '待处理' : '已解决'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mb-2">{conflict.reason}</p>
                      <p className="text-xs text-tech-cyan">下一步: {conflict.nextStep}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-tech-cyan/20 space-y-2">
              <button className="w-full btn-tech btn-danger" onClick={handleDeleteWindow}>
                <Trash2 size={14} className="inline mr-2" />
                删除窗口
              </button>
            </div>
          </div>
        ) : selectedConflict ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={20} className="text-tech-red" />
                <h3 className="text-lg font-bold text-white">
                  {CONFLICT_TYPE_LABELS[selectedConflict.type]}
                </h3>
              </div>
              <span className={`text-sm ${
                selectedConflict.status === 'DETECTED' ? 'text-tech-red' : 'text-tech-green'
              }`}>
                {selectedConflict.status === 'DETECTED' ? '待处理' : '已解决'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-space-800 rounded border border-tech-red/30">
                <h4 className="text-sm font-medium text-tech-red mb-2">问题原因</h4>
                <p className="text-sm text-gray-300">{selectedConflict.reason}</p>
              </div>

              <div className="p-3 bg-space-800 rounded border border-tech-orange/30">
                <h4 className="text-sm font-medium text-tech-orange mb-2">处理建议</h4>
                <p className="text-sm text-gray-300">{selectedConflict.suggestion}</p>
              </div>

              <div className="p-3 bg-space-800 rounded border border-tech-cyan/30">
                <h4 className="text-sm font-medium text-tech-cyan mb-2">下一步行动</h4>
                <p className="text-sm text-gray-300">{selectedConflict.nextStep}</p>
              </div>
            </div>

            {selectedConflict.status === 'DETECTED' && (
              <button className="w-full btn-tech btn-success" onClick={handleResolveConflict}>
                <CheckCircle size={14} className="inline mr-2" />
                标记为已解决
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Database size={48} className="mb-4 opacity-30" />
            <p className="text-sm">选择一个窗口或冲突查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}
