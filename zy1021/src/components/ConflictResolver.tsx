import React from 'react';
import { Conflict, ConflictType } from '../types';
import { useAppContext } from '../context/AppContext';
import { getConflictDescription } from '../utils/versionControl';
import { formatTimestamp } from '../utils';
import './ConflictResolver.css';

const fieldNames: Record<string, string> = {
  riskLevel: '风险等级',
  status: '处理状态',
  notes: '备注',
  photoPlaceholder: '照片备注'
};

export const ConflictResolver: React.FC = () => {
  const { state } = useAppContext();
  const unresolvedConflicts = state.server.conflicts.filter(c => !c.resolved);
  const resolvedConflicts = state.server.conflicts.filter(c => c.resolved);

  return (
    <div className="conflict-resolver-container">
      <div className="conflict-resolver-header">
        <h3>冲突管理</h3>
        <div className="conflict-stats">
          <span className="unresolved-count">
            未解决: {unresolvedConflicts.length}
          </span>
          <span className="resolved-count">
            已解决: {resolvedConflicts.length}
          </span>
        </div>
      </div>

      <div className="conflict-resolver-content">
        {unresolvedConflicts.length === 0 && resolvedConflicts.length === 0 ? (
          <div className="conflict-empty">
            <p>暂无冲突记录</p>
          </div>
        ) : (
          <>
            {unresolvedConflicts.length > 0 && (
              <div className="conflict-section">
                <h4>未解决冲突</h4>
                <div className="conflict-list">
                  {unresolvedConflicts.map((conflict) => (
                    <ConflictItem key={conflict.id} conflict={conflict} />
                  ))}
                </div>
              </div>
            )}

            {resolvedConflicts.length > 0 && (
              <div className="conflict-section">
                <h4>已解决冲突</h4>
                <div className="conflict-list">
                  {resolvedConflicts.map((conflict) => (
                    <ResolvedConflictItem key={conflict.id} conflict={conflict} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface ConflictItemProps {
  conflict: Conflict;
}

const ConflictItem: React.FC<ConflictItemProps> = ({ conflict }) => {
  const { resolveConflict } = useAppContext();

  const handleSelectServer = () => {
    resolveConflict(conflict.id, conflict.serverChange.newValue, 'user');
  };

  const handleSelectClient = () => {
    resolveConflict(conflict.id, conflict.clientChange.newValue, 'user');
  };

  const handleSelectBoth = () => {
    const combinedValue = `${String(conflict.serverChange.newValue)} | ${String(conflict.clientChange.newValue)}`;
    resolveConflict(conflict.id, combinedValue, 'user');
  };

  return (
    <div className="conflict-item unresolved">
      <div className="conflict-header">
        <div className="conflict-type">
          <span className="conflict-icon">⚠️</span>
          <span className="conflict-type-label">
            {getConflictDescription(conflict.type)}
          </span>
        </div>
        <div className="conflict-meta">
          <span>冲突ID: {conflict.id.substring(0, 12)}...</span>
        </div>
      </div>

      <div className="conflict-details">
        <div className="conflict-field-info">
          <span>字段: {fieldNames[conflict.clientChange.field] || conflict.clientChange.field}</span>
          <span>巡检项: {conflict.clientChange.itemId.substring(0, 8)}...</span>
        </div>

        <div className="conflict-versions">
          <div className="version-card server">
            <div className="version-header">
              <span className="version-label">服务端版本</span>
              <span className="version-number">v{conflict.serverChange.version}</span>
            </div>
            <div className="version-info">
              <span>修改者: {conflict.serverChange.userId}</span>
              <span>{formatTimestamp(conflict.serverChange.timestamp)}</span>
            </div>
            <div className="version-value">
              <span className="value-label">当前值:</span>
              <span className="value-content">{String(conflict.serverChange.newValue) || '(空)'}</span>
            </div>
          </div>

          <div className="version-divider">
            <span>VS</span>
          </div>

          <div className="version-card client">
            <div className="version-header">
              <span className="version-label">客户端版本</span>
              <span className="version-number">v{conflict.clientChange.version}</span>
            </div>
            <div className="version-info">
              <span>修改者: {conflict.clientChange.userId}</span>
              <span>{formatTimestamp(conflict.clientChange.timestamp)}</span>
            </div>
            <div className="version-value">
              <span className="value-label">待同步值:</span>
              <span className="value-content">{String(conflict.clientChange.newValue) || '(空)'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="conflict-actions">
        <span className="action-label">选择保留哪个版本:</span>
        <div className="action-buttons">
          <button className="action-btn server-btn" onClick={handleSelectServer}>
            保留服务端版本
          </button>
          <button className="action-btn client-btn" onClick={handleSelectClient}>
            保留客户端版本
          </button>
          {conflict.type === ConflictType.SAME_FIELD_CONFLICT && (
            <button className="action-btn merge-btn" onClick={handleSelectBoth}>
              合并双方（用 | 分隔）
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface ResolvedConflictItemProps {
  conflict: Conflict;
}

const ResolvedConflictItem: React.FC<ResolvedConflictItemProps> = ({ conflict }) => {
  return (
    <div className="conflict-item resolved">
      <div className="conflict-header">
        <div className="conflict-type">
          <span className="conflict-icon resolved">✅</span>
          <span className="conflict-type-label">
            {getConflictDescription(conflict.type)} - 已解决
          </span>
        </div>
        <div className="conflict-meta">
          <span>解决时间: {conflict.resolvedAt ? formatTimestamp(conflict.resolvedAt) : '-'}</span>
        </div>
      </div>

      <div className="resolved-summary">
        <div className="summary-item">
          <span className="summary-label">服务端值:</span>
          <span className="summary-value">{String(conflict.serverChange.newValue) || '(空)'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">客户端值:</span>
          <span className="summary-value">{String(conflict.clientChange.newValue) || '(空)'}</span>
        </div>
        <div className="summary-item selected">
          <span className="summary-label">最终选择:</span>
          <span className="summary-value">{String(conflict.selectedValue) || '(空)'}</span>
        </div>
      </div>
    </div>
  );
};
