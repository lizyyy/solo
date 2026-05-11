import { useEffect, useState } from 'react';
import { HistoryRecord } from '../types';
import { historyStorage } from '../storage';

const ENTITY_LABELS: Record<HistoryRecord['entityType'], string> = {
  screen: '屏幕',
  content: '内容',
  schedule: '排期',
};

const ACTION_LABELS: Record<HistoryRecord['action'], { label: string; color: string }> = {
  create: { label: '创建', color: '#22c55e' },
  update: { label: '更新', color: '#3b82f6' },
  delete: { label: '删除', color: '#ef4444' },
  cancel: { label: '撤销', color: '#f59e0b' },
  approve: { label: '通过', color: '#16a34a' },
  reject: { label: '拒绝', color: '#dc2626' },
  publish: { label: '发布', color: '#059669' },
};

export default function HistoryViewer() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [filter, setFilter] = useState<{
    entityType: string;
    action: string;
    keyword: string;
  }>({ entityType: '', action: '', keyword: '' });
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    setHistory(historyStorage.getAll().sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  }, []);

  const filteredHistory = history.filter(h => {
    const matchType = !filter.entityType || h.entityType === filter.entityType;
    const matchAction = !filter.action || h.action === filter.action;
    const matchKeyword = !filter.keyword || 
      h.description.includes(filter.keyword) || 
      h.operator.includes(filter.keyword);
    return matchType && matchAction && matchKeyword;
  });

  const formatDiff = (record: HistoryRecord) => {
    if (!record.beforeData && !record.afterData) return [];
    
    const changes: { field: string; before: string; after: string }[] = [];
    const keys = new Set([
      ...Object.keys(record.beforeData || {}),
      ...Object.keys(record.afterData || {}),
    ]);

    for (const key of keys) {
      const before = JSON.stringify(record.beforeData?.[key]);
      const after = JSON.stringify(record.afterData?.[key]);
      if (before !== after) {
        changes.push({
          field: key,
          before: before || '(空)',
          after: after || '(空)',
        });
      }
    }

    return changes;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>操作历史记录</h1>
        <div className="stats">共 {filteredHistory.length} 条记录</div>
      </div>

      <div className="filter-bar">
        <input
          placeholder="搜索描述/操作人"
          value={filter.keyword}
          onChange={e => setFilter({ ...filter, keyword: e.target.value })}
        />
        <select value={filter.entityType} onChange={e => setFilter({ ...filter, entityType: e.target.value })}>
          <option value="">全部类型</option>
          <option value="screen">屏幕</option>
          <option value="content">内容</option>
          <option value="schedule">排期</option>
        </select>
        <select value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })}>
          <option value="">全部动作</option>
          {Object.entries(ACTION_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>对象类型</th>
            <th>操作</th>
            <th>描述</th>
            <th>操作人</th>
            <th>变更详情</th>
          </tr>
        </thead>
        <tbody>
          {filteredHistory.map(record => {
            const changes = formatDiff(record);
            return (
              <tr key={record.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(record.timestamp).toLocaleString()}
                </td>
                <td>{ENTITY_LABELS[record.entityType]}</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: ACTION_LABELS[record.action].color }}
                  >
                    {ACTION_LABELS[record.action].label}
                  </span>
                </td>
                <td style={{ maxWidth: '300px' }}>{record.description}</td>
                <td>{record.operator}</td>
                <td>
                  {changes.length > 0 ? (
                    <button onClick={() => setSelectedRecord(record)}>
                      查看变更 ({changes.length})
                    </button>
                  ) : (
                    <span style={{ color: '#888' }}>-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filteredHistory.length === 0 && (
        <div className="empty-state">暂无操作记录</div>
      )}

      {selectedRecord && (
        <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-content large">
              <h2>变更详情</h2>
              <div className="detail-grid">
                <div><strong>时间：</strong>{new Date(selectedRecord.timestamp).toLocaleString()}</div>
                <div><strong>操作人：</strong>{selectedRecord.operator}</div>
                <div><strong>对象：</strong>{ENTITY_LABELS[selectedRecord.entityType]}</div>
                <div>
                  <strong>操作：</strong>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: ACTION_LABELS[selectedRecord.action].color }}
                  >
                    {ACTION_LABELS[selectedRecord.action].label}
                  </span>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>描述：</strong>{selectedRecord.description}
                </div>
              </div>

              <h3 style={{ marginTop: '16px' }}>字段变更</h3>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>变更前</th>
                    <th>变更后</th>
                  </tr>
                </thead>
                <tbody>
                  {formatDiff(selectedRecord).map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 'bold' }}>{c.field}</td>
                      <td className="diff-before">{c.before}</td>
                      <td className="diff-after">{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="modal-actions">
                <button onClick={() => setSelectedRecord(null)}>关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
