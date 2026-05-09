import { Event } from '../types';

interface Props {
  events: Event[];
}

export function EventHistory({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无操作历史</p>
      </div>
    );
  }

  const eventTypeLabels: Record<string, string> = {
    'BILL_CREATED': '创建账单',
    'BILL_UPDATED': '更新账单',
    'BILL_DELETED': '删除账单',
    'GROUP_CREATED': '创建群组',
    'GROUP_UPDATED': '更新群组',
    'GROUP_DELETED': '删除群组',
    'SYNC_STARTED': '开始同步',
    'SYNC_COMPLETED': '同步完成',
    'SYNC_FAILED': '同步失败',
    'CACHE_INVALIDATED': '缓存失效',
    'TRANSACTION_ROLLBACK': '事务回滚',
  };

  return (
    <div className="event-history">
      <h3>操作历史 (共 {events.length} 条记录)</h3>
      <div className="timeline">
        {events.map((event) => (
          <div key={event.id} className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="event-type">{eventTypeLabels[event.eventType] || event.eventType}</span>
                <span className="event-time">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              <div className="timeline-meta">
                <span>用户: {event.userId.slice(-6)}</span>
                <span>版本: {event.previousVersion} → {event.newVersion}</span>
                <span>聚合: {event.aggregateId.slice(-6)}</span>
              </div>
              <details>
                <summary>查看详情</summary>
                <pre className="event-payload">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
