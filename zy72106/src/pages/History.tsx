import { useAppStore } from '@/store/useAppStore';
import { Trash2, RotateCcw, GitCompare, Clock, User, FileText } from 'lucide-react';
import { useState } from 'react';

export function History() {
  const {
    snapshots,
    selectedSnapshots,
    toggleSnapshotSelection,
    clearSelectedSnapshots,
    deleteSnapshot,
    loadSnapshot,
  } = useAppStore();

  const [compareView, setCompareView] = useState(false);

  const selectedSnapshotData = selectedSnapshots
    .map((id) => snapshots.find((s) => s.id === id))
    .filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">历史记录快照</h2>
          <p className="text-sm text-slate-400 mt-1">
            共 {snapshots.length} 条快照记录
          </p>
        </div>
        {selectedSnapshots.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">
              已选择 {selectedSnapshots.length} 条
            </span>
            <button
              onClick={() => setCompareView(!compareView)}
              disabled={selectedSnapshots.length < 2}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <GitCompare size={18} />
              对比选中
            </button>
            <button
              onClick={clearSelectedSnapshots}
              className="btn-secondary"
            >
              清除选择
            </button>
          </div>
        )}
      </div>

      {compareView && selectedSnapshotData.length >= 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-white">快照对比</h3>
          </div>
          <div className="card-body">
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${selectedSnapshotData.length}, 1fr)` }}>
              {selectedSnapshotData.map((snapshot) => (
                snapshot && (
                  <div key={snapshot.id} className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="font-medium text-white mb-3">{snapshot.name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">操作员:</span>
                        <span className="text-white">{snapshot.operator}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">创建时间:</span>
                        <span className="text-white">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">台站数:</span>
                        <span className="text-white">{snapshot.inputRecords.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">P波速度:</span>
                        <span className="text-white">{snapshot.params.pWaveVelocity} km/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">S波速度:</span>
                        <span className="text-white">{snapshot.params.sWaveVelocity} km/s</span>
                      </div>
                      {snapshot.result && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-400">震级:</span>
                            <span className="text-white">M {snapshot.result.magnitude.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">质量:</span>
                            <span className="text-white">{snapshot.result.quality}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-16">
            <FileText className="mx-auto text-slate-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">暂无历史记录</h3>
            <p className="text-slate-400">
              在计算工作台保存快照后，记录将显示在此处
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className={`card transition-all ${
                selectedSnapshots.includes(snapshot.id)
                  ? 'border-primary-500 ring-2 ring-primary-500/30'
                  : ''
              }`}
            >
              <div className="card-body">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedSnapshots.includes(snapshot.id)}
                    onChange={() => toggleSnapshotSelection(snapshot.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-slate-950"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white text-lg">
                        {snapshot.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSnapshot(snapshot.id)}
                          className="p-2 text-slate-400 hover:text-primary-400 transition-colors"
                          title="加载此快照"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button
                          onClick={() => deleteSnapshot(snapshot.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User size={14} className="text-slate-400" />
                        <span className="text-slate-400">操作员:</span>
                        <span className="text-white">{snapshot.operator}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-slate-400">创建:</span>
                        <span className="text-white">
                          {new Date(snapshot.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <FileText size={14} className="text-slate-400" />
                        <span className="text-slate-400">台站:</span>
                        <span className="text-white">{snapshot.inputRecords.length} 个</span>
                      </div>
                      {snapshot.result && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-400">震级:</span>
                          <span className="text-white font-mono">
                            M {snapshot.result.magnitude.toFixed(1)}
                          </span>
                          <span
                            className={`badge ${
                              snapshot.result.quality === 'excellent'
                                ? 'badge-success'
                                : snapshot.result.quality === 'good'
                                ? 'badge-info'
                                : snapshot.result.quality === 'fair'
                                ? 'badge-warning'
                                : 'badge-danger'
                            }`}
                          >
                            {snapshot.result.quality}
                          </span>
                        </div>
                      )}
                    </div>

                    {snapshot.notes && (
                      <p className="mt-3 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg">
                        {snapshot.notes}
                      </p>
                    )}

                    {snapshot.manualCorrections.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-400 mb-2">
                          人工修正 ({snapshot.manualCorrections.length} 处):
                        </p>
                        <div className="space-y-1">
                          {snapshot.manualCorrections.slice(0, 3).map((correction, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-amber-900/30 border border-amber-800 rounded px-3 py-1"
                            >
                              {correction.reason}
                            </div>
                          ))}
                          {snapshot.manualCorrections.length > 3 && (
                            <p className="text-xs text-slate-500">
                              还有 {snapshot.manualCorrections.length - 3} 处修正...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
