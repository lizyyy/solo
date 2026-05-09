import React from 'react';
import { ArchiveItem, ItemStatus } from '../../shared/types';

interface Props {
  items: ArchiveItem[];
  selectedIds: string[];
  statusFilter: 'all' | ItemStatus;
  onStatusFilterChange: (filter: 'all' | ItemStatus) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (item: ArchiveItem) => void;
  onDelete: (id: string) => void;
  onMarkReviewed: (id: string) => void;
  onMarkDelivered: (id: string) => void;
  onExport: () => void;
}

const statusLabels: Record<ItemStatus, string> = {
  pending: '待复核',
  reviewed: '已复核',
  delivered: '已交付',
  missing: '文件缺失'
};

const statusBadgeClasses: Record<ItemStatus, string> = {
  pending: 'status-badge-pending',
  reviewed: 'status-badge-reviewed',
  delivered: 'status-badge-delivered',
  missing: 'status-badge-pending'
};

const ItemList: React.FC<Props> = ({
  items,
  selectedIds,
  statusFilter,
  onStatusFilterChange,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onDelete,
  onMarkReviewed,
  onMarkDelivered,
  onExport
}) => {
  const allSelected = items.length > 0 && items.every(item => selectedIds.includes(item.id));

  const getFileName = (path: string | null): string => {
    if (!path) return '未提供';
    return path.split(/[\\/]/).pop() || path;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="list-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3>项目列表</h3>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as 'all' | ItemStatus)}
          >
            <option value="all">全部状态</option>
            <option value="pending">待复核</option>
            <option value="reviewed">已复核</option>
            <option value="delivered">已交付</option>
          </select>
        </div>
        <div className="btn-group">
          <button
            className="btn btn-secondary btn-small"
            onClick={onSelectAll}
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
          <button
            className="btn btn-primary btn-small"
            onClick={onExport}
            disabled={selectedIds.length === 0}
          >
            📄 导出清单 ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="item-list" style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>暂无项目数据</p>
            <p style={{ marginTop: 8, fontSize: 12 }}>请从左侧表单添加第一个项目</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className={`item-card status-${item.status} ${selectedIds.includes(item.id) ? 'selected' : ''}`}
            >
              <div className="item-header">
                <div className="item-title">
                  <input
                    type="checkbox"
                    className="item-checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                  />
                  <span className="item-name">{item.name}</span>
                  <span className="item-version">v{item.version}</span>
                </div>
                <span className={`item-status ${statusBadgeClasses[item.status]}`}>
                  {statusLabels[item.status]}
                </span>
              </div>

              <div className="item-files">
                <div className="file-row">
                  <span className="file-icon">🎬</span>
                  <span className="file-label">视频:</span>
                  <span className={`file-path ${!item.videoPath ? 'missing' : ''}`} title={item.videoPath || ''}>
                    {getFileName(item.videoPath)}
                  </span>
                </div>
                <div className="file-row">
                  <span className="file-icon">📝</span>
                  <span className="file-label">字幕:</span>
                  <span className={`file-path ${!item.subtitlePath ? 'missing' : ''}`} title={item.subtitlePath || ''}>
                    {getFileName(item.subtitlePath)}
                  </span>
                </div>
                <div className="file-row">
                  <span className="file-icon">📦</span>
                  <span className="file-label">压缩包:</span>
                  <span className={`file-path ${!item.archivePath ? 'missing' : ''}`} title={item.archivePath || ''}>
                    {getFileName(item.archivePath)}
                  </span>
                </div>
              </div>

              {item.notes && (
                <div style={{ fontSize: 12, color: '#666', marginBottom: 12, fontStyle: 'italic' }}>
                  💬 {item.notes}
                </div>
              )}

              <div className="item-meta">
                <div className="item-client">
                  👤 {item.clientName} | 🕐 {formatDate(item.createdAt)}
                  {item.deliveredAt && ` | ✅ 交付于 ${formatDate(item.deliveredAt)}`}
                </div>
                <div className="item-actions">
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => onEdit(item)}
                  >
                    ✏️ 编辑
                  </button>
                  {item.status === 'pending' && (
                    <button
                      className="btn btn-success btn-small"
                      onClick={() => onMarkReviewed(item.id)}
                    >
                      ✅ 标记已复核
                    </button>
                  )}
                  {item.status === 'reviewed' && (
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => onMarkDelivered(item.id)}
                    >
                      🚀 标记已交付
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => onDelete(item.id)}
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ItemList;
