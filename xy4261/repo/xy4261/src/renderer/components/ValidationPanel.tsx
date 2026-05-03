import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { ValidationError } from '../../shared/models/types';

interface ValidationPanelProps {
  className?: string;
}

type FilterType = 'all' | 'error' | 'warning' | 'info';
type FilterCategory = 'all' | 'channel_conflict' | 'power_overload' | 'blackout_issue' | 'fade_conflict' | 'data_error';

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ className }) => {
  const { state } = useApp();
  const { ruleResult } = state;
  
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredErrors = useMemo(() => {
    if (!ruleResult) return [];
    
    const allIssues = [...ruleResult.errors, ...ruleResult.warnings];
    
    return allIssues.filter(issue => {
      if (filterType !== 'all') {
        if (filterType === 'error' && issue.severity !== 'error') return false;
        if (filterType === 'warning' && issue.severity !== 'warning') return false;
        if (filterType === 'info' && issue.severity !== 'info') return false;
      }
      
      if (filterCategory !== 'all' && issue.type !== filterCategory) {
        return false;
      }
      
      return true;
    });
  }, [ruleResult, filterType, filterCategory]);

  const stats = useMemo(() => {
    if (!ruleResult) return { errors: 0, warnings: 0, total: 0 };
    
    return {
      errors: ruleResult.errors.length,
      warnings: ruleResult.warnings.length,
      total: ruleResult.errors.length + ruleResult.warnings.length
    };
  }, [ruleResult]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'channel_conflict': return '🔌';
      case 'power_overload': return '⚡';
      case 'blackout_issue': return '🌑';
      case 'fade_conflict': return '🎚️';
      case 'data_error': return '📊';
      default: return '📋';
    }
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'channel_conflict': return '通道冲突';
      case 'power_overload': return '功率超载';
      case 'blackout_issue': return '黑场问题';
      case 'fade_conflict': return '淡变冲突';
      case 'data_error': return '数据错误';
      default: return '其他问题';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'error': return 'severity-error';
      case 'warning': return 'severity-warning';
      case 'info': return 'severity-info';
      default: return '';
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!ruleResult) {
    return (
      <div className={`validation-panel ${className || ''}`}>
        <div className="validation-empty">
          <div className="empty-icon">🔍</div>
          <h3>暂无验证结果</h3>
          <p>导入数据或修改项目后将自动运行验证</p>
        </div>

        <style>{`
          .validation-panel {
            display: flex;
            flex-direction: column;
            background-color: var(--bg-secondary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            height: 100%;
          }

          .validation-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
          }

          .validation-empty h3 {
            font-size: 16px;
            margin-bottom: 8px;
            color: var(--text-secondary);
          }

          .validation-empty p {
            font-size: 13px;
            color: var(--text-secondary);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`validation-panel ${className || ''}`}>
      <div className="validation-header">
        <div className="header-title">
          <h3>验证结果</h3>
          {stats.total > 0 && (
            <span className={`total-badge ${stats.errors > 0 ? 'has-errors' : ''}`}>
              {stats.total} 个问题
            </span>
          )}
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-icon">❌</span>
            <span className="stat-value">{stats.errors}</span>
            <span className="stat-label">错误</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">⚠️</span>
            <span className="stat-value">{stats.warnings}</span>
            <span className="stat-label">警告</span>
          </div>
        </div>
      </div>

      <div className="validation-filters">
        <div className="filter-group">
          <label>严重程度:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
          >
            <option value="all">全部</option>
            <option value="error">仅错误</option>
            <option value="warning">仅警告</option>
            <option value="info">仅信息</option>
          </select>
        </div>
        <div className="filter-group">
          <label>类型:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
          >
            <option value="all">全部类型</option>
            <option value="channel_conflict">通道冲突</option>
            <option value="power_overload">功率超载</option>
            <option value="blackout_issue">黑场问题</option>
            <option value="fade_conflict">淡变冲突</option>
            <option value="data_error">数据错误</option>
          </select>
        </div>
      </div>

      <div className="validation-content">
        {filteredErrors.length === 0 ? (
          <div className="no-issues">
            <div className="check-icon">✓</div>
            <h4>所有检查通过</h4>
            <p>当前筛选条件下没有发现问题</p>
          </div>
        ) : (
          <div className="issues-list">
            {filteredErrors.map((issue) => {
              const isExpanded = expandedId === issue.id;
              return (
                <div
                  key={issue.id}
                  className={`issue-item ${getSeverityClass(issue.severity)}`}
                  onClick={() => toggleExpand(issue.id)}
                >
                  <div className="issue-header">
                    <div className="issue-icon">{getSeverityIcon(issue.severity)}</div>
                    <div className="issue-main">
                      <div className="issue-title">
                        <span className="category-icon">{getCategoryIcon(issue.type)}</span>
                        <span>{issue.message}</span>
                      </div>
                      <div className="issue-meta">
                        <span className="category-label">{getCategoryLabel(issue.type)}</span>
                        <span className="severity-label">
                          {issue.severity === 'error' ? '错误' : issue.severity === 'warning' ? '警告' : '信息'}
                        </span>
                      </div>
                    </div>
                    <div className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                      ▼
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="issue-details">
                      <div className="detail-section">
                        <label>详细信息:</label>
                        <p>{issue.details}</p>
                      </div>
                      {issue.affectedItems.length > 0 && (
                        <div className="detail-section">
                          <label>影响项:</label>
                          <div className="affected-items">
                            {issue.affectedItems.map((item, idx) => (
                              <span key={idx} className="affected-item">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .validation-panel {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          height: 100%;
          overflow: hidden;
        }

        .validation-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .header-title h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .total-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          background-color: rgba(74, 222, 128, 0.2);
          color: var(--success);
        }

        .total-badge.has-errors {
          background-color: rgba(248, 113, 113, 0.2);
          color: var(--error);
        }

        .header-stats {
          display: flex;
          gap: 20px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
        }

        .stat-icon {
          font-size: 14px;
        }

        .stat-value {
          font-weight: 600;
        }

        .stat-label {
          color: var(--text-secondary);
        }

        .validation-filters {
          display: flex;
          gap: 16px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .filter-group select {
          padding: 4px 8px;
          font-size: 12px;
        }

        .validation-content {
          flex: 1;
          overflow-y: auto;
        }

        .no-issues {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          text-align: center;
        }

        .check-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(74, 222, 128, 0.2);
          color: var(--success);
          border-radius: 50%;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .no-issues h4 {
          font-size: 15px;
          margin-bottom: 4px;
          color: var(--success);
        }

        .no-issues p {
          font-size: 13px;
          color: var(--text-secondary);
        }

        .issues-list {
          display: flex;
          flex-direction: column;
        }

        .issue-item {
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .issue-item:hover {
          background-color: var(--bg-tertiary);
        }

        .issue-item.severity-error {
          border-left: 3px solid var(--error);
        }

        .issue-item.severity-warning {
          border-left: 3px solid var(--warning);
        }

        .issue-item.severity-info {
          border-left: 3px solid var(--info);
        }

        .issue-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
        }

        .issue-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .issue-main {
          flex: 1;
          min-width: 0;
        }

        .issue-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .category-icon {
          font-size: 14px;
        }

        .issue-meta {
          display: flex;
          gap: 8px;
          font-size: 11px;
        }

        .category-label {
          padding: 2px 6px;
          border-radius: 3px;
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .severity-label {
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
        }

        .severity-error .severity-label {
          background-color: rgba(248, 113, 113, 0.2);
          color: var(--error);
        }

        .severity-warning .severity-label {
          background-color: rgba(251, 191, 36, 0.2);
          color: var(--warning);
        }

        .severity-info .severity-label {
          background-color: rgba(96, 165, 250, 0.2);
          color: var(--info);
        }

        .expand-icon {
          font-size: 10px;
          color: var(--text-secondary);
          transition: transform 0.2s;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .issue-details {
          padding: 0 16px 12px 46px;
          font-size: 12px;
        }

        .detail-section {
          margin-bottom: 8px;
        }

        .detail-section:last-child {
          margin-bottom: 0;
        }

        .detail-section label {
          display: block;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .detail-section p {
          margin: 0;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .affected-items {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .affected-item {
          padding: 2px 8px;
          background-color: var(--bg-tertiary);
          border-radius: 3px;
          font-family: monospace;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};
