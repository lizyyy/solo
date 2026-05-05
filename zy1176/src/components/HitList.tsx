import React from 'react';
import { SensitiveHit, CATEGORY_LABELS } from '../types';

interface HitListProps {
  hits: SensitiveHit[];
  onUpdateStatus: (hitId: string, status: 'confirmed' | 'ignored') => void;
}

const HitList: React.FC<HitListProps> = ({ hits, onUpdateStatus }) => {
  const getCategoryClass = (category: string) => {
    const classes: Record<string, string> = {
      contact: 'cat-contact',
      identity: 'cat-identity',
      organization: 'cat-organization',
      finance: 'cat-finance',
      location: 'cat-location',
      other: 'cat-other',
    };
    return classes[category] || 'cat-other';
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.5) return 'confidence-medium';
    return 'confidence-low';
  };

  return (
    <div className="hit-list">
      {hits.length > 0 ? (
        hits.map(hit => (
          <div key={hit.id} className="hit-item">
            <div className="hit-header">
              <div className="hit-rule">
                <span className={`hit-category ${getCategoryClass(hit.category)}`}>
                  {CATEGORY_LABELS[hit.category as keyof typeof CATEGORY_LABELS] || hit.category}
                </span>
                <span className="hit-name">{hit.ruleName}</span>
              </div>
              <div className="hit-actions">
                {hit.status === 'pending' && (
                  <>
                    <button
                      className="btn btn-success"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => onUpdateStatus(hit.id, 'confirmed')}
                    >
                      ✓ 确认脱敏
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => onUpdateStatus(hit.id, 'ignored')}
                    >
                      ✕ 忽略
                    </button>
                  </>
                )}
                {hit.status === 'confirmed' && (
                  <span className="sensitive-tag tag-confirmed">已确认脱敏</span>
                )}
                {hit.status === 'ignored' && (
                  <span className="sensitive-tag tag-ignored">已忽略</span>
                )}
                {hit.status === 'processed' && (
                  <span className="file-status-badge status-completed" style={{ fontSize: '10px' }}>
                    已处理
                  </span>
                )}
              </div>
            </div>

            <div className="hit-content">
              <div className="hit-matched">
                <span className="hit-label">检测到:</span>
                <span className="hit-text">{hit.matchedText}</span>
              </div>
              <div className="hit-replacement">
                <span className="hit-label">替换为:</span>
                <span className="hit-text" style={{ background: '#f6ffed', color: '#52c41a' }}>
                  {hit.replacementText || '[敏感信息]'}
                </span>
              </div>
              {(hit.contextBefore || hit.contextAfter) && (
                <div className="hit-context">
                  <div className="hit-context-text">
                    {hit.contextBefore && <span>...{hit.contextBefore}</span>}
                    <span className="hit-context-highlight">{hit.matchedText}</span>
                    {hit.contextAfter && <span>{hit.contextAfter}...</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="hit-footer">
              {hit.lineNumber && (
                <span className="hit-line">行 {hit.lineNumber}</span>
              )}
              <div className="hit-confidence">
                <span>置信度:</span>
                <div className="confidence-bar">
                  <div 
                    className={`confidence-fill ${getConfidenceClass(hit.confidence)}`}
                    style={{ width: `${hit.confidence * 100}%` }}
                  />
                </div>
                <span>{(hit.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-icon">✨</div>
          <div className="empty-title">未检测到敏感信息</div>
          <div className="empty-desc">
            此文件未发现敏感信息，可以安全交付
          </div>
        </div>
      )}
    </div>
  );
};

export default HitList;
