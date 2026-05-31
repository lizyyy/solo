import { useState } from 'react';
import { useTimelineStore } from '@/store/useTimelineStore';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { History, Camera, RotateCcw, Clock, Edit2, Trash2, ChevronRight, Save } from 'lucide-react';
import { formatDateTime, formatDateTimeFull } from '@/utils/time';

export function HistoryPanel() {
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const snapshots = useTimelineStore(state => state.snapshots);
  const corrections = useTimelineStore(state => state.corrections);
  const records = useTimelineStore(state => state.records);
  const currentSnapshotId = useTimelineStore(state => state.currentSnapshotId);
  const createSnapshot = useTimelineStore(state => state.createSnapshot);
  const restoreSnapshot = useTimelineStore(state => state.restoreSnapshot);
  const getRecordCorrections = useTimelineStore(state => state.getRecordCorrections);

  const recentCorrections = [...corrections]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const handleCreateSnapshot = () => {
    if (!snapshotDesc.trim()) {
      alert('请输入快照描述');
      return;
    }
    createSnapshot(snapshotDesc);
    setSnapshotDesc('');
  };

  const getRecordTitle = (recordId: string) => {
    return records.find(r => r.id === recordId)?.title || '未知记录';
  };

  const fieldLabels: Record<string, string> = {
    startTime: '开始时间',
    duration: '时长',
    title: '标题',
    description: '描述',
    status: '状态',
    type: '类型',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-body border-b border-border-primary">
        <h3 className="section-title flex items-center gap-2">
          <Camera className="w-4 h-4" />
          创建快照
        </h3>
        <input
          type="text"
          className="input-raw mb-2 text-xs"
          placeholder="快照描述，如：异常处理完成后、制作人复核前..."
          value={snapshotDesc}
          onChange={(e) => setSnapshotDesc(e.target.value)}
        />
        <Button variant="primary" className="w-full" onClick={handleCreateSnapshot}>
          <Save className="w-4 h-4" />
          保存当前状态快照
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {snapshots.length > 0 && (
          <div className="panel-body border-b border-border-primary">
            <h3 className="section-title flex items-center gap-2">
              <History className="w-4 h-4" />
              历史快照 ({snapshots.length})
            </h3>
            <div className="space-y-2">
              {[...snapshots].reverse().map((snapshot, index) => (
                <div
                  key={snapshot.id}
                  className={`p-2 border cursor-pointer transition-colors ${
                    currentSnapshotId === snapshot.id
                      ? 'border-status-manual bg-status-manualBg'
                      : selectedSnapshotId === snapshot.id
                      ? 'border-border-secondary bg-bg-tertiary'
                      : 'border-border-primary hover:bg-bg-tertiary/50'
                  }`}
                  onClick={() => setSelectedSnapshotId(selectedSnapshotId === snapshot.id ? null : snapshot.id)}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs text-text-primary flex-1 truncate">{snapshot.description}</span>
                    <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${selectedSnapshotId === snapshot.id ? 'rotate-90' : ''}`} />
                  </div>
                  <div className="code-text text-[10px] text-text-muted mt-1 ml-5.5">
                    {formatDateTime(snapshot.timestamp)} · {snapshot.records.length}条记录
                  </div>

                  {selectedSnapshotId === snapshot.id && (
                    <div className="mt-2 pt-2 border-t border-border-primary/50 ml-5.5">
                      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                        <div>
                          <span className="text-text-muted">已确认</span>
                          <p className="font-mono text-status-confirmed">
                            {snapshot.records.filter(r => r.status === 'confirmed').length}
                          </p>
                        </div>
                        <div>
                          <span className="text-text-muted">待补</span>
                          <p className="font-mono text-status-pending">
                            {snapshot.records.filter(r => r.status === 'pending').length}
                          </p>
                        </div>
                        <div>
                          <span className="text-text-muted">人工更正</span>
                          <p className="font-mono text-status-manual">
                            {snapshot.records.filter(r => r.status === 'manual').length}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定恢复到此快照？当前未保存的修改将丢失。')) {
                              restoreSnapshot(snapshot.id);
                            }
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          恢复此版本
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel-body">
          <h3 className="section-title flex items-center gap-2">
            <Edit2 className="w-4 h-4" />
            人工更正轨迹 ({corrections.length})
          </h3>
          {recentCorrections.length === 0 ? (
            <p className="text-xs text-text-muted">暂无更正记录</p>
          ) : (
            <div className="space-y-2">
              {recentCorrections.map((correction, index) => (
                <div
                  key={correction.id}
                  className="p-2 border border-border-primary bg-bg-secondary animate-stagger"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="manual" className="text-[9px]">
                      {fieldLabels[correction.fieldName] || correction.fieldName}
                    </Badge>
                    <span className="code-text text-[10px] text-text-muted ml-auto">
                      {formatDateTime(correction.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-text-primary mb-1 truncate">
                    {getRecordTitle(correction.recordId)}
                  </p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="code-text text-status-anomaly line-through">{correction.oldValue}</span>
                    <span className="text-text-muted">→</span>
                    <span className="code-text text-status-confirmed">{correction.newValue}</span>
                  </div>
                  {correction.reason && (
                    <p className="text-[10px] text-text-muted mt-1">原因: {correction.reason}</p>
                  )}
                  <p className="text-[10px] text-text-muted mt-0.5">操作人: {correction.operator}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border-primary bg-bg-tertiary">
        <div className="text-[10px] text-text-muted">
          <p>提示：快照用于保存关键时刻状态，方便随时回退</p>
        </div>
      </div>
    </div>
  );
}
