import { useState } from 'react';
import { X, Save, RotateCcw, Trash2, Clock, User, AlertTriangle, FileText } from 'lucide-react';
import { useGaitStore } from '../../store/useGaitStore';
import { Snapshot } from '../../types';

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SnapshotModal({ isOpen, onClose }: SnapshotModalProps) {
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useGaitStore();
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [authorName, setAuthorName] = useState('阿乔');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (snapshotName.trim()) {
      createSnapshot(snapshotName.trim(), snapshotDesc.trim(), authorName);
      setSnapshotName('');
      setSnapshotDesc('');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[500px] max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Save size={20} className="text-blue-600" />
            快照管理
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 mb-3">创建新快照</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="快照名称"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="创建人"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <textarea
                placeholder="快照描述（可选）"
                value={snapshotDesc}
                onChange={(e) => setSnapshotDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
              />
              <button
                onClick={handleCreate}
                disabled={!snapshotName.trim()}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save size={16} />
                保存当前状态为快照
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              历史快照 ({snapshots.length})
            </h3>
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Save size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无快照记录</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...snapshots].reverse().map((snapshot: Snapshot) => (
                  <div
                    key={snapshot.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-medium text-gray-800">{snapshot.name}</h4>
                        {snapshot.description && (
                          <p className="text-xs text-gray-500 mt-1">{snapshot.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSnapshot(snapshot.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {snapshot.createdBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDate(snapshot.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-orange-600">
                        <AlertTriangle size={12} />
                        {snapshot.anomalyCount} 异常
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <FileText size={12} />
                        {snapshot.noteCount} 备注
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('确定要恢复到此快照吗？当前未保存的修改将丢失。')) {
                          restoreSnapshot(snapshot.id);
                          onClose();
                        }
                      }}
                      className="mt-2 w-full py-1.5 px-3 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <RotateCcw size={12} />
                      恢复到此快照
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
