import { useState, useMemo } from 'react';
import { Clock, Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore';
import { getTimelineEvents, compareSnapshots } from '../services/timelineService';
import { StatusBadge } from '../components/StatusBadge';
import { AnomalyBadge } from '../components/AnomalyBadge';

export function Timeline() {
  const { snapshots, replaySnapshotId, replaySnapshot, loadState } = useSimulationStore();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(0);

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => a.simulationTime - b.simulationTime),
    [snapshots]
  );

  const timelineEvents = useMemo(
    () => getTimelineEvents(snapshots),
    [snapshots]
  );

  const maxTime = sortedSnapshots.length > 0
    ? sortedSnapshots[sortedSnapshots.length - 1].simulationTime
    : 100;

  const currentSnapshot = selectedSnapshotId
    ? sortedSnapshots.find((s) => s.id === selectedSnapshotId)
    : sliderValue > 0
    ? sortedSnapshots.findLast((s) => s.simulationTime <= sliderValue)
    : null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const handleReplay = () => {
    if (currentSnapshot) {
      replaySnapshot(currentSnapshot.id);
      setSelectedSnapshotId(currentSnapshot.id);
    }
  };

  const handleExitReplay = () => {
    replaySnapshot(null);
    setSelectedSnapshotId(null);
    setSliderValue(0);
    loadState();
  };

  const handleJumpToSnapshot = (snapshotId: string) => {
    const snapshot = sortedSnapshots.find((s) => s.id === snapshotId);
    if (snapshot) {
      setSliderValue(snapshot.simulationTime);
      setSelectedSnapshotId(snapshotId);
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'submission': return 'bg-blue-500';
      case 'anomaly': return 'bg-red-500';
      case 'window': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-semibold">时间线回看</h1>
          {replaySnapshotId && (
            <span className="badge text-blue-400 bg-blue-900/30 border-blue-500/50">
              回放模式
            </span>
          )}
        </div>
        {replaySnapshotId && (
          <button className="btn btn-danger" onClick={handleExitReplay}>
            <RotateCcw className="w-4 h-4 mr-2" />
            退出回放
          </button>
        )}
      </div>

      {sortedSnapshots.length === 0 ? (
        <div className="panel text-center py-12 text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无状态快照</p>
          <p className="text-sm mt-2">运行仿真后系统会自动生成状态快照</p>
        </div>
      ) : (
        <>
          <div className="panel mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400">仿真时间</div>
                <div className="font-mono text-2xl font-semibold text-amber-400">
                  {formatTime(currentSnapshot?.simulationTime || 0)}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  className="btn"
                  onClick={() => {
                    const idx = sortedSnapshots.findIndex((s) => s.id === selectedSnapshotId);
                    if (idx > 0) {
                      handleJumpToSnapshot(sortedSnapshots[idx - 1].id);
                    }
                  }}
                  disabled={!currentSnapshot || sortedSnapshots.indexOf(currentSnapshot) === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="btn"
                  onClick={handleReplay}
                  disabled={!currentSnapshot || replaySnapshotId === currentSnapshot.id}
                >
                  {replaySnapshotId === currentSnapshot?.id ? (
                    <><Pause className="w-4 h-4 mr-2" /> 正在回放</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> 回放此状态</>
                  )}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    const idx = sortedSnapshots.findIndex((s) => s.id === selectedSnapshotId);
                    if (idx < sortedSnapshots.length - 1) {
                      handleJumpToSnapshot(sortedSnapshots[idx + 1].id);
                    }
                  }}
                  disabled={!currentSnapshot || sortedSnapshots.indexOf(currentSnapshot) === sortedSnapshots.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="range"
                min="0"
                max={maxTime}
                value={sliderValue}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSliderValue(val);
                  const snapshot = sortedSnapshots.findLast((s) => s.simulationTime <= val);
                  if (snapshot) {
                    setSelectedSnapshotId(snapshot.id);
                  }
                }}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between mt-2 text-xs text-slate-500 font-mono">
                <span>{formatTime(0)}</span>
                <span>{formatTime(maxTime / 2)}</span>
                <span>{formatTime(maxTime)}</span>
              </div>
            </div>

            <div className="relative mt-6 h-8">
              <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-700" />
              {timelineEvents.map((event, idx) => {
                const position = (event.time / maxTime) * 100;
                const isSelected = currentSnapshot && Math.abs(currentSnapshot.simulationTime - event.time) < 1000;
                return (
                  <button
                    key={idx}
                    onClick={() => handleJumpToSnapshot(event.snapshotId)}
                    className={`absolute top-0 w-4 h-4 rounded-full -translate-x-1/2 transition-transform ${
                      getEventColor(event.type)
                    } ${isSelected ? 'scale-125 ring-2 ring-amber-400' : 'hover:scale-110'}`}
                    style={{ left: `${position}%` }}
                    title={`${formatTime(event.time)} - ${event.description}`}
                  />
                );
              })}
            </div>
          </div>

          {currentSnapshot && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="panel">
                  <h3 className="panel-header">
                    快照信息
                    <span className="ml-2 text-xs text-slate-500 font-mono">
                      {currentSnapshot.id.substring(0, 16)}...
                    </span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">仿真时间</div>
                      <div className="font-mono">{formatTime(currentSnapshot.simulationTime)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">实际时间</div>
                      <div className="text-xs">{formatDateTime(currentSnapshot.timestamp)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">数据哈希</div>
                      <div className="font-mono text-xs text-emerald-400">
                        {currentSnapshot.hash.substring(0, 16)}...
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <h3 className="panel-header">窗口状态</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {currentSnapshot.windows.map((window) => (
                      <div
                        key={window.id}
                        className="p-3 bg-slate-800/50 rounded border border-slate-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{window.name}</span>
                          <StatusBadge status={window.status} size="sm" />
                        </div>
                        {window.currentSubmissionId ? (
                          <div className="text-xs text-slate-400">
                            处理中: {currentSnapshot.submissions.find((s) => s.id === window.currentSubmissionId)?.teamName || '-'}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">空闲</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          排队: {window.queue.length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h3 className="panel-header">
                    提交记录 ({currentSnapshot.submissions.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {currentSnapshot.submissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          <StatusBadge status={sub.status} size="sm" />
                          <span className="text-sm">{sub.teamName}</span>
                          {sub.isResubmission && (
                            <span className="text-xs text-blue-400">⚠️</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {sub.anomalies.map((a) => (
                            <AnomalyBadge
                              key={a.id}
                              type={a.type}
                              severity={a.severity}
                              showLabel={false}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="panel">
                  <h3 className="panel-header">时间线事件</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                    {timelineEvents.map((event, idx) => {
                      const isSelected = currentSnapshot && Math.abs(currentSnapshot.simulationTime - event.time) < 1000;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleJumpToSnapshot(event.snapshotId)}
                          className={`w-full text-left p-2 rounded border transition-colors ${
                            isSelected
                              ? 'bg-amber-900/20 border-amber-600/50'
                              : 'bg-slate-800/30 border-transparent hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${getEventColor(event.type)}`} />
                            <span className="font-mono text-xs text-slate-400">
                              {formatTime(event.time)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1 ml-4">
                            {event.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {sortedSnapshots.length >= 2 && currentSnapshot && (
                  <div className="panel">
                    <h3 className="panel-header">与前一状态对比</h3>
                    {(() => {
                      const idx = sortedSnapshots.findIndex((s) => s.id === currentSnapshot.id);
                      if (idx === 0) {
                        return <div className="text-sm text-slate-500">这是第一个快照</div>;
                      }
                      const prev = sortedSnapshots[idx - 1];
                      const diff = compareSnapshots(prev, currentSnapshot);
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">时间差</span>
                            <span className="font-mono">{formatTime(diff.timeDiff)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">新增提交</span>
                            <span className="text-emerald-400">+{diff.submissionChanges.added.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">状态变更</span>
                            <span className="text-amber-400">{diff.submissionChanges.statusChanged.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">异常增量</span>
                            <span className={diff.anomalyCount > 0 ? 'text-red-400' : 'text-slate-400'}>
                              {diff.anomalyCount > 0 ? '+' : ''}{diff.anomalyCount}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
