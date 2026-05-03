import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Subtitle, ValidationIssue } from '../types';
import { formatTimeDisplay } from '../utils/timeUtils';
import './SubtitleList.css';

interface SubtitleListProps {
  onSelectSubtitle: (subtitle: Subtitle) => void;
}

export function SubtitleList({ onSelectSubtitle }: SubtitleListProps) {
  const { state, dispatch } = useAppContext();
  const [filter, setFilter] = useState<'all' | 'has-issues' | 'modified'>('all');

  const filteredSubtitles = state.subtitles.filter((sub) => {
    if (filter === 'has-issues') {
      return state.validationIssues.some((i) => i.subtitleId === sub.id);
    }
    if (filter === 'modified') {
      return sub.isModified;
    }
    return true;
  });

  const getIssuesForSubtitle = (subtitleId: string): ValidationIssue[] => {
    return state.validationIssues.filter((i) => i.subtitleId === subtitleId);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '';
    }
  };

  const handleAutoFix = (subtitleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'AUTO_FIX_SUBTITLE', payload: subtitleId });
  };

  if (state.subtitles.length === 0) {
    return (
      <div className="subtitle-list-empty">
        <p>请先导入字幕文件</p>
      </div>
    );
  }

  return (
    <div className="subtitle-list-container">
      <div className="list-header">
        <h3>字幕列表</h3>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({state.subtitles.length})
          </button>
          <button
            className={`filter-tab ${filter === 'has-issues' ? 'active' : ''}`}
            onClick={() => setFilter('has-issues')}
          >
            有问题 ({state.validationIssues.length})
          </button>
          <button
            className={`filter-tab ${filter === 'modified' ? 'active' : ''}`}
            onClick={() => setFilter('modified')}
          >
            已修改 ({state.subtitles.filter((s) => s.isModified).length})
          </button>
        </div>
      </div>

      <div className="subtitle-list">
        {filteredSubtitles.map((subtitle) => {
          const issues = getIssuesForSubtitle(subtitle.id);
          const isSelected = state.selectedSubtitleId === subtitle.id;
          const hasIssue = issues.length > 0;

          return (
            <div
              key={subtitle.id}
              className={`subtitle-item ${isSelected ? 'selected' : ''} ${hasIssue ? 'has-issue' : ''} ${subtitle.isModified ? 'modified' : ''}`}
              onClick={() => onSelectSubtitle(subtitle)}
            >
              <div className="subtitle-item-header">
                <span className="subtitle-index">#{subtitle.index}</span>
                <div className="subtitle-status">
                  {subtitle.isModified && <span className="status-badge modified">✏️ 已修改</span>}
                  {hasIssue && (
                    <span className="status-badge issue">
                      ⚠️ {issues.length} 个问题
                    </span>
                  )}
                </div>
              </div>
              
              <div className="subtitle-time">
                <span className="time-label">开始:</span>
                <span className="time-value">{formatTimeDisplay(subtitle.startTime)}</span>
                <span className="time-separator">→</span>
                <span className="time-label">结束:</span>
                <span className="time-value">{formatTimeDisplay(subtitle.endTime)}</span>
              </div>

              <div className="subtitle-text">
                {subtitle.text}
              </div>

              {issues.length > 0 && (
                <div className="subtitle-issues">
                  {issues.map((issue) => (
                    <div key={issue.id} className={`issue-item ${issue.severity}`}>
                      <span className="issue-icon">{getSeverityColor(issue.severity)}</span>
                      <span className="issue-message">{issue.message}</span>
                    </div>
                  ))}
                  <button
                    className="auto-fix-btn"
                    onClick={(e) => handleAutoFix(subtitle.id, e)}
                  >
                    🔧 自动修正
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredSubtitles.length === 0 && (
        <div className="no-results">
          <p>没有符合筛选条件的字幕</p>
        </div>
      )}
    </div>
  );
}
