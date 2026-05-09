import { Conflict } from '../types';

interface Props {
  conflicts: Conflict[];
  onResolve: (conflictId: string, strategy: string) => void;
}

export function ConflictList({ conflicts, onResolve }: Props) {
  if (conflicts.length === 0) {
    return (
      <div className="empty-state">
        <p>✓ 没有待解决的冲突</p>
        <p className="hint">系统数据一致性良好</p>
      </div>
    );
  }

  const conflictTypeLabels: Record<string, string> = {
    'version-mismatch': '版本不匹配',
    'concurrent-edit': '并发编辑',
    'data-inconsistency': '数据不一致',
  };

  return (
    <div className="conflict-list">
      <h3>待解决的冲突 ({conflicts.length})</h3>
      <div className="conflicts-container">
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="conflict-card">
            <div className="conflict-header">
              <span className="conflict-type">{conflictTypeLabels[conflict.type]}</span>
              <span className="conflict-time">
                {new Date(conflict.detectedAt).toLocaleString()}
              </span>
            </div>
            
            <div className="conflict-details">
              <p><strong>聚合ID:</strong> {conflict.aggregateId}</p>
              <p><strong>事件1:</strong> {conflict.eventId1}</p>
              <p><strong>事件2:</strong> {conflict.eventId2}</p>
            </div>
            
            <div className="conflict-actions">
              <button onClick={() => onResolve(conflict.id, 'last-write-wins')}>
                保留最新版本
              </button>
              <button onClick={() => onResolve(conflict.id, 'merge')}>
                手动合并
              </button>
              <button onClick={() => onResolve(conflict.id, 'reject')}>
                拒绝更改
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
