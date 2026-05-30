import { useState } from 'react';
import { X, Camera, Play, Plus, Clock, User } from 'lucide-react';
import usePianoStore from '../../store/usePianoStore';

interface SnapshotModalProps {
  onClose: () => void;
}

export default function SnapshotModal({ onClose }: SnapshotModalProps) {
  const { snapshots, createSnapshot, loadSnapshot, currentSnapshot } = usePianoStore();
  const [showCreate, setShowCreate] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotReason, setSnapshotReason] = useState('');

  const handleCreate = () => {
    if (snapshotName.trim()) {
      createSnapshot(snapshotName, snapshotReason || '未填写原因', '当前用户');
      setSnapshotName('');
      setSnapshotReason('');
      setShowCreate(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedSnapshots = [...snapshots].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-100">数据快照</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!showCreate ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
              >
                <Plus size={20} />
                创建新快照
              </button>

              {sortedSnapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className={`p-4 rounded-xl border transition-all ${
                    currentSnapshot === snapshot.id
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        currentSnapshot === snapshot.id
                          ? 'bg-orange-500/20'
                          : 'bg-zinc-700'
                      }`}>
                        <Camera size={18} className={currentSnapshot === snapshot.id ? 'text-orange-400' : 'text-zinc-400'} />
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200">{snapshot.name}</div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(snapshot.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {snapshot.operator}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => loadSnapshot(snapshot.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                        currentSnapshot === snapshot.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      <Play size={12} />
                      {currentSnapshot === snapshot.id ? '当前' : '加载'}
                    </button>
                  </div>
                  {snapshot.reason && (
                    <p className="text-sm text-zinc-500 mt-2 pl-13">
                      {snapshot.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">快照名称</label>
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="例如：调律完成状态"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">处理理由</label>
                <textarea
                  value={snapshotReason}
                  onChange={(e) => setSnapshotReason(e.target.value)}
                  placeholder="记录创建此快照的原因..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!snapshotName.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  创建快照
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-700">
          <p className="text-xs text-zinc-500 text-center">
            快照保存完整的键盘数据状态，用于后续复盘和对比
          </p>
        </div>
      </div>
    </div>
  );
}
